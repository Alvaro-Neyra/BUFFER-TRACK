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
            .populate('specialtyId', 'name color')
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
}
