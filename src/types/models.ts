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
    company: string;
    specialtyName: string;
    specialtyColor: string;
}

/** Serialized project DTO for frontend components. */
export interface IProjectDTO {
    id: string;
    name: string;
}

/** Serialized specialty DTO for frontend components. */
export interface ISpecialtyDTO {
    id: string;
    name: string;
}

/** Project membership as stored in the user session. */
export interface IProjectMembership {
    projectId: string;
    status: 'Pending' | 'Active';
}
