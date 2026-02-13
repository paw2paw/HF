import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/messages/:messageId
 * @visibility internal
 * @auth session
 * @tags messages
 * @description Get a single message with its thread (parent + replies). Auto-marks as read if recipient is viewing.
 * @pathParam messageId string - The message ID
 * @response 200 { ok: true, message: object }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 403 { ok: false, error: "Forbidden" }
 * @response 404 { ok: false, error: "Message not found" }
 * @response 500 { ok: false, error: string }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const { messageId } = await params;
    const userId = session.user.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
        recipient: {
          select: { id: true, name: true, email: true, image: true },
        },
        parent: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        replies: {
          include: {
            sender: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
    }

    // Only allow sender or recipient to view
    if (message.senderId !== userId && message.recipientId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Mark as read if recipient is viewing
    if (message.recipientId === userId && !message.readAt) {
      await prisma.message.update({
        where: { id: messageId },
        data: { readAt: new Date() },
      });
      message.readAt = new Date();
    }

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error("GET /api/messages/[messageId] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch message" },
      { status: 500 }
    );
  }
}

/**
 * @api PATCH /api/messages/:messageId
 * @visibility internal
 * @auth session
 * @tags messages
 * @description Mark a message as read (recipient only)
 * @pathParam messageId string - The message ID
 * @body readAt string - ISO date to mark as read (default: now)
 * @response 200 { ok: true, message: object }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 403 { ok: false, error: "Forbidden" }
 * @response 404 { ok: false, error: "Message not found" }
 * @response 500 { ok: false, error: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const { messageId } = await params;
    const userId = session.user.id;
    const body = await req.json();

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, recipientId: true },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
    }

    // Only recipient can mark as read
    if (message.recipientId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        readAt: body.readAt ? new Date(body.readAt) : new Date(),
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
        recipient: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ ok: true, message: updated });
  } catch (error) {
    console.error("PATCH /api/messages/[messageId] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update message" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/messages/:messageId
 * @visibility internal
 * @auth session
 * @tags messages
 * @description Delete a message (sender only)
 * @pathParam messageId string - The message ID
 * @response 200 { ok: true }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 403 { ok: false, error: "Forbidden" }
 * @response 404 { ok: false, error: "Message not found" }
 * @response 500 { ok: false, error: string }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const { messageId } = await params;
    const userId = session.user.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true },
    });

    if (!message) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
    }

    // Only sender can delete
    if (message.senderId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.message.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/messages/[messageId] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
