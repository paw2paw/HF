/**
 * @api GET /api/student/artifacts
 * @auth STUDENT
 * @desc Returns the student's artifacts with unread count
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudent, isStudentAuthError } from "@/lib/student-access";

export async function GET() {
  const auth = await requireStudent();
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
