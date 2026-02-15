/**
 * @api POST /api/student/artifacts/mark-read
 * @auth STUDENT
 * @desc Batch mark artifacts as READ
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudent, isStudentAuthError } from "@/lib/student-access";

export async function POST(request: NextRequest) {
  const auth = await requireStudent();
  if (isStudentAuthError(auth)) return auth.error;

  const body = await request.json();
  const { artifactIds } = body;

  if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "artifactIds array is required" },
      { status: 400 },
    );
  }

  const result = await prisma.conversationArtifact.updateMany({
    where: {
      id: { in: artifactIds },
      callerId: auth.callerId,
      status: { in: ["DELIVERED", "SENT"] },
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
