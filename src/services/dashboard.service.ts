// ------------------------------------------------------------------
// Dashboard Service — Business Logic Layer
// Pattern: Service Layer
// Why: Extracts the 245-line PPC metrics aggregation from the server
//      action into a testable service. The server action becomes a
//      thin wrapper handling only session auth, then delegates here.
// ------------------------------------------------------------------

import { CommitmentRepository } from '@/repositories/commitment.repository';
import { UserRepository } from '@/repositories/user.repository';
import { statusRepository } from '@/repositories/status.repository';
import mongoose from 'mongoose';

/** Input parameters for the dashboard metrics query. */
interface IDashboardParams {
    projectId: string;
    weekStart: Date;
    isManager: boolean;
    userSpecialtyId?: string;
}

/** Shape of the metrics object returned to the DashboardView. */
export interface IDashboardMetrics {
    globalPPC: number;
    totalCompleted: number;
    totalCommitted: number;
    totalPinsCount: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ppcBySpecialty: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ppcBySubcontractor: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ppcByZone: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subcontractorLoad: any[];
    isManager: boolean;
}

export class DashboardService {
    /**
     * Compute all dashboard metrics for a given project and week.
     * Applies role-based filtering: managers see everything,
     * workers only see their specialty.
     */
    static async getMetrics(params: IDashboardParams): Promise<IDashboardMetrics> {
        const { projectId, weekStart, isManager, userSpecialtyId } = params;

        // Build base query with optional specialty filter
        const matchQuery: Record<string, unknown> = {
            projectId: new mongoose.Types.ObjectId(projectId),
        };
        if (!isManager && userSpecialtyId) {
            matchQuery.specialtyId = new mongoose.Types.ObjectId(userSpecialtyId);
        }

        // Week boundaries
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const thisWeekQuery = { ...matchQuery, weekStart: { $gte: weekStart, $lt: weekEnd } };

        const nextWeekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextWeekQuery = { ...matchQuery, weekStart: { $gte: nextWeekStart, $lt: nextWeekEnd } };

        // Get statuses that count for PPC
        const allStatuses = await statusRepository.getAll();
        const ppcStatusNames = allStatuses.filter(s => s.isPPC).map(s => s.name);
        
        // Default to 'Completed' if no statuses are marked as isPPC to avoid breaking dashboard
        const ppcFilter = ppcStatusNames.length > 0 ? ppcStatusNames : ['Completed'];

        // 1. Overall PPC
        const overallStats = await CommitmentRepository.aggregate([
            { $match: thisWeekQuery },
            {
                $group: {
                    _id: null,
                    totalCommitted: { $sum: 1 },
                    totalCompleted: { $sum: { $cond: [{ $in: ['$status', ppcFilter] }, 1, 0] } },
                },
            },
        ]);

        const totalCompleted = overallStats[0]?.totalCompleted ?? 0;
        const totalCommitted = overallStats[0]?.totalCommitted ?? 0;
        const globalPPC = totalCommitted > 0
            ? Math.round((totalCompleted / totalCommitted) * 100)
            : 0;

        // 2A. PPC by Specialty
        const ppcBySpecialty = await CommitmentRepository.aggregate([
            { $match: thisWeekQuery },
            { $group: { _id: '$specialtyId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ['$status', ppcFilter] }, 1, 0] } } } },
            { $lookup: { from: 'specialties', localField: '_id', foreignField: '_id', as: 'specialty' } },
            { $unwind: { path: '$specialty', preserveNullAndEmptyArrays: true } },
            { $project: { name: { $ifNull: ['$specialty.name', 'Unknown'] }, color: { $ifNull: ['$specialty.color', '#cbd5e1'] }, ppc: { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }, total: 1, completed: 1 } },
            { $sort: { ppc: -1 } },
        ]);

        // 2B. PPC by Subcontractor
        const ppcBySubcontractor = await CommitmentRepository.aggregate([
            { $match: { ...thisWeekQuery, assignedTo: { $exists: true, $ne: null } } },
            { $group: { _id: '$assignedTo', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ['$status', ppcFilter] }, 1, 0] } } } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            { $project: { name: { $concat: ['$user.firstName', ' ', '$user.lastName'] }, company: { $ifNull: ['$user.companyName', 'N/A'] }, ppc: { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }, total: 1, completed: 1 } },
            { $sort: { ppc: -1 } },
        ]);

        // 2C. PPC by Zone (Floor)
        const ppcByZone = await CommitmentRepository.aggregate([
            { $match: thisWeekQuery },
            { $group: { _id: '$floorId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $in: ['$status', ppcFilter] }, 1, 0] } } } },
            { $lookup: { from: 'floors', localField: '_id', foreignField: '_id', as: 'floor' } },
            { $unwind: { path: '$floor', preserveNullAndEmptyArrays: true } },
            { $project: { level: { $ifNull: ['$floor.level', 'Unknown Level'] }, ppc: { $round: [{ $multiply: [{ $divide: ['$completed', '$total'] }, 100] }, 0] }, total: 1, completed: 1 } },
            { $sort: { level: 1 } },
        ]);

        // 3. Subcontractor Workload: Current vs Next Week
        const currentWeekLoad = await CommitmentRepository.aggregate([
            { $match: thisWeekQuery },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        ]);
        const nextWeekLoad = await CommitmentRepository.aggregate([
            { $match: nextWeekQuery },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        ]);

        const assignedUserIds = Array.from(new Set([
            ...currentWeekLoad.map((u: { _id?: mongoose.Types.ObjectId }) => u._id?.toString()).filter(Boolean),
            ...nextWeekLoad.map((u: { _id?: mongoose.Types.ObjectId }) => u._id?.toString()).filter(Boolean),
        ]));

        const usersInfo = await UserRepository.findByIds(assignedUserIds as string[], 'firstName lastName companyName');

        const subcontractorLoad = usersInfo.map((user) => {
            const userId = user._id.toString();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const u = user as any;
            const cLoad = currentWeekLoad.find((c: { _id?: mongoose.Types.ObjectId }) => c._id?.toString() === userId)?.count ?? 0;
            const nLoad = nextWeekLoad.find((n: { _id?: mongoose.Types.ObjectId }) => n._id?.toString() === userId)?.count ?? 0;
            return {
                _id: userId,
                name: `${u.firstName} ${u.lastName}`,
                company: u.companyName,
                current: cLoad,
                next: nLoad,
            };
        });

        // 4. Total pins
        const totalPinsCount = await CommitmentRepository.countByQuery(matchQuery);

        return {
            globalPPC,
            totalCompleted,
            totalCommitted,
            totalPinsCount,
            ppcBySpecialty,
            ppcBySubcontractor,
            ppcByZone,
            subcontractorLoad,
            isManager,
        };
    }
}
