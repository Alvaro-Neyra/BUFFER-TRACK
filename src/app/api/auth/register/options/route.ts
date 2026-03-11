// ------------------------------------------------------------------
// Registration Options API Endpoint
// Pattern: Thin Route Handler
// Why: Resolve project-scoped role/specialty options from a project
//      connection code before registration is submitted.
// ------------------------------------------------------------------

import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/apiResponse';
import { ProjectRepository } from '@/repositories/project.repository';
import { roleRepository } from '@/repositories/role.repository';
import { SpecialtyRepository } from '@/repositories/specialty.repository';

const registerOptionsSchema = z.object({
    projectId: z
        .string({ error: 'Project code is required' })
        .min(1, 'Project code is required'),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = registerOptionsSchema.safeParse(body);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Validation failed';
            return apiError(firstError, 400);
        }

        const inputProject = parsed.data.projectId.trim();
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(inputProject);

        let project = isObjectId
            ? await ProjectRepository.findById(inputProject)
            : null;

        if (!project) {
            project = await ProjectRepository.findByConnectionCode(inputProject);
        }

        if (!project) {
            return apiError('Invalid project ID or connection code', 404);
        }

        const projectId = project._id.toString();

        const [roles, specialties] = await Promise.all([
            roleRepository.getByProjectId(projectId),
            SpecialtyRepository.findByProjectId(projectId),
        ]);

        return apiSuccess({
            projectId,
            projectName: project.name,
            roles: roles.map((role) => ({
                _id: role._id.toString(),
                projectId: role.projectId.toString(),
                name: role.name,
                isManager: role.isManager,
                specialtiesIds: (role.specialtiesIds || []).map((id) => id.toString()),
            })),
            specialties: specialties.map((specialty) => ({
                _id: specialty._id.toString(),
                projectId: specialty.projectId.toString(),
                name: specialty.name,
                colorHex: specialty.colorHex,
            })),
        });
    } catch (error) {
        console.error('Failed to resolve register options:', error);
        return apiError('Failed to load project options', 500);
    }
}
