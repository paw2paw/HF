/**
 * Auto-trigger curriculum generation after all extractions complete.
 *
 * Called from runBackgroundExtraction() when an extraction task finishes.
 * If all extraction tasks for the subject are done and no curriculum
 * generation is already running, starts one automatically.
 */

import { prisma } from "@/lib/prisma";
import { startCurriculumGeneration } from "./curriculum-runner";

/**
 * Check if all extractions for a subject are done and auto-trigger
 * curriculum generation if so.
 *
 * @returns The new curriculum task ID if triggered, null if skipped.
 */
export async function checkAutoTriggerCurriculum(
  subjectId: string,
  userId: string,
): Promise<string | null> {
  // 1. Any active extraction tasks still running for this subject?
  const activeExtractions = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "UserTask"
    WHERE "taskType" = 'extraction'
      AND "status" = 'in_progress'
      AND "context"->>'subjectId' = ${subjectId}
  `;

  if (Number(activeExtractions[0]?.count ?? 0) > 0) {
    return null; // Still running
  }

  // 2. Any active curriculum generation already running for this subject?
  const activeCurriculum = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "UserTask"
    WHERE "taskType" = 'curriculum_generation'
      AND "status" = 'in_progress'
      AND "context"->>'subjectId' = ${subjectId}
  `;

  if (Number(activeCurriculum[0]?.count ?? 0) > 0) {
    return null; // Already generating
  }

  // 3. Check that there are assertions to generate from
  const assertionCount = await prisma.contentAssertion.count({
    where: {
      source: {
        subjects: { some: { subjectId } },
      },
    },
  });

  if (assertionCount === 0) {
    return null; // Nothing to generate from
  }

  // 4. Look up subject name
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { name: true },
  });

  if (!subject) {
    return null;
  }

  // 5. Auto-trigger
  console.log(
    `[auto-trigger] All extractions for subject "${subject.name}" (${subjectId}) complete. ` +
    `${assertionCount} assertions available. Starting curriculum generation.`
  );

  const taskId = await startCurriculumGeneration(subjectId, subject.name, userId);
  return taskId;
}
