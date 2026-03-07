import { GlobalHeader } from "@/components/organisms/GlobalHeader";
import { ProjectKPIs } from "@/components/organisms/ProjectKPIs";
import { PendingTasksSidebar } from "@/components/organisms/PendingTasksSidebar";
import { MasterPlanViewer } from "@/components/organisms/MasterPlanViewer";
import { PendingAccessView } from "@/components/organisms/PendingAccessView";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { ProjectService } from "@/services/project.service";
import { ProjectRepository } from "@/repositories/project.repository";

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

  // Fetch buildings and project in parallel
  const [serializedBuildings, project] = await Promise.all([
    ProjectService.getBuildingsForMasterPlan(),
    ProjectRepository.findById(activeProject.projectId),
  ]);

  const masterPlanImageUrl = project?.masterPlanImageUrl || "";

  return (
    <div className="flex flex-col h-full w-full">
      <GlobalHeader showSearch={true} showLinks={true} />
      <ProjectKPIs />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-y-auto p-4 lg:p-6 border-r border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-4">
            <h1 className="text-neutral-900 dark:text-white text-2xl font-black leading-tight tracking-tight">Master Plan Overview</h1>
          </div>

          {masterPlanImageUrl ? (
            <MasterPlanViewer
              imageUrl={masterPlanImageUrl}
              buildings={serializedBuildings}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 min-h-[400px]">
              <span className="material-symbols-outlined text-5xl text-neutral-300 mb-3">map</span>
              <p className="text-sm font-medium text-neutral-500">No master plan image uploaded yet</p>
              <p className="text-xs text-neutral-400 mt-1">Go to Manage Project → Buildings to upload one</p>
            </div>
          )}
        </div>

        <PendingTasksSidebar />
      </div>
    </div>
  );
}
