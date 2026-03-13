"use server";

import { auth } from "@/lib/auth";
import { actionError, actionSuccess } from "@/lib/apiResponse";
import { UserRepository } from "@/repositories/user.repository";
import { profileUpdateSchema } from "@/schemas/profile.schema";
import { revalidatePath } from "next/cache";

export async function updateProfile(payload: { name: string; company?: string }) {
    const session = await auth();
    if (!session?.user?.id) {
        return actionError("Unauthorized");
    }

    const parsed = profileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        return actionError(firstIssue?.message || "Invalid profile data");
    }

    try {
        await UserRepository.updateProfile(session.user.id, {
            name: parsed.data.name,
            company: parsed.data.company,
        });

        revalidatePath("/profile");

        return actionSuccess({
            name: parsed.data.name,
            company: parsed.data.company || "",
        });
    } catch (error) {
        console.error("Failed to update profile:", error);
        return actionError("Failed to update profile");
    }
}
