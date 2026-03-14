import React from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { getProjectAssignments } from "./actions";
import { ProjectService } from "@/services/project.service";
import { AssignmentsView } from "./AssignmentsView";
import { PendingAccessView } from "@/components/organisms/PendingAccessView";

export default async function AssignmentsPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolvedSearchParams = await searchParams;
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
    const queryProjectId = resolvedSearchParams.projectId as string;
    const currentProjectId = queryProjectId && projectsList.some(p => p.id === queryProjectId)
        ? queryProjectId
        : projectsList[0].id;

    const data = await getProjectAssignments(currentProjectId);

    return (
        <AssignmentsView
            assignments={data.assignments}
            statuses={data.statuses}
            projectsList={projectsList}
            currentProjectId={currentProjectId}
            isManager={data.isManager}
        />
    );
}
