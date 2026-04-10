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
 * Matches structured LO refs: LO1, LO-1, LO12, AC2.3, R04-LO2-AC2.3, etc.
 * Case-insensitive. Hyphen between LO and the number is optional — both "LO1"
 * and "LO-1" are accepted because the legacy `parseLORef` synthesiser wrote
 * the hyphenated form into the DB. Rejects free-text values like
 * "Character analysis".
 */
export const STRUCTURED_LO_REF_PATTERN = /^(LO-?\d+|AC[\d.]+|R\d+-LO-?\d+(?:-AC[\d.]+)?)$/i;

/**
 * Normalise a raw LO ref string to its canonical form, or return null if it
 * is not a valid structured ref. Used as a guard between AI output and DB write.
 *
 *   sanitiseLORef("  LO1  ")        → "LO1"
 *   sanitiseLORef("lo2")            → "LO2"
 *   sanitiseLORef("LO-1")           → "LO-1"   (hyphen form preserved)
 *   sanitiseLORef("R04-LO2-AC2.3")  → "R04-LO2-AC2.3"
 *   sanitiseLORef("Character analysis") → null  (free text — reject)
 *   sanitiseLORef(null)             → null
 *   sanitiseLORef("")               → null
 *
 * The hyphen form `LO-1` is preserved rather than normalised to `LO1` because
 * the legacy DB has both forms and `loRefsMatch` (word-boundary matcher) will
 * bind them bidirectionally.
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

/**
 * Full scorecard for a course — loads from DB, computes coverage, garbage counts,
 * question linkage, and module/LO summary.
 *
 * Used by:
 *   - `GET /api/courses/[courseId]/curriculum-scorecard` (the Curriculum tab banner)
 *   - `scripts/repair-lo-linkage.ts` (before/after delta)
 *   - Future `B1` warning gate on lesson plan regeneration
 *
 * Single source of truth for LO linkage health on a course.
 */
export interface CourseLinkageScorecard {
  course: { id: string; name: string };
  scorecard: LoLinkageScorecard;
  loRows: {
    total: number;
    garbageDescriptions: number;
    orphanLos: number; // LOs with no TPs pointing at them via learningOutcomeRef
  };
  questions: {
    total: number;
    linkedToTp: number;
    linkedPct: number;
  };
  modules: {
    total: number;
    active: number;
  };
  warnings: string[];
}

export async function computeCourseLinkageScorecard(courseId: string): Promise<CourseLinkageScorecard | null> {
  // Dynamic import so this module stays safe to import from test files that
  // mock @/lib/prisma differently.
  const { prisma } = await import("@/lib/prisma");

  const playbook = await prisma.playbook.findUnique({
    where: { id: courseId },
    select: { id: true, name: true },
  });
  if (!playbook) return null;

  const ps = await prisma.playbookSubject.findMany({
    where: { playbookId: courseId },
    select: {
      subjectId: true,
      subject: { select: { sources: { select: { sourceId: true } } } },
    },
  });
  const sourceIds = [...new Set(ps.flatMap((p) => p.subject.sources.map((s) => s.sourceId)))];
  const subjectIds = [...new Set(ps.map((p) => p.subjectId))];

  const warnings: string[] = [];

  if (sourceIds.length === 0) {
    warnings.push("Course has no linked content sources yet");
  }
  if (subjectIds.length === 0) {
    warnings.push("Course has no subjects yet — upload content to create one");
  }

  // Assertions
  const assertions = sourceIds.length > 0
    ? await prisma.contentAssertion.findMany({
        where: { sourceId: { in: sourceIds } },
        select: { learningOutcomeRef: true, learningObjectiveId: true },
      })
    : [];
  const total = assertions.length;
  const withValidRef = assertions.filter((a) => sanitiseLORef(a.learningOutcomeRef) !== null).length;
  const withFk = assertions.filter((a) => a.learningObjectiveId !== null).length;
  const distinctRefs = new Set(
    assertions.map((a) => a.learningOutcomeRef).filter((r): r is string => !!r),
  ).size;

  // LearningObjective rows
  const curricula = subjectIds.length > 0
    ? await prisma.curriculum.findMany({
        where: { subjectId: { in: subjectIds } },
        select: { id: true, modules: { select: { id: true, isActive: true, learningObjectives: { select: { ref: true, description: true } } } } },
      })
    : [];
  const allModules = curricula.flatMap((c) => c.modules);
  const activeModules = allModules.filter((m) => m.isActive);
  const los = activeModules.flatMap((m) => m.learningObjectives);
  const garbageDescriptions = los.filter((lo) => !isValidLoPair(lo.ref, lo.description)).length;

  if (los.length > 0 && garbageDescriptions === los.length) {
    warnings.push(
      "All learning objectives have garbage descriptions — regenerate the curriculum to fix them",
    );
  } else if (garbageDescriptions > 0) {
    warnings.push(
      `${garbageDescriptions} of ${los.length} learning objectives have garbage descriptions`,
    );
  }

  // Orphan LOs — LOs with zero matching assertions (cheap approximation: ref
  // never appears in assertion.learningOutcomeRef for any assertion in this course)
  const refCounts = new Map<string, number>();
  for (const a of assertions) {
    if (a.learningOutcomeRef) {
      refCounts.set(a.learningOutcomeRef, (refCounts.get(a.learningOutcomeRef) ?? 0) + 1);
    }
  }
  const orphanLos = los.filter((lo) => {
    const canon = sanitiseLORef(lo.ref);
    if (!canon) return true;
    return !refCounts.has(canon) && !refCounts.has(lo.ref);
  }).length;

  // Questions
  const totalQuestions = sourceIds.length > 0
    ? await prisma.contentQuestion.count({ where: { sourceId: { in: sourceIds } } })
    : 0;
  const linkedQuestions = sourceIds.length > 0
    ? await prisma.contentQuestion.count({ where: { sourceId: { in: sourceIds }, assertionId: { not: null } } })
    : 0;

  if (totalQuestions > 0 && linkedQuestions === 0) {
    warnings.push(
      `${totalQuestions} question${totalQuestions !== 1 ? "s" : ""} not linked to any teaching point`,
    );
  }

  return {
    course: { id: playbook.id, name: playbook.name },
    scorecard: scoreCoverage({ total, withValidRef, withFk, distinctRefs, garbageDescriptions }),
    loRows: { total: los.length, garbageDescriptions, orphanLos },
    questions: {
      total: totalQuestions,
      linkedToTp: linkedQuestions,
      linkedPct: totalQuestions > 0 ? Math.round((linkedQuestions / totalQuestions) * 100) : 0,
    },
    modules: { total: allModules.length, active: activeModules.length },
    warnings,
  };
}
