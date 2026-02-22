import { NextRequest } from "next/server";
import { updateTaskProgress } from "@/lib/ai/task-guidance";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * @api POST /api/tasks/sync
 * @visibility internal
 * @scope tasks:sync
 * @auth session
 * @tags tasks
 * @description Beacon-friendly sync endpoint for wizard state persistence.
 * Used by navigator.sendBeacon() on page close to flush pending wizard data.
 * Returns 204 immediately — fire-and-forget.
 * @body taskId string - Task ID to sync (required)
 * @body updates object - Progress updates to apply (required)
 * @response 204 (always, even on error — beacon endpoints must not fail)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return new Response(null, { status: 204 });
    const { session } = authResult;

    const body = await request.json();
    if (!body.taskId || !body.updates) return new Response(null, { status: 204 });

    // Verify task belongs to user
    const task = await prisma.userTask.findFirst({
      where: { id: body.taskId, userId: session.user.id },
      select: { id: true },
    });
    if (!task) return new Response(null, { status: 204 });

    await updateTaskProgress(body.taskId, body.updates);
  } catch {
    // Silent — beacon endpoints must never fail visibly
  }
  return new Response(null, { status: 204 });
}
