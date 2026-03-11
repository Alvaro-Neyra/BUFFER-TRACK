"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { roleRepository } from "@/repositories/role.repository";
import { UserAdminService } from "@/services/userAdmin.service";
import { revalidatePath } from "next/cache";

export async function handleUserProjectAccess(userId: string, projectId: string, action: 'accept' | 'reject' | 'remove') {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const membership = session.user.projects?.find(
        (project) => project.projectId === projectId && project.status === "Active"
    );
    if (!membership) {
        throw new Error("Unauthorized");
    }

    const membershipRole = membership.roleId
        ? await roleRepository.getByIdInProject(membership.roleId, projectId)
        : null;
    const canManage = Boolean(membershipRole?.isManager);

    if (!canManage) {
        throw new Error("Forbidden: You do not have permission to manage users");
    }

    await connectToDatabase();

    try {
        await UserAdminService.handleAccess(userId, projectId, action);
        revalidatePath('/admin-users');
        return { success: true };
    } catch (error) {
        console.error(`Failed to ${action} user ${userId}:`, error);
        return { success: false, error: "Database operation failed" };
    }
}
