"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { RestrictionRepository } from "@/repositories/restriction.repository";
import { roleRepository } from "@/repositories/role.repository";
import mongoose from "mongoose";

export async function getProjectCommitments(projectId: string) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");

    const membership = session.user.projects?.find(
        (project) => project.projectId === projectId && project.status === "Active"
    );
    if (!membership) throw new Error("Unauthorized");

    await connectToDatabase();

    const membershipRole = membership.roleId
        ? await roleRepository.getByIdInProject(membership.roleId, projectId)
        : null;
    const isManager = Boolean(membershipRole?.isManager);
    const userSpecialtyId = membership.specialtyId;

    // 1. Fetch commitments with populated references
    const rawCommitments = await CommitmentRepository.findByProjectPopulated(projectId);

    let commitments = rawCommitments;
    if (!isManager && userSpecialtyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        commitments = rawCommitments.filter((c: any) => c.specialtyId?._id?.toString() === userSpecialtyId);
    }

    // Process commitments to plain JS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedCommitments = commitments.map((c: any) => ({
        id: c._id.toString(),
        taskName: c.name,
        location: `${c.buildingId?.name || 'Unknown BLD'} • ${c.floorId?.label || 'Unknown Level'}`,
        specialtyName: c.specialtyId?.name || 'Unknown',
        specialtyColor: c.specialtyId?.colorHex || '#ccc',
        status: c.status,
        targetDate: c.dates?.targetEnd ? new Date(c.dates.targetEnd).toLocaleDateString() : 'TBD',
        assignedTo: c.assignedTo ? `${c.assignedTo.name} (${c.assignedTo.company})` : 'Unassigned',
    }));

    // 2. Fetch active restrictions
    const commitmentIds = commitments.map(c => c._id as mongoose.Types.ObjectId);
    const rawRestrictions = await RestrictionRepository.findActiveByProject(projectId, commitmentIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedRestrictions = rawRestrictions.map((r: any) => ({
        id: r._id.toString(),
        description: r.description,
        location: `${r.commitmentId?.buildingId?.name || ''} • ${r.commitmentId?.floorId?.level || ''}`,
        reportedBy: r.reportedBy ? `${r.reportedBy.firstName} ${r.reportedBy.lastName} (${r.reportedBy.companyName})` : 'Unknown',
        solver: r.solver,
        targetDate: r.commitmentId?.dates?.targetEnd ? new Date(r.commitmentId.dates.targetEnd).toLocaleDateString() : 'TBD',
        commitmentId: r.commitmentId?._id?.toString() || '',
    }));

    return {
        commitments: processedCommitments,
        restrictions: processedRestrictions,
        isManager
    };
}
