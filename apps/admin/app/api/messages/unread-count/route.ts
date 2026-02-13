import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/messages/unread-count
 * @visibility internal
 * @auth session
 * @tags messages
 * @description Get count of unread messages for the current user (for badge display)
 * @response 200 { ok: true, count: number }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 500 { ok: false, error: string }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

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
