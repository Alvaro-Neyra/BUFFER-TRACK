"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { isManagerRole } from "@/constants/roles";
import { UserAdminService } from "@/services/userAdmin.service";
import { ProjectService } from "@/services/project.service";
import { ProjectRepository } from "@/repositories/project.repository";
import { revalidatePath } from "next/cache";

// ─── Project Settings Actions ─────────────────────────────────────

export async function updateMasterPlanImage(projectId: string, imageUrl: string) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        await ProjectRepository.updateById(projectId, { masterPlanImageUrl: imageUrl });
        revalidatePath('/manage-project');
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error("Failed to update master plan image:", error);
        return { success: false, error: "Failed to update image" };
    }
}

export async function handleUserProjectAccess(
    userId: string,
    projectId: string,
    action: 'accept' | 'reject' | 'remove'
) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");
    if (!isManagerRole(session.user.role)) {
        throw new Error("Forbidden: You do not have permission to manage users");
    }

    await connectToDatabase();

    try {
        await UserAdminService.handleAccess(userId, projectId, action);
        revalidatePath('/manage-project');
        return { success: true };
    } catch (error) {
        console.error(`Failed to ${action} user ${userId}:`, error);
        return { success: false, error: "Database operation failed" };
    }
}

// ─── Building Management Actions ─────────────────────────────────

export async function createBuilding(
    projectId: string,
    data: {
        name: string;
        code: string;
        number: number;
        coordinates: { xPercent: number; yPercent: number };
        polygon?: Array<{ xPercent: number; yPercent: number }>;
    }
) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        const building = await ProjectService.createBuilding(projectId, data);
        revalidatePath('/manage-project');
        return { success: true, data: building };
    } catch (error) {
        console.error("Failed to create building:", error);
        return { success: false, error: "Failed to create building" };
    }
}

export async function updateBuilding(
    buildingId: string,
    data: { name?: string; code?: string; number?: number; coordinates?: { xPercent: number; yPercent: number } }
) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        await ProjectService.updateBuilding(buildingId, data);
        revalidatePath('/manage-project');
        return { success: true };
    } catch (error) {
        console.error("Failed to update building:", error);
        return { success: false, error: "Failed to update building" };
    }
}

export async function deleteBuilding(buildingId: string) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        await ProjectService.deleteBuilding(buildingId);
        revalidatePath('/manage-project');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete building:", error);
        return { success: false, error: "Failed to delete building" };
    }
}

// ─── Floor Management Actions ────────────────────────────────────

export async function createFloor(
    buildingId: string,
    data: { label: string; order: number; gcsImageUrl: string }
) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        const floor = await ProjectService.createFloor(buildingId, data);
        revalidatePath('/manage-project');
        return { success: true, data: floor };
    } catch (error) {
        console.error("Failed to create floor:", error);
        return { success: false, error: "Failed to create floor" };
    }
}

export async function updateFloor(
    floorId: string,
    data: { label?: string; order?: number; gcsImageUrl?: string }
) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        await ProjectService.updateFloor(floorId, data);
        revalidatePath('/manage-project');
        return { success: true };
    } catch (error) {
        console.error("Failed to update floor:", error);
        return { success: false, error: "Failed to update floor" };
    }
}

export async function deleteFloor(floorId: string) {
    const session = await auth();
    if (!session?.user || !isManagerRole(session.user.role)) {
        return { success: false, error: "Unauthorized" };
    }

    await connectToDatabase();

    try {
        await ProjectService.deleteFloor(floorId);
        revalidatePath('/manage-project');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete floor:", error);
        return { success: false, error: "Failed to delete floor" };
    }
}
