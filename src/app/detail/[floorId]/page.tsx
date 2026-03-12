import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { getFloorData, getFloorCommitments, getSpecialtiesWithUsers } from "./actions";
import { statusRepository } from "@/repositories/status.repository";
import { roleRepository } from "@/repositories/role.repository";
import { isRestrictedStatus } from "@/lib/projectFeatures";
import { ProjectService } from "@/services/project.service";
import { DetailPlanView } from "./DetailPlanView";

export default async function DetailPlanPage({
    params,
}: {
    params: Promise<{ floorId: string }>;
}) {
    const { floorId } = await params;
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    await connectToDatabase();

    // Fetch floor data
    const floorResult = await getFloorData(floorId);
    if (!floorResult || !floorResult.success) {
        redirect("/");
    }
    const floorData = floorResult.data;

    const currentMembership = session.user.projects?.find(
        (project) => project.projectId === floorData.projectId && project.status === "Active"
    );
    if (!currentMembership) {
        redirect("/dashboard");
    }

    // Fetch data in parallel
    const [commitments, { specialties, users }, statuses, redListEnabled] = await Promise.all([
        getFloorCommitments(floorId),
        getSpecialtiesWithUsers(floorData.projectId),
        statusRepository.getAll(),
        ProjectService.isRedListEnabled(floorData.projectId),
    ]);

    const selectableStatuses = redListEnabled
        ? statuses
        : statuses.filter((status) => !isRestrictedStatus(status.name));

    const membershipRole = currentMembership?.roleId
        ? await roleRepository.getByIdInProject(currentMembership.roleId, floorData.projectId)
        : null;
    const canViewAllCommitments = Boolean(membershipRole?.isManager);

    const filteredCommitments = canViewAllCommitments
        ? commitments
        : commitments.filter(c => c.assignedToId === session.user.id || c.requesterId === session.user.id);

    return (
        <DetailPlanView
            floorData={floorData}
            commitments={filteredCommitments}
            specialties={specialties}
            users={users}
            statuses={selectableStatuses.map(s => ({ _id: s._id.toString(), name: s.name, colorHex: s.colorHex }))}
            currentUserId={session.user.id || ""}
        />
    );
}
