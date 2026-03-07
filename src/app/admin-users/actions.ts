"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { isManagerRole } from "@/constants/roles";
import { UserAdminService } from "@/services/userAdmin.service";
import { revalidatePath } from "next/cache";

export async function handleUserProjectAccess(userId: string, projectId: string, action: 'accept' | 'reject' | 'remove') {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    // Verify if the caller is a Manager
    if (!isManagerRole(session.user.role)) {
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
