// ------------------------------------------------------------------
// Specialty Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Specialty-related Mongoose queries.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Specialty, { type ISpecialty } from '@/models/Specialty';
import mongoose from 'mongoose';

export class SpecialtyRepository {
    private static async connect() {
        await connectToDatabase();
    }

    /** Find all specialties in the database. */
    static async findAll(projectId?: string): Promise<ISpecialty[]> {
        await this.connect();
        if (!projectId) {
            return Specialty.find({}).sort({ name: 1 }).lean() as Promise<ISpecialty[]>;
        }
        return Specialty.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ name: 1 }).lean() as Promise<ISpecialty[]>;
    }

    static async findByProjectId(projectId: string): Promise<ISpecialty[]> {
        await this.connect();
        return Specialty.find({ projectId: new mongoose.Types.ObjectId(projectId) }).sort({ name: 1 }).lean() as Promise<ISpecialty[]>;
    }

    static async findByIdsInProject(ids: string[], projectId: string): Promise<ISpecialty[]> {
        await this.connect();
        const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
        return Specialty.find({
            _id: { $in: objectIds },
            projectId: new mongoose.Types.ObjectId(projectId),
        }).lean() as Promise<ISpecialty[]>;
    }

    static async countByProjectId(projectId: string): Promise<number> {
        await this.connect();
        return Specialty.countDocuments({ projectId: new mongoose.Types.ObjectId(projectId) });
    }

    static async findByNameInProject(name: string, projectId: string): Promise<ISpecialty | null> {
        await this.connect();
        return Specialty.findOne({
            name,
            projectId: new mongoose.Types.ObjectId(projectId),
        }).lean() as Promise<ISpecialty | null>;
    }

    /** Backward compatible helper for global name lookups used by seed. */
    static async findByNamesGlobal(names: string[]): Promise<ISpecialty[]> {
        await this.connect();
        return Specialty.find({ name: { $in: names } }).lean() as Promise<ISpecialty[]>;
    }

    /** Find specialties by an array of names. */
    static async findByNames(names: string[]): Promise<ISpecialty[]> {
        await this.connect();
        return Specialty.find({ name: { $in: names } }).lean() as Promise<ISpecialty[]>;
    }

    /** Insert multiple specialties at once. */
    static async createMany(specialties: Record<string, unknown>[]): Promise<ISpecialty[]> {
        await this.connect();
        return Specialty.insertMany(specialties) as Promise<ISpecialty[]>;
    }

    /** Find a single specialty by its ObjectId. */
    static async findById(id: string): Promise<ISpecialty | null> {
        await this.connect();
        return Specialty.findById(id).lean() as Promise<ISpecialty | null>;
    }

    /** Create a single specialty. */
    static async create(data: Partial<ISpecialty>): Promise<ISpecialty> {
        await this.connect();
        const doc = await Specialty.create(data);
        return doc.toObject();
    }

    /** Update a specialty by its ObjectId. */
    static async update(id: string, data: Partial<ISpecialty>): Promise<ISpecialty | null> {
        await this.connect();
        return Specialty.findByIdAndUpdate(id, data, { new: true }).lean() as Promise<ISpecialty | null>;
    }

    /** Delete a specialty by its ObjectId. */
    static async delete(id: string): Promise<boolean> {
        await this.connect();
        const result = await Specialty.findByIdAndDelete(id);
        return !!result;
    }
}
