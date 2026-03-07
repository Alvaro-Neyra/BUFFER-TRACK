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
    floors: Array<{ _id: string; label: string; order: number }>;
}

/** Building with nested floors for admin panel. */
export interface IBuildingWithFloors {
    _id: string;
    name: string;
    code: string;
    number: number;
    coordinates: { xPercent: number; yPercent: number };
    floors: Array<{
        _id: string;
        label: string;
        order: number;
        gcsImageUrl: string;
    }>;
}

export class ProjectService {
    /**
     * Get the list of projects a user has access to.
     */
    static async getProjectsForUser(activeProjectIds: string[]): Promise<ISerializedProject[]> {
        if (activeProjectIds.length === 0) return [];

        const projects = await ProjectRepository.findByIds(activeProjectIds);

        return projects.map((p) => ({
            id: p._id.toString(),
            name: p.name,
        }));
    }

    /**
     * Get all buildings with floors, serialized for the master plan viewer component.
     */
    static async getBuildingsForMasterPlan(): Promise<ISerializedBuilding[]> {
        const buildings = await BuildingRepository.findAll();

        const result: ISerializedBuilding[] = [];
        for (const b of buildings) {
            const floors = await FloorRepository.findByBuildingId(b._id.toString());
            result.push({
                _id: b._id.toString(),
                projectId: b.projectId.toString(),
                name: b.name,
                code: b.code,
                number: b.number,
                coordinates: b.coordinates,
                floors: floors.map(f => ({
                    _id: f._id.toString(),
                    label: f.label,
                    order: f.order,
                })),
            });
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
            const floors = await FloorRepository.findByBuildingId(building._id.toString());
            result.push({
                _id: building._id.toString(),
                name: building.name,
                code: building.code,
                number: building.number,
                coordinates: building.coordinates,
                floors: floors.map((f) => ({
                    _id: f._id.toString(),
                    label: f.label,
                    order: f.order,
                    gcsImageUrl: f.gcsImageUrl,
                })),
            });
        }

        return result;
    }

    /**
     * Create a new building for a project.
     */
    static async createBuilding(
        projectId: string,
        data: { name: string; code: string; number: number; coordinates: { xPercent: number; yPercent: number } }
    ): Promise<IBuildingWithFloors> {
        const building = await BuildingRepository.create({
            projectId: new mongoose.Types.ObjectId(projectId),
            ...data,
        });

        return {
            _id: building._id.toString(),
            name: building.name,
            code: building.code,
            number: building.number,
            coordinates: building.coordinates,
            floors: [],
        };
    }

    /**
     * Update an existing building.
     */
    static async updateBuilding(
        buildingId: string,
        data: { name?: string; code?: string; number?: number; coordinates?: { xPercent: number; yPercent: number } }
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
