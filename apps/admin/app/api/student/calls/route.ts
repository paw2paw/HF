/**
 * @api GET /api/student/calls
 * @auth STUDENT
 * @desc Returns the student's call history (last 50 calls)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudent, isStudentAuthError } from "@/lib/student-access";

export async function GET() {
  const auth = await requireStudent();
  if (isStudentAuthError(auth)) return auth.error;

  const calls = await prisma.call.findMany({
    where: { callerId: auth.callerId },
    select: {
      id: true,
      createdAt: true,
      endedAt: true,
      caller: { select: { domain: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    calls: calls.map((c) => ({
      id: c.id,
      createdAt: c.createdAt,
      endedAt: c.endedAt,
      domain: c.caller?.domain?.name ?? null,
    })),
  });
}
