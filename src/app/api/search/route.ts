// ------------------------------------------------------------------
// Global Header Search API Endpoint
// Pattern: Thin Route Handler → Service
// Why: Handles auth, query validation, and active project resolution;
//      delegates domain logic to SearchService.
// ------------------------------------------------------------------

import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/apiResponse';
import { globalSearchQuerySchema } from '@/schemas/search.schema';
import { roleRepository } from '@/repositories/role.repository';
import { SearchService } from '@/services/search.service';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return apiError('Unauthorized', 403);
        }

        const url = new URL(req.url);
        const parsed = globalSearchQuerySchema.safeParse({
            q: url.searchParams.get('q'),
            limit: url.searchParams.get('limit') ?? undefined,
        });

        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0]?.message || 'Invalid search query';
            return apiError(firstIssue, 400);
        }

        const activeMembership = session.user.projects?.find((project) => project.status === 'Active');
        if (!activeMembership) {
            return apiError('No active project found', 403);
        }

        if (!mongoose.isValidObjectId(activeMembership.projectId)) {
            return apiError('Invalid project context', 400);
        }

        const membershipRole = activeMembership.roleId
            ? await roleRepository.getByIdInProject(activeMembership.roleId, activeMembership.projectId)
            : null;

        const data = await SearchService.searchInActiveProject({
            projectId: activeMembership.projectId,
            userId: session.user.id,
            query: parsed.data.q,
            limit: parsed.data.limit,
            isManager: Boolean(membershipRole?.isManager),
        });

        return apiSuccess(data);
    } catch (error) {
        console.error('Global search request failed:', error);
        return apiError('Internal Server Error', 500);
    }
}
