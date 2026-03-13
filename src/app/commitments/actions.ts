"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionSuccess } from "@/lib/apiResponse";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { roleRepository } from "@/repositories/role.repository";
import { statusRepository } from "@/repositories/status.repository";
import { formatDateOnlyUTC, parseDateOnlyInput } from "@/lib/dateOnly";
import mongoose from "mongoose";

interface ICommitmentTimelineUpdate {
    startDate?: string | null;
    targetDate?: string | null;
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

export async function getProjectCommitments(projectId: string) {
    const access = await requireActiveMembership(projectId);
    if (!access.ok) throw new Error(access.error);

    await connectToDatabase();

    const userSpecialtyId = access.membership.specialtyId;

    // 1. Fetch commitments with populated references
    const rawCommitments = await CommitmentRepository.findByProjectPopulated(projectId);

    let commitments = rawCommitments;
    if (!access.isManager && userSpecialtyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        commitments = rawCommitments.filter((c: any) => c.specialtyId?._id?.toString() === userSpecialtyId);
    }

    // Process commitments to plain JS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedCommitments = commitments.map((c: any) => ({
        internalId: c._id.toString(),
        customId: (typeof c.customId === "string" ? c.customId.trim() : "") || "N/A",
        taskName: c.name,
        location: `${c.buildingId?.name || 'Unknown BLD'} • ${c.floorId?.label || 'Unknown Level'}`,
        specialtyName: c.specialtyId?.name || 'Unknown',
        specialtyColor: c.specialtyId?.colorHex || '#ccc',
        status: c.status,
        startDate: toIsoDate(c.dates?.startDate),
        targetDate: toIsoDate(c.dates?.targetDate),
        startDateLabel: formatDateOnlyUTC(c.dates?.startDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
        targetDateLabel: formatDateOnlyUTC(c.dates?.targetDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
        assignedTo: c.assignedTo ? `${c.assignedTo.name} (${c.assignedTo.company})` : 'Unassigned',
    }));

    const statuses = await statusRepository.getAll();
    const processedStatuses = statuses.map((status) => ({
            id: status._id.toString(),
            name: status.name,
            colorHex: status.colorHex,
        }));

    return {
        commitments: processedCommitments,
        statuses: processedStatuses,
        isManager: access.isManager,
    };
}

export async function updateCommitmentTimeline(
    commitmentId: string,
    payload: ICommitmentTimelineUpdate,
    projectId: string
) {
    if (!mongoose.isValidObjectId(commitmentId) || !mongoose.isValidObjectId(projectId)) {
        return actionError("Invalid request");
    }

    await connectToDatabase();

    const access = await requireActiveMembership(projectId);
    if (!access.ok) {
        return actionError(access.error);
    }

    const existing = await CommitmentRepository.findById(commitmentId);
    if (!existing) {
        return actionError("Commitment not found");
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

        const validStatus = await statusRepository.findByName(normalizedStatus);
        if (!validStatus) {
            return actionError("Invalid status");
        }

        updatePayload.status = normalizedStatus;
    }

    const nextDates: {
        requestDate?: Date;
        startDate?: Date;
        targetDate?: Date;
        actualCompletionDate?: Date;
    } = {
        ...(existing.dates || {}),
    };

    if (payload.startDate !== undefined) {
        if (!payload.startDate) {
            delete nextDates.startDate;
        } else {
            const parsedStartDate = parseDateOnlyInput(payload.startDate);
            if (!parsedStartDate) {
                return actionError("Invalid start date");
            }
            nextDates.startDate = parsedStartDate;
        }
    }

    if (payload.targetDate !== undefined) {
        if (!payload.targetDate) {
            delete nextDates.targetDate;
        } else {
            const parsedTargetDate = parseDateOnlyInput(payload.targetDate);
            if (!parsedTargetDate) {
                return actionError("Invalid end date");
            }
            nextDates.targetDate = parsedTargetDate;
        }
    }

    updatePayload.dates = nextDates;

    try {
        await CommitmentRepository.update(commitmentId, updatePayload);
        revalidatePath("/commitments");
        revalidatePath("/manage-project");
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to update commitment timeline:", error);
        return actionError("Failed to update commitment");
    }
}
