/**
 * @api GET /api/student/artifacts
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Returns the student's artifacts with unread count
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const [artifacts, unreadCount] = await Promise.all([
    prisma.conversationArtifact.findMany({
      where: { callerId: auth.callerId },
      select: {
        id: true,
        callId: true,
        type: true,
        title: true,
        content: true,
        mediaUrl: true,
        mediaType: true,
        trustLevel: true,
        confidence: true,
        status: true,
        channel: true,
        createdAt: true,
        readAt: true,
        createdBy: true,
        call: { select: { createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.conversationArtifact.count({
      where: {
        callerId: auth.callerId,
        status: { in: ["DELIVERED", "SENT"] },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    artifacts,
    counts: { total: artifacts.length, unread: unreadCount },
  });
}
