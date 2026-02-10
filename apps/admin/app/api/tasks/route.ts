import { NextRequest, NextResponse } from "next/server";
import {
  startTaskTracking,
  updateTaskProgress,
  completeTask,
  getTaskGuidance,
} from "@/lib/ai/task-guidance";

export const runtime = "nodejs";

/**
 * POST /api/tasks - Start a new task
 * PUT /api/tasks - Update task progress
 * GET /api/tasks?taskId=xxx - Get task guidance
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskType, userId = "default", context } = body;

    if (!taskType) {
      return NextResponse.json(
        { ok: false, error: "taskType is required" },
        { status: 400 }
      );
    }

    const taskId = await startTaskTracking(userId, taskType, context);

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const guidance = await getTaskGuidance(taskId);

    return NextResponse.json({
      ok: true,
      guidance,
    });
  } catch (error) {
    console.error("Get task guidance error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

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
