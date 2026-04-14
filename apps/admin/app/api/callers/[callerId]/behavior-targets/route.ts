import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

const bodySchema = z.object({
  targets: z.array(
    z.object({
      parameterId: z.string().min(1),
      targetValue: z.number().min(0).max(1).nullable(),
    }),
  ),
});

/**
 * @api PATCH /api/callers/:callerId/behavior-targets
 * @visibility internal
 * @scope callers:write
 * @auth session
 * @tags callers, targets
 * @description Update CALLER-scoped behavior targets for a single caller. The server
 *   resolves every CallerIdentity attached to the caller and writes the override to each.
 *   Set targetValue to null to remove a caller-scoped override and fall back to the
 *   cascade (SEGMENT → PLAYBOOK → SYSTEM).
 * @pathParam callerId string - Caller UUID
 * @body targets Array<{ parameterId: string, targetValue: number | null }>
 * @response 200 { ok: true, results: [...] }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Caller not found" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callerId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { callerId } = await params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid body" },
        { status: 400 },
      );
    }
    const { targets } = parsed.data;

    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: {
        id: true,
        callerIdentities: { select: { id: true } },
      },
    });
    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 },
      );
    }

    const identityIds = caller.callerIdentities.map((i) => i.id);
    if (identityIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Caller has no identity to attach targets to" },
        { status: 400 },
      );
    }

    const results: Array<{ parameterId: string; action: string; count: number }> = [];

    await prisma.$transaction(async (tx) => {
      for (const { parameterId, targetValue } of targets) {
        if (targetValue === null) {
          const del = await tx.behaviorTarget.deleteMany({
            where: {
              parameterId,
              scope: "CALLER",
              callerIdentityId: { in: identityIds },
              effectiveUntil: null,
            },
          });
          results.push({ parameterId, action: "removed", count: del.count });
          continue;
        }

        let count = 0;
        for (const identityId of identityIds) {
          const existing = await tx.behaviorTarget.findFirst({
            where: {
              parameterId,
              scope: "CALLER",
              callerIdentityId: identityId,
              effectiveUntil: null,
            },
            select: { id: true },
          });

          if (existing) {
            await tx.behaviorTarget.update({
              where: { id: existing.id },
              data: { targetValue, source: "MANUAL" },
            });
          } else {
            await tx.behaviorTarget.create({
              data: {
                parameterId,
                callerIdentityId: identityId,
                scope: "CALLER",
                targetValue,
                confidence: 1.0,
                source: "MANUAL",
              },
            });
          }
          count += 1;
        }
        results.push({ parameterId, action: "upserted", count });
      }
    });

    return NextResponse.json({ ok: true, results });
  } catch (error: any) {
    console.error("Error updating caller behavior targets:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update caller targets" },
      { status: 500 },
    );
  }
}
