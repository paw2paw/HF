/**
 * Snapshot Take
 *
 * Exports the current database state to a named JSON file.
 * Uses Prisma client for reads (handles @@map and Unsupported types automatically).
 */

import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import {
  startTaskTracking,
  updateTaskProgress,
  completeTask,
  failTask,
  backgroundRun,
} from "@/lib/ai/task-guidance";
import {
  SNAPSHOTS_DIR,
  getTablesForLayers,
  getInsertionOrderForLayers,
  getPrismaKey,
  isValidSnapshotName,
  type TakeSnapshotOptions,
  type SnapshotMetadata,
  type SnapshotFile,
  type ProgressCallback,
} from "./snapshot-config";

/**
 * Take a database snapshot.
 *
 * Core function used by both CLI (synchronous await) and API (background job).
 * Reads all tables in the layer set, writes a JSON file to prisma/snapshots/.
 */
export async function takeSnapshot(
  options: TakeSnapshotOptions,
  onProgress?: ProgressCallback
): Promise<SnapshotMetadata> {
  const { name, description, withLearners = false } = options;

  if (!isValidSnapshotName(name)) {
    throw new Error(
      `Invalid snapshot name "${name}". Use alphanumeric characters, hyphens, and underscores only.`
    );
  }

  // Check for existing snapshot with same name
  const filePath = path.join(SNAPSHOTS_DIR, `${name}.json`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Snapshot "${name}" already exists. Delete it first or choose a different name.`);
  }

  // Ensure directory exists
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  // Determine which tables to export, in insertion order (for consistency)
  const orderedTables = getInsertionOrderForLayers(withLearners);
  const allTables = new Set(getTablesForLayers(withLearners));

  const data: Record<string, any[]> = {};
  const stats: Record<string, number> = {};
  let totalRows = 0;

  for (let i = 0; i < orderedTables.length; i++) {
    const modelName = orderedTables[i];

    if (onProgress) {
      await onProgress({
        table: modelName,
        index: i,
        total: orderedTables.length,
        phase: "exporting",
      });
    }

    // Skip if not in our layer set (safety check)
    if (!allTables.has(modelName)) continue;

    const rows = await readTable(modelName, withLearners);
    data[modelName] = rows;
    stats[modelName] = rows.length;
    totalRows += rows.length;
  }

  // Build metadata
  const metadata: SnapshotMetadata = {
    name,
    description,
    version: "1.0",
    createdAt: new Date().toISOString(),
    layers: withLearners ? [0, 1, 2, 3] : [0, 1, 2],
    withLearners,
    stats,
    totalRows,
  };

  // Write snapshot file
  if (onProgress) {
    await onProgress({
      table: "",
      index: orderedTables.length,
      total: orderedTables.length,
      phase: "writing",
    });
  }

  const snapshot: SnapshotFile = { metadata, data };
  fs.writeFileSync(filePath, JSON.stringify(snapshot));

  return metadata;
}

/**
 * Read all rows from a table using the Prisma client.
 * Handles @@map automatically. Unsupported("vector") fields are excluded by Prisma.
 *
 * Special case: BehaviorTarget is filtered by scope when learners are excluded.
 */
async function readTable(modelName: string, withLearners: boolean): Promise<any[]> {
  const key = getPrismaKey(modelName);
  const delegate = (prisma as any)[key];

  if (!delegate || typeof delegate.findMany !== "function") {
    console.warn(`[snapshot] Skipping unknown model: ${modelName}`);
    return [];
  }

  // BehaviorTarget: filter scope when learners excluded
  if (modelName === "BehaviorTarget" && !withLearners) {
    return delegate.findMany({
      where: {
        scope: { in: ["SYSTEM", "PLAYBOOK"] },
      },
    });
  }

  return delegate.findMany();
}

// ─── Async job wrapper (for API/UI use) ─────────────────────────────

/**
 * Start a snapshot take as a background job.
 * Returns the task ID immediately; progress tracked via UserTask.
 */
export async function startSnapshotTakeJob(
  userId: string,
  options: TakeSnapshotOptions
): Promise<string> {
  const taskId = await startTaskTracking(userId, "snapshot_take", {
    snapshotName: options.name,
    withLearners: options.withLearners ?? false,
    description: options.description,
    currentTable: "",
    totalTables: 0,
    tablesExported: [] as string[],
  });

  backgroundRun(taskId, async () => {
    try {
      const metadata = await takeSnapshot(options, async (info) => {
        await updateTaskProgress(taskId, {
          currentStep: info.phase === "writing" ? 2 : 1,
          context: {
            currentTable: info.table,
            totalTables: info.total,
            tablesExported: info.table ? [info.table] : [],
            progress: Math.round((info.index / info.total) * 100),
          },
        });
      });

      await updateTaskProgress(taskId, {
        context: {
          totalRows: metadata.totalRows,
          stats: metadata.stats,
        },
      });
      await completeTask(taskId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failTask(taskId, message);
    }
  });

  return taskId;
}
