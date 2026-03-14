// ------------------------------------------------------------------
// Assignment Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Assignment-related Mongoose queries,
//      including the complex aggregation pipelines for PPC calculation.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Assignment, { type IAssignment } from '@/models/Assignment';
import mongoose from 'mongoose';

export class AssignmentRepository {
    private static async connect() {
        await connectToDatabase();
    }

    private static escapeRegex(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /** Find assignments matching a generic query filter. */
    static async findByQuery(
        query: Record<string, unknown>,
        selectFields = ''
    ): Promise<IAssignment[]> {
        await this.connect();
        const q = Assignment.find(query);
        if (selectFields) q.select(selectFields);
        return q.lean() as Promise<IAssignment[]>;
    }

    /** Count documents matching a query. */
    static async countByQuery(query: Record<string, unknown>): Promise<number> {
        await this.connect();
        return Assignment.countDocuments(query);
    }

    /** Run a generic aggregation pipeline on the Assignment collection. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async aggregate(pipeline: mongoose.PipelineStage[]): Promise<any[]> {
        await this.connect();
        return Assignment.aggregate(pipeline);
    }

    /** Find an assignment by its ObjectId. */
    static async findById(id: string): Promise<IAssignment | null> {
        await this.connect();
        return Assignment.findById(id).lean() as Promise<IAssignment | null>;
    }

    /** Create a new assignment document. */
    static async create(payload: Record<string, unknown>): Promise<IAssignment> {
        await this.connect();
        return Assignment.create(payload) as Promise<IAssignment>;
    }

    /** Update an assignment status. */
    static async updateStatus(id: string, status: string): Promise<void> {
        await this.connect();
        await Assignment.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { status } }
        );
    }

    /** Update an assignment fully. */
    static async update(id: string, payload: Record<string, unknown>): Promise<IAssignment | null> {
        await this.connect();
        return Assignment.findByIdAndUpdate(id, payload, { returnDocument: 'after' }).lean() as Promise<IAssignment | null>;
    }

    /** Delete an assignment by ID. */
    static async delete(id: string): Promise<void> {
        await this.connect();
        await Assignment.findByIdAndDelete(id);
    }

    /** Find assignments for a specific floor. */
    static async findByFloorId(floorId: string): Promise<IAssignment[]> {
        await this.connect();
        return Assignment.find({ floorId: new mongoose.Types.ObjectId(floorId) })
            .populate('specialtyId', 'name color')
            .lean() as Promise<IAssignment[]>;
    }

    /** Find assignments for a floor with full populated references for detail view. */
    static async findByFloorPopulated(floorId: string): Promise<IAssignment[]> {
        await this.connect();
        return Assignment.find({ floorId: new mongoose.Types.ObjectId(floorId) })
            .populate('specialtyId', 'name colorHex')
            .populate('requesterId', 'name')
            .populate('acceptedById', 'name')
            .sort({ createdAt: -1 })
            .lean() as Promise<IAssignment[]>;
    }

    /** Delete all assignments matching a query (cascade delete). */
    static async deleteByQuery(query: Record<string, unknown>): Promise<void> {
        await this.connect();
        await Assignment.deleteMany(query);
    }

    /** Find assignments for a project with populated references for admin view. */
    static async findByProjectPopulated(projectId: string): Promise<IAssignment[]> {
        await this.connect();
        return Assignment.find({ projectId: new mongoose.Types.ObjectId(projectId) })
            .populate('buildingId', 'name code')
            .populate('floorId', 'label')
            .populate('specialtyId', 'name colorHex')
            .populate('requesterId', 'name')
            .populate('acceptedById', 'name')
            .sort({ createdAt: -1 })
            .lean() as Promise<IAssignment[]>;
    }

    /** Search activities in a project with populated floor/building metadata for navigation. */
    static async searchByProject(
        projectId: string,
        query: string,
        limit = 8,
        visibilityFilter: Record<string, unknown> = {}
    ): Promise<IAssignment[]> {
        await this.connect();

        const escapedQuery = this.escapeRegex(query.trim());
        const pattern = new RegExp(escapedQuery, 'i');

        return Assignment.find({
            projectId: new mongoose.Types.ObjectId(projectId),
            ...visibilityFilter,
            $or: [
                { description: pattern },
            ],
        })
            .populate('buildingId', 'name code')
            .populate('floorId', 'label')
            .populate('specialtyId', 'name colorHex')
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(limit)
            .lean() as Promise<IAssignment[]>;
    }
}
