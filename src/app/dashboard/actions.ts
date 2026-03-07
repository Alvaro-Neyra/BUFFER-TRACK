"use server";

import { auth } from "@/lib/auth";
import { isManagerRole } from "@/constants/roles";
import { DashboardService } from "@/services/dashboard.service";
import connectToDatabase from "@/lib/mongodb";

export async function getDashboardMetrics(projectId: string, weekStart: Date) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    await connectToDatabase();

    const isManager = isManagerRole(session.user.role);
    const userSpecialtyId = session.user.specialtyId;

    // Delegate all aggregation logic to the DashboardService
    return DashboardService.getMetrics({
        projectId,
        weekStart,
        isManager,
        userSpecialtyId,
    });
}
