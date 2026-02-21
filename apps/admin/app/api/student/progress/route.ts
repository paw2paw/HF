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
        cohortMemberships: {
          select: {
            cohortGroup: {
              select: {
                id: true,
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

  // Prefer join table memberships, fall back to legacy FK
  const primaryCohort = caller?.cohortMemberships?.[0]?.cohortGroup ?? caller?.cohortGroup;

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
    classroom: primaryCohort?.name ?? null,
    classrooms: (caller?.cohortMemberships ?? []).map(m => ({
      id: m.cohortGroup.id,
      name: m.cohortGroup.name,
      teacher: m.cohortGroup.owner?.name ?? null,
    })),
    domain: primaryCohort?.domain?.name ?? null,
    teacherName: primaryCohort?.owner?.name ?? null,
    institutionName: primaryCohort?.institution?.name ?? null,
    institutionLogo: primaryCohort?.institution?.logoUrl ?? null,
    welcomeMessage: primaryCohort?.institution?.welcomeMessage ?? null,
    topTopics: (memorySummary?.topTopics as Array<{ topic: string; lastMentioned: string }>) ?? [],
    topicCount: memorySummary?.topicCount ?? 0,
    keyFactCount,
  });
}
