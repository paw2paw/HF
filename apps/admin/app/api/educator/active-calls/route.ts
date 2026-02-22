import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/active-calls
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, calls
 * @query institutionId - Optional institution ID for ADMIN+ users
 * @description List active calls across the educator's students. Active = endedAt is null AND createdAt within last 2 hours. ADMIN+ users see all active learner calls (optionally scoped by institutionId).
 * @response 200 { ok: true, activeCalls: [{ callId, callerId, callerName, classroom, classroomId, startedAt }] }
 */
export async function GET(request: NextRequest) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // ADMIN+ path — see all active learner calls
  const adminAuth = await requireAuth("ADMIN");
  if (!isAuthError(adminAuth)) {
    const institutionId = request.nextUrl.searchParams.get("institutionId");
    const callerWhere: Record<string, unknown> = { role: "LEARNER" };

    if (institutionId) {
      callerWhere.cohortMemberships = {
        some: { cohortGroup: { institutionId, isActive: true } },
      };
    }

    const activeCalls = await prisma.call.findMany({
      where: {
        caller: callerWhere,
        endedAt: null,
        createdAt: { gte: twoHoursAgo },
      },
      select: {
        id: true,
        createdAt: true,
        caller: {
          select: {
            id: true,
            name: true,
            cohortMemberships: {
              include: { cohortGroup: { select: { id: true, name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      activeCalls: activeCalls.map((c) => ({
        callId: c.id,
        callerId: c.caller?.id,
        callerName: c.caller?.name,
        classroom: c.caller?.cohortMemberships?.[0]?.cohortGroup?.name ?? null,
        classroomId: c.caller?.cohortMemberships?.[0]?.cohortGroup?.id ?? null,
        startedAt: c.createdAt,
      })),
    });
  }

  // Educator path — see only their owned cohort calls
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const activeCalls = await prisma.call.findMany({
    where: {
      caller: {
        role: "LEARNER",
        cohortMemberships: {
          some: {
            cohortGroup: {
              ownerId: auth.callerId,
              isActive: true,
            },
          },
        },
      },
      endedAt: null,
      createdAt: { gte: twoHoursAgo },
    },
    select: {
      id: true,
      createdAt: true,
      caller: {
        select: {
          id: true,
          name: true,
          cohortMemberships: {
            include: { cohortGroup: { select: { id: true, name: true } } },
            where: { cohortGroup: { ownerId: auth.callerId } },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    activeCalls: activeCalls.map((c) => ({
      callId: c.id,
      callerId: c.caller?.id,
      callerName: c.caller?.name,
      classroom: c.caller?.cohortMemberships?.[0]?.cohortGroup?.name ?? null,
      classroomId: c.caller?.cohortMemberships?.[0]?.cohortGroup?.id ?? null,
      startedAt: c.createdAt,
    })),
  });
}
