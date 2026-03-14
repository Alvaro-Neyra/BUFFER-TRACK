// ------------------------------------------------------------------
// Project Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Project-related Mongoose queries.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Project, { type IProject } from '@/models/Project';
import { statusRepository } from '@/repositories/status.repository';
import mongoose from 'mongoose';

export class ProjectRepository {
    private static async connect() {
        await connectToDatabase();
    }

    /** Find a project by its ObjectId. */
    static async findById(id: string): Promise<IProject | null> {
        await this.connect();
        return Project.findById(id).lean() as Promise<IProject | null>;
    }

    /** Find a project by its unique connection code (e.g., "BufferTrack-123456"). */
    static async findByConnectionCode(code: string): Promise<IProject | null> {
        await this.connect();
        return Project.findOne({ connectionCode: code }).lean() as Promise<IProject | null>;
    }

    /** Find multiple projects by an array of ObjectId strings. Returns only _id and name. */
    static async findByIds(ids: string[]): Promise<Array<{ _id: mongoose.Types.ObjectId; name: string }>> {
        await this.connect();
        const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
        return Project.find({ _id: { $in: objectIds } })
            .select('_id name')
            .lean() as Promise<Array<{ _id: mongoose.Types.ObjectId; name: string }>>;
    }

    /** Find the first project in the database (used for seeding). */
    static async findFirst(): Promise<IProject | null> {
        await this.connect();
        return Project.findOne().lean() as Promise<IProject | null>;
    }

    /** Create a new project document. */
    static async create(payload: Record<string, unknown>): Promise<IProject> {
        await this.connect();
        const project = await Project.create(payload) as IProject;
        await statusRepository.ensureDefaultStatuses(project._id.toString());
        return project;
    }

    /** Update a project by its ObjectId. */
    static async updateById(id: string, data: Record<string, unknown>): Promise<void> {
        await this.connect();
        await Project.findByIdAndUpdate(id, { $set: data });
    }
}
