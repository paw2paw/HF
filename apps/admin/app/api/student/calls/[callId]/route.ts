/**
 * @api GET /api/student/calls/:callId
 * @auth STUDENT
 * @desc Returns a single call detail with transcript (ownership enforced)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudent, isStudentAuthError } from "@/lib/student-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const auth = await requireStudent();
  if (isStudentAuthError(auth)) return auth.error;

  const { callId } = await params;

  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      callerId: true,
      createdAt: true,
      endedAt: true,
      transcript: true,
    },
  });

  if (!call || call.callerId !== auth.callerId) {
    return NextResponse.json(
      { ok: false, error: "Call not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    call: {
      id: call.id,
      createdAt: call.createdAt,
      endedAt: call.endedAt,
      transcript: call.transcript,
    },
  });
}
