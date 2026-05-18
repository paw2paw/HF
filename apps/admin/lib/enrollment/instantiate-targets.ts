/**
 * Instantiate CallerTarget rows for a caller's ACTIVE playbook enrolments.
 *
 * Sibling of `instantiate-goals.ts`. For each active enrolment, finds every
 * PLAYBOOK-scope BehaviorTarget with a non-null `skillRef` — these are the
 * per-skill target rows projected from a Course Reference's Skills Framework
 * by `lib/wizard/apply-projection.ts` — and pre-creates a placeholder
 * CallerTarget row with `currentScore: null`, `callsUsed: 0`.
 *
 * Before this helper, CallerTarget rows were created lazily on the first
 * matching CallScore inside `lib/pipeline/aggregate-runner.ts`. A freshly
 * enrolled learner therefore had Goal rows but no per-skill target rows
 * until call #1 landed — and the ACHIEVE goal banding UI (#417 / #442) had
 * nothing to render. Eager creation makes the placeholder visible from
 * enrolment.
 *
 * Why this is safe with the aggregate-runner:
 *   The runner's `callerTarget.upsert` writes only `currentScore`,
 *   `lastScoredAt`, and `callsUsed` in its `update` clause — never
 *   `targetValue` — so a pre-existing row from this helper is not stomped
 *   on by the first scoring pass.
 *
 * Why we copy `targetValue` from BehaviorTarget (not default to 1.0):
 *   The runner defaults `targetValue: 1.0` only on first-create. If we
 *   created with 1.0 here for a BehaviorTarget whose real target is e.g.
 *   0.65 (Band 6.5 rather than Secure), the wrong value would persist
 *   forever — the runner never rewrites it. Read the truth from the source.
 *
 * Idempotent: uses `createMany({ skipDuplicates: true })` against the
 * `(callerId, parameterId)` unique constraint.
 *
 * Failure policy: returns `{ created, skipped }` on success; callers wrap
 * this in `.catch(...)` to log-and-continue so target-row creation never
 * blocks enrolment. Goals are the load-bearing artifact; targets are a UI
 * affordance.
 */

import { prisma } from "@/lib/prisma";

export interface InstantiateTargetsResult {
  created: number;
  skipped: number;
}

export async function instantiatePlaybookTargets(
  callerId: string,
): Promise<InstantiateTargetsResult> {
  const enrollments = await prisma.callerPlaybook.findMany({
    where: { callerId, status: "ACTIVE" },
    select: { playbookId: true },
  });

  if (enrollments.length === 0) {
    return { created: 0, skipped: 0 };
  }

  const playbookIds = enrollments.map((e) => e.playbookId);

  const targets = await prisma.behaviorTarget.findMany({
    where: {
      playbookId: { in: playbookIds },
      scope: "PLAYBOOK",
      skillRef: { not: null },
      effectiveUntil: null,
    },
    select: { parameterId: true, targetValue: true },
  });

  if (targets.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Dedupe by parameterId — a caller enrolled in two playbooks that both
  // expose the same skill parameter would otherwise violate the unique
  // (callerId, parameterId) constraint pre-skipDuplicates. First seen wins.
  const seen = new Set<string>();
  const rows: Array<{
    callerId: string;
    parameterId: string;
    targetValue: number;
    currentScore: null;
    callsUsed: number;
  }> = [];
  for (const t of targets) {
    if (seen.has(t.parameterId)) continue;
    seen.add(t.parameterId);
    rows.push({
      callerId,
      parameterId: t.parameterId,
      targetValue: t.targetValue,
      currentScore: null,
      callsUsed: 0,
    });
  }

  const result = await prisma.callerTarget.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return {
    created: result.count,
    skipped: rows.length - result.count,
  };
}
