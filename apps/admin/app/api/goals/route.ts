import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/goals
 *
 * Fetch all goals across all callers with filtering options
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const callerId = searchParams.get("callerId");

    // Build where clause
    const where: any = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (type && type !== "all") {
      where.type = type;
    }

    if (callerId) {
      where.callerId = callerId;
    }

    // Fetch goals with related data
    const goals = await prisma.goal.findMany({
      where,
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            domain: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
        playbook: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
        contentSpec: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Get counts by status
    const statusCounts = await prisma.goal.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get counts by type
    const typeCounts = await prisma.goal.groupBy({
      by: ["type"],
      _count: true,
    });

    return NextResponse.json({
      ok: true,
      goals,
      counts: {
        total: goals.length,
        byStatus: Object.fromEntries(
          statusCounts.map((s) => [s.status, s._count])
        ),
        byType: Object.fromEntries(
          typeCounts.map((t) => [t.type, t._count])
        ),
      },
    });
  } catch (error: any) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch goals" },
      { status: 500 }
    );
  }
}
