"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionSuccess } from "@/lib/apiResponse";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { AssignmentRepository } from "@/repositories/assignment.repository";
import { roleRepository } from "@/repositories/role.repository";
import { statusRepository } from "@/repositories/status.repository";
import { formatDateOnlyUTC, parseDateOnlyInput } from "@/lib/dateOnly";
import mongoose from "mongoose";

interface IAssignmentTimelineUpdate {
    requiredDate?: string | null;
    status?: string;
}

function toIsoDate(value?: Date | string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requireActiveMembership(projectId: string) {
    const session = await auth();
    if (!session?.user) {
        return { ok: false as const, error: "Unauthorized" };
    }

    const membership = session.user.projects?.find(
        (project) => project.projectId === projectId && project.status === "Active"
    );
    if (!membership) {
        return { ok: false as const, error: "Unauthorized" };
    }

    const membershipRole = membership.roleId
        ? await roleRepository.getByIdInProject(membership.roleId, projectId)
        : null;

    return {
        ok: true as const,
        membership,
        isManager: Boolean(membershipRole?.isManager),
    };
}

export async function getProjectAssignments(projectId: string) {
    const access = await requireActiveMembership(projectId);
    if (!access.ok) throw new Error(access.error);

    await connectToDatabase();

    const userSpecialtyId = access.membership.specialtyId;

    // 1. Fetch assignments with populated references
    const rawAssignments = await AssignmentRepository.findByProjectPopulated(projectId);

    let assignments = rawAssignments;
    if (!access.isManager && userSpecialtyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignments = rawAssignments.filter((c: any) => c.specialtyId?._id?.toString() === userSpecialtyId);
    }

    // Process assignments to plain JS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedAssignments = assignments.map((c: any) => ({
        internalId: c._id.toString(),
        taskName: c.description || "Untitled assignment",
        location: `${c.buildingId?.name || 'Unknown BLD'} • ${c.floorId?.label || 'Unknown Level'}`,
        specialtyName: c.specialtyId?.name || 'Unknown',
        specialtyColor: c.specialtyId?.colorHex || '#ccc',
        status: c.status,
        requiredDate: toIsoDate(c.requiredDate),
        requiredDateLabel: formatDateOnlyUTC(c.requiredDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
    }));

    const statuses = await statusRepository.getAll(projectId);
    const processedStatuses = statuses.map((status) => ({
            id: status._id.toString(),
            name: status.name,
            colorHex: status.colorHex,
        }));

    return {
        assignments: processedAssignments,
        statuses: processedStatuses,
        isManager: access.isManager,
    };
}

export async function updateAssignmentTimeline(
    assignmentId: string,
    payload: IAssignmentTimelineUpdate,
    projectId: string
) {
    if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(projectId)) {
        return actionError("Invalid request");
    }

    await connectToDatabase();

    const access = await requireActiveMembership(projectId);
    if (!access.ok) {
        return actionError(access.error);
    }

    const existing = await AssignmentRepository.findById(assignmentId);
    if (!existing) {
        return actionError("Assignment not found");
    }

    if (existing.projectId.toString() !== projectId) {
        return actionError("Invalid project context");
    }

    if (!access.isManager && access.membership.specialtyId) {
        if (existing.specialtyId.toString() !== access.membership.specialtyId) {
            return actionError("Forbidden");
        }
    }

    const updatePayload: Record<string, unknown> = {};

    if (payload.status !== undefined) {
        const normalizedStatus = payload.status.trim();
        if (!normalizedStatus) {
            return actionError("Status is required");
        }

        const validStatus = await statusRepository.findByName(normalizedStatus, projectId);
        if (!validStatus) {
            return actionError("Invalid status");
        }

        updatePayload.status = normalizedStatus;
    }

    if (payload.requiredDate !== undefined) {
        if (!payload.requiredDate) {
            return actionError("Required date is required");
        }

        const parsedRequiredDate = parseDateOnlyInput(payload.requiredDate);
        if (!parsedRequiredDate) {
            return actionError("Invalid required date");
        }

        const day = parsedRequiredDate.getUTCDay();
        const diff = parsedRequiredDate.getUTCDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(
            Date.UTC(parsedRequiredDate.getUTCFullYear(), parsedRequiredDate.getUTCMonth(), diff)
        );

        updatePayload.requiredDate = parsedRequiredDate;
        updatePayload.weekStart = weekStart;
    }

    try {
        await AssignmentRepository.update(assignmentId, updatePayload);
        revalidatePath("/assignments");
        revalidatePath("/manage-project");
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to update assignment timeline:", error);
        return actionError("Failed to update assignment");
    }
}
