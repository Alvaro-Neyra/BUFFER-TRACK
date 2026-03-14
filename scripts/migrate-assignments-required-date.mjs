#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

function parseArgs(argv) {
  const args = [...argv];
  return {
    apply: args.includes("--apply"),
    verbose: args.includes("--verbose"),
  };
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

function toUtcMidnight(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function computeWeekStart(requiredDate) {
  const day = requiredDate.getUTCDay();
  const diff = requiredDate.getUTCDate() - day + (day === 0 ? -6 : 1);
  return new Date(Date.UTC(requiredDate.getUTCFullYear(), requiredDate.getUTCMonth(), diff));
}

function resolveRequiredDate(doc) {
  const candidate =
    doc.requiredDate ||
    doc.dates?.targetDate ||
    doc.targetDate ||
    doc.createdAt ||
    null;

  return candidate ? toUtcMidnight(candidate) : null;
}

async function main() {
  const { apply, verbose } = parseArgs(process.argv.slice(2));
  const dryRun = !apply;

  loadLocalEnvIfNeeded();
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Set it in environment or .env.local");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not initialized");
  }

  // Post-cutover, assignments are stored in the dedicated collection.
  const assignmentsCollection = db.collection("assignments");

  const query = {
    $or: [
      { requiredDate: { $exists: false } },
      { requiredDate: null },
      { assignedTo: { $exists: true } },
      { customId: { $exists: true } },
      { location: { $exists: true } },
      { name: { $exists: true } },
      { dates: { $exists: true } },
      { startDate: { $exists: true } },
      { targetDate: { $exists: true } },
    ],
  };

  const totalCandidates = await assignmentsCollection.countDocuments(query);
  if (totalCandidates === 0) {
    console.log("No assignment documents require migration.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${totalCandidates} assignment documents to evaluate.`);

  const cursor = assignmentsCollection.find(query, {
    projection: {
      requiredDate: 1,
      createdAt: 1,
      dates: 1,
      targetDate: 1,
      startDate: 1,
      assignedTo: 1,
      customId: 1,
      location: 1,
      name: 1,
    },
  });

  const updates = [];
  let resolvedFromTargetDate = 0;
  let resolvedFromCreatedAt = 0;
  let unresolved = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc?._id) continue;

    const requiredDate = resolveRequiredDate(doc);
    if (!requiredDate) {
      unresolved += 1;
      if (verbose) {
        console.log(`Skipping ${doc._id.toString()} (no valid required date source)`);
      }
      continue;
    }

    if (doc.dates?.targetDate || doc.targetDate) {
      resolvedFromTargetDate += 1;
    } else {
      resolvedFromCreatedAt += 1;
    }

    const weekStart = computeWeekStart(requiredDate);

    updates.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            requiredDate,
            weekStart,
            updatedAt: new Date(),
          },
          $unset: {
            assignedTo: "",
            customId: "",
            location: "",
            name: "",
            dates: "",
            startDate: "",
            targetDate: "",
          },
        },
      },
    });
  }

  console.log(`Prepared ${updates.length} updates.`);
  console.log(`requiredDate source: targetDate=${resolvedFromTargetDate}, createdAt=${resolvedFromCreatedAt}`);
  if (unresolved > 0) {
    console.log(`Unresolved documents (skipped): ${unresolved}`);
  }

  if (dryRun) {
    console.log("Dry run complete. Re-run with --apply to execute updates.");
    await mongoose.disconnect();
    return;
  }

  if (updates.length > 0) {
    const result = await assignmentsCollection.bulkWrite(updates, { ordered: false });
    console.log(`Migration applied. matched=${result.matchedCount}, modified=${result.modifiedCount}`);
  } else {
    console.log("No updates were applied.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Assignment migration failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors on failure path.
  }
  process.exitCode = 1;
});
