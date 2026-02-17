/**
 * @api GET /api/testimony/export
 * @auth OPERATOR
 * @desc CSV download of testimony data for a spec/domain
 * @query specId - Spec ID to export (required)
 * @query domainId - Optional domain filter
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const specId = request.nextUrl.searchParams.get("specId");
  const domainId = request.nextUrl.searchParams.get("domainId");

  if (!specId) {
    return NextResponse.json(
      { ok: false, error: "specId is required" },
      { status: 400 }
    );
  }

  const spec = await prisma.analysisSpec.findUnique({
    where: { id: specId },
    select: { slug: true, name: true },
  });

  if (!spec) {
    return NextResponse.json(
      { ok: false, error: "Spec not found" },
      { status: 404 }
    );
  }

  const scoreWhere: Record<string, unknown> = { analysisSpecId: specId };
  if (domainId) {
    scoreWhere.call = { caller: { domainId } };
  }

  const scores = await prisma.callScore.findMany({
    where: scoreWhere,
    select: {
      parameterId: true,
      score: true,
      confidence: true,
      evidence: true,
      reasoning: true,
      callId: true,
      scoredAt: true,
      call: {
        select: {
          caller: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { scoredAt: "desc" },
  });

  const headers = [
    "spec_slug",
    "parameter_id",
    "caller_name",
    "call_id",
    "score",
    "confidence",
    "evidence",
    "reasoning",
    "scored_at",
  ];

  const rows = scores.map((s) => {
    const evidenceText =
      s.evidence && s.evidence.length > 0 ? s.evidence.join(" | ") : "";
    return [
      escapeCSV(spec.slug),
      escapeCSV(s.parameterId),
      escapeCSV(s.call?.caller?.name),
      escapeCSV(s.callId),
      escapeCSV(String(s.score)),
      escapeCSV(String(s.confidence)),
      escapeCSV(evidenceText),
      escapeCSV(s.reasoning),
      escapeCSV(s.scoredAt?.toISOString()),
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `testimony-${spec.slug}-${new Date().toISOString().split("T")[0]}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
