#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import mongoose from "mongoose";

const DEFAULT_PROJECT_STATUSES = [
    { name: "Pending", colorHex: "#F59E0B", isPPC: false },
    { name: "Completed", colorHex: "#10B981", isPPC: true },
];

function parseArgs(argv) {
    const args = [...argv];

    let projectId = null;
    let apply = false;
    let verbose = false;

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

        if (arg === "--help" || arg === "-h") {
            console.log([
                "Usage:",
                "  node scripts/backfill-project-default-statuses.mjs [--project-id <ObjectId>] [--apply] [--verbose]",
                "",
                "Defaults:",
                "  Dry-run mode unless --apply is provided",
                "  Runs for all projects when --project-id is omitted",
            ].join("\n"));
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return {
        projectId,
        dryRun: !apply,
        verbose,
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

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
    const { projectId, dryRun, verbose } = parseArgs(process.argv.slice(2));

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

    const projectsCollection = db.collection("projects");
    const statusesCollection = db.collection("statuses");

    const projectFilter = projectId
        ? { _id: new mongoose.Types.ObjectId(projectId) }
        : {};

    const projects = await projectsCollection
        .find(projectFilter, { projection: { _id: 1, name: 1 } })
        .toArray();

    if (projects.length === 0) {
        console.log("No projects found for backfill.");
        await mongoose.disconnect();
        return;
    }

    const summary = {
        dryRun,
        projectsScanned: projects.length,
        defaultsPerProject: DEFAULT_PROJECT_STATUSES.length,
        alreadyExisting: 0,
        toInsert: 0,
        inserted: 0,
    };

    for (const project of projects) {
        const projectObjectId = new mongoose.Types.ObjectId(project._id);

        for (const defaultStatus of DEFAULT_PROJECT_STATUSES) {
            const escapedName = escapeRegex(defaultStatus.name);
            const existing = await statusesCollection.findOne(
                {
                    projectId: projectObjectId,
                    name: { $regex: `^${escapedName}$`, $options: "i" },
                },
                { projection: { _id: 1, name: 1 } }
            );

            if (existing) {
                summary.alreadyExisting += 1;
                if (verbose) {
                    console.log(`[skip] ${project.name || project._id} -> ${existing.name}`);
                }
                continue;
            }

            summary.toInsert += 1;

            if (dryRun) {
                if (verbose) {
                    console.log(`[dry] ${project.name || project._id} -> ${defaultStatus.name}`);
                }
                continue;
            }

            await statusesCollection.updateOne(
                {
                    projectId: projectObjectId,
                    name: defaultStatus.name,
                },
                {
                    $setOnInsert: {
                        projectId: projectObjectId,
                        name: defaultStatus.name,
                        colorHex: defaultStatus.colorHex,
                        isPPC: defaultStatus.isPPC,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                },
                { upsert: true }
            );

            summary.inserted += 1;
            if (verbose) {
                console.log(`[insert] ${project.name || project._id} -> ${defaultStatus.name}`);
            }
        }
    }

    console.log("Project default status backfill summary:");
    console.log(JSON.stringify(summary, null, 2));

    if (dryRun) {
        console.log("Dry run complete. Re-run with --apply to persist changes.");
    }

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error("Failed to backfill project default statuses:", error?.message || error);
    try {
        await mongoose.disconnect();
    } catch {
        // Ignore disconnect errors on failure path.
    }
    process.exitCode = 1;
});
