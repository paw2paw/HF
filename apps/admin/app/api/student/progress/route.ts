/**
 * @api GET /api/student/progress
 * @auth STUDENT | OPERATOR+ (with callerId param)
 * @desc Returns the student's learning profile: personality, goals, call count, classroom info
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentOrAdmin, isStudentAuthError } from "@/lib/student-access";

export async function GET(request: NextRequest) {
  const auth = await requireStudentOrAdmin(request);
  if (isStudentAuthError(auth)) return auth.error;

  const { callerId } = auth;

  const [profile, goals, callCount, caller, memorySummary, keyFactCount] = await Promise.all([
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
            owner: { select: { name: true } },
            institution: {
              select: {
                name: true,
                logoUrl: true,
                welcomeMessage: true,
              },
            },
          },
        },
      },
    }),
    prisma.callerMemorySummary.findUnique({
      where: { callerId },
      select: { topTopics: true, topicCount: true },
    }),
    prisma.conversationArtifact.count({
      where: { callerId, type: "KEY_FACT" },
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
    teacherName: caller?.cohortGroup?.owner?.name ?? null,
    institutionName: caller?.cohortGroup?.institution?.name ?? null,
    institutionLogo: caller?.cohortGroup?.institution?.logoUrl ?? null,
    welcomeMessage: caller?.cohortGroup?.institution?.welcomeMessage ?? null,
    topTopics: (memorySummary?.topTopics as Array<{ topic: string; lastMentioned: string }>) ?? [],
    topicCount: memorySummary?.topicCount ?? 0,
    keyFactCount,
  });
}
