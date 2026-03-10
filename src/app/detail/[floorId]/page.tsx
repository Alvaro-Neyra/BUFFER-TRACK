import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { getFloorData, getFloorCommitments, getSpecialtiesWithUsers } from "./actions";
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

    const hasActiveProject = session.user.projects?.some(p => p.status === "Active");
    if (!hasActiveProject) {
        redirect("/dashboard");
    }

    await connectToDatabase();

    // Fetch floor data
    const floorData = await getFloorData(floorId);
    if (!floorData) {
        redirect("/");
    }

    // Fetch data in parallel
    const [commitments, { specialties, users }] = await Promise.all([
        getFloorCommitments(floorId),
        getSpecialtiesWithUsers(floorData.projectId),
    ]);

    const filteredCommitments = session.user.role === "Admin" || session.user.role === "Project Manager" || session.user.role === "Project Director"
        ? commitments
        : commitments.filter(c => c.assignedToId === session.user.id || c.requesterId === session.user.id);

    return (
        <DetailPlanView
            floorData={floorData}
            commitments={filteredCommitments}
            specialties={specialties}
            users={users}
            currentUserId={session.user.id || ""}
        />
    );
}
