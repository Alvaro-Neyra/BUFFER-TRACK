import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { UserAdminService } from "@/services/userAdmin.service";
import { ProjectService } from "@/services/project.service";
import { AssignmentRepository } from "@/repositories/assignment.repository";
import { SpecialtyRepository } from "@/repositories/specialty.repository";
import { statusRepository } from "@/repositories/status.repository";
import { roleRepository } from "@/repositories/role.repository";
import { UserRepository } from "@/repositories/user.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { PendingAccessView } from "@/components/organisms/PendingAccessView";
import { ManageProjectView } from "./ManageProjectView";

export default async function ManageProjectPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedSearchParams = await searchParams;
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    const isGlobalAdmin = session.user.role.toLowerCase() === "admin";

    await connectToDatabase();

    const dbUser = session.user.id ? await UserRepository.findById(session.user.id) : null;

    // Determine current project
    const activeDbProjectIds =
        dbUser?.projects
            ?.filter((p) => p.status === "Active")
            .map((p) => p.projectId.toString()) || [];

    const userProjectIds =
        activeDbProjectIds.length > 0
            ? activeDbProjectIds
            : session.user.projects
                ?.filter((p) => p.status === "Active")
                .map((p) => p.projectId) || [];

    if (userProjectIds.length === 0) {
        return <PendingAccessView />;
    }

    const queryProjectId = typeof resolvedSearchParams.projectId === "string"
        ? resolvedSearchParams.projectId
        : undefined;

    const sessionActiveMemberships =
        session.user.projects?.filter((project) => project.status === "Active") || [];

    const resolvedRolesByProject = new Map<string, Awaited<ReturnType<typeof roleRepository.getByIdInProject>> | null>();

    const resolveMembershipRoleInProject = async (projectId: string) => {
        if (resolvedRolesByProject.has(projectId)) {
            return resolvedRolesByProject.get(projectId) || null;
        }

        const dbMembership = dbUser?.projects?.find(
            (project) => project.projectId.toString() === projectId && project.status === "Active"
        );

        const sessionMembership = sessionActiveMemberships.find(
            (project) => project.projectId === projectId
        );

        let role = dbMembership?.roleId
            ? await roleRepository.getByIdInProject(dbMembership.roleId.toString(), projectId)
            : sessionMembership?.roleId
                ? await roleRepository.getByIdInProject(sessionMembership.roleId.toString(), projectId)
                : null;

        if (!role && session.user.id) {
            const roleByLegacyName = await roleRepository.findByNameInProject(session.user.role, projectId);
            if (roleByLegacyName?._id) {
                role = roleByLegacyName;
                await UserRepository.updateProjectMembership(session.user.id, projectId, {
                    roleId: roleByLegacyName._id.toString(),
                });
            }
        }

        resolvedRolesByProject.set(projectId, role);
        return role;
    };

    let managerProjectId: string | null = isGlobalAdmin ? userProjectIds[0] : null;
    if (!isGlobalAdmin) {
        for (const projectId of userProjectIds) {
            const role = await resolveMembershipRoleInProject(projectId);
            if (role?.isManager) {
                managerProjectId = projectId;
                break;
            }
        }
    }

    const requestedProjectId =
        queryProjectId && userProjectIds.includes(queryProjectId)
            ? queryProjectId
            : undefined;

    const currentProjectId = isGlobalAdmin
        ? requestedProjectId || userProjectIds[0]
        : requestedProjectId && (await resolveMembershipRoleInProject(requestedProjectId))?.isManager
            ? requestedProjectId
            : managerProjectId || userProjectIds[0];

    const membershipRole = isGlobalAdmin ? null : await resolveMembershipRoleInProject(currentProjectId);
    const hasManagerAccess = isGlobalAdmin || Boolean(membershipRole?.isManager);

    if (!hasManagerAccess) {
        redirect("/dashboard");
    }

    // Fetch all data in parallel
    const [userResult, buildings, assignments, specialties, statuses, roles] = await Promise.all([
        UserAdminService.getUsersByProject(currentProjectId, session.user.id || ""),
        ProjectService.getBuildingsWithFloors(currentProjectId),
        AssignmentRepository.findByProjectPopulated(currentProjectId),
        SpecialtyRepository.findByProjectId(currentProjectId),
        statusRepository.getAll(currentProjectId),
        roleRepository.getByProjectId(currentProjectId),
    ]);

    // Serialize assignments for client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedAssignments = assignments.map((c: any) => ({
        _id: c._id.toString(),
        buildingName: c.buildingId?.name || "N/A",
        buildingCode: c.buildingId?.code || "",
        floorId: c.floorId?._id?.toString() || c.floorId?.toString() || "",
        floorLabel: c.floorId?.label || "N/A",
        name: c.description || "Activity",
        description: c.description || "",
        specialtyId: c.specialtyId?._id?.toString() || c.specialtyId?.toString() || "",
        specialtyName: c.specialtyId?.name || "N/A",
        specialtyColor: c.specialtyId?.colorHex || "#cbd5e1",
        requesterName: c.requesterId?.name || "Unknown",
        acceptedById: c.acceptedById?._id?.toString() || c.acceptedById?.toString() || "",
        acceptedByName: c.acceptedById?.name || "",
        acceptedAt: c.acceptedAt?.toISOString() || null,
        status: c.status,
        requiredDate: c.requiredDate?.toISOString() || null,
        createdAt: c.createdAt?.toISOString() || null,
        coordinates: c.coordinates,
        polygon: c.polygon?.map((p: { xPercent: number; yPercent: number }) => ({
            xPercent: p.xPercent,
            yPercent: p.yPercent,
        })) || undefined,
    }));

    // Serialize specialties for client
    const serializedSpecialties = specialties.map((s) => ({
        _id: s._id.toString(),
        projectId: s.projectId.toString(),
        name: s.name,
        colorHex: s.colorHex,
    }));

    // Serialize statuses for client
    const serializedStatuses = statuses.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        colorHex: s.colorHex,
        isPPC: s.isPPC || false,
    }));

    // Serialize roles for client
    const serializedRoles = roles.map((r) => ({
        _id: r._id.toString(),
        projectId: r.projectId.toString(),
        name: r.name,
        isManager: r.isManager,
        specialtiesIds: (r.specialtiesIds || []).map((id) => id.toString()),
    }));

    // Compute assignment counts per building
    const assignmentCounts: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments.forEach((c: any) => {
        const bId = c.buildingId?._id?.toString() || c.buildingId?.toString() || "";
        if (bId) assignmentCounts[bId] = (assignmentCounts[bId] || 0) + 1;
    });

    // Fetch master plan image from DB
    const project = await ProjectRepository.findById(currentProjectId);
    const masterPlanImageUrl = project?.masterPlanImageUrl || "";

    return (
        <ManageProjectView
            pendingUsers={userResult.pendingUsers}
            activeUsers={userResult.activeUsers}
            buildings={buildings}
            assignments={serializedAssignments}
            specialties={serializedSpecialties}
            statuses={serializedStatuses}
            roles={serializedRoles}
            currentProjectId={currentProjectId}
            masterPlanImageUrl={masterPlanImageUrl}
            assignmentCounts={assignmentCounts}
        />
    );
}
