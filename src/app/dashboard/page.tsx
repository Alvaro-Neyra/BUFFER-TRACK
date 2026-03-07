import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { getDashboardMetrics } from "./actions";
import { ProjectService } from "@/services/project.service";
import { DashboardView } from "./DashboardView";
import { PendingAccessView } from "@/components/organisms/PendingAccessView";

export default async function DashboardPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const session = await auth();
    if (!session?.user) {
        redirect("/login");
    }

    await connectToDatabase();

    // Get the user's active project IDs
    const activeProjectIds = session.user.projects
        ?.filter(p => p.status === 'Active')
        .map(p => p.projectId) || [];

    if (activeProjectIds.length === 0) {
        return <PendingAccessView />;
    }

    // Delegate project lookup to the service
    const projectsList = await ProjectService.getProjectsForUser(activeProjectIds);

    if (projectsList.length === 0) {
        return <div className="p-8 text-center mt-20 text-neutral-500">No active projects found.</div>;
    }

    // Determine current project Id
    const queryProjectId = searchParams.projectId as string;
    const currentProjectId = queryProjectId && projectsList.some(p => p.id === queryProjectId)
        ? queryProjectId
        : projectsList[0].id;

    // Determine current week start (Monday)
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const queryWeekStart = searchParams.weekStart as string;
    const currentWeekStart = queryWeekStart ? new Date(queryWeekStart) : monday;

    // Fetch the metrics server-side
    const metrics = await getDashboardMetrics(currentProjectId, currentWeekStart);

    return (
        <DashboardView
            metrics={metrics}
            projectsList={projectsList}
            currentProjectId={currentProjectId}
            currentWeekStart={currentWeekStart.toISOString()}
        />
    );
}
