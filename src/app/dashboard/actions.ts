"use server";

import { auth } from "@/lib/auth";
import { roleRepository } from "@/repositories/role.repository";
import { DashboardService } from "@/services/dashboard.service";
import connectToDatabase from "@/lib/mongodb";

export async function getDashboardMetrics(projectId: string, weekStart: Date) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const membership = session.user.projects?.find(
        (project) => project.projectId === projectId && project.status === "Active"
    );
    if (!membership) throw new Error("Unauthorized");

    await connectToDatabase();

    const membershipRole = membership.roleId
        ? await roleRepository.getByIdInProject(membership.roleId, projectId)
        : null;
    const isManager = Boolean(membershipRole?.isManager);
    const userSpecialtyId = membership.specialtyId;

    // Delegate all aggregation logic to the DashboardService
    return DashboardService.getMetrics({
        projectId,
        weekStart,
        isManager,
        userSpecialtyId,
    });
}
