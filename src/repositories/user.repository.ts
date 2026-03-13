// ------------------------------------------------------------------
// User Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Decouples all User-related Mongoose queries from business logic.
//      Any file needing user data calls this repository, never the model directly.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import User, { type IUser } from '@/models/User';
import mongoose from 'mongoose';

export class UserRepository {
    /** Ensure database connection before any query. */
    private static async connect() {
        await connectToDatabase();
    }

    /** Find a user by email. Optionally include the password field. */
    static async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
        await this.connect();
        const query = User.findOne({ email });
        if (includePassword) query.select('+password');
        return query.lean() as Promise<IUser | null>;
    }

    /** Find a user by their ObjectId. */
    static async findById(id: string): Promise<IUser | null> {
        await this.connect();
        return User.findById(id).lean() as Promise<IUser | null>;
    }

    /** Update editable profile fields for a user. */
    static async updateProfile(
        userId: string,
        data: { name: string; company?: string }
    ): Promise<void> {
        await this.connect();

        const trimmedCompany = data.company?.trim();

        if (trimmedCompany) {
            await User.updateOne(
                { _id: new mongoose.Types.ObjectId(userId) },
                {
                    $set: {
                        name: data.name,
                        company: trimmedCompany,
                    },
                }
            );
            return;
        }

        await User.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
                $set: {
                    name: data.name,
                },
                $unset: {
                    company: "",
                },
            }
        );
    }

    /** Create a new user document. */
    static async create(payload: Record<string, unknown>): Promise<IUser> {
        await this.connect();
        return User.create(payload) as Promise<IUser>;
    }

    /** Find all users that belong to a specific project (any status). Populates specialty. */
    static async findByProjectId(projectId: string): Promise<IUser[]> {
        await this.connect();
        return User.find({
            'projects.projectId': new mongoose.Types.ObjectId(projectId),
        })
            .populate('specialtyId', 'name colorHex projectId')
            .populate('projects.roleId', 'name isManager specialtiesIds projectId')
            .populate('projects.specialtyId', 'name colorHex projectId')
            .lean() as Promise<IUser[]>;
    }

    /** Update a user's project membership status (e.g., Pending → Active). */
    static async updateProjectStatus(
        userId: string,
        projectId: string,
        status: 'Pending' | 'Active'
    ): Promise<void> {
        await this.connect();
        await User.updateOne(
            {
                _id: new mongoose.Types.ObjectId(userId),
                'projects.projectId': new mongoose.Types.ObjectId(projectId),
            },
            { $set: { 'projects.$.status': status } }
        );
    }

    /** Update per-project membership fields (role/specialty/status) for a user. */
    static async updateProjectMembership(
        userId: string,
        projectId: string,
        data: { status?: 'Pending' | 'Active'; roleId?: string | null; specialtyId?: string | null }
    ): Promise<void> {
        await this.connect();

        const setPayload: Record<string, unknown> = {};
        if (typeof data.status !== 'undefined') setPayload['projects.$.status'] = data.status;
        if (typeof data.roleId !== 'undefined') {
            setPayload['projects.$.roleId'] = data.roleId ? new mongoose.Types.ObjectId(data.roleId) : null;
        }
        if (typeof data.specialtyId !== 'undefined') {
            setPayload['projects.$.specialtyId'] = data.specialtyId ? new mongoose.Types.ObjectId(data.specialtyId) : null;
        }

        if (Object.keys(setPayload).length === 0) return;

        await User.updateOne(
            {
                _id: new mongoose.Types.ObjectId(userId),
                'projects.projectId': new mongoose.Types.ObjectId(projectId),
            },
            { $set: setPayload }
        );
    }

    /** Remove a user from a project entirely (reject or revoke access). */
    static async removeFromProject(userId: string, projectId: string): Promise<void> {
        await this.connect();
        await User.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            { $pull: { projects: { projectId: new mongoose.Types.ObjectId(projectId) } } }
        );
    }

    /** Find users by an array of ObjectIds with selected fields. */
    static async findByIds(ids: string[], selectFields = ''): Promise<IUser[]> {
        await this.connect();
        const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
        return User.find({ _id: { $in: objectIds } })
            .select(selectFields)
            .lean() as Promise<IUser[]>;
    }

    /** Count users in a project that currently use a specific role in membership. */
    static async countByProjectRole(projectId: string, roleId: string): Promise<number> {
        await this.connect();
        return User.countDocuments({
            projects: {
                $elemMatch: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    roleId: new mongoose.Types.ObjectId(roleId),
                },
            },
        });
    }

    /** Count project users still relying on legacy global role string. */
    static async countLegacyByProjectRoleName(projectId: string, roleName: string): Promise<number> {
        await this.connect();
        return User.countDocuments({
            role: roleName,
            projects: {
                $elemMatch: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    roleId: { $exists: false },
                },
            },
        });
    }

    /** Count users in a project that currently use a specific specialty in membership. */
    static async countByProjectSpecialty(projectId: string, specialtyId: string): Promise<number> {
        await this.connect();
        return User.countDocuments({
            projects: {
                $elemMatch: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    specialtyId: new mongoose.Types.ObjectId(specialtyId),
                },
            },
        });
    }

    /** Count project users still relying on legacy global specialty assignment. */
    static async countLegacyByProjectSpecialty(projectId: string, specialtyId: string): Promise<number> {
        await this.connect();
        return User.countDocuments({
            specialtyId: new mongoose.Types.ObjectId(specialtyId),
            projects: {
                $elemMatch: {
                    projectId: new mongoose.Types.ObjectId(projectId),
                    specialtyId: { $exists: false },
                },
            },
        });
    }

    /**
     * Returns users whose membership in a project has the target role but a specialty
     * outside the allowed set (used to block incompatible role updates).
     */
    static async findRoleSpecialtyConflicts(
        projectId: string,
        roleId: string,
        allowedSpecialtyIds: string[]
    ): Promise<IUser[]> {
        await this.connect();

        const projectObjectId = new mongoose.Types.ObjectId(projectId);
        const roleObjectId = new mongoose.Types.ObjectId(roleId);
        const allowedObjectIds = allowedSpecialtyIds.map((id) => new mongoose.Types.ObjectId(id));

        return User.find({
            projects: {
                $elemMatch: {
                    projectId: projectObjectId,
                    roleId: roleObjectId,
                    specialtyId: { $exists: true, $nin: allowedObjectIds },
                },
            },
        })
            .populate('projects.roleId', 'name isManager specialtiesIds projectId')
            .populate('projects.specialtyId', 'name colorHex projectId')
            .lean() as Promise<IUser[]>;
    }

    /**
     * Same conflict rule for users still using legacy global role/specialty fields.
     */
    static async findLegacyRoleSpecialtyConflicts(
        projectId: string,
        roleName: string,
        allowedSpecialtyIds: string[]
    ): Promise<IUser[]> {
        await this.connect();

        const projectObjectId = new mongoose.Types.ObjectId(projectId);
        const allowedObjectIds = allowedSpecialtyIds.map((id) => new mongoose.Types.ObjectId(id));

        return User.find({
            role: roleName,
            specialtyId: { $exists: true, $nin: allowedObjectIds },
            projects: {
                $elemMatch: {
                    projectId: projectObjectId,
                    roleId: { $exists: false },
                },
            },
        }).lean() as Promise<IUser[]>;
    }
}
