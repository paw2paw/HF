import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/sim/setup-info
 * @visibility internal
 * @auth session
 * @tags sim
 * @description Returns setup info for a new sim tester: whether they have an assigned domain (from invite) or need to choose one.
 * @response 200 { ok: true, user, assignedDomainId?, assignedDomainName?, domains? }
 * @response 401 { ok: false, error: "Unauthorized" }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  // Check if user was invited with a specific domain
  const invite = await prisma.invite.findFirst({
    where: { email: session.user.email, usedAt: { not: null } },
    include: { domain: { select: { id: true, name: true } } },
    orderBy: { usedAt: "desc" },
  });

  if (invite?.domainId && invite.domain) {
    return NextResponse.json({
      ok: true,
      user: { name: session.user.name, email: session.user.email },
      assignedDomainId: invite.domainId,
      assignedDomainName: invite.domain.name,
    });
  }

  // Domain-chooser: return active domains
  const domains = await prisma.domain.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, slug: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    ok: true,
    user: { name: session.user.name, email: session.user.email },
    domains,
  });
}
