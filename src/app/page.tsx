import { PendingAccessView } from "@/components/organisms/PendingAccessView";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { ProjectService } from "@/services/project.service";
import { ProjectRepository } from "@/repositories/project.repository";
import { AssignmentRepository } from "@/repositories/assignment.repository";
import { roleRepository } from "@/repositories/role.repository";
import { MasterPlanPage } from "@/components/organisms/MasterPlanPage";

function asSpecialtyEntity(value: unknown): { name?: string; colorHex?: string } | null {
  if (!value || typeof value !== "object") return null;
  return value as { name?: string; colorHex?: string };
}

function asBuildingEntity(value: unknown): { _id?: { toString: () => string } | string; code?: string } | null {
  if (!value || typeof value !== "object") return null;
  return value as { _id?: { toString: () => string } | string; code?: string };
}

function asFloorEntity(value: unknown): { _id?: { toString: () => string } | string; label?: string } | null {
  if (!value || typeof value !== "object") return null;
  return value as { _id?: { toString: () => string } | string; label?: string };
}

function entityIdToString(entity: { _id?: { toString: () => string } | string } | null): string {
  if (!entity?._id) return "";
  return typeof entity._id === "string" ? entity._id : entity._id.toString();
}

function getStringSearchParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const activeProject = session.user.projects?.find(p => p.status === 'Active');
  if (!activeProject) {
    return <PendingAccessView />;
  }

  await connectToDatabase();

  const membershipRolePromise = activeProject.roleId
    ? roleRepository.getByIdInProject(activeProject.roleId, activeProject.projectId)
    : Promise.resolve(null);

  const [serializedBuildings, project, rawAssignments, membershipRole] = await Promise.all([
    ProjectService.getBuildingsForMasterPlan(activeProject.projectId),
    ProjectRepository.findById(activeProject.projectId),
    AssignmentRepository.findByProjectPopulated(activeProject.projectId),
    membershipRolePromise,
  ]);

  // Filter assignments based on user role (Admin or requester visibility)
  const isManager = Boolean(membershipRole?.isManager);
  const filteredAssignments = isManager
    ? rawAssignments
    : rawAssignments.filter(c =>
      (c.requesterId && c.requesterId._id && c.requesterId._id.toString() === session.user.id)
    );

  const serializedAssignments = filteredAssignments.map(c => {
    const specialty = asSpecialtyEntity(c.specialtyId);
    const building = asBuildingEntity(c.buildingId);
    const floor = asFloorEntity(c.floorId);

    return {
      _id: c._id.toString(),
      name: c.description || "Unnamed Activity",
      status: c.status,
      specialtyName: specialty?.name || "Unknown",
      specialtyColor: specialty?.colorHex || "#8B5CF6",
      buildingCode: building?.code || "",
      buildingId: entityIdToString(building),
      floorLabel: floor?.label || "",
      floorId: entityIdToString(floor),
      isOverdue: false, // Implement logic if needed later
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
    };
  });

  return (
    <MasterPlanPage
      masterPlanImageUrl={project?.masterPlanImageUrl || ""}
      buildings={serializedBuildings}
      assignments={serializedAssignments}
      initialOpenBuildingId={getStringSearchParam(resolvedSearchParams.openBuildingId)}
    />
  );
}
