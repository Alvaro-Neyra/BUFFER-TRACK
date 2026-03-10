import { PendingAccessView } from "@/components/organisms/PendingAccessView";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { ProjectService } from "@/services/project.service";
import { ProjectRepository } from "@/repositories/project.repository";
import { CommitmentRepository } from "@/repositories/commitment.repository";
import { MasterPlanPage } from "@/components/organisms/MasterPlanPage";

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

  const [serializedBuildings, project, rawCommitments] = await Promise.all([
    ProjectService.getBuildingsForMasterPlan(),
    ProjectRepository.findById(activeProject.projectId),
    CommitmentRepository.findByProjectPopulated(activeProject.projectId),
  ]);

  // Filter commitments based on user role (Admin or the requester should see everything they created)
  const isManager = session.user.role === "Admin" || session.user.role === "Project Manager" || session.user.role === "Project Director";
  const filteredCommitments = isManager
    ? rawCommitments
    : rawCommitments.filter(c =>
      (c.assignedTo && c.assignedTo._id && c.assignedTo._id.toString() === session.user.id) ||
      (c.requesterId && c.requesterId._id && c.requesterId._id.toString() === session.user.id)
    );

  const serializedCommitments = filteredCommitments.map(c => ({
    _id: c._id.toString(),
    name: c.name || c.description || "Unnamed Activity",
    status: c.status,
    specialtyName: (c.specialtyId as any)?.name || "Unknown",
    specialtyColor: (c.specialtyId as any)?.colorHex || "#8B5CF6",
    assignedToName: (c.assignedTo as any)?.name || "Unassigned",
    buildingCode: (c.buildingId as any)?.code || "",
    buildingId: (c.buildingId as any)?._id?.toString() || "",
    floorLabel: (c.floorId as any)?.label || "",
    floorId: (c.floorId as any)?._id?.toString() || "",
    isOverdue: false, // Implement logic if needed later
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
  }));

  return (
    <MasterPlanPage
      masterPlanImageUrl={project?.masterPlanImageUrl || ""}
      buildings={serializedBuildings}
      commitments={serializedCommitments}
    />
  );
}
