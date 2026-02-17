/**
 * @api GET /api/educator/readiness
 * @auth EDUCATOR
 * @desc Returns simplified readiness view for educator's domains, split into educator-fixable and admin-fixable actions
 * @query institutionId - Optional institution ID for ADMIN+ users
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";
import { checkDomainReadiness, type ReadinessCheckResult } from "@/lib/domain/readiness";

// Checks that educators can fix themselves
const EDUCATOR_FIXABLE_CHECKS = new Set([
  "playbook_published",
  "content_sources",
  "assertions",
  "test_caller",
  "content_curriculum_valid",
]);

export async function GET(request: NextRequest) {
  const institutionId = request.nextUrl.searchParams.get("institutionId");

  let domainFilter: Record<string, unknown>;

  if (institutionId) {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;
    // Get domains from institution's cohorts
    const cohorts = await prisma.cohortGroup.findMany({
      where: { institutionId },
      select: { domainId: true },
    });
    const domainIds = [...new Set(cohorts.map((c) => c.domainId))];
    domainFilter = { id: { in: domainIds } };
  } else {
    const auth = await requireEducator();
    if (isEducatorAuthError(auth)) return auth.error;
    // Get domains from educator's owned cohorts
    const cohorts = await prisma.cohortGroup.findMany({
      where: { ownerId: auth.callerId },
      select: { domainId: true },
    });
    const domainIds = [...new Set(cohorts.map((c) => c.domainId))];
    domainFilter = { id: { in: domainIds } };
  }

  const domains = await prisma.domain.findMany({
    where: domainFilter,
    select: { id: true, name: true },
  });

  if (domains.length === 0) {
    return NextResponse.json({
      ok: true,
      domains: [],
      overallReady: false,
      overallLevel: "incomplete" as const,
    });
  }

  // Check readiness for each domain
  const domainResults = await Promise.all(
    domains.map(async (domain) => {
      const result = await checkDomainReadiness(domain.id);

      const educatorActions: ReadinessCheckResult[] = [];
      const adminActions: ReadinessCheckResult[] = [];

      for (const check of result.checks) {
        if (check.passed) continue;
        if (EDUCATOR_FIXABLE_CHECKS.has(check.id)) {
          educatorActions.push(check);
        } else {
          adminActions.push(check);
        }
      }

      return {
        domainId: domain.id,
        domainName: domain.name,
        ready: result.ready,
        score: result.score,
        level: result.level,
        educatorActions,
        adminActions,
      };
    })
  );

  const overallReady = domainResults.every((d) => d.ready);
  const overallLevel = overallReady
    ? "ready"
    : domainResults.some((d) => d.level === "incomplete")
      ? "incomplete"
      : "almost";

  return NextResponse.json({
    ok: true,
    domains: domainResults,
    overallReady,
    overallLevel,
  });
}
