import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * @archived 2026-02-12 — Only referenced by archived legacy prompts page and
 * its test files. No active frontend consumer.
 *
 * TO RESTORE: Move this file back to  app/api/prompts/gallery/route.ts
 *
 * @api GET /api/prompts/gallery
 * @visibility internal
 * @scope prompts:read
 * @auth session
 * @tags prompts
 * @description Get all caller identities with their prompt status for the gallery view.
 *   Returns callers with basic info, prompt content/metadata, and related caller stats.
 * @query limit number - Max results (default 200)
 * @query withPromptOnly string - Only return callers with a prompt ("true")
 * @response 200 { ok: true, callers: CallerIdentity[], count: number, stats: { withPrompt, withoutPrompt } }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "200");
    const withPromptOnly = url.searchParams.get("withPromptOnly") === "true";

    // Fetch caller identities with prompt data
    const callerIdentities = await prisma.callerIdentity.findMany({
      where: withPromptOnly
        ? { nextPrompt: { not: null } }
        : {},
      orderBy: [
        { nextPromptComposedAt: "desc" },
        { updatedAt: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        externalId: true,
        callerId: true,
        nextPrompt: true,
        nextPromptComposedAt: true,
        nextPromptInputs: true,
        segmentId: true,
        segment: {
          select: { name: true },
        },
        caller: {
          select: {
            name: true,
            email: true,
            _count: {
              select: {
                calls: true,
                memories: true,
              },
            },
          },
        },
      },
    });

    // Compute stats
    const totalWithPrompt = callerIdentities.filter((c) => c.nextPrompt).length;
    const totalWithoutPrompt = callerIdentities.filter((c) => !c.nextPrompt).length;

    return NextResponse.json({
      ok: true,
      callers: callerIdentities,
      count: callerIdentities.length,
      stats: {
        withPrompt: totalWithPrompt,
        withoutPrompt: totalWithoutPrompt,
      },
    });
  } catch (error: any) {
    console.error("[Prompts Gallery Error]:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch prompts gallery" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
