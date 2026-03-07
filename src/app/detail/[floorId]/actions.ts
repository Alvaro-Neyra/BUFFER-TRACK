"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { UserRepository } from "@/repositories/user.repository";
import { FloorRepository } from "@/repositories/floor.repository";
import { BuildingRepository } from "@/repositories/building.repository";
import { SpecialtyRepository } from "@/repositories/specialty.repository";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";

// ─── Data Fetching ───────────────────────────────────────────────

export async function getFloorData(floorId: string) {
    // Guard against invalid ObjectIds (e.g. old bookmarks using building codes)
    if (!mongoose.isValidObjectId(floorId)) return null;

    await connectToDatabase();

    const floor = await FloorRepository.findById(floorId);
    if (!floor) return null;

    const building = await BuildingRepository.findById(floor.buildingId.toString());

    return {
        _id: floor._id.toString(),
        label: floor.label,
        order: floor.order,
        gcsImageUrl: floor.gcsImageUrl,
        buildingId: floor.buildingId.toString(),
        buildingName: building?.name || "Unknown",
        buildingCode: building?.code || "",
        projectId: building?.projectId.toString() || "",
    };
}

export async function getFloorCommitments(floorId: string) {
    await connectToDatabase();

    const commitments = await CommitmentRepository.findByFloorPopulated(floorId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return commitments.map((c: any) => ({
        _id: c._id.toString(),
        description: c.description || "",
        status: c.status as string,
        specialtyName: c.specialtyId?.name || "N/A",
        specialtyColor: c.specialtyId?.colorHex || "#94a3b8",
        assignedToName: c.assignedTo?.name || "Unassigned",
        assignedToCompany: c.assignedTo?.company || "",
        requesterName: c.requesterId?.name || "Unknown",
        coordinates: { xPercent: c.coordinates.xPercent, yPercent: c.coordinates.yPercent },
        targetDate: c.dates?.targetDate?.toISOString() || null,
        requestDate: c.dates?.requestDate?.toISOString() || null,
        weekStart: c.weekStart?.toISOString() || null,
    }));
}

export async function getSpecialtiesWithUsers(projectId: string) {
    await connectToDatabase();

    const specialties = await SpecialtyRepository.findAll();
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users: activeUsers.map((u: any) => ({
            _id: u._id.toString(),
            name: u.name,
            company: u.company || "",
            role: u.role,
            specialtyId: u.specialtyId?.toString() || "",
        })),
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
    targetDate?: string;
    coordinates: { xPercent: number; yPercent: number };
}) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    // Calculate weekStart (Monday of the target week)
    let weekStart: Date | undefined;
    if (data.targetDate) {
        const target = new Date(data.targetDate);
        const day = target.getDay();
        const diff = target.getDate() - day + (day === 0 ? -6 : 1);
        weekStart = new Date(target);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
    }

    try {
        await CommitmentRepository.create({
            projectId: new mongoose.Types.ObjectId(data.projectId),
            buildingId: new mongoose.Types.ObjectId(data.buildingId),
            floorId: new mongoose.Types.ObjectId(data.floorId),
            specialtyId: new mongoose.Types.ObjectId(data.specialtyId),
            requesterId: new mongoose.Types.ObjectId(session.user.id),
            assignedTo: data.assignedTo ? new mongoose.Types.ObjectId(data.assignedTo) : undefined,
            description: data.description,
            status: "Request",
            coordinates: data.coordinates,
            dates: {
                requestDate: new Date(),
                targetDate: data.targetDate ? new Date(data.targetDate) : undefined,
            },
            weekStart,
        });

        revalidatePath(`/detail/${data.floorId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to create commitment:", error);
        return { success: false, error: "Failed to create commitment" };
    }
}

export async function updateCommitmentStatus(commitmentId: string, status: string, floorId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    await connectToDatabase();

    try {
        await CommitmentRepository.updateStatus(commitmentId, status);
        revalidatePath(`/detail/${floorId}`);
        return { success: true };
    } catch (error) {
        console.error("Failed to update commitment:", error);
        return { success: false, error: "Failed to update status" };
    }
}
