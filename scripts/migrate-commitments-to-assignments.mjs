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

function normalizeObjectId(value) {
  if (!value) return null;

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === "string" && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }

  if (typeof value === "object" && value._id) {
    return normalizeObjectId(value._id);
  }

  return null;
}

function normalizeCoordinates(value) {
  if (!value || typeof value !== "object") return null;

  const x = Number(value.xPercent);
  const y = Number(value.yPercent);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > 100 || y < 0 || y > 100) return null;

  return { xPercent: x, yPercent: y };
}

function normalizePolygon(value) {
  if (!Array.isArray(value) || value.length < 3) return undefined;

  const points = [];
  for (const point of value) {
    const normalized = normalizeCoordinates(point);
    if (normalized) {
      points.push(normalized);
    }
  }

  return points.length >= 3 ? points : undefined;
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

function resolveDescription(doc) {
  const fromDescription = typeof doc.description === "string" ? doc.description.trim() : "";
  if (fromDescription.length > 0) return fromDescription;

  const fromName = typeof doc.name === "string" ? doc.name.trim() : "";
  if (fromName.length > 0) return fromName;

  return `Migrated assignment ${String(doc._id)}`;
}

function resolveStatus(doc) {
  const raw = typeof doc.status === "string" ? doc.status.trim() : "";
  return raw.length > 0 ? raw : "Request";
}

function resolveCreatedAt(doc) {
  const createdAt = new Date(doc.createdAt);
  if (!Number.isNaN(createdAt.getTime())) return createdAt;
  return new Date();
}

function buildAssignmentDocument(doc) {
  const requiredDate = resolveRequiredDate(doc);
  const coordinates = normalizeCoordinates(doc.coordinates);

  const projectId = normalizeObjectId(doc.projectId);
  const buildingId = normalizeObjectId(doc.buildingId);
  const floorId = normalizeObjectId(doc.floorId);
  const specialtyId = normalizeObjectId(doc.specialtyId);
  const requesterId = normalizeObjectId(doc.requesterId);

  if (!requiredDate || !coordinates) {
    return { ok: false, reason: "invalid-date-or-coordinates" };
  }

  if (!projectId || !buildingId || !floorId || !specialtyId || !requesterId) {
    return { ok: false, reason: "invalid-objectid-reference" };
  }

  const createdAt = resolveCreatedAt(doc);
  const assignment = {
    _id: doc._id,
    projectId,
    buildingId,
    floorId,
    specialtyId,
    requesterId,
    description: resolveDescription(doc),
    status: resolveStatus(doc),
    coordinates,
    requiredDate,
    weekStart: computeWeekStart(requiredDate),
    createdAt,
    updatedAt: new Date(),
  };

  const polygon = normalizePolygon(doc.polygon);
  if (polygon) {
    assignment.polygon = polygon;
  }

  return { ok: true, assignment };
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

  const sourceCollection = db.collection("commitments");
  const targetCollection = db.collection("assignments");

  const totalSource = await sourceCollection.countDocuments({});
  const initialTargetCount = await targetCollection.countDocuments({});

  if (totalSource === 0) {
    console.log("No documents found in commitments. Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Source commitments: ${totalSource}`);
  console.log(`Target assignments (before): ${initialTargetCount}`);

  const cursor = sourceCollection.find(
    {},
    {
      projection: {
        _id: 1,
        projectId: 1,
        buildingId: 1,
        floorId: 1,
        specialtyId: 1,
        requesterId: 1,
        description: 1,
        name: 1,
        status: 1,
        coordinates: 1,
        polygon: 1,
        requiredDate: 1,
        weekStart: 1,
        dates: 1,
        targetDate: 1,
        createdAt: 1,
      },
    }
  );

  let processed = 0;
  let prepared = 0;
  let skipped = 0;
  const skippedReasons = {
    "invalid-date-or-coordinates": 0,
    "invalid-objectid-reference": 0,
  };

  let matchedCount = 0;
  let modifiedCount = 0;
  let upsertedCount = 0;
  const operations = [];

  async function flushOperations() {
    if (operations.length === 0 || dryRun) return;

    const result = await targetCollection.bulkWrite(operations.splice(0), { ordered: false });
    matchedCount += result.matchedCount || 0;
    modifiedCount += result.modifiedCount || 0;
    upsertedCount += result.upsertedCount || 0;
  }

  while (await cursor.hasNext()) {
    const sourceDoc = await cursor.next();
    if (!sourceDoc?._id) continue;

    processed += 1;

    const transformed = buildAssignmentDocument(sourceDoc);
    if (!transformed.ok) {
      skipped += 1;
      if (transformed.reason in skippedReasons) {
        skippedReasons[transformed.reason] += 1;
      }

      if (verbose) {
        console.log(`Skipping ${String(sourceDoc._id)} (${transformed.reason})`);
      }
      continue;
    }

    prepared += 1;
    operations.push({
      updateOne: {
        filter: { _id: sourceDoc._id },
        update: { $set: transformed.assignment },
        upsert: true,
      },
    });

    if (operations.length >= 500) {
      await flushOperations();
    }
  }

  await flushOperations();

  console.log(`Processed: ${processed}`);
  console.log(`Prepared for migration: ${prepared}`);
  console.log(`Skipped: ${skipped}`);
  if (skipped > 0) {
    console.log(`Skip details: ${JSON.stringify(skippedReasons)}`);
  }

  if (dryRun) {
    console.log("Dry run complete. Re-run with --apply to persist documents in assignments.");
    await mongoose.disconnect();
    return;
  }

  const finalTargetCount = await targetCollection.countDocuments({});
  console.log(`Bulk result: matched=${matchedCount}, modified=${modifiedCount}, upserted=${upsertedCount}`);
  console.log(`Target assignments (after): ${finalTargetCount}`);
  console.log("Migration commitments -> assignments completed.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Commitments to assignments migration failed:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors on failure path.
  }
  process.exitCode = 1;
});
