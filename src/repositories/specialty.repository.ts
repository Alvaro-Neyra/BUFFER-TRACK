// ------------------------------------------------------------------
// Specialty Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Specialty-related Mongoose queries.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Specialty, { type ISpecialty } from '@/models/Specialty';

export class SpecialtyRepository {
    private static async connect() {
        await connectToDatabase();
    }

    /** Find all specialties in the database. */
    static async findAll(): Promise<ISpecialty[]> {
        await this.connect();
        return Specialty.find({}).sort({ name: 1 }).lean() as Promise<ISpecialty[]>;
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
}
