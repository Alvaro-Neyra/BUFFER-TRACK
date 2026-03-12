// ------------------------------------------------------------------
// Shared Frontend Types and DTOs
// Pattern: Interface-based typing
// Why: AGENTS.md requires interfaces in `src/types/` with `I` prefix
//      for models and `T` prefix for utility types. These DTOs are
//      the serialized (string-id) versions of Mongoose documents
//      used by React components — never raw Mongoose documents.
// ------------------------------------------------------------------

export { type TRole, type TProjectStatus, type TPinStatus } from '@/constants/roles';

/** Serialized user DTO for frontend components. */
export interface IUserDTO {
    _id: string;
    name: string;
    email: string;
    role: string;
    roleId?: string;
    company: string;
    specialtyName: string;
    specialtyColor: string;
    specialtyId?: string;
}

/** Serialized project DTO for frontend components. */
export interface IProjectDTO {
    id: string;
    name: string;
}

/** Serialized status DTO for frontend components. */
export interface IStatusDTO {
    _id: string;
    name: string;
    colorHex: string;
    isPPC: boolean;
}

/** Serialized role DTO for frontend components. */
export interface IRoleDTO {
    _id: string;
    projectId: string;
    name: string;
    isManager: boolean;
    specialtiesIds: string[];
}

/** Serialized specialty DTO for frontend components. */
export interface ISpecialtyDTO {
    _id: string;
    projectId: string;
    name: string;
    colorHex: string;
}

/** Project membership as stored in the user session. */
export interface IProjectMembership {
    projectId: string;
    status: 'Pending' | 'Active';
    roleId?: string;
    specialtyId?: string;
}

/** Search result item for a building in the active project. */
export interface IBuildingSearchResultDTO {
    kind: 'building';
    id: string;
    name: string;
    code: string;
}

/** Search result item for an activity in the active project. */
export interface IActivitySearchResultDTO {
    kind: 'activity';
    id: string;
    name: string;
    customId?: string;
    location?: string;
    status: string;
    buildingId: string;
    buildingName: string;
    buildingCode: string;
    floorId: string;
    floorLabel: string;
    specialtyName: string;
}

/** Grouped global search payload for the header autocomplete. */
export interface IGlobalSearchResultsDTO {
    buildings: IBuildingSearchResultDTO[];
    activities: IActivitySearchResultDTO[];
}

/** Union for navigation handlers in the global header search. */
export type TGlobalSearchResultDTO = IBuildingSearchResultDTO | IActivitySearchResultDTO;
