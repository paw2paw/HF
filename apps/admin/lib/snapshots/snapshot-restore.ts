/**
 * Snapshot Restore
 *
 * Restores database state from a snapshot file.
 * Runs inside a single Prisma transaction with deferred FK constraints.
 * On any failure, the entire transaction rolls back — DB unchanged.
 *
 * Uses Prisma client for deletes (deleteMany) and inserts (createMany)
 * to handle @@map table name overrides automatically.
 * Raw SQL only for SET CONSTRAINTS and advisory locks.
 */

import { prisma } from "@/lib/prisma";
import {
  startTaskTracking,
  updateTaskProgress,
  completeTask,
  failTask,
  backgroundRun,
} from "@/lib/ai/task-guidance";
import {
  getTruncationOrderForLayers,
  getInsertionOrderForLayers,
  getPrismaKey,
  getTableName,
  type RestoreSnapshotOptions,
  type RestoreResult,
  type ProgressCallback,
} from "./snapshot-config";
import { loadSnapshotFile } from "./snapshot-list";

/** Advisory lock ID for snapshot restore (prevents concurrent restores) */
const RESTORE_LOCK_ID = 857291;

/** Max rows per createMany batch (PostgreSQL parameter limit ~65535) */
const BATCH_SIZE = 500;

/**
 * Restore database from a snapshot.
 *
 * Core function used by both CLI (synchronous) and API (background job).
 *
 * Flow:
 * 1. Load and validate snapshot file
 * 2. Inside a transaction:
 *    a. Acquire advisory lock (prevent concurrent restores)
 *    b. Defer FK constraints
 *    c. Delete all data in truncation order (children first)
 *    d. Insert snapshot data in insertion order (parents first)
 * 3. On any error, transaction rolls back entirely
 */
export async function restoreSnapshot(
  options: RestoreSnapshotOptions,
  onProgress?: ProgressCallback
): Promise<RestoreResult> {
  const { name, dryRun = false } = options;

  // Load snapshot
  const snapshot = loadSnapshotFile(name);
  const withLearners = snapshot.metadata.withLearners;

  const truncationOrder = getTruncationOrderForLayers(withLearners);
  const insertionOrder = getInsertionOrderForLayers(withLearners);

  // For dry run, just report what would happen
  if (dryRun) {
    const tablesInserted: Record<string, number> = {};
    for (const model of insertionOrder) {
      const rows = snapshot.data[model] || [];
      if (rows.length > 0) tablesInserted[model] = rows.length;
    }
    return {
      success: true,
      tablesCleared: truncationOrder,
      tablesInserted,
      errors: [],
      dryRun: true,
    };
  }

  const tablesCleared: string[] = [];
  const tablesInserted: Record<string, number> = {};
  const errors: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // Advisory lock — prevents concurrent restores
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${RESTORE_LOCK_ID})`
      );

      // Defer all FK constraints until commit
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");

      // ── Phase 1: Clear tables (children first) ──
      for (let i = 0; i < truncationOrder.length; i++) {
        const modelName = truncationOrder[i];
        const tableName = getTableName(modelName);

        if (onProgress) {
          await onProgress({
            table: modelName,
            index: i,
            total: truncationOrder.length,
            phase: "clearing",
          });
        }

        try {
          await tx.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
          tablesCleared.push(modelName);
        } catch (err: any) {
          // Table might not exist in this schema version
          if (err?.code === "P2010" || err?.message?.includes("does not exist")) {
            console.warn(`[restore] Table "${tableName}" not found, skipping`);
          } else {
            throw err; // Re-throw to roll back transaction
          }
        }
      }

      // ── Phase 2: Insert data (parents first) ──
      for (let i = 0; i < insertionOrder.length; i++) {
        const modelName = insertionOrder[i];
        const rows = snapshot.data[modelName];

        if (!rows || rows.length === 0) continue;

        if (onProgress) {
          await onProgress({
            table: modelName,
            index: i,
            total: insertionOrder.length,
            phase: "inserting",
          });
        }

        const key = getPrismaKey(modelName);
        const delegate = (tx as any)[key];

        if (!delegate || typeof delegate.createMany !== "function") {
          errors.push(`Unknown model: ${modelName}`);
          continue;
        }

        try {
          // Batch inserts to avoid PostgreSQL parameter limit
          for (let start = 0; start < rows.length; start += BATCH_SIZE) {
            const batch = rows.slice(start, start + BATCH_SIZE);

            // Convert ISO date strings back to Date objects for DateTime fields
            const processed = batch.map(convertDatesInRow);

            await delegate.createMany({
              data: processed,
              skipDuplicates: true,
            });
          }
          tablesInserted[modelName] = rows.length;
        } catch (err: any) {
          // Log but re-throw to roll back the entire transaction
          console.error(
            `[restore] Failed to insert ${rows.length} rows into ${modelName}:`,
            err?.message
          );
          throw err;
        }
      }
    },
    {
      timeout: 300_000, // 5 minutes for large snapshots
      maxWait: 10_000,
    }
  );

  return {
    success: true,
    tablesCleared,
    tablesInserted,
    errors,
    dryRun: false,
  };
}

/**
 * Convert ISO date strings in a row back to Date objects.
 * JSON.parse produces strings for dates; Prisma createMany expects Date objects.
 */
function convertDatesInRow(row: Record<string, any>): Record<string, any> {
  const result = { ...row };

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string" && isISODateString(value)) {
      result[key] = new Date(value);
    }
  }

  return result;
}

/** Check if a string looks like an ISO 8601 date */
function isISODateString(value: string): boolean {
  // Match: 2026-02-22T14:30:00.000Z or 2026-02-22T14:30:00+00:00
  return (
    value.length >= 20 &&
    value.length <= 30 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
  );
}

// ─── Async job wrapper (for API/UI use) ─────────────────────────────

/**
 * Start a snapshot restore as a background job.
 * Returns the task ID immediately; progress tracked via UserTask.
 */
export async function startSnapshotRestoreJob(
  userId: string,
  name: string
): Promise<string> {
  // Validate snapshot exists before creating the job
  loadSnapshotFile(name); // throws if not found

  const taskId = await startTaskTracking(userId, "snapshot_restore", {
    snapshotName: name,
    phase: "starting",
    currentTable: "",
    totalTables: 0,
    rowsInserted: 0,
  });

  backgroundRun(taskId, async () => {
    try {
      const result = await restoreSnapshot({ name }, async (info) => {
        const step = info.phase === "clearing" ? 2 : info.phase === "inserting" ? 3 : 1;
        await updateTaskProgress(taskId, {
          currentStep: step,
          context: {
            phase: info.phase,
            currentTable: info.table,
            totalTables: info.total,
            progress: Math.round((info.index / Math.max(info.total, 1)) * 100),
          },
        });
      });

      await updateTaskProgress(taskId, {
        currentStep: 4,
        context: {
          phase: "complete",
          tablesCleared: result.tablesCleared.length,
          tablesInserted: result.tablesInserted,
          totalRows: Object.values(result.tablesInserted).reduce((a, b) => a + b, 0),
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
