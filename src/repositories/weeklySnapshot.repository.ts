// ------------------------------------------------------------------
// WeeklySnapshot Repository — Data Access Layer
// Pattern: Repository Pattern
// Why: Centralizes all WeeklySnapshot-related Mongoose queries.
//      Used for historical PPC data and week-closing operations.
// ------------------------------------------------------------------

import connectToDatabase from '@/lib/mongodb';
import WeeklySnapshot, { type IWeeklySnapshot } from '@/models/WeeklySnapshot';
import mongoose from 'mongoose';

export class WeeklySnapshotRepository {
    private static async connect() {
        await connectToDatabase();
    }

    /** Find a snapshot for a specific project and week. */
    static async findByProjectAndWeek(
        projectId: string,
        weekStart: Date
    ): Promise<IWeeklySnapshot | null> {
        await this.connect();
        return WeeklySnapshot.findOne({
            projectId: new mongoose.Types.ObjectId(projectId),
            weekStart,
        }).lean() as Promise<IWeeklySnapshot | null>;
    }

    /** Create a new weekly snapshot (freezes PPC data for historical reporting). */
    static async create(payload: Record<string, unknown>): Promise<IWeeklySnapshot> {
        await this.connect();
        return WeeklySnapshot.create(payload) as Promise<IWeeklySnapshot>;
    }

    /** Find all snapshots for a project, sorted by week descending. */
    static async findByProjectId(projectId: string): Promise<IWeeklySnapshot[]> {
        await this.connect();
        return WeeklySnapshot.find({
            projectId: new mongoose.Types.ObjectId(projectId),
        })
            .sort({ weekStart: -1 })
            .lean() as Promise<IWeeklySnapshot[]>;
    }
}
