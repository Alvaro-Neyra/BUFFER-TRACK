// ------------------------------------------------------------------
// Commitment Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all Commitment-related Mongoose queries,
//      including the complex aggregation pipelines for PPC calculation.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import Commitment, { type ICommitment } from '@/models/Commitment';
import mongoose from 'mongoose';

export class CommitmentRepository {
    private static async connect() {
        await connectToDatabase();
    }

    private static escapeRegex(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /** Find commitments matching a generic query filter. */
    static async findByQuery(
        query: Record<string, unknown>,
        selectFields = ''
    ): Promise<ICommitment[]> {
        await this.connect();
        const q = Commitment.find(query);
        if (selectFields) q.select(selectFields);
        return q.lean() as Promise<ICommitment[]>;
    }

    /** Count documents matching a query. */
    static async countByQuery(query: Record<string, unknown>): Promise<number> {
        await this.connect();
        return Commitment.countDocuments(query);
    }

    /** Run a generic aggregation pipeline on the Commitment collection. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async aggregate(pipeline: mongoose.PipelineStage[]): Promise<any[]> {
        await this.connect();
        return Commitment.aggregate(pipeline);
    }

    /** Find a commitment by its ObjectId. */
    static async findById(id: string): Promise<ICommitment | null> {
        await this.connect();
        return Commitment.findById(id).lean() as Promise<ICommitment | null>;
    }

    /** Create a new commitment document. */
    static async create(payload: Record<string, unknown>): Promise<ICommitment> {
        await this.connect();
        return Commitment.create(payload) as Promise<ICommitment>;
    }

    /** Update a commitment's status. */
    static async updateStatus(id: string, status: string): Promise<void> {
        await this.connect();
        await Commitment.updateOne(
            { _id: new mongoose.Types.ObjectId(id) },
            { $set: { status } }
        );
    }

    /** Update a commitment fully. */
    static async update(id: string, payload: Record<string, unknown>): Promise<ICommitment | null> {
        await this.connect();
        return Commitment.findByIdAndUpdate(id, payload, { returnDocument: 'after' }).lean() as Promise<ICommitment | null>;
    }

    /** Delete a commitment by ID. */
    static async delete(id: string): Promise<void> {
        await this.connect();
        await Commitment.findByIdAndDelete(id);
    }

    /** Find commitments for a specific floor. */
    static async findByFloorId(floorId: string): Promise<ICommitment[]> {
        await this.connect();
        return Commitment.find({ floorId: new mongoose.Types.ObjectId(floorId) })
            .populate('specialtyId', 'name color')
            .populate('assignedTo', 'name company')
            .lean() as Promise<ICommitment[]>;
    }

    /** Find commitments for a floor with full populated references for detail view. */
    static async findByFloorPopulated(floorId: string): Promise<ICommitment[]> {
        await this.connect();
        return Commitment.find({ floorId: new mongoose.Types.ObjectId(floorId) })
            .populate('specialtyId', 'name colorHex')
            .populate('assignedTo', 'name company')
            .populate('requesterId', 'name')
            .sort({ createdAt: -1 })
            .lean() as Promise<ICommitment[]>;
    }

    /** Delete all commitments matching a query (cascade delete). */
    static async deleteByQuery(query: Record<string, unknown>): Promise<void> {
        await this.connect();
        await Commitment.deleteMany(query);
    }

    /** Find commitments for a project with populated references for admin view. */
    static async findByProjectPopulated(projectId: string): Promise<ICommitment[]> {
        await this.connect();
        return Commitment.find({ projectId: new mongoose.Types.ObjectId(projectId) })
            .populate('buildingId', 'name code')
            .populate('floorId', 'label')
            .populate('specialtyId', 'name colorHex')
            .populate('assignedTo', 'name company')
            .populate('requesterId', 'name')
            .sort({ createdAt: -1 })
            .lean() as Promise<ICommitment[]>;
    }

    /** Search activities in a project with populated floor/building metadata for navigation. */
    static async searchByProject(
        projectId: string,
        query: string,
        limit = 8,
        visibilityFilter: Record<string, unknown> = {}
    ): Promise<ICommitment[]> {
        await this.connect();

        const escapedQuery = this.escapeRegex(query.trim());
        const pattern = new RegExp(escapedQuery, 'i');

        return Commitment.find({
            projectId: new mongoose.Types.ObjectId(projectId),
            ...visibilityFilter,
            $or: [
                { name: pattern },
                { customId: pattern },
                { location: pattern },
                { description: pattern },
            ],
        })
            .populate('buildingId', 'name code')
            .populate('floorId', 'label')
            .populate('specialtyId', 'name colorHex')
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(limit)
            .lean() as Promise<ICommitment[]>;
    }
}
