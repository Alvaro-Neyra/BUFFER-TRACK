// ------------------------------------------------------------------
// Restriction Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Restriction-related Mongoose queries.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Restriction, { type IRestriction } from '@/models/Restriction';
import mongoose from 'mongoose';

export class RestrictionRepository {
    private static async connect() {
        await connectToDatabase();
    }

    /**
     * Find all active restrictions for a project, filtered to specific commitment IDs.
     * Populates reportedBy and commitment details (floor, building).
     */
    static async findActiveByProject(
        projectId: string,
        commitmentIds: mongoose.Types.ObjectId[]
    ): Promise<IRestriction[]> {
        await this.connect();
        return Restriction.find({
            projectId: new mongoose.Types.ObjectId(projectId),
            isActive: true,
            commitmentId: { $in: commitmentIds },
        })
            .populate({ path: 'reportedBy', select: 'firstName lastName companyName' })
            .populate({
                path: 'commitmentId',
                select: 'dates status',
                populate: [
                    { path: 'floorId', select: 'level' },
                    { path: 'buildingId', select: 'name code' },
                ],
            })
            .sort({ createdAt: -1 })
            .lean() as Promise<IRestriction[]>;
    }

    /** Create a new restriction document. */
    static async create(payload: Record<string, unknown>): Promise<IRestriction> {
        await this.connect();
        return Restriction.create(payload) as Promise<IRestriction>;
    }

    /** Mark a restriction as resolved. */
    static async resolve(id: string): Promise<void> {
        await this.connect();
        await Restriction.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { isActive: false, resolvedAt: new Date() } }
        );
    }
}
