// ------------------------------------------------------------------
// UserAdmin Service — Business Logic Layer
// Pattern: Service Layer
// Why: Encapsulates all user administration business logic
//      (listing users by project, accepting/rejecting access).
//      Separates authorization checks and data transformation
//      from the raw Mongoose queries in UserRepository.
// ------------------------------------------------------------------

import { UserRepository } from '@/repositories/user.repository';
import { roleRepository } from '@/repositories/role.repository';
import { SpecialtyRepository } from '@/repositories/specialty.repository';
import type { IUserDTO } from '@/types/models';

/** Result of fetching users for a project. */
interface IProjectUsersResult {
    pendingUsers: IUserDTO[];
    activeUsers: IUserDTO[];
}

export class UserAdminService {
    private static async backfillMembershipFields(userId: string, projectId: string): Promise<void> {
        const user = await UserRepository.findById(userId);
        if (!user) return;

        const membership = (user.projects || []).find(
            (projectMembership) => projectMembership.projectId.toString() === projectId
        );
        if (!membership) return;

        const patch: { roleId?: string; specialtyId?: string } = {};

        if (!membership.roleId) {
            const role = await roleRepository.findByNameInProject(user.role, projectId);
            if (role?._id) {
                patch.roleId = role._id.toString();
            }
        }

        if (!membership.specialtyId && user.specialtyId) {
            const specialty = await SpecialtyRepository.findByIdsInProject([user.specialtyId.toString()], projectId);
            if (specialty.length === 1) {
                patch.specialtyId = specialty[0]._id.toString();
            }
        }

        if (patch.roleId || patch.specialtyId) {
            await UserRepository.updateProjectMembership(userId, projectId, patch);
        }
    }

    /**
     * Fetch all users associated with a project, split into pending and active lists.
     * Excludes the current admin from the active list to prevent self-removal.
     */
    static async getUsersByProject(
        projectId: string,
        currentUserId: string
    ): Promise<IProjectUsersResult> {
        const usersInProject = await UserRepository.findByProjectId(projectId);

        const pendingUsers: IUserDTO[] = [];
        const activeUsers: IUserDTO[] = [];

        for (const user of usersInProject) {
            // Find membership for this specific project
            const memberships = (user.projects as unknown as Array<{
                projectId: { toString: () => string };
                status: 'Pending' | 'Active';
                roleId?: unknown;
                specialtyId?: unknown;
            }>) || [];
            const membership = memberships.find(
                (projectMembership) => projectMembership.projectId.toString() === projectId
            );
            if (!membership) continue;

            const mappedUser: IUserDTO = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                company: user.company || 'N/A',
                role: user.role,
                roleId: undefined,
                specialtyName: '',
                specialtyColor: '#cbd5e1',
                specialtyId: undefined,
            };

            // Project-scoped role and specialty with fallback to legacy global fields.
            const hasMembershipRoleRef = typeof membership.roleId !== 'undefined' && membership.roleId !== null;
            const membershipRole = membership.roleId;
            if (membershipRole && typeof membershipRole === 'object' && '_id' in membershipRole) {
                const populatedRole = membershipRole as { _id?: { toString: () => string }; name?: string };
                if (populatedRole._id) {
                    mappedUser.roleId = populatedRole._id.toString();
                }
                if (populatedRole.name) {
                    mappedUser.role = populatedRole.name;
                }
            } else if (typeof membershipRole === 'string') {
                mappedUser.roleId = membershipRole;
            } else if (
                membershipRole &&
                typeof membershipRole === 'object' &&
                'toString' in membershipRole &&
                typeof (membershipRole as { toString: () => string }).toString === 'function'
            ) {
                mappedUser.roleId = (membershipRole as { toString: () => string }).toString();
            } else if (!hasMembershipRoleRef) {
                // Legacy fallback only when membership role hasn't been migrated yet.
                mappedUser.role = user.role;
            }

            const hasMembershipSpecialtyRef = typeof membership.specialtyId !== 'undefined' && membership.specialtyId !== null;
            const membershipSpecialty = membership.specialtyId;
            if (membershipSpecialty && typeof membershipSpecialty === 'object' && '_id' in membershipSpecialty) {
                const populatedSpecialty = membershipSpecialty as {
                    _id?: { toString: () => string };
                    name?: string;
                    colorHex?: string;
                };
                if (populatedSpecialty._id) {
                    mappedUser.specialtyId = populatedSpecialty._id.toString();
                }
                mappedUser.specialtyName = populatedSpecialty.name || '';
                mappedUser.specialtyColor = populatedSpecialty.colorHex || '#cbd5e1';
            } else if (typeof membershipSpecialty === 'string') {
                mappedUser.specialtyId = membershipSpecialty;
            } else if (
                membershipSpecialty &&
                typeof membershipSpecialty === 'object' &&
                'toString' in membershipSpecialty &&
                typeof (membershipSpecialty as { toString: () => string }).toString === 'function'
            ) {
                mappedUser.specialtyId = (membershipSpecialty as { toString: () => string }).toString();
            } else {
                // Legacy fallback only when membership specialty hasn't been migrated yet.
                if (!hasMembershipSpecialtyRef) {
                    const legacySpecialty = user.specialtyId as unknown;
                    if (legacySpecialty && typeof legacySpecialty === 'object' && '_id' in legacySpecialty) {
                        const populatedLegacySpecialty = legacySpecialty as {
                            _id?: { toString: () => string };
                            name?: string;
                            colorHex?: string;
                        };
                        if (populatedLegacySpecialty._id) {
                            mappedUser.specialtyId = populatedLegacySpecialty._id.toString();
                        }
                        mappedUser.specialtyName = populatedLegacySpecialty.name || '';
                        mappedUser.specialtyColor = populatedLegacySpecialty.colorHex || '#cbd5e1';
                    }
                }
            }

            if (membership.status === 'Pending') {
                pendingUsers.push(mappedUser);
            } else if (membership.status === 'Active') {
                // Don't include the current admin in the removable list
                if (user._id.toString() !== currentUserId) {
                    activeUsers.push(mappedUser);
                }
            }
        }

        return { pendingUsers, activeUsers };
    }

    /**
     * Handle a user's project access: accept, reject, or remove.
     * Authorization must be checked by the caller (server action).
     */
    static async handleAccess(
        userId: string,
        projectId: string,
        action: 'accept' | 'reject' | 'remove'
    ): Promise<void> {
        if (action === 'accept') {
            await UserRepository.updateProjectStatus(userId, projectId, 'Active');
            await this.backfillMembershipFields(userId, projectId);
        } else {
            // Both 'reject' and 'remove' pull the user from the project
            await UserRepository.removeFromProject(userId, projectId);
        }
    }
}
