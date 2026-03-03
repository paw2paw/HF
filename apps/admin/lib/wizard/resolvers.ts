/**
 * Wizard Resolvers — Knowledge Sources in the Blackboard Architecture.
 *
 * Each resolver reads the blackboard, does work (DB lookup, inference),
 * and returns fields to write back. Resolvers fire automatically when
 * their trigger fields are updated.
 *
 * processUpdate() orchestrates: write incoming → fire resolvers → re-evaluate graph.
 *
 * NOTE: The actual DB lookup functions (resolveInstitutionByName, etc.) live in
 * wizard-tools.ts. This module wraps them in the resolver framework.
 * When V3 is fully wired, the inline resolution logic in executeWizardTool
 * can be replaced with calls to processUpdate.
 */

import type {
  ResolverKey,
  ResolverRegistration,
  ResolverResult,
  ProcessUpdateResult,
} from "./graph-schema";
import { evaluateGraph } from "./graph-evaluator";
import { ALL_NODES } from "./graph-nodes";

// ── Resolver Registry ─────────────────────────────────────

export const RESOLVER_REGISTRY: ResolverRegistration[] = [
  {
    key: "institution-lookup",
    triggerOn: ["institutionName"],
    requires: [],
    canSatisfy: [
      "existingInstitutionId",
      "existingDomainId",
      "defaultDomainKind",
      "typeSlug",
      // Can also chain to subject/course via auto-commit
      "subjectDiscipline",
      "courseName",
      "interactionPattern",
      "draftPlaybookId",
    ],
  },
  {
    key: "name-type-inference",
    triggerOn: ["institutionName"],
    requires: [],
    canSatisfy: ["typeSlug"],
  },
  {
    key: "subject-lookup",
    triggerOn: ["subjectDiscipline"],
    requires: ["existingDomainId|draftDomainId"],
    canSatisfy: ["courseName", "draftPlaybookId", "interactionPattern"],
  },
  {
    key: "course-lookup",
    triggerOn: ["courseName"],
    requires: ["existingDomainId|draftDomainId"],
    canSatisfy: ["draftPlaybookId", "interactionPattern"],
  },
  {
    key: "file-upload",
    triggerOn: ["packSubjectIds"],
    requires: ["existingDomainId|draftDomainId"],
    canSatisfy: ["subjectDiscipline", "sessionCount"],
  },
];

// ── Dependency check (same as graph-evaluator, imported for reuse) ──

function checkResolverDeps(
  requires: string[],
  blackboard: Record<string, unknown>,
): boolean {
  for (const dep of requires) {
    if (dep.includes("|")) {
      const alts = dep.split("|");
      if (!alts.some((a) => blackboard[a] !== undefined && blackboard[a] !== null && blackboard[a] !== "")) {
        return false;
      }
    } else {
      const v = blackboard[dep];
      if (v === undefined || v === null || v === "") return false;
    }
  }
  return true;
}

// ── Resolver executor placeholder ─────────────────────────
//
// The actual DB functions are in wizard-tools.ts:
//   - resolveInstitutionByName(name)
//   - resolveCourseByName(name, domainId)
//   - resolveSubjectByName(name, domainId)
//   - inferTypeFromName(name)
//
// For now, processUpdate is a pass-through that fires resolvers
// by calling the existing functions. This keeps V3 working with
// the existing wizard-tools.ts infrastructure.
//
// In a future refactor, the resolution logic can move here fully.

export type ResolverExecutor = (
  key: ResolverKey,
  blackboard: Record<string, unknown>,
  triggerField: string,
) => Promise<ResolverResult | null>;

// ── processUpdate ─────────────────────────────────────────

/**
 * Process a field update through the resolver chain.
 *
 * 1. Merge incoming fields into the blackboard
 * 2. Find triggered resolvers (matching triggerOn + deps met)
 * 3. Execute triggered resolvers
 * 4. Merge resolver results into the blackboard
 * 5. Re-evaluate the graph
 *
 * @param incomingFields - Fields from the AI's update_setup call
 * @param blackboard - Current wizard data bag
 * @param executor - Resolver executor function (injected for testability)
 * @returns Merged fields, context messages, and fresh graph evaluation
 */
export async function processUpdate(
  incomingFields: Record<string, unknown>,
  blackboard: Record<string, unknown>,
  executor: ResolverExecutor,
): Promise<ProcessUpdateResult> {
  // Step 1: Merge incoming
  const merged = { ...blackboard, ...incomingFields };
  const aiMessages: string[] = [];
  const triggeredKeys = Object.keys(incomingFields);

  // Step 2: Find triggered resolvers
  const toRun = RESOLVER_REGISTRY.filter(
    (r) =>
      r.triggerOn.some((t) => triggeredKeys.includes(t)) &&
      checkResolverDeps(r.requires, merged),
  );

  // Step 3: Execute resolvers in registration order (respects dependency ordering)
  for (const resolver of toRun) {
    const triggerField = resolver.triggerOn.find((t) => triggeredKeys.includes(t))!;
    const result = await executor(resolver.key, merged, triggerField);
    if (result) {
      // Step 4: Merge results — only write non-undefined values
      for (const [k, v] of Object.entries(result.fields)) {
        if (v !== undefined) {
          merged[k] = v;
        }
      }
      if (result.aiContext) {
        aiMessages.push(result.aiContext);
      }
    }
  }

  // Step 5: Re-evaluate graph
  const evaluation = evaluateGraph(merged, ALL_NODES);

  return {
    mergedFields: merged,
    aiContextMessages: aiMessages,
    evaluation,
  };
}

/**
 * Check which resolvers would be triggered by a set of field keys.
 * Useful for preview/debugging without executing.
 */
export function findTriggeredResolvers(
  fieldKeys: string[],
  blackboard: Record<string, unknown>,
): ResolverRegistration[] {
  return RESOLVER_REGISTRY.filter(
    (r) =>
      r.triggerOn.some((t) => fieldKeys.includes(t)) &&
      checkResolverDeps(r.requires, blackboard),
  );
}
