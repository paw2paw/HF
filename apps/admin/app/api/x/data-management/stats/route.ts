import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/x/data-management/stats
 * @visibility internal
 * @scope dev:stats
 * @auth bearer
 * @tags dev-tools
 * @description Returns current database statistics including counts of domains, playbooks, specs, callers, and calls.
 * @response 200 { ok: true, stats: { domains: number, playbooks: number, specs: number, callers: number, calls: number } }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const [domains, playbooks, specs, callers, calls] = await Promise.all([
      prisma.domain.count(),
      prisma.playbook.count(),
      prisma.analysisSpec.count(),
      prisma.caller.count(),
      prisma.call.count(),
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        domains,
        playbooks,
        specs,
        callers,
        calls,
      },
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to fetch stats",
      },
      { status: 500 }
    );
  }
}
