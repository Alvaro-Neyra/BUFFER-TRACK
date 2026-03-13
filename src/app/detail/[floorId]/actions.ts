"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { UserRepository } from "@/repositories/user.repository";
import { FloorRepository } from "@/repositories/floor.repository";
import { BuildingRepository } from "@/repositories/building.repository";
import { SpecialtyRepository } from "@/repositories/specialty.repository";
import { roleRepository } from "@/repositories/role.repository";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { actionSuccess, actionError } from "@/lib/apiResponse";
import { parseDateOnlyInput } from "@/lib/dateOnly";

type TProjectAccessResult =
    | { ok: true; userId: string; isManager: boolean }
    | { ok: false; message: string };

function toObjectIdString(value: unknown): string | null {
    if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
        return null;
    }
    return value;
}

function memberCanEditCommitment(
    userId: string,
    isManager: boolean,
    requesterId: mongoose.Types.ObjectId,
    assignedTo?: mongoose.Types.ObjectId
): boolean {
    if (isManager) return true;
    const requesterMatches = requesterId.toString() === userId;
    const assigneeMatches = assignedTo?.toString() === userId;
    return requesterMatches || Boolean(assigneeMatches);
}

async function requireActiveProjectAccess(projectId: string): Promise<TProjectAccessResult> {
    if (!mongoose.isValidObjectId(projectId)) {
        return { ok: false, message: "Invalid project id" };
    }

    const session = await auth();
    if (!session?.user) {
        return { ok: false, message: "Unauthorized" };
    }

    const membership = session.user.projects?.find(
        (project) => project.projectId === projectId && project.status === "Active"
    );

    if (!membership) {
        return { ok: false, message: "Unauthorized" };
    }

    let membershipIsManager = false;
    if (membership.roleId) {
        const membershipRole = await roleRepository.getByIdInProject(membership.roleId, projectId);
        membershipIsManager = Boolean(membershipRole?.isManager);
    }

    return {
        ok: true,
        userId: session.user.id,
        isManager: membershipIsManager,
    };
}

function validateRestrictedStatusRemoved(status: unknown): string | null {
    if (typeof status !== "string") {
        return null;
    }

    if (status.trim().toLowerCase() === "restricted") {
        return "Restricted status is no longer available";
    }

    return null;
}

// ─── Data Fetching ───────────────────────────────────────────────

export async function getFloorData(floorId: string) {
    // Guard against invalid ObjectIds (e.g. old bookmarks using building codes)
    if (!mongoose.isValidObjectId(floorId)) return null;

    await connectToDatabase();

    const floor = await FloorRepository.findById(floorId);
    if (!floor) return null;

    const building = await BuildingRepository.findById(floor.buildingId.toString());

    return actionSuccess({
        _id: floor._id.toString(),
        label: floor.label,
        order: floor.order,
        gcsImageUrl: floor.gcsImageUrl,
        buildingId: floor.buildingId.toString(),
        buildingName: building?.name || "Unknown",
        buildingCode: building?.code || "",
        projectId: building?.projectId.toString() || "",
    });
}

export async function getFloorCommitments(floorId: string) {
    await connectToDatabase();

    const commitments = await CommitmentRepository.findByFloorPopulated(floorId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return commitments.map((c: any) => ({
        _id: c._id.toString(),
        customId: c.customId || "",
        location: c.location || "",
        name: c.name || "",
        description: c.description || "",
        status: c.status as string,
        specialtyId: c.specialtyId?._id?.toString() || "",
        specialtyName: c.specialtyId?.name || "N/A",
        specialtyColor: c.specialtyId?.colorHex || "#94a3b8",
        assignedToId: c.assignedTo?._id?.toString() || "",
        assignedToName: c.assignedTo?.name || "Unassigned",
        assignedToCompany: c.assignedTo?.company || "",
        requesterId: c.requesterId?._id?.toString() || c.requesterId?.toString() || "",
        requesterName: c.requesterId?.name || "Unknown",
        coordinates: { xPercent: c.coordinates.xPercent, yPercent: c.coordinates.yPercent },
        startDate: c.dates?.startDate?.toISOString() || null,
        targetDate: c.dates?.targetDate?.toISOString() || null,
        requestDate: c.dates?.requestDate?.toISOString() || null,
        weekStart: c.weekStart?.toISOString() || null,
    }));
}

export async function getSpecialtiesWithUsers(projectId: string) {
    await connectToDatabase();

    const specialties = await SpecialtyRepository.findByProjectId(projectId);
    const users = await UserRepository.findByProjectId(projectId);

    // Filter to only active users
    const activeUsers = users.filter(u =>
        u.projects.some(p => p.projectId.toString() === projectId && p.status === "Active")
    );

    return {
        specialties: specialties.map(s => ({
            _id: s._id.toString(),
            name: s.name,
            colorHex: s.colorHex,
        })),
        users: activeUsers.map((u) => {
            const projectMembership = u.projects.find(p => p.projectId.toString() === projectId);
            const hasMembershipRoleRef = Boolean(projectMembership && typeof projectMembership.roleId !== "undefined" && projectMembership.roleId !== null);
            const hasMembershipSpecialtyRef = Boolean(projectMembership && typeof projectMembership.specialtyId !== "undefined" && projectMembership.specialtyId !== null);

            const roleCandidate = projectMembership?.roleId as unknown;
            const membershipRoleName =
                roleCandidate &&
                typeof roleCandidate === "object" &&
                "name" in roleCandidate
                    ? (roleCandidate as { name?: string }).name
                    : undefined;

            const specialtyCandidate = projectMembership?.specialtyId as unknown;
            const membershipSpecialtyId =
                specialtyCandidate &&
                typeof specialtyCandidate === "object" &&
                "_id" in specialtyCandidate
                    ? (specialtyCandidate as { _id?: { toString: () => string } })._id?.toString()
                    : specialtyCandidate?.toString();

            return {
                _id: u._id.toString(),
                name: u.name,
                company: u.company || "",
                role: membershipRoleName || (!hasMembershipRoleRef ? u.role : ""),
                specialtyId: membershipSpecialtyId || (!hasMembershipSpecialtyRef ? u.specialtyId?.toString() || "" : ""),
            };
        }),
    };
}

// ─── Mutations ───────────────────────────────────────────────────

export async function createCommitment(data: {
    projectId: string;
    buildingId: string;
    floorId: string;
    specialtyId: string;
    assignedTo?: string;
    description: string;
    status?: string;
    targetDate?: string;
    coordinates: { xPercent: number; yPercent: number };
}) {
    const projectId = toObjectIdString(data.projectId);
    const buildingId = toObjectIdString(data.buildingId);
    const floorId = toObjectIdString(data.floorId);
    const specialtyId = toObjectIdString(data.specialtyId);
    const assignedToId = data.assignedTo ? toObjectIdString(data.assignedTo) : null;

    if (!projectId || !buildingId || !floorId || !specialtyId || (data.assignedTo && !assignedToId)) {
        return actionError("Invalid project context");
    }

    const access = await requireActiveProjectAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    const normalizedStatus = typeof data.status === "string" ? data.status.trim() : undefined;
    const restrictedStatusError = validateRestrictedStatusRemoved(normalizedStatus);
    if (restrictedStatusError) {
        return actionError(restrictedStatusError);
    }

    await connectToDatabase();

    const [building, floor, specialty, assignedUser] = await Promise.all([
        BuildingRepository.findById(buildingId),
        FloorRepository.findById(floorId),
        SpecialtyRepository.findById(specialtyId),
        assignedToId ? UserRepository.findById(assignedToId) : Promise.resolve(null),
    ]);

    if (!building || building.projectId.toString() !== projectId) {
        return actionError("Invalid project context");
    }
    if (!floor || floor.buildingId.toString() !== buildingId) {
        return actionError("Invalid project context");
    }
    if (!specialty || specialty.projectId.toString() !== projectId) {
        return actionError("Invalid specialty for project");
    }
    if (
        assignedToId &&
        (!assignedUser || !assignedUser.projects.some((project) => project.projectId.toString() === projectId && project.status === "Active"))
    ) {
        return actionError("Assigned user is not active in this project");
    }

    // Calculate weekStart (Monday of the target week) in UTC for date-only consistency.
    let parsedTargetDate: Date | undefined;
    let weekStart: Date | undefined;
    if (data.targetDate) {
        const target = parseDateOnlyInput(data.targetDate);
        if (!target) {
            return actionError("Invalid target date");
        }

        parsedTargetDate = target;
        const day = target.getUTCDay();
        const diff = target.getUTCDate() - day + (day === 0 ? -6 : 1);
        weekStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), diff));
    }

    try {
        const commitment = await CommitmentRepository.create({
            projectId: new mongoose.Types.ObjectId(projectId),
            buildingId: new mongoose.Types.ObjectId(buildingId),
            floorId: new mongoose.Types.ObjectId(floorId),
            specialtyId: new mongoose.Types.ObjectId(specialtyId),
            requesterId: new mongoose.Types.ObjectId(access.userId),
            assignedTo: assignedToId ? new mongoose.Types.ObjectId(assignedToId) : undefined,
            description: data.description,
            status: normalizedStatus || "Request",
            coordinates: data.coordinates,
            dates: {
                requestDate: new Date(),
                targetDate: parsedTargetDate,
            },
            weekStart,
        });

        revalidatePath(`/detail/${floorId}`);
        return actionSuccess(commitment);
    } catch (error) {
        console.error("Failed to create commitment:", error);
        return actionError("Failed to create commitment");
    }
}

export async function updateCommitmentStatus(commitmentId: string, status: string, floorId: string) {
    if (!mongoose.isValidObjectId(commitmentId) || !mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid commitment context");
    }

    await connectToDatabase();

    const existing = await CommitmentRepository.findById(commitmentId);
    if (!existing) return actionError("Not found");
    if (existing.floorId.toString() !== floorId) {
        return actionError("Invalid floor context");
    }

    const access = await requireActiveProjectAccess(existing.projectId.toString());
    if (!access.ok) {
        return actionError(access.message);
    }
    if (!memberCanEditCommitment(access.userId, access.isManager, existing.requesterId, existing.assignedTo)) {
        return actionError("Forbidden");
    }

    const normalizedStatus = status.trim();
    if (!normalizedStatus) {
        return actionError("Status is required");
    }

    const restrictedStatusError = validateRestrictedStatusRemoved(normalizedStatus);
    if (restrictedStatusError) {
        return actionError(restrictedStatusError);
    }

    try {
        await CommitmentRepository.updateStatus(commitmentId, normalizedStatus);
        revalidatePath(`/detail/${floorId}`);
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to update commitment:", error);
        return actionError("Failed to update status");
    }
}

export async function updateCommitmentDetails(
    commitmentId: string,
    data: {
        startDate?: string | null;
        targetDate?: string | null;
        status?: string;
    },
    floorId: string
) {
    if (!mongoose.isValidObjectId(commitmentId) || !mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid commitment context");
    }

    await connectToDatabase();

    const existing = await CommitmentRepository.findById(commitmentId);
    if (!existing) return actionError("Not found");
    if (existing.floorId.toString() !== floorId) {
        return actionError("Invalid floor context");
    }

    const access = await requireActiveProjectAccess(existing.projectId.toString());
    if (!access.ok) {
        return actionError(access.message);
    }
    if (!memberCanEditCommitment(access.userId, access.isManager, existing.requesterId, existing.assignedTo)) {
        return actionError("Forbidden");
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof data.status === "string") {
        const normalizedStatus = data.status.trim();
        if (!normalizedStatus) {
            return actionError("Status is required");
        }

        const restrictedStatusError = validateRestrictedStatusRemoved(normalizedStatus);
        if (restrictedStatusError) {
            return actionError(restrictedStatusError);
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

    if (data.startDate !== undefined) {
        if (!data.startDate) {
            nextDates.startDate = undefined;
        } else {
            const parsedStartDate = parseDateOnlyInput(data.startDate);
            if (!parsedStartDate) {
                return actionError("Invalid start date");
            }
            nextDates.startDate = parsedStartDate;
        }
    }
    if (data.targetDate !== undefined) {
        if (!data.targetDate) {
            nextDates.targetDate = undefined;
        } else {
            const parsedTargetDate = parseDateOnlyInput(data.targetDate);
            if (!parsedTargetDate) {
                return actionError("Invalid end date");
            }
            nextDates.targetDate = parsedTargetDate;
        }
    }
    updatePayload.dates = nextDates;

    try {
        const commitment = await CommitmentRepository.update(commitmentId, updatePayload);
        revalidatePath(`/detail/${floorId}`);
        revalidatePath(`/manage-project`);
        return actionSuccess(commitment);
    } catch (error) {
        console.error("Failed to update commitment details:", error);
        return actionError("Failed to update details");
    }
}
