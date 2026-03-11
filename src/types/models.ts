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
