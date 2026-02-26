/**
 * Selective Runtime Data Deletion (Server-Only)
 *
 * Surgical deletion of selected runtime tables with automatic FK cascade
 * resolution. Uses TRUNCATION_ORDER from snapshot-config for safe ordering.
 *
 * Config tables (Layer 0/1/2) are never deletable through this module.
 *
 * NOTE: Client-safe exports (ENTITY_DEPENDENCY_TREE, resolveDeleteSet, etc.)
 * live in ./entity-config.ts to avoid bundling prisma into client code.
 */

import { prisma } from "@/lib/prisma";
import {
  TRUNCATION_ORDER,
  getTableName,
} from "@/lib/snapshots/snapshot-config";
import { seedDemoMeteringData } from "./seed-metering";
import { resolveDeleteSet, isDeletable } from "./entity-config";

// Re-export client-safe functions for server callers
export {
  ENTITY_DEPENDENCY_TREE,
  resolveDeleteSet,
  getCascadedTables,
  isDeletable,
} from "./entity-config";

// ─── Types ───────────────────────────────────────────────────────────

export interface DemoResetResult {
  success: boolean;
  tablesDeleted: string[];
  rowsDeleted: Record<string, number>;
  totalRowsDeleted: number;
  meteringSeeded?: { eventsCreated: number; totalCostCents: number };
  errors: string[];
}

// ─── FK-Safe Deletion Order ──────────────────────────────────────────

/**
 * Sort tables into FK-safe deletion order (children first, parents last).
 * Uses TRUNCATION_ORDER as the authority. Tables not in TRUNCATION_ORDER
 * are appended at the beginning (safest position — deleted first).
 */
function sortForDeletion(tables: string[]): string[] {
  const orderMap = new Map<string, number>();
  TRUNCATION_ORDER.forEach((t, i) => orderMap.set(t, i));

  return [...tables].sort((a, b) => {
    const ai = orderMap.get(a) ?? -1;
    const bi = orderMap.get(b) ?? -1;
    return ai - bi;
  });
}

// ─── Perform Deletion ────────────────────────────────────────────────

/**
 * Perform selective deletion of specified runtime tables.
 * Auto-resolves FK cascades, deletes in safe order, optionally re-seeds metering.
 */
export async function performSelectiveDelete(
  tables: string[],
  options?: { reseedMetering?: boolean }
): Promise<DemoResetResult> {
  const resolved = resolveDeleteSet(tables);
  const ordered = sortForDeletion(resolved);
  const errors: string[] = [];
  const rowsDeleted: Record<string, number> = {};
  let totalRowsDeleted = 0;

  for (const table of ordered) {
    const pgTable = getTableName(table);
    try {
      const result = await prisma.$executeRawUnsafe(
        `DELETE FROM "${pgTable}"`
      );
      rowsDeleted[table] = result;
      totalRowsDeleted += result;
    } catch (err: any) {
      errors.push(`${table}: ${err.message}`);
    }
  }

  // Optionally re-seed metering data
  let meteringSeeded: { eventsCreated: number; totalCostCents: number } | undefined;
  if (options?.reseedMetering) {
    try {
      meteringSeeded = await seedDemoMeteringData();
    } catch (err: any) {
      errors.push(`Metering re-seed: ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    tablesDeleted: ordered,
    rowsDeleted,
    totalRowsDeleted,
    meteringSeeded,
    errors,
  };
}

/**
 * Full demo reset — all runtime tables + metering re-seed.
 * Collects all runtime-deletable table names and deletes them.
 */
export async function performDemoReset(): Promise<DemoResetResult> {
  // Get all runtime tables by checking each entity definition
  // We use the same RUNTIME_TABLE_NAMES from entity-config via isDeletable
  const allRuntime = [
    // Layer 3
    "Caller", "CallerPlaybook", "CallerAttribute", "CallerIdentity",
    "CohortGroup", "CallerCohortMembership", "CohortPlaybook",
    "Call", "CallMessage", "CallScore", "CallAction",
    "CallerMemory", "CallerPersonality", "PersonalityObservation",
    "Goal", "ComposedPrompt", "OnboardingSession",
    "BehaviorMeasurement", "ConversationArtifact",
    // Skipped (runtime)
    "CallerMemorySummary", "CallerPersonalityProfile",
    "CallerTarget", "CallTarget", "CallerModuleProgress",
    "PipelineRun", "PipelineStep",
    "AgentInstance", "AgentRun",
    "UsageEvent", "UsageRollup",
    "AuditLog", "PromptSlugSelection", "RewardScore",
    "VectorEmbedding", "FailedCall", "ProcessedFile",
    "Invite", "ExcludedCaller", "Message",
    "Ticket", "TicketComment", "UserTask",
    "InboundMessage", "BDDUpload",
  ].filter(isDeletable);

  return performSelectiveDelete(allRuntime, { reseedMetering: true });
}
