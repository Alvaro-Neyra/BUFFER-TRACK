#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

const VALID_MODES = new Set(["archive", "delete", "archive-delete"]);

function printUsage() {
  console.log([
    "Usage:",
    "  node scripts/cleanup-legacy-commitments.mjs [--mode=archive|delete|archive-delete] [--archive-collection=<name>] [--verbose] [--apply]",
    "",
    "Defaults:",
    "  --mode=archive",
    "  --archive-collection=commitments_legacy_archive",
    "  dry-run unless --apply is provided",
  ].join("\n"));
}

function parseArgs(argv) {
  const args = [...argv];

  let mode = "archive";
  let archiveCollection = "commitments_legacy_archive";
  let apply = false;
  let verbose = false;

  for (const arg of args) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length).trim();
      continue;
    }

    if (arg.startsWith("--archive-collection=")) {
      archiveCollection = arg.slice("--archive-collection=".length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!VALID_MODES.has(mode)) {
    throw new Error(`Invalid mode: ${mode}. Expected one of: ${Array.from(VALID_MODES).join(", ")}`);
  }

  if (!archiveCollection) {
    throw new Error("archive collection name cannot be empty");
  }

  return { mode, archiveCollection, apply, verbose };
}

function loadLocalEnvIfNeeded() {
  if (process.env.MONGODB_URI) return;

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function getMissingAssignmentIds(sourceCollection) {
  const facetResult = await sourceCollection
    .aggregate([
      {
        $lookup: {
          from: "assignments",
          localField: "_id",
          foreignField: "_id",
          as: "assignmentMatch",
        },
      },
      {
        $match: {
          assignmentMatch: { $size: 0 },
        },
      },
      {
        $facet: {
          sample: [{ $project: { _id: 1 } }, { $limit: 10 }],
          count: [{ $count: "value" }],
        },
      },
    ])
    .toArray();

  const first = facetResult[0] || { sample: [], count: [] };
  const count = first.count?.[0]?.value || 0;
  const sample = (first.sample || []).map((doc) => String(doc._id));
  return { count, sample };
}

async function archiveCommitments({ sourceCollection, archiveCollection, dryRun, verbose }) {
  const cursor = sourceCollection.find({});
  const operations = [];

  let processed = 0;
  let matchedCount = 0;
  let modifiedCount = 0;
  let upsertedCount = 0;

  async function flush() {
    if (operations.length === 0 || dryRun) return;

    const result = await archiveCollection.bulkWrite(operations.splice(0), { ordered: false });
    matchedCount += result.matchedCount || 0;
    modifiedCount += result.modifiedCount || 0;
    upsertedCount += result.upsertedCount || 0;
  }

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc?._id) continue;

    processed += 1;
    operations.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    });

    if (operations.length >= 500) {
      await flush();
      if (verbose) {
        console.log(`Archived batch progress: processed=${processed}`);
      }
    }
  }

  await flush();

  return {
    processed,
    matchedCount,
    modifiedCount,
    upsertedCount,
  };
}

async function main() {
  const { mode, archiveCollection, apply, verbose } = parseArgs(process.argv.slice(2));
  const dryRun = !apply;

  loadLocalEnvIfNeeded();
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Set it in environment or .env.local");
  }

  if (archiveCollection === "commitments" || archiveCollection === "assignments") {
    throw new Error("archive collection cannot be commitments or assignments");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not initialized");
  }

  const sourceCollection = db.collection("commitments");
  const targetCollection = db.collection("assignments");
  const archiveTarget = db.collection(archiveCollection);

  const [sourceCount, targetCount] = await Promise.all([
    sourceCollection.countDocuments({}),
    targetCollection.countDocuments({}),
  ]);

  console.log(`Mode: ${mode}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Source commitments: ${sourceCount}`);
  console.log(`Target assignments: ${targetCount}`);

  if (sourceCount === 0) {
    console.log("No legacy commitments found. Nothing to clean.");
    await mongoose.disconnect();
    return;
  }

  const missingInAssignments = await getMissingAssignmentIds(sourceCollection);
  console.log(`Missing IDs in assignments: ${missingInAssignments.count}`);
  if (missingInAssignments.sample.length > 0) {
    console.log(`Missing sample IDs: ${missingInAssignments.sample.join(", ")}`);
  }

  const willDelete = mode === "delete" || mode === "archive-delete";
  if (willDelete && missingInAssignments.count > 0) {
    throw new Error(
      "Unsafe delete blocked: some commitments IDs are missing in assignments. Resolve migration gaps before deleting legacy source."
    );
  }

  if (mode === "archive" || mode === "archive-delete") {
    const archiveBefore = await archiveTarget.countDocuments({});
    console.log(`Archive collection: ${archiveCollection}`);
    console.log(`Archive documents before: ${archiveBefore}`);

    const archiveResult = await archiveCommitments({
      sourceCollection,
      archiveCollection: archiveTarget,
      dryRun,
      verbose,
    });

    console.log(`Archive processed: ${archiveResult.processed}`);
    if (!dryRun) {
      console.log(
        `Archive bulk result: matched=${archiveResult.matchedCount}, modified=${archiveResult.modifiedCount}, upserted=${archiveResult.upsertedCount}`
      );
    }

    const archiveAfter = dryRun ? archiveBefore : await archiveTarget.countDocuments({});
    console.log(`Archive documents after: ${archiveAfter}`);

    if (!dryRun && willDelete && archiveAfter < sourceCount) {
      throw new Error(
        "Safety check failed: archive collection has fewer docs than source commitments. Delete canceled."
      );
    }
  }

  if (willDelete) {
    if (dryRun) {
      console.log(`Delete plan: would delete ${sourceCount} docs from commitments.`);
    } else {
      const deleteResult = await sourceCollection.deleteMany({});
      console.log(`Delete applied: deleted=${deleteResult.deletedCount}`);
    }
  }

  if (dryRun) {
    console.log("Dry run complete. Re-run with --apply to execute cleanup.");
  } else {
    console.log("Cleanup operation completed successfully.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Legacy commitments cleanup failed:", error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors on failure path.
  }
  process.exitCode = 1;
});
