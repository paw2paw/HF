/**
 * Auto-inject structural and survey stops into a lesson plan.
 *
 * Reads SESSION_TYPES_V1 contract for `autoInclude` positions and injects
 * stops that aren't already present. Handles mid_survey separately via
 * playbook survey config (not autoInclude).
 *
 * Idempotent: strips existing auto-include stops before re-inserting.
 */

import { getSessionTypeConfig, type SessionTypeEntry } from "./session-ui";

/** Minimal entry shape — compatible with both wizard and PUT route entry types. */
export interface PlanEntry {
  session: number;
  type: string;
  label?: string;
  moduleId?: string | null;
  moduleLabel?: string;
  estimatedDurationMins?: number;
  isOptional?: boolean;
  [key: string]: any;
}

export interface SurveyConfig {
  pre?: { enabled: boolean };
  mid?: { enabled: boolean };
  post?: { enabled: boolean };
}

/** Create a structural/survey stop entry. */
function makeStop(typeDef: SessionTypeEntry, overrides?: Partial<PlanEntry>): PlanEntry {
  return {
    session: 0, // renumbered later
    type: typeDef.value,
    moduleId: null,
    moduleLabel: "",
    label: typeDef.educatorLabel || typeDef.label,
    estimatedDurationMins: typeDef.category === "survey" ? 2 : undefined,
    isOptional: typeDef.canSkip,
    ...overrides,
  };
}

/**
 * Inject auto-include stops into a lesson plan.
 *
 * @param entries - Teaching session entries (may already contain structural stops)
 * @param surveys - Playbook survey config (controls which surveys are enabled)
 * @returns New array with structural + survey stops injected, renumbered sequentially
 */
export async function applyAutoIncludeStops(
  entries: PlanEntry[],
  surveys?: SurveyConfig | null,
): Promise<PlanEntry[]> {
  const config = await getSessionTypeConfig();
  const typeMap = new Map(config.types.map((t) => [t.value, t]));

  // Collect all types that have autoInclude set
  const autoTypes = config.types.filter((t) => t.autoInclude !== null);
  const autoTypeValues = new Set(autoTypes.map((t) => t.value));

  // Strip existing auto-include stops (idempotency)
  const teaching = entries.filter((e) => !autoTypeValues.has(e.type) && e.type !== "mid_survey");

  // Determine which auto-include stops to inject
  const beforeFirst: PlanEntry[] = [];
  const first: PlanEntry[] = [];
  const last: PlanEntry[] = [];
  const afterLast: PlanEntry[] = [];

  for (const typeDef of autoTypes) {
    // Survey stops are gated by playbook config
    if (typeDef.category === "survey") {
      if (!surveys) continue;
      if (typeDef.value === "pre_survey" && !surveys.pre?.enabled) continue;
      if (typeDef.value === "post_survey" && !surveys.post?.enabled) continue;
    }

    switch (typeDef.autoInclude) {
      case "before_first": beforeFirst.push(makeStop(typeDef)); break;
      case "first": first.push(makeStop(typeDef)); break;
      case "last": last.push(makeStop(typeDef)); break;
      case "after_last": afterLast.push(makeStop(typeDef)); break;
    }
  }

  // Handle mid_survey — config-gated, not autoInclude-driven
  let midSurvey: PlanEntry | undefined;
  if (surveys?.mid?.enabled) {
    const midDef = typeMap.get("mid_survey");
    if (midDef) midSurvey = makeStop(midDef);
  }

  // Assemble: before_first → first → teaching (with mid_survey) → last → after_last
  const result: PlanEntry[] = [...beforeFirst, ...first];

  if (midSurvey && teaching.length >= 2) {
    const midPoint = Math.ceil(teaching.length / 2);
    result.push(...teaching.slice(0, midPoint));
    result.push(midSurvey);
    result.push(...teaching.slice(midPoint));
  } else {
    result.push(...teaching);
  }

  result.push(...last, ...afterLast);

  // Renumber all entries sequentially
  result.forEach((e, i) => { e.session = i + 1; });

  return result;
}
