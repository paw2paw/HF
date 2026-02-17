import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

type Params = { params: Promise<{ subjectId: string }> };

/**
 * @api GET /api/subjects/:subjectId/curriculum/preview?taskId=xxx
 * @visibility public
 * @scope subjects:read
 * @auth VIEWER
 * @tags subjects, curriculum
 * @description Get the generated curriculum preview from a completed generation task.
 *   The preview is stored in the UserTask's context.preview field.
 * @query taskId string - The curriculum_generation task ID
 * @response 200 { ok, curriculum, taskStatus }
 * @response 404 { error } if task not found or no preview available
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { subjectId } = await params;
    const taskId = req.nextUrl.searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId query parameter required" },
        { status: 400 }
      );
    }

    const task = await prisma.userTask.findUnique({
      where: { id: taskId },
      select: { context: true, status: true, taskType: true },
    });

    if (!task) {
      return NextResponse.json(
        { ok: false, error: "Task not found" },
        { status: 404 }
      );
    }

    if (task.taskType !== "curriculum_generation") {
      return NextResponse.json(
        { ok: false, error: "Task is not a curriculum generation task" },
        { status: 400 }
      );
    }

    const ctx = task.context as Record<string, any>;

    // Verify subject matches
    if (ctx?.subjectId !== subjectId) {
      return NextResponse.json(
        { ok: false, error: "Task does not belong to this subject" },
        { status: 403 }
      );
    }

    // Task still running
    if (task.status === "in_progress") {
      return NextResponse.json({
        ok: true,
        taskStatus: "in_progress",
        curriculum: null,
        phase: ctx?.phase,
        assertionCount: ctx?.assertionCount,
      });
    }

    // Task failed
    if (task.status === "abandoned") {
      return NextResponse.json({
        ok: false,
        taskStatus: "error",
        error: ctx?.error || "Curriculum generation failed",
        warnings: ctx?.warnings,
      });
    }

    // Task completed — return preview
    const preview = ctx?.preview;
    if (!preview) {
      return NextResponse.json(
        { ok: false, error: "No curriculum preview found in task" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      taskStatus: "completed",
      curriculum: preview,
      moduleCount: ctx?.moduleCount,
      warnings: ctx?.warnings,
    });
  } catch (error: any) {
    console.error("[subjects/:id/curriculum/preview] GET error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
