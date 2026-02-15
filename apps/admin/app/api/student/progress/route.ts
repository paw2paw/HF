/**
 * @api GET /api/student/progress
 * @auth STUDENT
 * @desc Returns the student's learning profile: personality, goals, call count, classroom info
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudent, isStudentAuthError } from "@/lib/student-access";

export async function GET() {
  const auth = await requireStudent();
  if (isStudentAuthError(auth)) return auth.error;

  const { callerId } = auth;

  const [profile, goals, callCount, caller] = await Promise.all([
    prisma.callerPersonalityProfile.findUnique({
      where: { callerId },
      select: { parameterValues: true, lastUpdatedAt: true, callsUsed: true },
    }),
    prisma.goal.findMany({
      where: { callerId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        type: true,
        progress: true,
        description: true,
      },
      orderBy: { priority: "desc" },
    }),
    prisma.call.count({ where: { callerId } }),
    prisma.caller.findUnique({
      where: { id: callerId },
      select: {
        name: true,
        cohortGroup: {
          select: {
            name: true,
            domain: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    profile: profile
      ? {
          parameterValues: profile.parameterValues,
          lastUpdated: profile.lastUpdatedAt,
          callsAnalyzed: profile.callsUsed,
        }
      : null,
    goals,
    totalCalls: callCount,
    classroom: caller?.cohortGroup?.name ?? null,
    domain: caller?.cohortGroup?.domain?.name ?? null,
  });
}
