// ------------------------------------------------------------------
// Search Service — Business Logic Layer
// Pattern: Service Layer
// Why: Encapsulates project-scoped global search behavior for buildings
//      and activities, keeping route handlers thin.
// ------------------------------------------------------------------

import mongoose from 'mongoose';
import { BuildingRepository } from '@/repositories/building.repository';
import { AssignmentRepository } from '@/repositories/assignment.repository';
import type {
    IActivitySearchResultDTO,
    IBuildingSearchResultDTO,
    IGlobalSearchResultsDTO,
} from '@/types/models';

interface ISearchInActiveProjectInput {
    projectId: string;
    userId: string;
    query: string;
    limit: number;
    isManager: boolean;
}

interface IEntityWithObjectId {
    _id?: { toString: () => string } | string;
}

interface IBuildingReference extends IEntityWithObjectId {
    name?: string;
    code?: string;
}

interface IFloorReference extends IEntityWithObjectId {
    label?: string;
}

interface ISpecialtyReference extends IEntityWithObjectId {
    name?: string;
}

function toEntityIdString(entity: IEntityWithObjectId | null): string {
    if (!entity?._id) return '';
    return typeof entity._id === 'string' ? entity._id : entity._id.toString();
}

function asBuildingReference(value: unknown): IBuildingReference | null {
    if (!value || typeof value !== 'object') return null;
    return value as IBuildingReference;
}

function asFloorReference(value: unknown): IFloorReference | null {
    if (!value || typeof value !== 'object') return null;
    return value as IFloorReference;
}

function asSpecialtyReference(value: unknown): ISpecialtyReference | null {
    if (!value || typeof value !== 'object') return null;
    return value as ISpecialtyReference;
}

export class SearchService {
    static async searchInActiveProject({
        projectId,
        userId,
        query,
        limit,
        isManager,
    }: ISearchInActiveProjectInput): Promise<IGlobalSearchResultsDTO> {
        const effectiveLimit = Math.max(1, Math.min(20, limit));

        const visibilityFilter: Record<string, unknown> = {};
        if (!isManager) {
            if (!mongoose.isValidObjectId(userId)) {
                return { buildings: [], activities: [] };
            }

            const viewerObjectId = new mongoose.Types.ObjectId(userId);
            visibilityFilter.$or = [
                { requesterId: viewerObjectId },
            ];
        }

        const [buildings, activities] = await Promise.all([
            BuildingRepository.searchByProject(projectId, query, effectiveLimit),
            AssignmentRepository.searchByProject(projectId, query, effectiveLimit, visibilityFilter),
        ]);

        const serializedBuildings: IBuildingSearchResultDTO[] = buildings.map((building) => ({
            kind: 'building',
            id: String(building._id),
            name: building.name,
            code: building.code,
        }));

        const serializedActivities = activities
            .map((activity): IActivitySearchResultDTO | null => {
                const building = asBuildingReference(activity.buildingId);
                const floor = asFloorReference(activity.floorId);
                const specialty = asSpecialtyReference(activity.specialtyId);

                const floorId = toEntityIdString(floor);
                if (!floorId) return null;

                return {
                    kind: 'activity',
                    id: String(activity._id),
                    name: activity.description || 'Unnamed Activity',
                    status: activity.status,
                    buildingId: toEntityIdString(building),
                    buildingName: building?.name || 'Unknown Building',
                    buildingCode: building?.code || '',
                    floorId,
                    floorLabel: floor?.label || 'Unknown Floor',
                    specialtyName: specialty?.name || 'Unknown Specialty',
                };
            })
            .filter((activity): activity is IActivitySearchResultDTO => activity !== null);

        return {
            buildings: serializedBuildings,
            activities: serializedActivities,
        };
    }
}
