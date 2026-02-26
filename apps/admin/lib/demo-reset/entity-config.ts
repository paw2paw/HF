/**
 * Entity Configuration — Client-Safe
 *
 * FK dependency tree and resolution logic for the entity datagrid.
 * This module has NO server-side imports (no prisma, no fs) so it
 * can be safely imported into "use client" components.
 */

// ─── FK Dependency Tree ──────────────────────────────────────────────
// Selecting a parent auto-includes all FK children.
// Keys = parent Prisma model, Values = direct + transitive dependents.

export const ENTITY_DEPENDENCY_TREE: Record<string, string[]> = {
  Caller: [
    "CallerIdentity",
    "CallerPlaybook",
    "CallerCohortMembership",
    "OnboardingSession",
    "CallerAttribute",
    "CallerTarget",
    "CallerMemory",
    "CallerMemorySummary",
    "CallerPersonality",
    "CallerPersonalityProfile",
    "PersonalityObservation",
    "Goal",
    "CallerModuleProgress",
    "ComposedPrompt",
    "Call",
    // Transitive via Call:
    "CallMessage",
    "CallScore",
    "CallTarget",
    "CallAction",
    "BehaviorMeasurement",
    "RewardScore",
    "ConversationArtifact",
    "PromptSlugSelection",
    "InboundMessage",
  ],
  Call: [
    "CallMessage",
    "CallScore",
    "CallTarget",
    "CallAction",
    "BehaviorMeasurement",
    "RewardScore",
    "ConversationArtifact",
    "PromptSlugSelection",
    "InboundMessage",
  ],
  CohortGroup: ["CallerCohortMembership", "CohortPlaybook"],
  PipelineRun: ["PipelineStep"],
  Ticket: ["TicketComment"],
};

// ─── Runtime-deletable table names ───────────────────────────────────
// Kept in sync with LAYER_3_TABLES + SKIPPED_TABLES from snapshot-config.
// Intentionally duplicated here to avoid importing server-only modules.

const RUNTIME_TABLE_NAMES = new Set([
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
]);

/** Check if a table name is deletable (runtime data) */
export function isDeletable(tableName: string): boolean {
  return RUNTIME_TABLE_NAMES.has(tableName);
}

/**
 * Resolve the full deletion set from user selection.
 * Expands parent selections to include all FK children.
 * Returns only tables that are runtime-deletable.
 */
export function resolveDeleteSet(selected: string[]): string[] {
  const expanded = new Set<string>();

  for (const table of selected) {
    if (!RUNTIME_TABLE_NAMES.has(table)) continue;
    expanded.add(table);

    const children = ENTITY_DEPENDENCY_TREE[table];
    if (children) {
      for (const child of children) {
        if (RUNTIME_TABLE_NAMES.has(child)) {
          expanded.add(child);
        }
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Given a selected set and the resolved set, return which tables
 * were auto-added by cascade (present in result but not in original selection).
 */
export function getCascadedTables(
  selected: string[],
  resolved: string[]
): string[] {
  const selectedSet = new Set(selected);
  return resolved.filter((t) => !selectedSet.has(t));
}
