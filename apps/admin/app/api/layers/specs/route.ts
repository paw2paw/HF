import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { deriveBaseSlug } from "@/lib/layers/compute-diff";

/**
 * @api GET /api/layers/specs
 * @visibility public
 * @scope layers:read
 * @auth session
 * @tags layers, specs
 * @description List all overlay identity specs grouped by their base archetype
 * @response 200 { ok: true, bases: [...] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    // Find all active specs with extendsAgent set
    const overlays = await prisma.analysisSpec.findMany({
      where: {
        extendsAgent: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        extendsAgent: true,
      },
      orderBy: { name: "asc" },
    });

    // Group by extendsAgent
    const groupMap = new Map<string, typeof overlays>();
    for (const overlay of overlays) {
      const key = overlay.extendsAgent!;
      const group = groupMap.get(key) || [];
      group.push(overlay);
      groupMap.set(key, group);
    }

    // Resolve base spec names
    const bases = await Promise.all(
      Array.from(groupMap.entries()).map(async ([extendsAgent, groupOverlays]) => {
        const baseSlug = deriveBaseSlug(extendsAgent);
        const baseSpec = await prisma.analysisSpec.findFirst({
          where: { slug: baseSlug, isActive: true },
          select: { id: true, slug: true, name: true },
        });

        return {
          extendsAgent,
          slug: baseSpec?.slug || baseSlug,
          name: baseSpec?.name || `${extendsAgent} (not found)`,
          baseId: baseSpec?.id || null,
          overlays: groupOverlays.map((o) => ({
            id: o.id,
            slug: o.slug,
            name: o.name,
            description: o.description,
            extendsAgent: o.extendsAgent,
          })),
        };
      }),
    );

    return NextResponse.json({ ok: true, bases });
  } catch (error: any) {
    console.error("[api/layers/specs] Error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch layer specs" },
      { status: 500 },
    );
  }
}
