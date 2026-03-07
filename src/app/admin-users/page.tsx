import { redirect } from "next/navigation";

/**
 * Backwards compatibility redirect.
 * The old /admin-users route has been migrated to /manage-project.
 */
export default function AdminUsersRedirect() {
    redirect("/manage-project");
}
