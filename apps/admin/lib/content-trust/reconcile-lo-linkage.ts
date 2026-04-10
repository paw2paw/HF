/**
 * reconcile-lo-linkage.ts
 *
 * Epic #131 A4 — populate `ContentAssertion.learningObjectiveId` by joining
 * the string `learningOutcomeRef` against `LearningObjective.ref` within the
 * curriculum scope. The match uses `loRefsMatch` (word-boundary bidirectional)
 * from Part A, so hierarchical refs like "R04-LO2-AC2.3" bind to "LO2" and
 * "LO1" does not collide with "LO10".
 *
 * Runs automatically from `syncModulesToDB` after every curriculum save, and
 * on-demand from the repair script (B2) and the extract route after first-pass
 * extraction (handles the temporal dependency where assertions are extracted
 * before LOs exist).
 *
 * The FK is authoritative for the deep-detail endpoint, Genome route, and
 * future matrix view. The string ref stays as the write-time signal used by
 * the lesson plan engine and prompt composition (which still round-trip via
 * loRefsMatch).
 */

import { prisma } from "@/lib/prisma";
import { loRefsMatch } from "@/lib/lesson-plan/lo-ref-match";

export interface ReconcileResult {
  curriculumId: string;
  assertionsScanned: number;
  fkWritten: number;
  fkAlreadySet: number;
  noRefOnAssertion: number;
  refDidNotMatchAnyLo: number;
  assertionsByLoRef: Record<string, number>;
}

/**
 * For every ContentAssertion reachable from this curriculum's sources that
 * has a non-null `learningOutcomeRef`, try to set `learningObjectiveId` by
 * matching against the curriculum's `LearningObjective` rows.
 *
 * Idempotent — assertions that already have the FK set are left alone.
 * Safe to call on every curriculum save.
 */
export async function reconcileAssertionLOs(curriculumId: string): Promise<ReconcileResult> {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    select: {
      id: true,
      subjectId: true,
      modules: {
        where: { isActive: true },
        select: {
          id: true,
          learningObjectives: {
            select: { id: true, ref: true },
          },
        },
      },
    },
  });

  const empty: ReconcileResult = {
    curriculumId,
    assertionsScanned: 0,
    fkWritten: 0,
    fkAlreadySet: 0,
    noRefOnAssertion: 0,
    refDidNotMatchAnyLo: 0,
    assertionsByLoRef: {},
  };

  if (!curriculum) return empty;

  // Flatten LOs to (ref, id) pairs. A ref may appear in multiple modules
  // (Defect #5 — tracked separately); index by ref and, when multiple modules
  // share a ref, pick the first match. This is a soft compromise — the hard
  // fix (B4) enforces curriculum-wide uniqueness at the schema level.
  const loByRef = new Map<string, { id: string; ref: string }>();
  for (const mod of curriculum.modules) {
    for (const lo of mod.learningObjectives) {
      if (!loByRef.has(lo.ref)) {
        loByRef.set(lo.ref, { id: lo.id, ref: lo.ref });
      }
    }
  }

  if (loByRef.size === 0) return empty;

  // Resolve source IDs via the subject link chain
  const subjectSources = await prisma.subjectSource.findMany({
    where: { subjectId: curriculum.subjectId ?? undefined },
    select: { sourceId: true },
  });
  const sourceIds = [...new Set(subjectSources.map((s) => s.sourceId))];
  if (sourceIds.length === 0) return empty;

  const assertions = await prisma.contentAssertion.findMany({
    where: { sourceId: { in: sourceIds } },
    select: {
      id: true,
      learningOutcomeRef: true,
      learningObjectiveId: true,
    },
  });

  const result: ReconcileResult = { ...empty, assertionsScanned: assertions.length };
  const loArray = [...loByRef.values()];

  for (const a of assertions) {
    if (a.learningObjectiveId) {
      result.fkAlreadySet++;
      continue;
    }
    if (!a.learningOutcomeRef) {
      result.noRefOnAssertion++;
      continue;
    }

    const match = loArray.find((lo) => loRefsMatch(a.learningOutcomeRef, lo.ref));
    if (!match) {
      result.refDidNotMatchAnyLo++;
      continue;
    }

    await prisma.contentAssertion.update({
      where: { id: a.id },
      data: { learningObjectiveId: match.id },
    });
    result.fkWritten++;
    result.assertionsByLoRef[match.ref] = (result.assertionsByLoRef[match.ref] ?? 0) + 1;
  }

  console.log(
    `[reconcile-lo-linkage] curriculum=${curriculumId}: scanned=${result.assertionsScanned} ` +
      `fkWritten=${result.fkWritten} alreadySet=${result.fkAlreadySet} ` +
      `noRef=${result.noRefOnAssertion} unmatched=${result.refDidNotMatchAnyLo}`,
  );

  return result;
}
