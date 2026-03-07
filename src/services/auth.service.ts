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
    projects: Array<{ projectId: string; status: string }>;
    specialtyId?: string;
}

export class AuthService {
    /**
     * Register a new user.
     * Business rules:
     * 1. Locate the target project by ObjectId or connectionCode.
     * 2. Reject if email is already in use.
     * 3. Hash the password before persisting.
     * 4. New users start with project status 'Pending'.
     */
    static async registerUser(input: TRegisterInput): Promise<IRegisterResult> {
        const { name, email, password, role, projectId, company, specialtyId } = input;

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
            role,
            projects: [{ projectId: targetProject._id, status: 'Pending' }],
        };

        if (company) newUserPayload.company = company;
        if (role === 'Subcontractor' && specialtyId) {
            newUserPayload.specialtyId = specialtyId;
        }

        const user = await UserRepository.create(newUserPayload);

        return {
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
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

        return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            projects: (user.projects || []).map((p) => ({
                projectId: p.projectId.toString(),
                status: p.status,
            })),
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
