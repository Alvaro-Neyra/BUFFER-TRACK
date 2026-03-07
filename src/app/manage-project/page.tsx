import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { isManagerRole } from "@/constants/roles";
import { UserAdminService } from "@/services/userAdmin.service";
import { ProjectService } from "@/services/project.service";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { SpecialtyRepository } from "@/repositories/specialty.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { PendingAccessView } from "@/components/organisms/PendingAccessView";
import { ManageProjectView } from "./ManageProjectView";

export default async function ManageProjectPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    if (!isManagerRole(session.user.role)) {
        redirect("/dashboard");
    }

    await connectToDatabase();

    // Determine current project
    const userProjectIds =
        session.user.projects
            ?.filter((p) => p.status === "Active")
            .map((p) => p.projectId) || [];

    if (userProjectIds.length === 0) {
        return <PendingAccessView />;
    }

    const queryProjectId = searchParams.projectId as string;
    const currentProjectId =
        queryProjectId && userProjectIds.includes(queryProjectId)
            ? queryProjectId
            : userProjectIds[0];

    // Fetch all data in parallel
    const [userResult, buildings, commitments, specialties] = await Promise.all([
        UserAdminService.getUsersByProject(currentProjectId, session.user.id || ""),
        ProjectService.getBuildingsWithFloors(currentProjectId),
        CommitmentRepository.findByProjectPopulated(currentProjectId),
        SpecialtyRepository.findAll(),
    ]);

    // Serialize commitments for client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedCommitments = commitments.map((c: any) => ({
        _id: c._id.toString(),
        buildingName: c.buildingId?.name || "N/A",
        buildingCode: c.buildingId?.code || "",
        floorLabel: c.floorId?.label || "N/A",
        specialtyName: c.specialtyId?.name || "N/A",
        specialtyColor: c.specialtyId?.colorHex || "#cbd5e1",
        assignedToName: c.assignedTo?.name || "Unassigned",
        requesterName: c.requesterId?.name || "Unknown",
        status: c.status,
        targetDate: c.dates?.targetDate?.toISOString() || null,
        requestDate: c.dates?.requestDate?.toISOString() || null,
        coordinates: c.coordinates,
    }));

    // Serialize specialties for client
    const serializedSpecialties = specialties.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        colorHex: s.colorHex,
    }));

    // Compute commitment counts per building
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commitmentCounts: Record<string, number> = {};
    commitments.forEach((c: any) => {
        const bId = c.buildingId?._id?.toString() || c.buildingId?.toString() || "";
        if (bId) commitmentCounts[bId] = (commitmentCounts[bId] || 0) + 1;
    });

    // Fetch master plan image from DB
    const project = await ProjectRepository.findById(currentProjectId);
    const masterPlanImageUrl = project?.masterPlanImageUrl || "";

    return (
        <ManageProjectView
            pendingUsers={userResult.pendingUsers}
            activeUsers={userResult.activeUsers}
            buildings={buildings}
            commitments={serializedCommitments}
            specialties={serializedSpecialties}
            currentProjectId={currentProjectId}
            masterPlanImageUrl={masterPlanImageUrl}
            commitmentCounts={commitmentCounts}
        />
    );
}
