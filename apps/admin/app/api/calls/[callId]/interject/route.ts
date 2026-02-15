import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorStudentAccess,
} from "@/lib/educator-access";

/**
 * @api POST /api/calls/[callId]/interject
 * @visibility internal
 * @scope calls:write
 * @auth bearer
 * @tags educator, calls
 * @description Teacher sends a message into an active student call. Verifies the call is active and belongs to a student in the educator's cohort. Creates a callMessage with role "teacher".
 * @body content string - Message content to inject into the call
 * @response 200 { ok: true, message: { id, role, content, senderName, createdAt } }
 * @response 400 { ok: false, error: "Message content is required" }
 * @response 400 { ok: false, error: "Call has already ended" }
 * @response 404 { ok: false, error: "Call not found" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { callId } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content || !content.trim()) {
    return NextResponse.json(
      { ok: false, error: "Message content is required" },
      { status: 400 }
    );
  }

  // Find the call and verify it belongs to educator's student
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { id: true, callerId: true, endedAt: true },
  });

  if (!call) {
    return NextResponse.json(
      { ok: false, error: "Call not found" },
      { status: 404 }
    );
  }

  if (!call.callerId) {
    return NextResponse.json(
      { ok: false, error: "Call has no associated student" },
      { status: 400 }
    );
  }

  if (call.endedAt) {
    return NextResponse.json(
      { ok: false, error: "Call has already ended" },
      { status: 400 }
    );
  }

  // Verify educator owns the student's cohort
  const access = await requireEducatorStudentAccess(
    call.callerId,
    auth.callerId
  );
  if ("error" in access) return access.error;

  // Get educator's display name
  const educator = await prisma.caller.findUnique({
    where: { id: auth.callerId },
    select: { name: true },
  });

  const message = await prisma.callMessage.create({
    data: {
      callId,
      role: "teacher",
      content: content.trim(),
      senderName: educator?.name || "Teacher",
    },
    select: {
      id: true,
      role: true,
      content: true,
      senderName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, message });
}
