/**
 * Async curriculum generation via UserTask.
 *
 * Creates a UserTask of type "curriculum_generation", fires the AI call
 * in the background, and stores the preview result in task context.
 */

import { prisma } from "@/lib/prisma";
import { startTaskTracking, updateTaskProgress, completeTask } from "@/lib/ai/task-guidance";
import { extractCurriculumFromAssertions } from "@/lib/content-trust/extract-curriculum";

/**
 * Start async curriculum generation for a subject.
 * Returns the taskId immediately — AI runs in background.
 */
export async function startCurriculumGeneration(
  subjectId: string,
  subjectName: string,
  userId: string,
): Promise<string> {
  const taskId = await startTaskTracking(userId, "curriculum_generation", {
    subjectId,
    subjectName,
  });

  // Fire-and-forget background generation
  runCurriculumGeneration(taskId, subjectId, subjectName).catch(async (err) => {
    console.error(`[curriculum-runner] Task ${taskId} unhandled error:`, err);
    try {
      await updateTaskProgress(taskId, {
        context: { error: err.message || "Curriculum generation failed" },
      });
      await prisma.userTask.update({
        where: { id: taskId },
        data: { status: "abandoned", completedAt: new Date() },
      });
    } catch {
      // Best-effort error recording
    }
  });

  return taskId;
}

async function runCurriculumGeneration(
  taskId: string,
  subjectId: string,
  subjectName: string,
): Promise<void> {
  // Step 1: Load assertions
  await updateTaskProgress(taskId, { currentStep: 1 });

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
  });

  if (!subject) {
    await updateTaskProgress(taskId, {
      context: { error: "Subject not found" },
    });
    await prisma.userTask.update({
      where: { id: taskId },
      data: { status: "abandoned", completedAt: new Date() },
    });
    return;
  }

  // Find syllabus-tagged sources, fall back to all
  const syllabusSources = await prisma.subjectSource.findMany({
    where: { subjectId, tags: { has: "syllabus" } },
    select: { sourceId: true },
  });

  const sourceIds = syllabusSources.length > 0
    ? syllabusSources.map((s) => s.sourceId)
    : (
        await prisma.subjectSource.findMany({
          where: { subjectId },
          select: { sourceId: true },
        })
      ).map((s) => s.sourceId);

  if (sourceIds.length === 0) {
    await updateTaskProgress(taskId, {
      context: { error: "No sources attached to this subject" },
    });
    await prisma.userTask.update({
      where: { id: taskId },
      data: { status: "abandoned", completedAt: new Date() },
    });
    return;
  }

  const assertions = await prisma.contentAssertion.findMany({
    where: { sourceId: { in: sourceIds } },
    select: {
      assertion: true,
      category: true,
      chapter: true,
      section: true,
      tags: true,
    },
    orderBy: [{ chapter: "asc" }, { section: "asc" }, { createdAt: "asc" }],
  });

  if (assertions.length === 0) {
    await updateTaskProgress(taskId, {
      context: { error: "No assertions found. Extract documents first." },
    });
    await prisma.userTask.update({
      where: { id: taskId },
      data: { status: "abandoned", completedAt: new Date() },
    });
    return;
  }

  await updateTaskProgress(taskId, {
    context: { assertionCount: assertions.length },
  });

  // Step 2: Generate curriculum via AI
  await updateTaskProgress(taskId, { currentStep: 2 });

  const result = await extractCurriculumFromAssertions(
    assertions,
    subjectName,
    subject.qualificationRef || undefined,
  );

  if (!result.ok) {
    await updateTaskProgress(taskId, {
      context: { error: result.error, warnings: result.warnings },
    });
    await prisma.userTask.update({
      where: { id: taskId },
      data: { status: "abandoned", completedAt: new Date() },
    });
    return;
  }

  // Step 3: Complete — store preview in context
  await updateTaskProgress(taskId, {
    currentStep: 3,
    context: {
      preview: result,
      moduleCount: result.modules?.length ?? 0,
      warnings: result.warnings,
    },
  });

  await completeTask(taskId);
}
