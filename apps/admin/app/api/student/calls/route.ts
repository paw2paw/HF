/**
 * @api GET /api/student/calls
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Returns the student's call history (last 50 calls)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
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
