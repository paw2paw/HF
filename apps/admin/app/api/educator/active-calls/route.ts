import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";

/**
 * @api GET /api/educator/active-calls
 * @visibility internal
 * @scope educator:read
 * @auth bearer
 * @tags educator, calls
 * @description List active calls across the educator's students. Active = endedAt is null AND createdAt within last 2 hours.
 * @response 200 { ok: true, activeCalls: [{ callId, callerId, callerName, classroom, classroomId, startedAt }] }
 */
export async function GET() {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

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
