#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

function parseArgs(argv) {
    const args = [...argv];

    let apply = false;
    let verbose = false;
    let projectId = null;

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];

        if (arg === "--apply") {
            apply = true;
            continue;
        }

        if (arg === "--verbose") {
            verbose = true;
            continue;
        }

        if (arg === "--project-id") {
            projectId = args[i + 1] || null;
            i += 1;
            continue;
        }

        if (arg === "--help" || arg === "-h") {
            console.log([
                "Usage:",
                "  node scripts/migrate-statuses-add-project-id.mjs [--project-id <ObjectId>] [--apply] [--verbose]",
                "",
                "Defaults:",
                "  Dry-run mode unless --apply is provided",
                "  Migrates all legacy statuses without projectId",
                "",
                "Behavior:",
                "  1) If --project-id is provided, legacy statuses are migrated only to that project",
                "  2) Without --project-id, status usage is inferred from assignments/commitments",
                "  3) If a status has no usage matches, it is copied to all projects",
            ].join("\n"));
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return {
        dryRun: !apply,
        verbose,
        projectId,
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

function normalizeStatusName(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addUsage(usageByStatus, rawStatus, rawProjectId) {
    const statusName = normalizeStatusName(rawStatus);
    if (!statusName || !rawProjectId) return;

    const projectId = String(rawProjectId);
    const key = statusName.toLowerCase();

    if (!usageByStatus.has(key)) {
        usageByStatus.set(key, new Set());
    }

    usageByStatus.get(key).add(projectId);
}

async function collectUsageByStatus(db) {
    const usageByStatus = new Map();

    const [assignmentUsage, commitmentUsage] = await Promise.all([
        db
            .collection("assignments")
            .aggregate([
                {
                    $match: {
                        projectId: { $exists: true },
                        status: { $type: "string" },
                    },
                },
                {
                    $group: {
                        _id: {
                            projectId: "$projectId",
                            status: "$status",
                        },
                    },
                },
            ])
            .toArray(),
        db
            .collection("commitments")
            .aggregate([
                {
                    $match: {
                        projectId: { $exists: true },
                        status: { $type: "string" },
                    },
                },
                {
                    $group: {
                        _id: {
                            projectId: "$projectId",
                            status: "$status",
                        },
                    },
                },
            ])
            .toArray(),
    ]);

    for (const row of assignmentUsage) {
        addUsage(usageByStatus, row?._id?.status, row?._id?.projectId);
    }

    for (const row of commitmentUsage) {
        addUsage(usageByStatus, row?._id?.status, row?._id?.projectId);
    }

    return usageByStatus;
}

async function main() {
    const { dryRun, verbose, projectId } = parseArgs(process.argv.slice(2));

    if (projectId && !mongoose.isValidObjectId(projectId)) {
        throw new Error("--project-id must be a valid ObjectId");
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

    const statusesCollection = db.collection("statuses");
    const projectsCollection = db.collection("projects");

    const projectFilter = projectId
        ? { _id: new mongoose.Types.ObjectId(projectId) }
        : {};

    const projects = await projectsCollection
        .find(projectFilter, { projection: { _id: 1, name: 1 } })
        .toArray();

    if (projects.length === 0) {
        console.log("No projects found for migration.");
        await mongoose.disconnect();
        return;
    }

    const legacyStatuses = await statusesCollection
        .find(
            {
                $or: [
                    { projectId: { $exists: false } },
                    { projectId: null },
                ],
            },
            {
                projection: {
                    _id: 1,
                    name: 1,
                    colorHex: 1,
                    isPPC: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            }
        )
        .toArray();

    if (legacyStatuses.length === 0) {
        console.log("No legacy statuses without projectId were found.");
        await mongoose.disconnect();
        return;
    }

    const allProjectIds = projects.map((project) => String(project._id));
    const usageByStatus = projectId ? new Map() : await collectUsageByStatus(db);

    const summary = {
        dryRun,
        targetProjects: projects.length,
        legacyStatusesFound: legacyStatuses.length,
        legacyStatusesProcessed: 0,
        legacyStatusesSkippedEmptyName: 0,
        copiedByUsage: 0,
        copiedByFallbackAllProjects: 0,
        alreadyExisting: 0,
        toInsert: 0,
        inserted: 0,
    };

    for (const legacyStatus of legacyStatuses) {
        const normalizedName = normalizeStatusName(legacyStatus.name);
        if (!normalizedName) {
            summary.legacyStatusesSkippedEmptyName += 1;
            continue;
        }

        summary.legacyStatusesProcessed += 1;

        let targetProjectIds = [];

        if (projectId) {
            targetProjectIds = [projectId];
        } else {
            const usageProjects = usageByStatus.get(normalizedName.toLowerCase());
            if (usageProjects && usageProjects.size > 0) {
                targetProjectIds = Array.from(usageProjects);
                summary.copiedByUsage += 1;
            } else {
                targetProjectIds = [...allProjectIds];
                summary.copiedByFallbackAllProjects += 1;
            }
        }

        if (verbose) {
            console.log(
                `[plan] ${normalizedName} -> ${targetProjectIds.length} project(s): ${targetProjectIds.join(", ")}`
            );
        }

        for (const targetProjectId of targetProjectIds) {
            const projectObjectId = new mongoose.Types.ObjectId(targetProjectId);
            const escapedName = escapeRegex(normalizedName);

            const existing = await statusesCollection.findOne(
                {
                    projectId: projectObjectId,
                    name: { $regex: `^${escapedName}$`, $options: "i" },
                },
                { projection: { _id: 1 } }
            );

            if (existing) {
                summary.alreadyExisting += 1;
                continue;
            }

            summary.toInsert += 1;

            if (dryRun) {
                continue;
            }

            await statusesCollection.updateOne(
                {
                    projectId: projectObjectId,
                    name: normalizedName,
                },
                {
                    $setOnInsert: {
                        projectId: projectObjectId,
                        name: normalizedName,
                        colorHex:
                            typeof legacyStatus.colorHex === "string" && legacyStatus.colorHex.trim()
                                ? legacyStatus.colorHex
                                : "#F59E0B",
                        isPPC: Boolean(legacyStatus.isPPC),
                        createdAt: legacyStatus.createdAt || new Date(),
                        updatedAt: new Date(),
                    },
                },
                { upsert: true }
            );

            summary.inserted += 1;
        }
    }

    console.log("Legacy status migration summary:");
    console.log(JSON.stringify(summary, null, 2));

    if (dryRun) {
        console.log("Dry run complete. Re-run with --apply to persist changes.");
    }

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error("Failed to migrate statuses projectId:", error?.message || error);
    try {
        await mongoose.disconnect();
    } catch {
        // Ignore disconnect errors on failure path.
    }
    process.exitCode = 1;
});
