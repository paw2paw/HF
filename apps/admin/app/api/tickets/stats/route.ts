import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/tickets/stats
 * Get ticket statistics for dashboard/badges
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [statusCounts, priorityCounts, myAssigned, myCreated] = await Promise.all([
      // Count by status
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Count by priority (only open/in-progress)
      prisma.ticket.groupBy({
        by: ["priority"],
        where: {
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
        _count: { id: true },
      }),
      // Count assigned to current user (open/in-progress)
      prisma.ticket.count({
        where: {
          assigneeId: session.user.id,
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
      }),
      // Count created by current user (open/in-progress)
      prisma.ticket.count({
        where: {
          creatorId: session.user.id,
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING"] },
        },
      }),
    ]);

    // Transform status counts to object
    const byStatus = {
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };
    for (const item of statusCounts) {
      byStatus[item.status as keyof typeof byStatus] = item._count.id;
    }

    // Transform priority counts to object
    const byPriority = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    for (const item of priorityCounts) {
      byPriority[item.priority as keyof typeof byPriority] = item._count.id;
    }

    return NextResponse.json({
      ok: true,
      stats: {
        byStatus,
        byPriority,
        myAssigned,
        myCreated,
        totalOpen: byStatus.OPEN + byStatus.IN_PROGRESS + byStatus.WAITING,
      },
    });
  } catch (error) {
    console.error("GET /api/tickets/stats error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch ticket stats" },
      { status: 500 }
    );
  }
}
