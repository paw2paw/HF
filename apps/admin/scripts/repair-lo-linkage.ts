/**
 * repair-lo-linkage.ts — Epic #131 B2
 *
 * One-time repair for courses extracted before the Sprint 1 LO mapping fix.
 *
 * What it does:
 *   1. Measure LO linkage before repair (scorecard per course)
 *   2. Delete garbage LearningObjective rows where description === ref
 *      (the next curriculum regen will replace them with real prose)
 *   3. Re-run the FK reconciler for every curriculum (sets learningObjectiveId)
 *   4. Re-run question→TP linker for every source (with cross-source fallback)
 *   5. Measure after repair and report the delta
 *
 * Usage:
 *   npx tsx scripts/repair-lo-linkage.ts --dry-run
 *   npx tsx scripts/repair-lo-linkage.ts --course 5630dad9-de81-4f7e-a6e8-99d4a90fc0a6
 *   npx tsx scripts/repair-lo-linkage.ts                        # all courses
 *   npx tsx scripts/repair-lo-linkage.ts --course <id> --dry-run
 *
 * Idempotent — safe to re-run. Does not trigger AI re-extraction.
 *
 * What it does NOT fix:
 *   - Assertions with `learningOutcomeRef = null` (95% of Secret Garden).
 *     Those need a real re-extraction under the Sprint 1 curriculum-aware
 *     prompt. This script repairs the link between existing refs and LOs;
 *     the Sprint 1 extractors repair the refs themselves on re-extraction.
 */

import { PrismaClient } from "@prisma/client";
import { reconcileAssertionLOs } from "../lib/content-trust/reconcile-lo-linkage";
import { linkContentForSource } from "../lib/content-trust/link-content";
import {
  isValidLoPair,
  sanitiseLORef,
  scoreCoverage,
  type LoLinkageScorecard,
} from "../lib/content-trust/validate-lo-linkage";

const prisma = new PrismaClient();

// ── CLI args ───────────────────────────────────────────

interface CliArgs {
  dryRun: boolean;
  courseId: string | null;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = { dryRun: false, courseId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--course") args.courseId = argv[++i] ?? null;
    else if (a.startsWith("--course=")) args.courseId = a.slice("--course=".length);
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: npx tsx scripts/repair-lo-linkage.ts [--dry-run] [--course <id>]",
      );
      process.exit(0);
    }
  }
  return args;
}

// ── Scorecard ──────────────────────────────────────────

async function measureCourse(courseId: string): Promise<{
  name: string;
  sourceIds: string[];
  curriculumIds: string[];
  scorecard: LoLinkageScorecard;
  loRows: { total: number; garbageDescriptions: number };
  questions: { total: number; linked: number };
}> {
  const playbook = await prisma.playbook.findUnique({
    where: { id: courseId },
    select: { id: true, name: true },
  });
  if (!playbook) throw new Error(`course not found: ${courseId}`);

  // Subjects → sources → curricula
  const ps = await prisma.playbookSubject.findMany({
    where: { playbookId: courseId },
    select: {
      subject: {
        select: {
          id: true,
          sources: { select: { sourceId: true } },
        },
      },
    },
  });
  const sourceIds = [...new Set(ps.flatMap((p) => p.subject.sources.map((s) => s.sourceId)))];
  const subjectIds = [...new Set(ps.map((p) => p.subject.id))];

  const curricula = await prisma.curriculum.findMany({
    where: { subjectId: { in: subjectIds } },
    select: { id: true },
  });
  const curriculumIds = curricula.map((c) => c.id);

  // Assertion scorecard
  const assertions = await prisma.contentAssertion.findMany({
    where: { sourceId: { in: sourceIds } },
    select: { learningOutcomeRef: true, learningObjectiveId: true },
  });
  const total = assertions.length;
  const withValidRef = assertions.filter((a) => sanitiseLORef(a.learningOutcomeRef) !== null).length;
  const withFk = assertions.filter((a) => a.learningObjectiveId !== null).length;
  const distinctRefs = new Set(assertions.map((a) => a.learningOutcomeRef).filter(Boolean)).size;

  // LO rows — count garbage
  const los = curriculumIds.length > 0
    ? await prisma.learningObjective.findMany({
        where: { module: { curriculumId: { in: curriculumIds } } },
        select: { ref: true, description: true },
      })
    : [];
  const garbageDescriptions = los.filter((lo) => !isValidLoPair(lo.ref, lo.description)).length;

  // Questions
  const totalQuestions = await prisma.contentQuestion.count({
    where: { sourceId: { in: sourceIds } },
  });
  const linkedQuestions = await prisma.contentQuestion.count({
    where: { sourceId: { in: sourceIds }, assertionId: { not: null } },
  });

  return {
    name: playbook.name,
    sourceIds,
    curriculumIds,
    scorecard: scoreCoverage({ total, withValidRef, withFk, distinctRefs, garbageDescriptions }),
    loRows: { total: los.length, garbageDescriptions },
    questions: { total: totalQuestions, linked: linkedQuestions },
  };
}

function formatScorecard(label: string, sc: LoLinkageScorecard, los: { total: number; garbageDescriptions: number }, q: { total: number; linked: number }): string {
  const qPct = q.total > 0 ? Math.round((q.linked / q.total) * 100) : 0;
  return [
    `${label}:`,
    `  TPs total:                     ${sc.total}`,
    `  TPs with valid learningOutcomeRef: ${sc.withValidRef} (${sc.coveragePct}%)`,
    `  TPs with learningObjectiveId FK:   ${sc.withFk} (${sc.fkCoveragePct}%)`,
    `  Distinct LO refs on TPs:       ${sc.distinctRefs}`,
    `  LO rows in DB:                 ${los.total}`,
    `  LO rows with garbage descriptions: ${los.garbageDescriptions}`,
    `  Questions total:               ${q.total}`,
    `  Questions linked to a TP:      ${q.linked} (${qPct}%)`,
  ].join("\n");
}

// ── Repair ─────────────────────────────────────────────

async function repairCourse(courseId: string, dryRun: boolean): Promise<void> {
  const before = await measureCourse(courseId);
  console.log(`\n=== ${before.name} ===`);
  console.log(formatScorecard("BEFORE", before.scorecard, before.loRows, before.questions));

  if (before.sourceIds.length === 0) {
    console.log("  (no sources linked to this course — nothing to repair)");
    return;
  }

  if (dryRun) {
    console.log("\n[dry-run] Would:");
    if (before.loRows.garbageDescriptions > 0) {
      console.log(`  • Delete ${before.loRows.garbageDescriptions} LO rows with garbage descriptions`);
    }
    console.log(`  • Reconcile FKs across ${before.curriculumIds.length} curricula`);
    console.log(`  • Re-run question linker across ${before.sourceIds.length} sources`);
    return;
  }

  // Step 1 — purge garbage LO rows. Their modules still exist; the next
  // curriculum regeneration (under A3's hardened prompt) will recreate real
  // LO rows. Leaving the garbage in place would poison the FK reconciler
  // because sanitiseLORef accepts "LO-1" as a structured ref even though its
  // description is the same string.
  if (before.loRows.garbageDescriptions > 0) {
    // Delete only the garbage rows, preserving good ones
    const allLos = await prisma.learningObjective.findMany({
      where: { module: { curriculumId: { in: before.curriculumIds } } },
      select: { id: true, ref: true, description: true },
    });
    const garbageIds = allLos
      .filter((lo) => !isValidLoPair(lo.ref, lo.description))
      .map((lo) => lo.id);
    if (garbageIds.length > 0) {
      await prisma.learningObjective.deleteMany({ where: { id: { in: garbageIds } } });
      console.log(`  deleted ${garbageIds.length} garbage LO rows`);
    }
  }

  // Step 2 — reconcile FKs for every curriculum under this course
  let fkWritten = 0;
  for (const curriculumId of before.curriculumIds) {
    const result = await reconcileAssertionLOs(curriculumId);
    fkWritten += result.fkWritten;
  }
  console.log(`  reconcile: fkWritten=${fkWritten}`);

  // Step 3 — re-run question linker for every source
  let questionsLinked = 0;
  for (const sourceId of before.sourceIds) {
    try {
      const result = await linkContentForSource(sourceId);
      questionsLinked += result.questionsLinked;
    } catch (err) {
      console.error(`  link-content failed for source ${sourceId}:`, err);
    }
  }
  console.log(`  link-content: questionsLinked=${questionsLinked}`);

  // Step 4 — measure after
  const after = await measureCourse(courseId);
  console.log(formatScorecard("AFTER", after.scorecard, after.loRows, after.questions));

  const deltaFk = after.scorecard.fkCoveragePct - before.scorecard.fkCoveragePct;
  const deltaQ = (after.questions.total > 0 ? Math.round((after.questions.linked / after.questions.total) * 100) : 0)
    - (before.questions.total > 0 ? Math.round((before.questions.linked / before.questions.total) * 100) : 0);
  console.log(`  Δ FK coverage: ${deltaFk >= 0 ? "+" : ""}${deltaFk}pp · Δ question linkage: ${deltaQ >= 0 ? "+" : ""}${deltaQ}pp`);
}

// ── Main ───────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  console.log(`[repair-lo-linkage] dry-run=${args.dryRun} course=${args.courseId ?? "all"}`);

  const targetIds: string[] = [];
  if (args.courseId) {
    targetIds.push(args.courseId);
  } else {
    const all = await prisma.playbook.findMany({ select: { id: true } });
    targetIds.push(...all.map((p) => p.id));
  }
  console.log(`[repair-lo-linkage] ${targetIds.length} course(s) targeted`);

  for (const id of targetIds) {
    try {
      await repairCourse(id, args.dryRun);
    } catch (err) {
      console.error(`\n[repair-lo-linkage] failed for ${id}:`, err);
    }
  }

  console.log(`\n[repair-lo-linkage] done`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
