// ------------------------------------------------------------------
// Building Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Building-related Mongoose queries.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Building, { type IBuilding } from '@/models/Building';
import mongoose from 'mongoose';

export class BuildingRepository {
    private static async connect() {
        await connectToDatabase();
    }

    private static escapeRegex(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /** Find all buildings belonging to a specific project. */
    static async findByProjectId(projectId: string): Promise<IBuilding[]> {
        await this.connect();
        return Building.find({ projectId: new mongoose.Types.ObjectId(projectId) })
            .sort({ number: 1 })
            .lean() as Promise<IBuilding[]>;
    }

    /** Search buildings by name or code within a specific project. */
    static async searchByProject(projectId: string, query: string, limit = 8): Promise<IBuilding[]> {
        await this.connect();
        const escapedQuery = this.escapeRegex(query.trim());
        const pattern = new RegExp(escapedQuery, 'i');

        return Building.find({
            projectId: new mongoose.Types.ObjectId(projectId),
            $or: [
                { name: pattern },
                { code: pattern },
            ],
        })
            .sort({ number: 1, name: 1 })
            .limit(limit)
            .lean() as Promise<IBuilding[]>;
    }

    /** Find all buildings (no filter). Used by master plan page. */
    static async findAll(): Promise<IBuilding[]> {
        await this.connect();
        return Building.find({}).lean() as Promise<IBuilding[]>;
    }

    /** Find a single building by its ObjectId. */
    static async findById(id: string): Promise<IBuilding | null> {
        await this.connect();
        return Building.findById(id).lean() as Promise<IBuilding | null>;
    }

    /** Create a single building. */
    static async create(payload: Record<string, unknown>): Promise<IBuilding> {
        await this.connect();
        return Building.create(payload) as Promise<IBuilding>;
    }

    /** Update a building by its ObjectId. */
    static async updateById(id: string, payload: Record<string, unknown>): Promise<IBuilding | null> {
        await this.connect();
        return Building.findByIdAndUpdate(id, payload, { returnDocument: 'after' }).lean() as Promise<IBuilding | null>;
    }

    /** Delete a single building by its ObjectId. */
    static async deleteById(id: string): Promise<void> {
        await this.connect();
        await Building.findByIdAndDelete(id);
    }

    /** Delete all buildings for a project (used before re-seeding). */
    static async deleteByProjectId(projectId: string): Promise<void> {
        await this.connect();
        await Building.deleteMany({ projectId: new mongoose.Types.ObjectId(projectId) });
    }

    /** Insert multiple buildings at once. */
    static async createMany(buildings: Record<string, unknown>[]): Promise<IBuilding[]> {
        await this.connect();
        return Building.insertMany(buildings) as Promise<IBuilding[]>;
    }
}
