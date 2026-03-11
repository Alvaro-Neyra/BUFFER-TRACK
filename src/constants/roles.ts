// ------------------------------------------------------------------
// Single source of truth for all application roles.
// Pattern: Constants Module
// Why: Eliminates duplicated inline role arrays scattered across
//      GlobalHeader, admin-users/page, admin-users/actions,
//      dashboard/actions, and RegisterView. Any role change only
//      needs to happen in this one file.
// ------------------------------------------------------------------

/** All valid roles in the system, ordered by authority level (descending). */
export const ROLES = [
    'Admin',
    'Project Director',
    'Project Manager',
    'Superintendent',
    'Production Manager',
    'Production Lead',
    'Production Engineer',
    'Coordinator',
    'Subcontractor',
] as const;

/** TypeScript union type derived from the ROLES constant. */
export type TRole = (typeof ROLES)[number];

/**
 * Roles that have manager-level permissions:
 * - Access to Admin Users panel
 * - Full Dashboard visibility (all specialties/subcontractors)
 * - Can accept/reject user access requests
 */
export const MANAGER_ROLES: readonly TRole[] = [
    'Admin',
    'Project Director',
    'Project Manager',
    'Superintendent',
    'Production Manager',
    'Production Lead',
    'Production Engineer',
] as const;

/** Check if a given role string has manager-level permissions. */
export function isManagerRole(role: string | undefined | null): boolean {
    if (!role) return false;
    return (MANAGER_ROLES as readonly string[]).includes(role);
}

/** Project membership statuses. */
export type TProjectStatus = 'Pending' | 'Active';

/** Commitment pin statuses for the plan viewer. */
export type TPinStatus = string;
