import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/calls/[callId]/messages
 * @visibility internal
 * @scope calls:write
 * @auth bearer
 * @tags calls, messages
 * @description Store a message during an active call for live observation relay. Validates role is "user" or "assistant".
 * @body role string - Message role ("user" | "assistant")
 * @body content string - Message content
 * @response 200 { ok: true, message: { id, role, content, createdAt } }
 * @response 400 { ok: false, error: "role and content are required" }
 * @response 404 { ok: false, error: "Call not found" }
 */

/**
 * @api GET /api/calls/[callId]/messages
 * @visibility internal
 * @scope calls:read
 * @auth bearer
 * @tags calls, messages
 * @description Fetch messages for a call, optionally filtered by timestamp and role. Includes call ended status for observation polling.
 * @query after? string - ISO timestamp, only return messages after this time
 * @query role? string - Filter by message role (e.g. "teacher")
 * @response 200 { ok: true, messages: [{ id, role, content, senderName, createdAt }], callEnded: boolean }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  const { callId } = await params;
  const body = await request.json();
  const { role, content } = body;

  if (!role || !content) {
    return NextResponse.json(
      { ok: false, error: "role and content are required" },
      { status: 400 }
    );
  }

  if (!["user", "assistant"].includes(role)) {
    return NextResponse.json(
      { ok: false, error: "role must be 'user' or 'assistant'" },
      { status: 400 }
    );
  }

  // Verify call exists
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { id: true },
  });

  if (!call) {
    return NextResponse.json(
      { ok: false, error: "Call not found" },
      { status: 404 }
    );
  }

  const message = await prisma.callMessage.create({
    data: {
      callId,
      role,
      content,
    },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, message });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  const { callId } = await params;
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const roleFilter = url.searchParams.get("role");

  // Build where clause
  const where: Record<string, unknown> = { callId };
  if (after) {
    where.createdAt = { gt: new Date(after) };
  }
  if (roleFilter) {
    where.role = roleFilter;
  }

  // Check if call has ended (for observation polling)
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { endedAt: true },
  });

  const messages = await prisma.callMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      senderName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    messages,
    callEnded: !!call?.endedAt,
  });
}
