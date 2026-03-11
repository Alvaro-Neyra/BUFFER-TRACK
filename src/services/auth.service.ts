// ------------------------------------------------------------------
// Auth Service — Business Logic Layer
// Pattern: Service Layer
// Why: Encapsulates all authentication business logic (registration,
//      credential verification) separated from HTTP concerns.
//      API routes become thin wrappers that only parse input and
//      format output.
// ------------------------------------------------------------------

import bcrypt from 'bcryptjs';
import { UserRepository } from '@/repositories/user.repository';
import { ProjectRepository } from '@/repositories/project.repository';
import { roleRepository } from '@/repositories/role.repository';
import { SpecialtyRepository } from '@/repositories/specialty.repository';
import mongoose from 'mongoose';
import type { TRegisterInput, TLoginInput } from '@/schemas/auth.schema';

/** Result returned on successful registration. */
interface IRegisterResult {
    _id: string;
    email: string;
    role: string;
}

/** Result returned on successful credential verification. */
interface IVerifyResult {
    id: string;
    name: string;
    email: string;
    role: string;
    projects: Array<{ projectId: string; status: string; roleId?: string; specialtyId?: string }>;
    specialtyId?: string;
}

interface IUserProjectMembership {
    projectId: mongoose.Types.ObjectId;
    status: string;
    roleId?: mongoose.Types.ObjectId;
    specialtyId?: mongoose.Types.ObjectId;
}

export class AuthService {
    private static async resolveMembershipPatch(
        projectId: string,
        roleName: string,
        legacySpecialtyId: string | undefined,
        membership: IUserProjectMembership
    ): Promise<{ roleId?: string; specialtyId?: string }> {
        const patch: { roleId?: string; specialtyId?: string } = {};

        if (!membership.roleId) {
            const role = await roleRepository.findByNameInProject(roleName, projectId);
            if (role?._id) {
                patch.roleId = role._id.toString();
            }
        }

        if (!membership.specialtyId && legacySpecialtyId) {
            const specialty = await SpecialtyRepository.findByIdsInProject([legacySpecialtyId], projectId);
            if (specialty.length === 1) {
                patch.specialtyId = specialty[0]._id.toString();
            }
        }

        return patch;
    }

    /**
     * Register a new user.
     * Business rules:
     * 1. Locate the target project by ObjectId or connectionCode.
     * 2. Reject if email is already in use.
     * 3. Hash the password before persisting.
     * 4. New users start with project status 'Pending'.
     */
    static async registerUser(input: TRegisterInput): Promise<IRegisterResult> {
        const { name, email, password, roleId, projectId, company, specialtyId } = input;

        // Locate the target project
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(projectId);
        let targetProject = isObjectId
            ? await ProjectRepository.findById(projectId)
            : null;

        if (!targetProject) {
            targetProject = await ProjectRepository.findByConnectionCode(projectId);
        }

        if (!targetProject) {
            throw new ServiceError('Invalid project ID or connection code', 404);
        }

        const targetProjectId = targetProject._id.toString();

        // Validate role belongs to the resolved project
        const role = await roleRepository.getByIdInProject(roleId, targetProjectId);
        if (!role) {
            throw new ServiceError('Selected role is invalid for this project', 400);
        }

        const allowedSpecialtyIds = (role.specialtiesIds || []).map((id) => id.toString());
        let resolvedSpecialtyId: string | undefined;

        if (allowedSpecialtyIds.length > 0) {
            if (!specialtyId) {
                throw new ServiceError('Specialty is required for this role', 400);
            }

            if (!allowedSpecialtyIds.includes(specialtyId)) {
                throw new ServiceError('Selected specialty is not allowed for this role', 400);
            }

            resolvedSpecialtyId = specialtyId;
        } else if (specialtyId) {
            const specialtyCheck = await SpecialtyRepository.findByIdsInProject([specialtyId], targetProjectId);
            if (specialtyCheck.length !== 1) {
                throw new ServiceError('Selected specialty is invalid for this project', 400);
            }
            resolvedSpecialtyId = specialtyId;
        }

        // Check for duplicate email
        const existingUser = await UserRepository.findByEmail(email);
        if (existingUser) {
            throw new ServiceError('Email already in use', 409);
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Build user payload
        const newUserPayload: Record<string, unknown> = {
            name,
            email,
            password: hashedPassword,
            role: role.name,
            projects: [{
                projectId: targetProject._id,
                status: 'Pending',
                roleId: new mongoose.Types.ObjectId(role._id.toString()),
                ...(resolvedSpecialtyId ? { specialtyId: new mongoose.Types.ObjectId(resolvedSpecialtyId) } : {}),
            }],
        };

        if (company) newUserPayload.company = company;
        if (resolvedSpecialtyId) {
            // Legacy global field retained temporarily for backward compatibility.
            newUserPayload.specialtyId = resolvedSpecialtyId;
        }

        const user = await UserRepository.create(newUserPayload);

        return {
            _id: user._id.toString(),
            email: user.email,
            role: role.name,
        };
    }

    /**
     * Verify user credentials for login.
     * Returns session-ready data if credentials are valid.
     */
    static async verifyCredentials(input: TLoginInput): Promise<IVerifyResult> {
        const { email, password } = input;

        const user = await UserRepository.findByEmail(email, true);

        if (!user || !user.password) {
            throw new ServiceError('Invalid credentials', 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new ServiceError('Invalid credentials', 401);
        }

        const memberships = (user.projects || []) as IUserProjectMembership[];
        const normalizedProjects: IVerifyResult['projects'] = [];

        for (const membership of memberships) {
            const projectId = membership.projectId.toString();
            let roleId = membership.roleId?.toString();
            let specialtyId = membership.specialtyId?.toString();

            const patch = await this.resolveMembershipPatch(
                projectId,
                user.role,
                user.specialtyId?.toString(),
                membership
            );

            if (patch.roleId || patch.specialtyId) {
                await UserRepository.updateProjectMembership(user._id.toString(), projectId, {
                    ...(patch.roleId ? { roleId: patch.roleId } : {}),
                    ...(patch.specialtyId ? { specialtyId: patch.specialtyId } : {}),
                });
                roleId = roleId || patch.roleId;
                specialtyId = specialtyId || patch.specialtyId;
            }

            normalizedProjects.push({
                projectId,
                status: membership.status,
                ...(roleId ? { roleId } : {}),
                ...(specialtyId ? { specialtyId } : {}),
            });
        }

        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            projects: normalizedProjects,
            specialtyId: user.specialtyId?.toString(),
        };
    }
}

/**
 * Custom error class for service-level errors.
 * Carries an HTTP status code for the API route to use.
 */
export class ServiceError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number
    ) {
        super(message);
        this.name = 'ServiceError';
    }
}
