import { PendingAccessView } from "@/components/organisms/PendingAccessView";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { ProjectService } from "@/services/project.service";
import { ProjectRepository } from "@/repositories/project.repository";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { roleRepository } from "@/repositories/role.repository";
import { MasterPlanPage } from "@/components/organisms/MasterPlanPage";

function asNamedEntity(value: unknown): { _id?: { toString: () => string } | string; name?: string } | null {
  if (!value || typeof value !== "object") return null;
  return value as { _id?: { toString: () => string } | string; name?: string };
}

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

export default async function Home() {
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

  const [serializedBuildings, project, rawCommitments, membershipRole] = await Promise.all([
    ProjectService.getBuildingsForMasterPlan(),
    ProjectRepository.findById(activeProject.projectId),
    CommitmentRepository.findByProjectPopulated(activeProject.projectId),
    membershipRolePromise,
  ]);

  // Filter commitments based on user role (Admin or the requester should see everything they created)
  const isManager = Boolean(membershipRole?.isManager);
  const filteredCommitments = isManager
    ? rawCommitments
    : rawCommitments.filter(c =>
      (c.assignedTo && c.assignedTo._id && c.assignedTo._id.toString() === session.user.id) ||
      (c.requesterId && c.requesterId._id && c.requesterId._id.toString() === session.user.id)
    );

  const serializedCommitments = filteredCommitments.map(c => {
    const specialty = asSpecialtyEntity(c.specialtyId);
    const assignedTo = asNamedEntity(c.assignedTo);
    const building = asBuildingEntity(c.buildingId);
    const floor = asFloorEntity(c.floorId);

    return {
      _id: c._id.toString(),
      name: c.name || c.description || "Unnamed Activity",
      status: c.status,
      specialtyName: specialty?.name || "Unknown",
      specialtyColor: specialty?.colorHex || "#8B5CF6",
      assignedToName: assignedTo?.name || "Unassigned",
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
      commitments={serializedCommitments}
    />
  );
}
