/**
 * @api GET /api/student/notifications
 * @auth STUDENT
 * @desc Lightweight unread artifact count for badge polling
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudent, isStudentAuthError } from "@/lib/student-access";

export async function GET() {
  const auth = await requireStudent();
  if (isStudentAuthError(auth)) return auth.error;

  const unreadCount = await prisma.conversationArtifact.count({
    where: {
      callerId: auth.callerId,
      status: { in: ["DELIVERED", "SENT"] },
    },
  });

  return NextResponse.json({ ok: true, unreadCount });
}
