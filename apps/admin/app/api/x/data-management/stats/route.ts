import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/x/data-management/stats
 * Returns current database statistics
 */
export async function GET() {
  try {
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
