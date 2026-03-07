// ------------------------------------------------------------------
// UserAdmin Service — Business Logic Layer
// Pattern: Service Layer
// Why: Encapsulates all user administration business logic
//      (listing users by project, accepting/rejecting access).
//      Separates authorization checks and data transformation
//      from the raw Mongoose queries in UserRepository.
// ------------------------------------------------------------------

import { UserRepository } from '@/repositories/user.repository';
import type { IUserDTO } from '@/types/models';

/** Result of fetching users for a project. */
interface IProjectUsersResult {
    pendingUsers: IUserDTO[];
    activeUsers: IUserDTO[];
}

export class UserAdminService {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const membership = (user.projects as any[])?.find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (p: any) => p.projectId.toString() === projectId
            );
            if (!membership) continue;

            const mappedUser: IUserDTO = {
                _id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company || 'N/A',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                specialtyName: (user.specialtyId as any)?.name || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                specialtyColor: (user.specialtyId as any)?.color || '#cbd5e1',
            };

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
        } else {
            // Both 'reject' and 'remove' pull the user from the project
            await UserRepository.removeFromProject(userId, projectId);
        }
    }
}
