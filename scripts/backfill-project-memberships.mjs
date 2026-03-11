#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

const MANAGER_ROLE_PRIORITY = [
  "Admin",
  "Project Director",
  "Project Manager",
  "Superintendent",
  "Production Manager",
  "Production Lead",
  "Production Engineer",
];
const MANAGER_ROLE_SET = new Set(MANAGER_ROLE_PRIORITY.map((role) => role.toLowerCase()));
const DEFAULT_SPECIALTY_COLOR = "#64748b";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has("--dry-run"),
    verbose: args.has("--verbose"),
  };
}

function loadLocalEnvIfNeeded() {
  if (process.env.MONGODB_URI) return;

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function toObjectId(value) {
  if (!value) return null;
  const normalized = String(value);
  if (!mongoose.isValidObjectId(normalized)) return null;
  return new mongoose.Types.ObjectId(normalized);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const { dryRun, verbose } = parseArgs();
  loadLocalEnvIfNeeded();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required. Define it in environment or .env.local");
  }

  await mongoose.connect(mongoUri);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not initialized");
  }

  const usersCollection = db.collection("users");
  const rolesCollection = db.collection("roles");
  const specialtiesCollection = db.collection("specialties");

  const roleCache = new Map();
  const managerRoleCache = new Map();
  const specialtyCache = new Map();
  const legacySpecialtyNameCache = new Map();

  const unresolvedSamples = [];

  const summary = {
    dryRun,
    usersScanned: 0,
    membershipsScanned: 0,
    usersWithUpdates: 0,
    roleIdsPatched: 0,
    specialtyIdsPatched: 0,
    rolesCreatedInProject: 0,
    specialtiesCreatedInProject: 0,
    unresolvedRoleMappings: 0,
    unresolvedSpecialtyMappings: 0,
    invalidProjectIds: 0,
    operationsPrepared: 0,
    operationsExecuted: 0,
    matchedDocs: 0,
    modifiedDocs: 0,
  };

  async function resolvePreferredManagerRoleId(projectId) {
    if (managerRoleCache.has(projectId)) {
      return managerRoleCache.get(projectId);
    }

    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const managerRoles = await rolesCollection
      .find({ projectId: projectObjectId, isManager: true }, { projection: { _id: 1, name: 1 } })
      .toArray();

    if (managerRoles.length === 0) {
      managerRoleCache.set(projectId, null);
      return null;
    }

    managerRoles.sort((a, b) => {
      const aIndex = MANAGER_ROLE_PRIORITY.indexOf(a.name);
      const bIndex = MANAGER_ROLE_PRIORITY.indexOf(b.name);
      const aRank = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const bRank = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return aRank - bRank;
    });

    const selectedRoleId = managerRoles[0]?._id || null;
    managerRoleCache.set(projectId, selectedRoleId);
    return selectedRoleId;
  }

  async function createRoleInProject(projectId, roleName) {
    const now = new Date();
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const roleDoc = {
      _id: new mongoose.Types.ObjectId(),
      projectId: projectObjectId,
      name: roleName,
      isManager: MANAGER_ROLE_SET.has(roleName.toLowerCase()),
      specialtiesIds: [],
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      summary.rolesCreatedInProject += 1;
      return roleDoc._id;
    }

    const upsertResult = await rolesCollection.updateOne(
      { projectId: projectObjectId, name: roleName },
      { $setOnInsert: roleDoc },
      { upsert: true }
    );

    if ((upsertResult.upsertedCount || 0) > 0) {
      summary.rolesCreatedInProject += 1;
    }

    const createdOrExistingRole = await rolesCollection.findOne(
      {
        projectId: projectObjectId,
        name: { $regex: `^${escapeRegex(roleName)}$`, $options: "i" },
      },
      { projection: { _id: 1 } }
    );

    return createdOrExistingRole?._id || null;
  }

  async function resolveLegacySpecialtyMetadata(legacySpecialtyId) {
    const key = legacySpecialtyId.toString();
    if (legacySpecialtyNameCache.has(key)) {
      return legacySpecialtyNameCache.get(key);
    }

    const specialty = await specialtiesCollection.findOne(
      { _id: legacySpecialtyId },
      { projection: { name: 1, colorHex: 1 } }
    );

    const metadata = specialty
      ? {
          name: specialty.name,
          colorHex: specialty.colorHex || DEFAULT_SPECIALTY_COLOR,
        }
      : null;

    legacySpecialtyNameCache.set(key, metadata);
    return metadata;
  }

  async function createSpecialtyInProject(projectId, specialtyName, colorHex) {
    const now = new Date();
    const projectObjectId = new mongoose.Types.ObjectId(projectId);
    const specialtyDoc = {
      _id: new mongoose.Types.ObjectId(),
      projectId: projectObjectId,
      name: specialtyName,
      colorHex: colorHex || DEFAULT_SPECIALTY_COLOR,
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      summary.specialtiesCreatedInProject += 1;
      return specialtyDoc._id;
    }

    let upsertResult = null;
    try {
      upsertResult = await specialtiesCollection.updateOne(
        { projectId: projectObjectId, name: specialtyName },
        { $setOnInsert: specialtyDoc },
        { upsert: true }
      );
    } catch (error) {
      // Legacy databases may still have a global unique index on `name`.
      if (!error || error.code !== 11000) {
        throw error;
      }
    }

    if ((upsertResult?.upsertedCount || 0) > 0) {
      summary.specialtiesCreatedInProject += 1;
    }

    const createdOrExistingSpecialty = await specialtiesCollection.findOne(
      {
        projectId: projectObjectId,
        name: { $regex: `^${escapeRegex(specialtyName)}$`, $options: "i" },
      },
      { projection: { _id: 1 } }
    );

    if (createdOrExistingSpecialty?._id) {
      return createdOrExistingSpecialty._id;
    }

    // Fallback for legacy global-name specialty indexes.
    const existingGlobalSpecialty = await specialtiesCollection.findOne(
      { name: { $regex: `^${escapeRegex(specialtyName)}$`, $options: "i" } },
      { projection: { _id: 1 } }
    );

    return existingGlobalSpecialty?._id || null;
  }

  async function resolveRoleId(projectId, legacyRoleName) {
    const normalizedRoleName = typeof legacyRoleName === "string" ? legacyRoleName.trim() : "";
    if (!normalizedRoleName) return null;

    const cacheKey = `${projectId}:${normalizedRoleName.toLowerCase()}`;
    if (roleCache.has(cacheKey)) {
      return roleCache.get(cacheKey);
    }

    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    let role = await rolesCollection.findOne(
      { projectId: projectObjectId, name: normalizedRoleName },
      { projection: { _id: 1 } }
    );

    if (!role) {
      role = await rolesCollection.findOne(
        {
          projectId: projectObjectId,
          name: { $regex: `^${escapeRegex(normalizedRoleName)}$`, $options: "i" },
        },
        { projection: { _id: 1 } }
      );
    }

    let resolvedRoleId = role?._id || null;

    // Legacy admins may not have an explicit per-project "Admin" role.
    if (!resolvedRoleId && normalizedRoleName.toLowerCase() === "admin") {
      resolvedRoleId = await resolvePreferredManagerRoleId(projectId);
    }

    if (!resolvedRoleId) {
      resolvedRoleId = await createRoleInProject(projectId, normalizedRoleName);
    }

    roleCache.set(cacheKey, resolvedRoleId);
    return resolvedRoleId;
  }

  async function resolveSpecialtyId(projectId, legacySpecialtyIdValue) {
    const legacySpecialtyId = toObjectId(legacySpecialtyIdValue);
    if (!legacySpecialtyId) return null;

    const cacheKey = `${projectId}:${legacySpecialtyId.toString()}`;
    if (specialtyCache.has(cacheKey)) {
      return specialtyCache.get(cacheKey);
    }

    const projectObjectId = new mongoose.Types.ObjectId(projectId);

    // Best case: same specialty document is already scoped to the project.
    const directSpecialty = await specialtiesCollection.findOne(
      { _id: legacySpecialtyId, projectId: projectObjectId },
      { projection: { _id: 1, name: 1 } }
    );

    if (directSpecialty?._id) {
      specialtyCache.set(cacheKey, directSpecialty._id);
      return directSpecialty._id;
    }

    // Fallback: map by specialty name if legacy id belongs to another project.
    const legacySpecialtyMetadata = await resolveLegacySpecialtyMetadata(legacySpecialtyId);

    if (!legacySpecialtyMetadata?.name) {
      specialtyCache.set(cacheKey, null);
      return null;
    }

    const projectSpecialty = await specialtiesCollection.findOne(
      { projectId: projectObjectId, name: legacySpecialtyMetadata.name },
      { projection: { _id: 1 } }
    );

    let resolvedSpecialtyId = projectSpecialty?._id || null;

    if (!resolvedSpecialtyId) {
      const globalSpecialty = await specialtiesCollection.findOne(
        { name: { $regex: `^${escapeRegex(legacySpecialtyMetadata.name)}$`, $options: "i" } },
        { projection: { _id: 1 } }
      );
      resolvedSpecialtyId = globalSpecialty?._id || null;
    }

    if (!resolvedSpecialtyId) {
      resolvedSpecialtyId = await createSpecialtyInProject(
        projectId,
        legacySpecialtyMetadata.name,
        legacySpecialtyMetadata.colorHex
      );
    }

    specialtyCache.set(cacheKey, resolvedSpecialtyId);
    return resolvedSpecialtyId;
  }

  const BATCH_SIZE = 500;
  let pendingOps = [];

  async function flushOps() {
    if (pendingOps.length === 0) return;

    summary.operationsExecuted += pendingOps.length;

    if (!dryRun) {
      const result = await usersCollection.bulkWrite(pendingOps, { ordered: false });
      summary.matchedDocs += result.matchedCount || 0;
      summary.modifiedDocs += result.modifiedCount || 0;
    }

    pendingOps = [];
  }

  const cursor = usersCollection.find(
    { projects: { $exists: true, $ne: [] } },
    { projection: { email: 1, role: 1, specialtyId: 1, projects: 1 } }
  );

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    if (!user) continue;

    summary.usersScanned += 1;

    const memberships = Array.isArray(user.projects) ? user.projects : [];
    if (memberships.length === 0) continue;

    const updatePayload = {};
    let updatedThisUser = false;

    for (let index = 0; index < memberships.length; index += 1) {
      const membership = memberships[index] || {};
      summary.membershipsScanned += 1;

      const projectObjectId = toObjectId(membership.projectId);
      if (!projectObjectId) {
        summary.invalidProjectIds += 1;
        continue;
      }

      const projectId = projectObjectId.toString();

      const hasRoleId = typeof membership.roleId !== "undefined" && membership.roleId !== null;
      if (!hasRoleId) {
        const resolvedRoleId = await resolveRoleId(projectId, user.role);
        if (resolvedRoleId) {
          updatePayload[`projects.${index}.roleId`] = resolvedRoleId;
          summary.roleIdsPatched += 1;
          updatedThisUser = true;
        } else {
          summary.unresolvedRoleMappings += 1;
          if (unresolvedSamples.length < 25) {
            unresolvedSamples.push({
              type: "role",
              email: user.email || "unknown",
              projectId,
              legacyRole: user.role || "(empty)",
            });
          }
        }
      }

      const hasSpecialtyId = typeof membership.specialtyId !== "undefined" && membership.specialtyId !== null;
      if (!hasSpecialtyId && user.specialtyId) {
        const resolvedSpecialtyId = await resolveSpecialtyId(projectId, user.specialtyId);
        if (resolvedSpecialtyId) {
          updatePayload[`projects.${index}.specialtyId`] = resolvedSpecialtyId;
          summary.specialtyIdsPatched += 1;
          updatedThisUser = true;
        } else {
          summary.unresolvedSpecialtyMappings += 1;
          if (unresolvedSamples.length < 25) {
            unresolvedSamples.push({
              type: "specialty",
              email: user.email || "unknown",
              projectId,
              legacySpecialtyId: String(user.specialtyId),
            });
          }
        }
      }
    }

    if (!updatedThisUser) continue;

    updatePayload.updatedAt = new Date();
    summary.usersWithUpdates += 1;
    summary.operationsPrepared += 1;

    pendingOps.push({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: updatePayload },
      },
    });

    if (pendingOps.length >= BATCH_SIZE) {
      await flushOps();
    }
  }

  await flushOps();

  console.log(`[migration] project membership backfill ${dryRun ? "dry-run" : "completed"}`);
  console.log(JSON.stringify(summary, null, 2));

  if (verbose && unresolvedSamples.length > 0) {
    console.log("[migration] unresolved samples:");
    console.log(JSON.stringify(unresolvedSamples, null, 2));
  }
}

main()
  .catch((error) => {
    console.error("[migration] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
