import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { getFloorData, getFloorAssignments, getSpecialtiesWithUsers } from "./actions";
import { statusRepository } from "@/repositories/status.repository";
import { roleRepository } from "@/repositories/role.repository";
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
    const [assignments, { specialties }, statuses] = await Promise.all([
        getFloorAssignments(floorId),
        getSpecialtiesWithUsers(floorData.projectId),
        statusRepository.getAll(floorData.projectId),
    ]);

    const membershipRole = currentMembership?.roleId
        ? await roleRepository.getByIdInProject(currentMembership.roleId, floorData.projectId)
        : null;
    const canViewAllAssignments = Boolean(membershipRole?.isManager);

    const membershipSpecialty = currentMembership.specialtyId as unknown;
    const membershipSpecialtyId =
        membershipSpecialty && typeof membershipSpecialty === "object" && "_id" in membershipSpecialty
            ? (membershipSpecialty as { _id?: { toString: () => string } })._id?.toString() || ""
            : typeof membershipSpecialty === "string"
                ? membershipSpecialty
                : "";

    const filteredAssignments = canViewAllAssignments
        ? assignments
        : assignments.filter((assignment) => (
            assignment.requesterId === session.user.id
            || (membershipSpecialtyId && assignment.specialtyId === membershipSpecialtyId)
        ));

    return (
        <DetailPlanView
            floorData={floorData}
            assignments={filteredAssignments}
            specialties={specialties}
            statuses={statuses.map(s => ({ _id: s._id.toString(), name: s.name, colorHex: s.colorHex }))}
            currentUserId={session.user.id || ""}
        />
    );
}
