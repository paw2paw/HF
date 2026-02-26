import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/institutions/[id]/communities
 * @auth ADMIN
 * @description List all communities (COMMUNITY-kind domains) belonging to an institution.
 * @response 200 { ok: true, communities: Community[] }
 * @response 404 { ok: false, error: "Institution not found" }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const { id } = await params;

  const institution = await prisma.institution.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!institution) {
    return NextResponse.json({ ok: false, error: "Institution not found" }, { status: 404 });
  }

  const domains = await prisma.domain.findMany({
    where: { institutionId: id, kind: "COMMUNITY" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      config: true,
      createdAt: true,
      _count: { select: { callers: true, playbooks: true } },
    },
  });

  const communities = domains.map((d) => {
    const cfg = (d.config as Record<string, unknown> | null) ?? {};
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      isActive: d.isActive,
      communityKind: (cfg.communityKind as string) ?? null,
      memberCount: d._count.callers,
      playbookCount: d._count.playbooks,
      createdAt: d.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ ok: true, communities });
}
