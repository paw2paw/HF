/**
 * @api GET /api/testimony/specs
 * @auth OPERATOR
 * @desc Per-spec aggregates for testimony dashboard: unique callers, total scores, avg score, avg confidence, date range
 * @query domainId - Optional domain ID to filter
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const domainId = request.nextUrl.searchParams.get("domainId");

  // Build filter for scores
  const scoreFilter: Record<string, unknown> = {};
  if (domainId) {
    scoreFilter.call = { caller: { domainId } };
  }

  // Get all specs that have scores
  const specs = await prisma.analysisSpec.findMany({
    where: {
      isActive: true,
      callScores: { some: scoreFilter },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      specRole: true,
    },
  });

  if (specs.length === 0) {
    return NextResponse.json({ ok: true, specs: [] });
  }

  // For each spec, compute aggregates
  const specStats = await Promise.all(
    specs.map(async (spec) => {
      const where: Record<string, unknown> = { analysisSpecId: spec.id };
      if (domainId) {
        where.call = { caller: { domainId } };
      }

      const [aggregates, uniqueCallers, dateRange] = await Promise.all([
        prisma.callScore.aggregate({
          where,
          _count: { id: true },
          _avg: { score: true, confidence: true },
        }),
        prisma.callScore.findMany({
          where,
          select: { callerId: true },
          distinct: ["callerId"],
        }),
        prisma.callScore.aggregate({
          where,
          _min: { scoredAt: true },
          _max: { scoredAt: true },
        }),
      ]);

      return {
        specId: spec.id,
        slug: spec.slug,
        name: spec.name,
        specRole: spec.specRole,
        uniqueCallers: uniqueCallers.filter((c) => c.callerId).length,
        totalScores: aggregates._count.id,
        avgScore: aggregates._avg.score
          ? Math.round(aggregates._avg.score * 100) / 100
          : null,
        avgConfidence: aggregates._avg.confidence
          ? Math.round(aggregates._avg.confidence * 100) / 100
          : null,
        firstScored: dateRange._min.scoredAt,
        lastScored: dateRange._max.scoredAt,
      };
    })
  );

  // Sort by total scores descending
  specStats.sort((a, b) => b.totalScores - a.totalScores);

  return NextResponse.json({ ok: true, specs: specStats });
}
