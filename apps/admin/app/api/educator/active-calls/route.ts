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
        cohortGroup: {
          ownerId: auth.callerId,
          isActive: true,
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
          cohortGroup: {
            select: { id: true, name: true },
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
      classroom: c.caller?.cohortGroup?.name,
      classroomId: c.caller?.cohortGroup?.id,
      startedAt: c.createdAt,
    })),
  });
}
