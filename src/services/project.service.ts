// ------------------------------------------------------------------
// Project Service — Business Logic Layer
// Pattern: Service Layer
// Why: Handles project and building management business logic.
// ------------------------------------------------------------------

import { ProjectRepository } from '@/repositories/project.repository';
import { BuildingRepository } from '@/repositories/building.repository';
import { FloorRepository } from '@/repositories/floor.repository';
import { CommitmentRepository } from '@/repositories/commitment.repository';
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
    }>;
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
        // Delete associated commitments
        await CommitmentRepository.deleteByQuery({ buildingId: new mongoose.Types.ObjectId(buildingId) });
        // Delete associated floors
        await FloorRepository.deleteByBuildingId(buildingId);
        // Delete the building itself
        await BuildingRepository.deleteById(buildingId);
    }

    /**
     * Create a new floor for a building.
     */
    static async createFloor(
        buildingId: string,
        data: { label: string; order: number; gcsImageUrl: string }
    ): Promise<{ _id: string; label: string; order: number; gcsImageUrl: string }> {
        const floor = await FloorRepository.create({
            buildingId: new mongoose.Types.ObjectId(buildingId),
            ...data,
        });

        return {
            _id: floor._id.toString(),
            label: floor.label,
            order: floor.order,
            gcsImageUrl: floor.gcsImageUrl,
        };
    }

    /**
     * Update an existing floor.
     */
    static async updateFloor(
        floorId: string,
        data: { label?: string; order?: number; gcsImageUrl?: string }
    ): Promise<void> {
        await FloorRepository.updateById(floorId, data);
    }

    /**
     * Delete a floor and its associated commitments.
     */
    static async deleteFloor(floorId: string): Promise<void> {
        await CommitmentRepository.deleteByQuery({ floorId: new mongoose.Types.ObjectId(floorId) });
        await FloorRepository.deleteById(floorId);
    }
}
