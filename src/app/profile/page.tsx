import React from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { ProjectService } from "@/services/project.service";
import { UserRepository } from "@/repositories/user.repository";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    await connectToDatabase();

    const user = await UserRepository.findById(session.user.id);
    if (!user) {
        redirect("/login");
    }

    const memberships = (user.projects || []).map((membership) => ({
        projectId: membership.projectId.toString(),
        status: membership.status,
    }));

    const projectIds = memberships.map((membership) => membership.projectId);
    const projects = await ProjectService.getProjectsForUser(projectIds);
    const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

    const membershipsWithNames = memberships.map((membership) => ({
        projectId: membership.projectId,
        status: membership.status,
        projectName: projectNameById.get(membership.projectId) || "Unnamed Project",
    }));

    return (
        <ProfileView
            initialName={user.name}
            initialEmail={user.email}
            initialCompany={user.company || ""}
            roleName={session.user.role}
            memberships={membershipsWithNames}
        />
    );
}
