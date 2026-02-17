/**
 * @api GET /api/student/notifications
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Lightweight unread artifact count for badge polling
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const unreadCount = await prisma.conversationArtifact.count({
    where: {
      callerId: auth.callerId,
      status: { in: ["DELIVERED", "SENT"] },
    },
  });

  return NextResponse.json({ ok: true, unreadCount });
}
