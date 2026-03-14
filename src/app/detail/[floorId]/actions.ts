"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { AssignmentRepository } from "@/repositories/assignment.repository";
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
    | { ok: true; userId: string; isManager: boolean; userSpecialtyId: string | null }
    | { ok: false; message: string };

function toObjectIdString(value: unknown): string | null {
    if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
        return null;
    }
    return value;
}

function memberCanEditAssignment(
    userId: string,
    isManager: boolean,
    requesterId: mongoose.Types.ObjectId,
    acceptedById?: mongoose.Types.ObjectId
): boolean {
    if (isManager) return true;
    if (requesterId.toString() === userId) return true;
    return Boolean(acceptedById?.toString() === userId);
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

    const membershipSpecialty = membership.specialtyId as unknown;
    const membershipSpecialtyId =
        membershipSpecialty && typeof membershipSpecialty === "object" && "_id" in membershipSpecialty
            ? (membershipSpecialty as { _id?: { toString: () => string } })._id?.toString() || null
            : typeof membershipSpecialty === "string"
                ? membershipSpecialty
                : null;

    let membershipIsManager = false;
    if (membership.roleId) {
        const membershipRole = await roleRepository.getByIdInProject(membership.roleId, projectId);
        membershipIsManager = Boolean(membershipRole?.isManager);
    }

    return {
        ok: true,
        userId: session.user.id,
        isManager: membershipIsManager,
        userSpecialtyId: membershipSpecialtyId,
    };
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

export async function getFloorAssignments(floorId: string) {
    await connectToDatabase();

    const assignments = await AssignmentRepository.findByFloorPopulated(floorId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return assignments.map((c: any) => ({
        _id: c._id.toString(),
        name: c.description || "",
        description: c.description || "",
        status: c.status as string,
        specialtyId: c.specialtyId?._id?.toString() || "",
        specialtyName: c.specialtyId?.name || "N/A",
        specialtyColor: c.specialtyId?.colorHex || "#94a3b8",
        requesterId: c.requesterId?._id?.toString() || c.requesterId?.toString() || "",
        requesterName: c.requesterId?.name || "Unknown",
        acceptedById: c.acceptedById?._id?.toString() || c.acceptedById?.toString() || "",
        acceptedByName: c.acceptedById?.name || "",
        acceptedAt: c.acceptedAt?.toISOString() || null,
        coordinates: { xPercent: c.coordinates.xPercent, yPercent: c.coordinates.yPercent },
        requiredDate: c.requiredDate?.toISOString() || null,
        createdAt: c.createdAt?.toISOString() || null,
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

export async function createAssignment(data: {
    projectId: string;
    buildingId: string;
    floorId: string;
    specialtyId: string;
    description: string;
    status?: string;
    requiredDate: string;
    coordinates: { xPercent: number; yPercent: number };
    polygon?: { xPercent: number; yPercent: number }[];
}) {
    const projectId = toObjectIdString(data.projectId);
    const buildingId = toObjectIdString(data.buildingId);
    const floorId = toObjectIdString(data.floorId);
    const specialtyId = toObjectIdString(data.specialtyId);

    if (!projectId || !buildingId || !floorId || !specialtyId) {
        return actionError("Invalid project context");
    }

    const access = await requireActiveProjectAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    const normalizedStatus = typeof data.status === "string" ? data.status.trim() : undefined;

    await connectToDatabase();

    const [building, floor, specialty] = await Promise.all([
        BuildingRepository.findById(buildingId),
        FloorRepository.findById(floorId),
        SpecialtyRepository.findById(specialtyId),
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

    const parsedRequiredDate = parseDateOnlyInput(data.requiredDate);
    if (!parsedRequiredDate) {
        return actionError("Invalid required date");
    }

    const day = parsedRequiredDate.getUTCDay();
    const diff = parsedRequiredDate.getUTCDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(Date.UTC(parsedRequiredDate.getUTCFullYear(), parsedRequiredDate.getUTCMonth(), diff));

    try {
        const assignment = await AssignmentRepository.create({
            projectId: new mongoose.Types.ObjectId(projectId),
            buildingId: new mongoose.Types.ObjectId(buildingId),
            floorId: new mongoose.Types.ObjectId(floorId),
            specialtyId: new mongoose.Types.ObjectId(specialtyId),
            requesterId: new mongoose.Types.ObjectId(access.userId),
            description: data.description,
            status: normalizedStatus || "Pending",
            coordinates: data.coordinates,
            polygon: data.polygon,
            requiredDate: parsedRequiredDate,
            weekStart,
        });

        revalidatePath(`/detail/${floorId}`);
        return actionSuccess(assignment);
    } catch (error) {
        console.error("Failed to create assignment:", error);
        return actionError("Failed to create assignment");
    }
}

export async function updateAssignmentStatus(assignmentId: string, status: string, floorId: string) {
    if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid assignment context");
    }

    await connectToDatabase();

    const existing = await AssignmentRepository.findById(assignmentId);
    if (!existing) return actionError("Not found");
    if (existing.floorId.toString() !== floorId) {
        return actionError("Invalid floor context");
    }

    const access = await requireActiveProjectAccess(existing.projectId.toString());
    if (!access.ok) {
        return actionError(access.message);
    }
    if (!memberCanEditAssignment(access.userId, access.isManager, existing.requesterId, existing.acceptedById)) {
        return actionError("Forbidden");
    }

    const normalizedStatus = status.trim();
    if (!normalizedStatus) {
        return actionError("Status is required");
    }

    try {
        await AssignmentRepository.updateStatus(assignmentId, normalizedStatus);
        revalidatePath(`/detail/${floorId}`);
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to update assignment:", error);
        return actionError("Failed to update status");
    }
}

export async function updateAssignmentDetails(
    assignmentId: string,
    data: {
        requiredDate?: string | null;
        status?: string;
    },
    floorId: string
) {
    if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid assignment context");
    }

    await connectToDatabase();

    const existing = await AssignmentRepository.findById(assignmentId);
    if (!existing) return actionError("Not found");
    if (existing.floorId.toString() !== floorId) {
        return actionError("Invalid floor context");
    }

    const access = await requireActiveProjectAccess(existing.projectId.toString());
    if (!access.ok) {
        return actionError(access.message);
    }
    if (!memberCanEditAssignment(access.userId, access.isManager, existing.requesterId, existing.acceptedById)) {
        return actionError("Forbidden");
    }

    const updatePayload: Record<string, unknown> = {};
    if (typeof data.status === "string") {
        const normalizedStatus = data.status.trim();
        if (!normalizedStatus) {
            return actionError("Status is required");
        }

        updatePayload.status = normalizedStatus;
    }

    if (data.requiredDate !== undefined) {
        if (!data.requiredDate) {
            return actionError("Required date is required");
        }

        const parsedRequiredDate = parseDateOnlyInput(data.requiredDate);
        if (!parsedRequiredDate) {
            return actionError("Invalid required date");
        }

        const day = parsedRequiredDate.getUTCDay();
        const diff = parsedRequiredDate.getUTCDate() - day + (day === 0 ? -6 : 1);
        updatePayload.requiredDate = parsedRequiredDate;
        updatePayload.weekStart = new Date(
            Date.UTC(parsedRequiredDate.getUTCFullYear(), parsedRequiredDate.getUTCMonth(), diff)
        );
    }

    try {
        const assignment = await AssignmentRepository.update(assignmentId, updatePayload);
        revalidatePath(`/detail/${floorId}`);
        revalidatePath(`/manage-project`);
        return actionSuccess(assignment);
    } catch (error) {
        console.error("Failed to update assignment details:", error);
        return actionError("Failed to update details");
    }
}

export async function acceptAssignment(assignmentId: string, floorId: string) {
    if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid assignment context");
    }

    await connectToDatabase();

    const existing = await AssignmentRepository.findById(assignmentId);
    if (!existing) return actionError("Not found");
    if (existing.floorId.toString() !== floorId) {
        return actionError("Invalid floor context");
    }

    const access = await requireActiveProjectAccess(existing.projectId.toString());
    if (!access.ok) {
        return actionError(access.message);
    }

    if (!access.userSpecialtyId) {
        return actionError("You must belong to a specialty to accept this assignment");
    }

    if (existing.specialtyId.toString() !== access.userSpecialtyId) {
        return actionError("Only active users from the same specialty can accept this assignment");
    }

    if (existing.acceptedById) {
        return actionError("Assignment already accepted");
    }

    try {
        await AssignmentRepository.update(assignmentId, {
            acceptedById: new mongoose.Types.ObjectId(access.userId),
            acceptedAt: new Date(),
        });
        revalidatePath(`/detail/${floorId}`);
        revalidatePath(`/manage-project`);
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to accept assignment:", error);
        return actionError("Failed to accept assignment");
    }
}
