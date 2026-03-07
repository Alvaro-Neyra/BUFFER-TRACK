// ------------------------------------------------------------------
// Floor Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Floor-related Mongoose queries.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Floor, { type IFloor } from '@/models/Floor';
import mongoose from 'mongoose';

export class FloorRepository {
    private static async connect() {
        await connectToDatabase();
    }

    /** Find all floors belonging to a specific building. */
    static async findByBuildingId(buildingId: string): Promise<IFloor[]> {
        await this.connect();
        return Floor.find({ buildingId: new mongoose.Types.ObjectId(buildingId) })
            .sort({ order: 1 })
            .lean() as Promise<IFloor[]>;
    }

    /** Find a single floor by its ObjectId. */
    static async findById(id: string): Promise<IFloor | null> {
        await this.connect();
        return Floor.findById(id).lean() as Promise<IFloor | null>;
    }

    /** Create a new floor document. */
    static async create(payload: Record<string, unknown>): Promise<IFloor> {
        await this.connect();
        return Floor.create(payload) as Promise<IFloor>;
    }

    /** Update a floor by its ObjectId. */
    static async updateById(id: string, payload: Record<string, unknown>): Promise<IFloor | null> {
        await this.connect();
        return Floor.findByIdAndUpdate(id, payload, { new: true }).lean() as Promise<IFloor | null>;
    }

    /** Delete a single floor by its ObjectId. */
    static async deleteById(id: string): Promise<void> {
        await this.connect();
        await Floor.findByIdAndDelete(id);
    }

    /** Delete all floors belonging to a specific building (cascade delete). */
    static async deleteByBuildingId(buildingId: string): Promise<void> {
        await this.connect();
        await Floor.deleteMany({ buildingId: new mongoose.Types.ObjectId(buildingId) });
    }
}
