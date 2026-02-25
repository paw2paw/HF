import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import {
  startTaskTracking,
  updateTaskProgress,
  completeTask,
} from "@/lib/ai/task-guidance";

export const runtime = "nodejs";

/**
 * @api POST /api/wizard-lab
 * @visibility internal
 * @scope dev:wizard-lab
 * @auth ADMIN+
 * @tags dev
 * @description Test endpoint for the wizard framework. Creates a task that
 * simulates async server work with progress updates, completing after ~6s.
 * @body name string - Topic name from intent step
 * @body emphasis string - Teaching emphasis
 * @body duration string - Session duration
 * @response 200 { ok: true, taskId: "..." }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const body = await request.json();
  const { name, emphasis, duration } = body;

  if (!name) {
    return NextResponse.json(
      { ok: false, error: "name is required" },
      { status: 400 },
    );
  }

  // Create a real UserTask
  const taskId = await startTaskTracking(
    session.user.id,
    "wizard_lab_test",
    {
      name,
      emphasis,
      duration,
      phase: "initializing",
      message: "Starting generation...",
    },
  );

  // Simulate async work in background (fire-and-forget)
  simulateWork(taskId, name).catch((err) =>
    console.error("[wizard-lab] Background work failed:", err),
  );

  return NextResponse.json({ ok: true, taskId });
}

/**
 * Simulates a 3-step background job:
 * 1. Analyzing (2s) → 2. Generating modules (2s) → 3. Enriching (2s) → Complete
 */
async function simulateWork(taskId: string, name: string) {
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Step 1: Analyzing
  await delay(2000);
  await updateTaskProgress(taskId, {
    currentStep: 1,
    context: {
      phase: "analyzing",
      message: `Analyzing "${name}"...`,
      stepIndex: 0,
      totalSteps: 3,
    },
  });

  // Step 2: Generating — push skeleton data
  await delay(2000);
  await updateTaskProgress(taskId, {
    currentStep: 2,
    context: {
      phase: "generating",
      message: "Generating modules...",
      stepIndex: 1,
      totalSteps: 3,
      skeletonReady: true,
      skeletonModules: [
        { id: "MOD-1", title: "Introduction to " + name, description: "Overview and key concepts" },
        { id: "MOD-2", title: "Core Principles", description: "Deep dive into fundamentals" },
        { id: "MOD-3", title: "Practical Application", description: "Hands-on exercises" },
      ],
    },
  });

  // Step 3: Enriching
  await delay(2000);
  await updateTaskProgress(taskId, {
    currentStep: 3,
    context: {
      phase: "complete",
      message: "Done!",
      stepIndex: 2,
      totalSteps: 3,
      result: {
        moduleCount: 3,
        modules: [
          {
            id: "MOD-1",
            title: "Introduction to " + name,
            description: "Overview and key concepts",
            learningOutcomes: ["Understand core terminology", "Identify key principles"],
          },
          {
            id: "MOD-2",
            title: "Core Principles",
            description: "Deep dive into fundamentals",
            learningOutcomes: ["Apply foundational concepts", "Analyze relationships"],
          },
          {
            id: "MOD-3",
            title: "Practical Application",
            description: "Hands-on exercises",
            learningOutcomes: ["Demonstrate mastery", "Create original work"],
          },
        ],
      },
    },
  });

  await completeTask(taskId);
}
