import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/messages/[messageId]
 * Get a single message with its thread (parent + replies)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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
 * PATCH /api/messages/[messageId]
 * Update message (mark as read)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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
 * DELETE /api/messages/[messageId]
 * Delete a message (sender only)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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
