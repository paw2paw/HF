import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/messages/unread-count
 * Get count of unread messages for current user (for badge display)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const count = await prisma.message.count({
      where: {
        recipientId: session.user.id,
        readAt: null,
      },
    });

    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error("GET /api/messages/unread-count error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
