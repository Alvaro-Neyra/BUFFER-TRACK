"use server";

import { auth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { UserAdminService } from "@/services/userAdmin.service";
import { ProjectService } from "@/services/project.service";
import { ProjectRepository } from "@/repositories/project.repository";
import { BuildingRepository } from "@/repositories/building.repository";
import { FloorRepository } from "@/repositories/floor.repository";
import { SpecialtyRepository } from "@/repositories/specialty.repository";
import { statusRepository } from "@/repositories/status.repository";
import { roleRepository } from "@/repositories/role.repository";
import { AssignmentRepository } from "@/repositories/assignment.repository";
import { UserRepository } from "@/repositories/user.repository";
import { deleteCloudinaryAsset, extractCloudinaryPublicId } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";
import { actionSuccess, actionError } from "@/lib/apiResponse";
import mongoose from "mongoose";

type TAccessResult =
    | { ok: true; userId: string }
    | { ok: false; message: string };

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveProjectIdFromBuildingId(buildingId: string): Promise<string | null> {
    const building = await BuildingRepository.findById(buildingId);
    return building?.projectId?.toString() || null;
}

async function resolveProjectIdFromFloorId(floorId: string): Promise<string | null> {
    const floor = await FloorRepository.findById(floorId);
    if (!floor) return null;
    return resolveProjectIdFromBuildingId(floor.buildingId.toString());
}

async function resolveProjectIdFromAssignmentId(assignmentId: string): Promise<string | null> {
    const assignment = await AssignmentRepository.findById(assignmentId);
    return assignment?.projectId?.toString() || null;
}

async function requireProjectManagerAccess(projectId: string): Promise<TAccessResult> {
    if (!mongoose.isValidObjectId(projectId)) {
        return { ok: false, message: "Invalid project id" };
    }

    const session = await auth();
    if (!session?.user) {
        return { ok: false, message: "Unauthorized" };
    }

    const dbUser = await UserRepository.findById(session.user.id);
    if (!dbUser) {
        return { ok: false, message: "Unauthorized" };
    }

    const membership = dbUser.projects?.find(
        (project) => project.projectId.toString() === projectId && project.status === "Active"
    );

    if (!membership) {
        return { ok: false, message: "Unauthorized" };
    }

    // Global Admin keeps full access as long as membership in the project is active.
    if (session.user.role.toLowerCase() === "admin") {
        return { ok: true, userId: session.user.id };
    }

    let membershipRoleId = membership.roleId?.toString();

    if (!membershipRoleId) {
        const roleByLegacyName = await roleRepository.findByNameInProject(session.user.role, projectId);
        if (roleByLegacyName?._id) {
            membershipRoleId = roleByLegacyName._id.toString();
            await UserRepository.updateProjectMembership(session.user.id, projectId, {
                roleId: membershipRoleId,
            });
        }
    }

    if (!membershipRoleId) {
        return { ok: false, message: "Unauthorized" };
    }

    const membershipRole = await roleRepository.getByIdInProject(membershipRoleId, projectId);
    if (membershipRole?.isManager) {
        return { ok: true, userId: session.user.id };
    }

    return { ok: false, message: "Unauthorized" };
}

// ─── Project Settings Actions ─────────────────────────────────────

export async function updateMasterPlanImage(projectId: string, imageUrl: string, cloudinaryPublicId?: string) {
    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    const normalizedImageUrl = normalizeOptionalString(imageUrl);
    if (!normalizedImageUrl) {
        return actionError("Invalid image URL");
    }

    const resolvedPublicId =
        normalizeOptionalString(cloudinaryPublicId) ??
        extractCloudinaryPublicId(normalizedImageUrl) ??
        undefined;

    await connectToDatabase();

    const project = await ProjectRepository.findById(projectId);
    if (!project) {
        return actionError("Project not found");
    }

    const previousImageUrl = normalizeOptionalString(project.masterPlanImageUrl);
    const previousPublicId = normalizeOptionalString(project.masterPlanCloudinaryPublicId);
    const hasImageReplacement = previousImageUrl && previousImageUrl !== normalizedImageUrl;
    let projectUpdated = false;

    try {
        await ProjectRepository.updateById(projectId, {
            masterPlanImageUrl: normalizedImageUrl,
            masterPlanCloudinaryPublicId: resolvedPublicId ?? null,
        });
        projectUpdated = true;

        if (hasImageReplacement) {
            await deleteCloudinaryAsset({
                url: previousImageUrl,
                publicId: previousPublicId,
                context: `replace-master-plan:${projectId}`,
            });
        }

        revalidatePath('/manage-project');
        revalidatePath('/');
        return actionSuccess(true);
    } catch (error) {
        if (!projectUpdated) {
            await deleteCloudinaryAsset({
                url: normalizedImageUrl,
                publicId: resolvedPublicId,
                context: `rollback-master-plan:${projectId}`,
            });
        }

        console.error("Failed to update master plan image:", error);
        return actionError("Failed to update image");
    }
}

export async function handleUserProjectAccess(
    userId: string,
    projectId: string,
    action: 'accept' | 'reject' | 'remove'
) {
    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        await UserAdminService.handleAccess(userId, projectId, action);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error(`Failed to ${action} user ${userId}:`, error);
        return actionError("Database operation failed");
    }
}

// ─── Building Management Actions ─────────────────────────────────

export async function createBuilding(
    projectId: string,
    data: {
        name: string;
        code: string;
        number: number;
        coordinates: { xPercent: number; yPercent: number };
        polygon?: Array<{ xPercent: number; yPercent: number }>;
        color?: string;
    }
) {
    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const building = await ProjectService.createBuilding(projectId, data);
        revalidatePath('/manage-project');
        return actionSuccess(building);
    } catch (error) {
        console.error("Failed to create building:", error);
        return actionError("Failed to create building");
    }
}

export async function updateBuilding(
    buildingId: string,
    data: { name?: string; code?: string; number?: number; color?: string; coordinates?: { xPercent: number; yPercent: number } }
) {
    if (!mongoose.isValidObjectId(buildingId)) {
        return actionError("Invalid building id");
    }

    const projectId = await resolveProjectIdFromBuildingId(buildingId);
    if (!projectId) {
        return actionError("Building not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        await ProjectService.updateBuilding(buildingId, data);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to update building:", error);
        return actionError("Failed to update building");
    }
}

export async function deleteBuilding(buildingId: string) {
    if (!mongoose.isValidObjectId(buildingId)) {
        return actionError("Invalid building id");
    }

    const projectId = await resolveProjectIdFromBuildingId(buildingId);
    if (!projectId) {
        return actionError("Building not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        await ProjectService.deleteBuilding(buildingId);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to delete building:", error);
        return actionError("Failed to delete building");
    }
}

// ─── Floor Management Actions ────────────────────────────────────

export async function createFloor(
    buildingId: string,
    data: { label: string; order: number; gcsImageUrl: string; cloudinaryPublicId?: string }
) {
    if (!mongoose.isValidObjectId(buildingId)) {
        return actionError("Invalid building id");
    }

    const projectId = await resolveProjectIdFromBuildingId(buildingId);
    if (!projectId) {
        return actionError("Building not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    let floorCreated = false;

    try {
        const floor = await ProjectService.createFloor(buildingId, data);
        floorCreated = true;
        revalidatePath('/manage-project');
        return actionSuccess(floor);
    } catch (error) {
        if (!floorCreated) {
            await deleteCloudinaryAsset({
                url: data.gcsImageUrl,
                publicId: data.cloudinaryPublicId,
                context: `rollback-create-floor:${buildingId}`,
            });
        }

        console.error("Failed to create floor:", error);
        return actionError("Failed to create floor");
    }
}

export async function updateFloor(
    floorId: string,
    data: { label?: string; order?: number; gcsImageUrl?: string; cloudinaryPublicId?: string }
) {
    if (!mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid floor id");
    }

    const projectId = await resolveProjectIdFromFloorId(floorId);
    if (!projectId) {
        return actionError("Floor not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    let floorUpdated = false;

    try {
        await ProjectService.updateFloor(floorId, data);
        floorUpdated = true;
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        if (!floorUpdated && data.gcsImageUrl) {
            await deleteCloudinaryAsset({
                url: data.gcsImageUrl,
                publicId: data.cloudinaryPublicId,
                context: `rollback-update-floor:${floorId}`,
            });
        }

        console.error("Failed to update floor:", error);
        return actionError("Failed to update floor");
    }
}

export async function deleteFloor(floorId: string) {
    if (!mongoose.isValidObjectId(floorId)) {
        return actionError("Invalid floor id");
    }

    const projectId = await resolveProjectIdFromFloorId(floorId);
    if (!projectId) {
        return actionError("Floor not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        await ProjectService.deleteFloor(floorId);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to delete floor:", error);
        return actionError("Failed to delete floor");
    }
}

// ─── Assignment (Activity) Management Actions ─────────────────────

export async function updateAssignment(assignmentId: string, data: Record<string, unknown>) {
    if (!mongoose.isValidObjectId(assignmentId)) {
        return actionError("Invalid activity id");
    }

    const projectId = await resolveProjectIdFromAssignmentId(assignmentId);
    if (!projectId) {
        return actionError("Activity not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    const normalizedStatus = typeof data.status === "string" ? data.status.trim() : data.status;

    await connectToDatabase();

    try {
        const assignment = await AssignmentRepository.update(assignmentId, {
            ...data,
            ...(typeof normalizedStatus === "string" ? { status: normalizedStatus } : {}),
        });
        revalidatePath('/manage-project');
        return actionSuccess(assignment);
    } catch (error) {
        console.error("Failed to update assignment:", error);
        return actionError("Failed to update activity");
    }
}

export async function deleteAssignment(assignmentId: string) {
    if (!mongoose.isValidObjectId(assignmentId)) {
        return actionError("Invalid activity id");
    }

    const projectId = await resolveProjectIdFromAssignmentId(assignmentId);
    if (!projectId) {
        return actionError("Activity not found");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        await AssignmentRepository.delete(assignmentId);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to delete assignment:", error);
        return actionError("Failed to delete activity");
    }
}

// ─── Specialty Management Actions ────────────────────────────────

export async function createSpecialty(data: { projectId: string; name: string; colorHex: string }) {
    if (!mongoose.isValidObjectId(data.projectId)) {
        return actionError("Invalid project id");
    }

    const access = await requireProjectManagerAccess(data.projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existing = await SpecialtyRepository.findByNameInProject(data.name, data.projectId);
        if (existing) {
            return actionError("A specialty with this name already exists in this project");
        }

        const specialty = await SpecialtyRepository.create({
            projectId: new mongoose.Types.ObjectId(data.projectId),
            name: data.name,
            colorHex: data.colorHex,
        });
        revalidatePath('/manage-project');
        return actionSuccess(specialty);
    } catch (error) {
        console.error("Failed to create specialty:", error);
        return actionError("Failed to create specialty");
    }
}

export async function updateSpecialty(id: string, data: { projectId: string; name?: string; colorHex?: string }) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(data.projectId)) {
        return actionError("Invalid id");
    }

    const access = await requireProjectManagerAccess(data.projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existing = await SpecialtyRepository.findById(id);
        if (!existing || existing.projectId.toString() !== data.projectId) {
            return actionError("Specialty not found in current project");
        }

        if (data.name && data.name !== existing.name) {
            const nameConflict = await SpecialtyRepository.findByNameInProject(data.name, data.projectId);
            if (nameConflict && nameConflict._id.toString() !== id) {
                return actionError("A specialty with this name already exists in this project");
            }
        }

        const specialty = await SpecialtyRepository.update(id, {
            ...(data.name ? { name: data.name } : {}),
            ...(data.colorHex ? { colorHex: data.colorHex } : {}),
        });
        revalidatePath('/manage-project');
        return actionSuccess(specialty);
    } catch (error) {
        console.error("Failed to update specialty:", error);
        return actionError("Failed to update specialty");
    }
}

export async function deleteSpecialty(id: string, projectId: string) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(projectId)) {
        return actionError("Invalid id");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existing = await SpecialtyRepository.findById(id);
        if (!existing || existing.projectId.toString() !== projectId) {
            return actionError("Specialty not found in current project");
        }

        const rolesUsingSpecialty = await roleRepository.countByProjectAndSpecialty(projectId, id);
        if (rolesUsingSpecialty > 0) {
            return actionError(`Cannot delete specialty: ${rolesUsingSpecialty} role(s) still depend on it`);
        }

        const usersUsingSpecialty = await UserRepository.countByProjectSpecialty(projectId, id);
        const legacyUsersUsingSpecialty = await UserRepository.countLegacyByProjectSpecialty(projectId, id);
        const totalUsersUsingSpecialty = usersUsingSpecialty + legacyUsersUsingSpecialty;
        if (totalUsersUsingSpecialty > 0) {
            return actionError(`Cannot delete specialty: ${totalUsersUsingSpecialty} user(s) are assigned to it in this project`);
        }

        await SpecialtyRepository.delete(id);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to delete specialty:", error);
        return actionError("Failed to delete specialty");
    }
}

// ─── Status Management Actions ───────────────────────────────────

export async function createStatus(data: { projectId: string; name: string; colorHex: string; isPPC?: boolean }) {
    if (!mongoose.isValidObjectId(data.projectId)) {
        return actionError("Invalid project id");
    }

    const access = await requireProjectManagerAccess(data.projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const normalizedName = data.name.trim();
        if (!normalizedName) {
            return actionError("Status name is required");
        }

        const existing = await statusRepository.findByName(normalizedName, data.projectId);
        if (existing) {
            return actionError("A status with this name already exists in this project");
        }

        const status = await statusRepository.create({
            projectId: new mongoose.Types.ObjectId(data.projectId),
            name: normalizedName,
            colorHex: data.colorHex,
            isPPC: data.isPPC,
        });
        revalidatePath('/manage-project');
        return actionSuccess(status);
    } catch (error) {
        console.error("Failed to create status:", error);
        return actionError("Failed to create status");
    }
}

export async function updateStatus(id: string, data: { projectId: string; name?: string; colorHex?: string; isPPC?: boolean }) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(data.projectId)) {
        return actionError("Invalid id");
    }

    const access = await requireProjectManagerAccess(data.projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existingStatus = await statusRepository.getByIdInProject(id, data.projectId);
        if (!existingStatus) {
            return actionError("Status not found in current project");
        }

        const normalizedName = typeof data.name === 'string' ? data.name.trim() : undefined;
        if (typeof data.name === 'string' && !normalizedName) {
            return actionError("Status name is required");
        }

        if (typeof normalizedName === 'string' && normalizedName.length > 0) {
            const nameConflict = await statusRepository.findByName(normalizedName, data.projectId);
            if (nameConflict && nameConflict._id.toString() !== id) {
                return actionError("A status with this name already exists in this project");
            }
        }

        const status = await statusRepository.update(id, {
            ...(typeof normalizedName !== 'undefined' ? { name: normalizedName } : {}),
            ...(typeof data.colorHex !== 'undefined' ? { colorHex: data.colorHex } : {}),
            ...(typeof data.isPPC !== 'undefined' ? { isPPC: data.isPPC } : {}),
        });
        revalidatePath('/manage-project');
        return actionSuccess(status);
    } catch (error) {
        console.error("Failed to update status:", error);
        return actionError("Failed to update status");
    }
}

export async function deleteStatus(id: string, projectId: string) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(projectId)) {
        return actionError("Invalid id");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existingStatus = await statusRepository.getByIdInProject(id, projectId);
        if (!existingStatus) {
            return actionError("Status not found in current project");
        }

        await statusRepository.delete(id);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to delete status:", error);
        return actionError("Failed to delete status");
    }
}

// ─── Role Management Actions ─────────────────────────────────────

export async function createRole(data: { projectId: string; name: string; isManager: boolean; specialtiesIds?: string[] }) {
    if (!mongoose.isValidObjectId(data.projectId)) {
        return actionError("Invalid project id");
    }

    const access = await requireProjectManagerAccess(data.projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existing = await roleRepository.findByNameInProject(data.name, data.projectId);
        if (existing) {
            return actionError("A role with this name already exists in this project");
        }

        const specialtiesIds = data.isManager ? [] : (data.specialtiesIds || []);
        if (specialtiesIds.length > 0) {
            const specialties = await SpecialtyRepository.findByIdsInProject(specialtiesIds, data.projectId);
            if (specialties.length !== specialtiesIds.length) {
                return actionError("Some selected specialties are invalid for this project");
            }
        }

        const role = await roleRepository.create({
            projectId: new mongoose.Types.ObjectId(data.projectId),
            name: data.name,
            isManager: data.isManager,
            specialtiesIds: specialtiesIds.map((id) => new mongoose.Types.ObjectId(id)),
        });
        revalidatePath('/manage-project');
        return actionSuccess(role);
    } catch (error) {
        console.error("Failed to create role:", error);
        return actionError("Failed to create role");
    }
}

export async function updateRole(
    id: string,
    data: { projectId: string; name?: string; isManager?: boolean; specialtiesIds?: string[] }
) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(data.projectId)) {
        return actionError("Invalid id");
    }

    const access = await requireProjectManagerAccess(data.projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existing = await roleRepository.getByIdInProject(id, data.projectId);
        if (!existing) {
            return actionError("Role not found in current project");
        }

        if (data.name && data.name !== existing.name) {
            const nameConflict = await roleRepository.findByNameInProject(data.name, data.projectId);
            if (nameConflict && nameConflict._id.toString() !== id) {
                return actionError("A role with this name already exists in this project");
            }
        }

        let resolvedSpecialtiesIds = data.specialtiesIds;
        if (typeof resolvedSpecialtiesIds === 'undefined') {
            resolvedSpecialtiesIds = (existing.specialtiesIds || []).map((specId) => specId.toString());
        }

        const resolvedIsManager = typeof data.isManager === 'boolean' ? data.isManager : existing.isManager;
        if (resolvedIsManager) {
            resolvedSpecialtiesIds = [];
        }

        if ((resolvedSpecialtiesIds || []).length > 0) {
            const specialties = await SpecialtyRepository.findByIdsInProject(resolvedSpecialtiesIds || [], data.projectId);
            if (specialties.length !== (resolvedSpecialtiesIds || []).length) {
                return actionError("Some selected specialties are invalid for this project");
            }
        }

        if ((resolvedSpecialtiesIds || []).length > 0) {
            const conflicts = await UserRepository.findRoleSpecialtyConflicts(data.projectId, id, resolvedSpecialtiesIds || []);
            const legacyConflicts = await UserRepository.findLegacyRoleSpecialtyConflicts(data.projectId, existing.name, resolvedSpecialtiesIds || []);
            const totalConflicts = conflicts.length + legacyConflicts.length;
            if (totalConflicts > 0) {
                return actionError(`Cannot apply changes: ${totalConflicts} user(s) have specialties outside the allowed set for this role`);
            }
        }

        const role = await roleRepository.update(id, {
            ...(data.name ? { name: data.name } : {}),
            ...(typeof data.isManager === 'boolean' ? { isManager: data.isManager } : {}),
            specialtiesIds: (resolvedSpecialtiesIds || []).map((specId) => new mongoose.Types.ObjectId(specId)),
        });
        revalidatePath('/manage-project');
        return actionSuccess(role);
    } catch (error) {
        console.error("Failed to update role:", error);
        return actionError("Failed to update role");
    }
}

export async function deleteRole(id: string, projectId: string) {
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(projectId)) {
        return actionError("Invalid id");
    }

    const access = await requireProjectManagerAccess(projectId);
    if (!access.ok) {
        return actionError(access.message);
    }

    await connectToDatabase();

    try {
        const existing = await roleRepository.getByIdInProject(id, projectId);
        if (!existing) {
            return actionError("Role not found in current project");
        }

        const usersUsingRole = await UserRepository.countByProjectRole(projectId, id);
        const legacyUsersUsingRole = await UserRepository.countLegacyByProjectRoleName(projectId, existing.name);
        const totalUsersUsingRole = usersUsingRole + legacyUsersUsingRole;
        if (totalUsersUsingRole > 0) {
            return actionError(`Cannot delete role: ${totalUsersUsingRole} user(s) are assigned to it in this project`);
        }

        await roleRepository.delete(id);
        revalidatePath('/manage-project');
        return actionSuccess(true);
    } catch (error) {
        console.error("Failed to delete role:", error);
        return actionError("Failed to delete role");
    }
}


