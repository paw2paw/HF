/**
 * validate-lo-linkage.ts
 *
 * Guards and measurement for the Learning Objective → Teaching Point → Question
 * mapping pipeline. Used by:
 *
 *   1. syncModulesToDB — reject garbage `description === ref` payloads before write
 *   2. lesson plan regeneration — surface data-quality warnings (epic #131 B1)
 *   3. the repair script — report before/after scorecards
 *
 * The invariants this module defends:
 *
 *   - `LearningObjective.description` must not equal `LearningObjective.ref`
 *     (descriptions like "LO1" are garbage — the prompt must produce real outcome text)
 *   - `ContentAssertion.learningOutcomeRef` must be a structured ref or null —
 *     free-text topic names like "Character analysis" are rejected upstream
 *   - `ContentAssertion.learningObjectiveId` is the authoritative FK; the string
 *     ref is the write-time signal from extraction
 *
 * This is the structural fix per `.claude/rules/ai-to-db-guard.md` — a validation
 * step between AI output and DB write, so the 5 defects found on PW: Secret Garden
 * cannot silently recur on new courses.
 */

/**
 * Matches structured LO refs: LO1, LO12, AC2.3, R04-LO2-AC2.3, etc.
 * Case-insensitive. Rejects free-text values like "Character analysis".
 */
export const STRUCTURED_LO_REF_PATTERN = /^(LO\d+|AC[\d.]+|R\d+-LO\d+(?:-AC[\d.]+)?)$/i;

/**
 * Normalise a raw LO ref string to its canonical form, or return null if it
 * is not a valid structured ref. Used as a guard between AI output and DB write.
 *
 *   sanitiseLORef("  LO1  ")        → "LO1"
 *   sanitiseLORef("lo2")            → "LO2"
 *   sanitiseLORef("R04-LO2-AC2.3")  → "R04-LO2-AC2.3"
 *   sanitiseLORef("Character analysis") → null  (free text — reject)
 *   sanitiseLORef(null)             → null
 *   sanitiseLORef("")               → null
 */
export function sanitiseLORef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!STRUCTURED_LO_REF_PATTERN.test(trimmed)) return null;
  return trimmed.toUpperCase();
}

/**
 * True if a proposed (ref, description) pair is a valid LearningObjective.
 * Rejects pairs where description is empty, equals the ref, or is shorter than 4 chars
 * (nothing meaningful fits in 3 chars for a learning outcome).
 */
export function isValidLoPair(
  ref: string | null | undefined,
  description: string | null | undefined,
): boolean {
  if (!ref || !description) return false;
  const trimmedDesc = description.trim();
  if (trimmedDesc.length < 4) return false;
  if (trimmedDesc.toUpperCase() === ref.trim().toUpperCase()) return false;
  return true;
}

/**
 * Parse a raw learning-outcome string from AI output into `{ ref, description }`.
 * Returns null (not a synthetic fallback) when the input is unusable — the caller
 * must decide whether to skip, request regeneration, or log a warning.
 *
 * This is the strict replacement for the old `parseLORef` synthesizer that
 * silently fabricated `LO-${index+1}` refs and wrote the raw input as description,
 * producing the "description === ref" garbage seen on PW: Secret Garden.
 *
 *   parseLoLine("LO1: Identify themes")     → { ref: "LO1", description: "Identify themes" }
 *   parseLoLine("R04-LO2-AC2.3 - Apply X")  → { ref: "R04-LO2-AC2.3", description: "Apply X" }
 *   parseLoLine("LO1")                      → null  (no description)
 *   parseLoLine("Character analysis")       → null  (no ref)
 *   parseLoLine("")                         → null
 */
const LO_LINE_PATTERN = /^(LO\d+|AC[\d.]+|R\d+-LO\d+(?:-AC[\d.]+)?)\s*[:\-–]\s*(.+)$/i;

export function parseLoLine(text: string | null | undefined): { ref: string; description: string } | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(LO_LINE_PATTERN);
  if (!match) return null;
  const ref = match[1].toUpperCase();
  const description = match[2].trim();
  if (!isValidLoPair(ref, description)) return null;
  return { ref, description };
}

/**
 * Coverage scorecard for an LO linkage set. Used by the validation gate (B1)
 * and the repair script (B2) to produce before/after numbers.
 */
export interface LoLinkageScorecard {
  total: number;
  withValidRef: number;
  withFk: number;
  orphans: number;
  distinctRefs: number;
  garbageDescriptions: number;
  coveragePct: number;
  fkCoveragePct: number;
}

export function scoreCoverage(input: {
  total: number;
  withValidRef: number;
  withFk: number;
  distinctRefs: number;
  garbageDescriptions: number;
}): LoLinkageScorecard {
  const orphans = input.total - input.withValidRef;
  const coveragePct = input.total > 0 ? Math.round((input.withValidRef / input.total) * 100) : 0;
  const fkCoveragePct = input.total > 0 ? Math.round((input.withFk / input.total) * 100) : 0;
  return { ...input, orphans, coveragePct, fkCoveragePct };
}
