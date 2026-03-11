#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

function parseArgs(argv) {
  const args = [...argv];

  let projectId = null;
  let apply = false;
  let verbose = false;
  let includeUnscopedGlobal = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--project-id") {
      projectId = args[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--verbose") {
      verbose = true;
      continue;
    }
    if (arg === "--include-unscoped-global") {
      includeUnscopedGlobal = true;
    }
  }

  return { projectId, apply, verbose, includeUnscopedGlobal };
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

function asObjectId(value) {
  if (!value) return null;
  const normalized = String(value);
  if (!mongoose.isValidObjectId(normalized)) return null;
  return new mongoose.Types.ObjectId(normalized);
}

function uniqueObjectIdStrings(values) {
  const set = new Set();
  for (const value of values) {
    const id = asObjectId(value);
    if (id) set.add(id.toString());
  }
  return [...set];
}

function areSameIds(a, b) {
  if (a.length !== b.length) return false;
  const aSet = new Set(a);
  for (const value of b) {
    if (!aSet.has(value)) return false;
  }
  return true;
}

async function main() {
  const { projectId, apply, verbose, includeUnscopedGlobal } = parseArgs(process.argv.slice(2));
  const dryRun = !apply;

  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    throw new Error("--project-id <ObjectId> is required");
  }

  loadLocalEnvIfNeeded();
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Define it in environment or .env.local");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not initialized");
  }

  const projectObjectId = new mongoose.Types.ObjectId(projectId);

  const rolesCollection = db.collection("roles");
  const specialtiesCollection = db.collection("specialties");
  const usersCollection = db.collection("users");
  const projectsCollection = db.collection("projects");

  const projectCount = await projectsCollection.countDocuments({});

  const summary = {
    dryRun,
    projectId,
    projectCount,
    includeUnscopedGlobal,
    subcontractorRoleFound: false,
    roleUpdated: false,
    roleSpecialtiesBefore: 0,
    roleSpecialtiesAfter: 0,
    missingProjectIdSpecialtiesFixed: 0,
    unscopedSpecialtiesFound: 0,
    unscopedSpecialtiesAdopted: 0,
    projectScopedSpecialtiesFound: 0,
    userReferencedSpecialtiesFound: 0,
    fallbackGlobalSpecialtiesUsed: false,
  };

  const fixedMissingProjectIds = new Set();

  async function adoptMissingProjectId(specialties) {
    const idsToFix = specialties
      .filter((specialty) => !specialty.projectId)
      .map((specialty) => specialty._id.toString())
      .filter((id) => !fixedMissingProjectIds.has(id));

    if (idsToFix.length === 0) return;

    idsToFix.forEach((id) => fixedMissingProjectIds.add(id));

    if (!dryRun) {
      await specialtiesCollection.updateMany(
        {
          _id: { $in: idsToFix.map((id) => new mongoose.Types.ObjectId(id)) },
          projectId: { $exists: false },
        },
        { $set: { projectId: projectObjectId, updatedAt: new Date() } }
      );
    }

    summary.missingProjectIdSpecialtiesFixed += idsToFix.length;
    summary.unscopedSpecialtiesAdopted += idsToFix.length;
  }

  function mergeProjectSpecialties(baseSpecialties, incomingSpecialties) {
    const merged = new Map(baseSpecialties.map((specialty) => [specialty._id.toString(), specialty]));
    for (const specialty of incomingSpecialties) {
      const specialtyId = specialty._id.toString();
      const incomingProjectId = asObjectId(specialty.projectId)?.toString() || null;
      if (incomingProjectId && incomingProjectId !== projectId) {
        continue;
      }
      const scopedSpecialty = specialty.projectId
        ? specialty
        : { ...specialty, projectId: projectObjectId };
      merged.set(specialtyId, scopedSpecialty);
    }
    return [...merged.values()];
  }

  const subcontractorRole = await rolesCollection.findOne(
    {
      projectId: projectObjectId,
      name: { $regex: /^Subcontractor$/i },
    },
    { projection: { _id: 1, specialtiesIds: 1, name: 1 } }
  );

  if (!subcontractorRole?._id) {
    throw new Error(`Subcontractor role not found in project ${projectId}`);
  }

  summary.subcontractorRoleFound = true;
  const currentRoleSpecialties = uniqueObjectIdStrings(subcontractorRole.specialtiesIds || []);
  summary.roleSpecialtiesBefore = currentRoleSpecialties.length;

  let projectSpecialties = await specialtiesCollection
    .find({ projectId: projectObjectId }, { projection: { _id: 1, projectId: 1, name: 1 } })
    .toArray();

  summary.projectScopedSpecialtiesFound = projectSpecialties.length;

  if (projectSpecialties.length === 0) {
    const cursor = usersCollection.find(
      { "projects.projectId": projectObjectId },
      { projection: { specialtyId: 1, projects: 1 } }
    );

    const referencedIds = new Set();

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      if (!user) continue;

      const legacySpecialtyId = asObjectId(user.specialtyId);
      if (legacySpecialtyId) {
        referencedIds.add(legacySpecialtyId.toString());
      }

      const memberships = Array.isArray(user.projects) ? user.projects : [];
      for (const membership of memberships) {
        const membershipProjectId = asObjectId(membership?.projectId);
        if (!membershipProjectId || membershipProjectId.toString() !== projectId) continue;

        const membershipSpecialtyId = asObjectId(membership?.specialtyId);
        if (membershipSpecialtyId) {
          referencedIds.add(membershipSpecialtyId.toString());
        }
      }
    }

    if (referencedIds.size > 0) {
      const refObjectIds = [...referencedIds].map((id) => new mongoose.Types.ObjectId(id));
      const referencedSpecialties = await specialtiesCollection
        .find({ _id: { $in: refObjectIds } }, { projection: { _id: 1, projectId: 1, name: 1 } })
        .toArray();

      summary.userReferencedSpecialtiesFound = referencedSpecialties.length;

      const missingProjectIdIds = referencedSpecialties
        .filter((specialty) => !specialty.projectId)
        .map((specialty) => specialty._id);

      if (missingProjectIdIds.length > 0) {
        await adoptMissingProjectId(referencedSpecialties);
      }

      if (dryRun) {
        projectSpecialties = mergeProjectSpecialties(projectSpecialties, referencedSpecialties);
      } else {
        projectSpecialties = await specialtiesCollection
          .find({ projectId: projectObjectId }, { projection: { _id: 1, projectId: 1, name: 1 } })
          .toArray();
      }
      summary.projectScopedSpecialtiesFound = projectSpecialties.length;
    }
  }

  const unscopedGlobalSpecialties = await specialtiesCollection
    .find({ projectId: { $exists: false } }, { projection: { _id: 1, projectId: 1, name: 1 } })
    .toArray();
  summary.unscopedSpecialtiesFound = unscopedGlobalSpecialties.length;

  const shouldAdoptUnscopedGlobal = includeUnscopedGlobal || projectCount === 1;
  if (unscopedGlobalSpecialties.length > 0 && shouldAdoptUnscopedGlobal) {
    summary.fallbackGlobalSpecialtiesUsed = true;
    await adoptMissingProjectId(unscopedGlobalSpecialties);

    if (dryRun) {
      projectSpecialties = mergeProjectSpecialties(projectSpecialties, unscopedGlobalSpecialties);
    } else {
      projectSpecialties = await specialtiesCollection
        .find({ projectId: projectObjectId }, { projection: { _id: 1, projectId: 1, name: 1 } })
        .toArray();
    }
    summary.projectScopedSpecialtiesFound = projectSpecialties.length;
  }

  if (projectSpecialties.length === 0) {
    const globalSpecialties = await specialtiesCollection
      .find({}, { projection: { _id: 1, projectId: 1, name: 1 } })
      .toArray();

    if (globalSpecialties.length === 0) {
      throw new Error(`No specialties exist in database for project ${projectId}`);
    }

    if (!shouldAdoptUnscopedGlobal) {
      throw new Error(
        "No project-scoped specialties resolved. Re-run with --include-unscoped-global to adopt legacy unscoped specialties."
      );
    }

    summary.fallbackGlobalSpecialtiesUsed = true;
    await adoptMissingProjectId(globalSpecialties);

    if (dryRun) {
      projectSpecialties = mergeProjectSpecialties(projectSpecialties, globalSpecialties);
    } else {
      projectSpecialties = await specialtiesCollection
        .find({ projectId: projectObjectId }, { projection: { _id: 1, projectId: 1, name: 1 } })
        .toArray();
    }

    summary.projectScopedSpecialtiesFound = projectSpecialties.length;
  }

  const finalSpecialtyIds = uniqueObjectIdStrings(projectSpecialties.map((specialty) => specialty._id));
  summary.roleSpecialtiesAfter = finalSpecialtyIds.length;

  if (finalSpecialtyIds.length === 0) {
    throw new Error(`No specialties were resolved for project ${projectId}`);
  }

  if (!areSameIds(currentRoleSpecialties, finalSpecialtyIds)) {
    summary.roleUpdated = true;
    if (!dryRun) {
      await rolesCollection.updateOne(
        { _id: subcontractorRole._id },
        {
          $set: {
            specialtiesIds: finalSpecialtyIds.map((id) => new mongoose.Types.ObjectId(id)),
            updatedAt: new Date(),
          },
        }
      );
    }
  }

  console.log(`[sync-subcontractor-specialties] ${dryRun ? "dry-run" : "completed"}`);
  console.log(JSON.stringify(summary, null, 2));

  if (verbose) {
    console.log("[sync-subcontractor-specialties] sample specialty ids:");
    console.log(JSON.stringify(finalSpecialtyIds.slice(0, 10), null, 2));
  }
}

main()
  .catch((error) => {
    console.error("[sync-subcontractor-specialties] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
