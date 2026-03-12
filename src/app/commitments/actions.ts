"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionSuccess } from "@/lib/apiResponse";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { RestrictionRepository } from "@/repositories/restriction.repository";
import { roleRepository } from "@/repositories/role.repository";
import { statusRepository } from "@/repositories/status.repository";
import { formatDateOnlyUTC, parseDateOnlyInput } from "@/lib/dateOnly";
import { isRestrictedStatus } from "@/lib/projectFeatures";
import { ProjectService } from "@/services/project.service";
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
    const redListEnabled = await ProjectService.isRedListEnabled(projectId);

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

    // 2. Fetch active restrictions
    const commitmentIds = commitments.map(c => c._id as mongoose.Types.ObjectId);
    const rawRestrictions = redListEnabled && commitmentIds.length > 0
        ? await RestrictionRepository.findActiveByProject(projectId, commitmentIds)
        : [];

    const restrictedCommitmentIdsWithRestriction = new Set<string>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawRestrictions.map((restriction: any) => restriction.commitmentId?._id?.toString()).filter(Boolean)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedRestrictionsFromRows = rawRestrictions.map((r: any) => ({
        id: r._id.toString(),
        description: r.description,
        commitmentInternalId: r.commitmentId?._id?.toString() || "",
        floorId: r.commitmentId?.floorId?._id?.toString() || "",
        taskName: r.commitmentId?.name || "Restricted commitment",
        commitmentDescription: r.commitmentId?.description || r.description || "No description",
        location: `${r.commitmentId?.buildingId?.name || ''} • ${r.commitmentId?.floorId?.label || ''}`,
        status: r.commitmentId?.status || "Unknown",
        specialtyName: r.commitmentId?.specialtyId?.name || "Unknown",
        assignedTo: r.commitmentId?.assignedTo
            ? `${r.commitmentId.assignedTo.name} (${r.commitmentId.assignedTo.company})`
            : "Unassigned",
        startDate: formatDateOnlyUTC(r.commitmentId?.dates?.startDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
        reportedBy: r.reportedBy ? `${r.reportedBy.firstName} ${r.reportedBy.lastName} (${r.reportedBy.companyName})` : 'Unknown',
        solver: r.solver,
        targetDate: formatDateOnlyUTC(r.commitmentId?.dates?.targetDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
        commitmentId: (typeof r.commitmentId?.customId === "string" ? r.commitmentId.customId.trim() : "") || 'N/A',
    }));

    // If a commitment is marked Restricted but has no active Restriction row,
    // surface it in The Red List so it never gets lost from the blocker workflow.
    type TCommitmentForRedList = {
        _id: { toString(): string } | string;
        status?: string;
        name?: string;
        description?: string;
        buildingId?: { name?: string } | null;
        floorId?: { _id?: { toString(): string } | string; label?: string } | null;
        specialtyId?: { name?: string } | null;
        requesterId?: { name?: string } | null;
        assignedTo?: { name?: string; company?: string } | null;
        dates?: { startDate?: Date | string | null; targetDate?: Date | string | null } | null;
        customId?: string | null;
    };

    const commitmentsForRedList = commitments as unknown as TCommitmentForRedList[];
    const synthesizedRestrictedRows = commitmentsForRedList
        .filter((commitment) => {
            const commitmentId =
                typeof commitment._id === "string"
                    ? commitment._id
                    : commitment._id?.toString();
            return isRestrictedStatus(commitment.status || "")
                && Boolean(commitmentId)
                && !restrictedCommitmentIdsWithRestriction.has(commitmentId);
        })
        .map((commitment) => {
            const commitmentId =
                typeof commitment._id === "string"
                    ? commitment._id
                    : commitment._id?.toString();

            return {
                id: `restricted-${commitmentId || "unknown"}`,
                description: commitment.name || commitment.description || "Restricted commitment",
                commitmentInternalId: commitmentId || "",
                floorId:
                    typeof commitment.floorId?._id === "string"
                        ? commitment.floorId._id
                        : commitment.floorId?._id?.toString() || "",
                taskName: commitment.name || "Restricted commitment",
                commitmentDescription: commitment.description || "No description",
                location: `${commitment.buildingId?.name || ''} • ${commitment.floorId?.label || ''}`,
                status: commitment.status || "Unknown",
                specialtyName: commitment.specialtyId?.name || "Unknown",
                assignedTo: commitment.assignedTo
                    ? `${commitment.assignedTo.name} (${commitment.assignedTo.company})`
                    : "Unassigned",
                startDate: formatDateOnlyUTC(commitment.dates?.startDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
                reportedBy: commitment.requesterId?.name || 'Unknown',
                solver: commitment.assignedTo?.name || 'Pending assignment',
                targetDate: formatDateOnlyUTC(commitment.dates?.targetDate, { year: "2-digit", month: "2-digit", day: "2-digit" }, "TBD"),
                commitmentId: (typeof commitment.customId === "string" ? commitment.customId.trim() : "") || 'N/A',
            };
        });

    const processedRestrictions = [
        ...processedRestrictionsFromRows,
        ...synthesizedRestrictedRows,
    ];

    const statuses = await statusRepository.getAll();
    const processedStatuses = statuses
        .filter((status) => redListEnabled || !isRestrictedStatus(status.name))
        .map((status) => ({
            id: status._id.toString(),
            name: status.name,
            colorHex: status.colorHex,
        }));

    return {
        commitments: processedCommitments,
        restrictions: processedRestrictions,
        statuses: processedStatuses,
        redListEnabled,
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

        if (isRestrictedStatus(normalizedStatus)) {
            const redListEnabled = await ProjectService.isRedListEnabled(projectId);
            if (!redListEnabled) {
                return actionError("Restricted status is unavailable because Red List is disabled for this project");
            }
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
