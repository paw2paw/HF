import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/prompts/gallery
 *
 * Get all caller identities with their prompt status for the gallery view.
 * Returns callers with:
 * - Basic info
 * - Prompt content and metadata
 * - Related caller stats
 */
export async function GET(req: Request) {
  try {
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
