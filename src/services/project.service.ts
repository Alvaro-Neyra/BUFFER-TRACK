// ------------------------------------------------------------------
// Project Service — Business Logic Layer
// Pattern: Service Layer
// Why: Handles project and building management business logic.
// ------------------------------------------------------------------

import { ProjectRepository } from '@/repositories/project.repository';
import { BuildingRepository } from '@/repositories/building.repository';
import { FloorRepository } from '@/repositories/floor.repository';
import { CommitmentRepository } from '@/repositories/commitment.repository';
import { deleteCloudinaryAsset, extractCloudinaryPublicId } from '@/lib/cloudinary';
import { isRedListEnabled as resolveRedListEnabled } from '@/lib/projectFeatures';
import mongoose from 'mongoose';

/** Serialized project for frontend components. */
interface ISerializedProject {
    id: string;
    name: string;
}

/** Serialized building for frontend components (including floors for selector). */
interface ISerializedBuilding {
    _id: string;
    projectId: string;
    name: string;
    code: string;
    number: number;
    coordinates: { xPercent: number; yPercent: number };
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    color?: string;
    floors: Array<{ _id: string; label: string; order: number }>;
}

/** Building with nested floors for admin panel. */
export interface IBuildingWithFloors {
    _id: string;
    name: string;
    code: string;
    number: number;
    coordinates: { xPercent: number; yPercent: number };
    polygon?: Array<{ xPercent: number; yPercent: number }>;
    color?: string;
    floors: Array<{
        _id: string;
        label: string;
        order: number;
        gcsImageUrl: string;
        cloudinaryPublicId?: string;
    }>;
}

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function resolveCloudinaryPublicId(imageUrl: string, cloudinaryPublicId?: string): string | undefined {
    return normalizeOptionalString(cloudinaryPublicId) ?? extractCloudinaryPublicId(imageUrl) ?? undefined;
}

function serializeBuildingForMasterPlan(b: Record<string, unknown>): ISerializedBuilding {
    return {
        _id: String(b._id),
        projectId: String(b.projectId),
        name: String(b.name),
        code: String(b.code),
        number: Number(b.number),
        coordinates: {
            xPercent: Number(b.coordinates && (b.coordinates as Record<string, unknown>).xPercent),
            yPercent: Number(b.coordinates && (b.coordinates as Record<string, unknown>).yPercent),
        },
        polygon: Array.isArray(b.polygon) && b.polygon.length >= 3
            ? b.polygon.map((p: unknown) => ({
                xPercent: Number((p as Record<string, unknown>).xPercent),
                yPercent: Number((p as Record<string, unknown>).yPercent),
            }))
            : undefined,
        color: b.color ? String(b.color) : undefined,
        floors: [],
    };
}

function serializeBuildingWithFloors(b: Record<string, unknown>): IBuildingWithFloors {
    return {
        _id: String(b._id),
        name: String(b.name),
        code: String(b.code),
        number: Number(b.number),
        coordinates: {
            xPercent: Number(b.coordinates && (b.coordinates as Record<string, unknown>).xPercent),
            yPercent: Number(b.coordinates && (b.coordinates as Record<string, unknown>).yPercent),
        },
        polygon: Array.isArray(b.polygon) && b.polygon.length >= 3
            ? b.polygon.map((p: unknown) => ({
                xPercent: Number((p as Record<string, unknown>).xPercent),
                yPercent: Number((p as Record<string, unknown>).yPercent),
            }))
            : undefined,
        color: b.color ? String(b.color) : undefined,
        floors: [],
    };
}

export class ProjectService {
    /**
     * Resolve whether Red List is enabled for a specific project.
     * Defaults to true for backward compatibility with legacy projects.
     */
    static async isRedListEnabled(projectId: string): Promise<boolean> {
        const project = await ProjectRepository.findById(projectId);
        return resolveRedListEnabled(project);
    }

    /**
     * Get the list of projects a user has access to.
     */
    static async getProjectsForUser(activeProjectIds: string[]): Promise<ISerializedProject[]> {
        if (activeProjectIds.length === 0) return [];

        const projects = await ProjectRepository.findByIds(activeProjectIds);

        return projects.map((p) => ({
            id: String(p._id),
            name: String(p.name),
        }));
    }

    /**
     * Get all buildings with floors, serialized for the master plan viewer component.
     */
    static async getBuildingsForMasterPlan(): Promise<ISerializedBuilding[]> {
        const buildings = await BuildingRepository.findAll();

        const result: ISerializedBuilding[] = [];
        for (const b of buildings) {
            const serialized = serializeBuildingForMasterPlan(b as unknown as Record<string, unknown>);
            const floors = await FloorRepository.findByBuildingId(serialized._id);
            serialized.floors = floors.map(f => ({
                _id: String(f._id),
                label: String(f.label),
                order: Number(f.order),
            }));
            result.push(serialized);
        }

        return result;
    }


    /**
     * Get buildings with their nested floors for the admin panel.
     */
    static async getBuildingsWithFloors(projectId: string): Promise<IBuildingWithFloors[]> {
        const buildings = await BuildingRepository.findByProjectId(projectId);

        const result: IBuildingWithFloors[] = [];
        for (const building of buildings) {
            const serialized = serializeBuildingWithFloors(building as unknown as Record<string, unknown>);
            const floors = await FloorRepository.findByBuildingId(serialized._id);
            serialized.floors = floors.map(f => ({
                _id: String(f._id),
                label: String(f.label),
                order: Number(f.order),
                gcsImageUrl: String(f.gcsImageUrl),
                cloudinaryPublicId: normalizeOptionalString(f.cloudinaryPublicId),
            }));
            result.push(serialized);
        }

        return result;
    }

    /**
     * Create a new building for a project.
     */
    static async createBuilding(
        projectId: string,
        data: {
            name: string;
            code: string;
            number: number;
            coordinates: { xPercent: number; yPercent: number };
            polygon?: Array<{ xPercent: number; yPercent: number }>;
            color?: string;
        }
    ): Promise<IBuildingWithFloors> {
        const building = await BuildingRepository.create({
            projectId: new mongoose.Types.ObjectId(projectId),
            ...data,
        });

        return serializeBuildingWithFloors(building as unknown as Record<string, unknown>);
    }

    /**
     * Update an existing building.
     */
    static async updateBuilding(
        buildingId: string,
        data: { name?: string; code?: string; number?: number; color?: string; coordinates?: { xPercent: number; yPercent: number } }
    ): Promise<void> {
        await BuildingRepository.updateById(buildingId, data);
    }

    /**
     * Delete a building and cascade to its floors and commitments.
     */
    static async deleteBuilding(buildingId: string): Promise<void> {
        const floors = await FloorRepository.findByBuildingId(buildingId);

        // Delete associated commitments
        await CommitmentRepository.deleteByQuery({ buildingId: new mongoose.Types.ObjectId(buildingId) });
        // Delete associated floors
        await FloorRepository.deleteByBuildingId(buildingId);
        // Delete the building itself
        await BuildingRepository.deleteById(buildingId);

        await Promise.all(
            floors.map((floor) =>
                deleteCloudinaryAsset({
                    url: floor.gcsImageUrl,
                    publicId: floor.cloudinaryPublicId,
                    context: `delete-building-floor:${buildingId}`,
                })
            )
        );
    }

    /**
     * Create a new floor for a building.
     */
    static async createFloor(
        buildingId: string,
        data: { label: string; order: number; gcsImageUrl: string; cloudinaryPublicId?: string }
    ): Promise<{ _id: string; label: string; order: number; gcsImageUrl: string; cloudinaryPublicId?: string }> {
        const cloudinaryPublicId = resolveCloudinaryPublicId(data.gcsImageUrl, data.cloudinaryPublicId);

        const floor = await FloorRepository.create({
            buildingId: new mongoose.Types.ObjectId(buildingId),
            label: data.label,
            order: data.order,
            gcsImageUrl: data.gcsImageUrl,
            ...(cloudinaryPublicId ? { cloudinaryPublicId } : {}),
        });

        return {
            _id: floor._id.toString(),
            label: floor.label,
            order: floor.order,
            gcsImageUrl: floor.gcsImageUrl,
            cloudinaryPublicId: normalizeOptionalString(floor.cloudinaryPublicId),
        };
    }

    /**
     * Update an existing floor.
     */
    static async updateFloor(
        floorId: string,
        data: { label?: string; order?: number; gcsImageUrl?: string; cloudinaryPublicId?: string }
    ): Promise<void> {
        const existingFloor = await FloorRepository.findById(floorId);
        if (!existingFloor) {
            throw new Error('Floor not found');
        }

        const updatePayload: Record<string, unknown> = {};

        if (typeof data.label === 'string') {
            updatePayload.label = data.label;
        }

        if (typeof data.order === 'number') {
            updatePayload.order = data.order;
        }

        const nextImageUrl = normalizeOptionalString(data.gcsImageUrl);
        const hasImageUpdate = Boolean(nextImageUrl && nextImageUrl !== existingFloor.gcsImageUrl);

        if (hasImageUpdate && nextImageUrl) {
            updatePayload.gcsImageUrl = nextImageUrl;

            const nextPublicId = resolveCloudinaryPublicId(nextImageUrl, data.cloudinaryPublicId);
            updatePayload.cloudinaryPublicId = nextPublicId ?? null;
        } else {
            const nextPublicId = normalizeOptionalString(data.cloudinaryPublicId);
            if (nextPublicId && nextPublicId !== existingFloor.cloudinaryPublicId) {
                updatePayload.cloudinaryPublicId = nextPublicId;
            }
        }

        if (Object.keys(updatePayload).length === 0) {
            return;
        }

        await FloorRepository.updateById(floorId, updatePayload);

        if (hasImageUpdate) {
            await deleteCloudinaryAsset({
                url: existingFloor.gcsImageUrl,
                publicId: existingFloor.cloudinaryPublicId,
                context: `replace-floor-image:${floorId}`,
            });
        }
    }

    /**
     * Delete a floor and its associated commitments.
     */
    static async deleteFloor(floorId: string): Promise<void> {
        const floor = await FloorRepository.findById(floorId);
        if (!floor) {
            return;
        }

        await CommitmentRepository.deleteByQuery({ floorId: new mongoose.Types.ObjectId(floorId) });
        await FloorRepository.deleteById(floorId);

        await deleteCloudinaryAsset({
            url: floor.gcsImageUrl,
            publicId: floor.cloudinaryPublicId,
            context: `delete-floor:${floorId}`,
        });
    }
}
