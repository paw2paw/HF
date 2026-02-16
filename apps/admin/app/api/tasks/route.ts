import { NextRequest, NextResponse } from "next/server";
import {
  startTaskTracking,
  updateTaskProgress,
  completeTask,
  getTaskGuidance,
} from "@/lib/ai/task-guidance";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @api POST /api/tasks
 * @visibility internal
 * @scope tasks:create
 * @auth session
 * @tags tasks
 * @description Starts a new task tracking session with a given task type and optional context.
 * @body taskType string - Type of task to track (required)
 * @body userId string - User ID (default: "default")
 * @body context object - Additional task context
 * @response 200 { ok: true, taskId: "..." }
 * @response 400 { ok: false, error: "taskType is required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const body = await request.json();
    const { taskType, context } = body;

    if (!taskType) {
      return NextResponse.json(
        { ok: false, error: "taskType is required" },
        { status: 400 }
      );
    }

    const taskId = await startTaskTracking(session.user.id, taskType, context);

    return NextResponse.json({
      ok: true,
      taskId,
    });
  } catch (error) {
    console.error("Start task error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * @api PUT /api/tasks
 * @visibility internal
 * @scope tasks:update
 * @auth session
 * @tags tasks
 * @description Updates progress on an existing task.
 * @body taskId string - Task ID to update (required)
 * @body updates object - Progress updates to apply
 * @response 200 { ok: true }
 * @response 400 { ok: false, error: "taskId is required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, updates } = body;

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    await updateTaskProgress(taskId, updates);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * @api GET /api/tasks
 * @visibility internal
 * @scope tasks:read
 * @auth session
 * @tags tasks
 * @description Retrieves task guidance for a specific task ID, or lists tasks by status.
 * @query taskId string - Specific task ID to get guidance for
 * @query status string - Filter tasks by status
 * @response 200 { ok: true, guidance: {...} } | { ok: true, tasks: [...], count: number }
 * @response 400 { ok: false, error: "taskId or status parameter is required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const status = searchParams.get("status");

    // If requesting a specific task
    if (taskId) {
      const guidance = await getTaskGuidance(taskId);
      return NextResponse.json({
        ok: true,
        guidance,
      });
    }

    // If listing tasks by status
    if (status) {
      const { prisma } = await import("@/lib/prisma");
      const limitParam = searchParams.get("limit");
      const offsetParam = searchParams.get("offset");
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;
      const offset = offsetParam ? parseInt(offsetParam, 10) || 0 : 0;

      const where = {
        userId: session.user.id,
        status: status as any,
      };

      const [tasks, total] = await Promise.all([
        prisma.userTask.findMany({
          where,
          orderBy: { startedAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.userTask.count({ where }),
      ]);

      return NextResponse.json({
        ok: true,
        tasks,
        count: tasks.length,
        total,
        hasMore: offset + tasks.length < total,
      });
    }

    return NextResponse.json(
      { ok: false, error: "taskId or status parameter is required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Get task guidance error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/tasks
 * @visibility internal
 * @scope tasks:complete
 * @auth session
 * @tags tasks
 * @description Marks a task as completed.
 * @query taskId string - Task ID to complete (required)
 * @response 200 { ok: true }
 * @response 400 { ok: false, error: "taskId is required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    await completeTask(taskId);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
