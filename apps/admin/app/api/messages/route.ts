import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/messages
 * List messages (inbox or sent)
 * Query params: type=inbox|sent, limit, offset, unreadOnly
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "inbox"; // inbox | sent
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const userId = session.user.id;

    // Build where clause based on type
    const where =
      type === "sent"
        ? { senderId: userId }
        : {
            recipientId: userId,
            ...(unreadOnly ? { readAt: null } : {}),
          };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          sender: {
            select: { id: true, name: true, email: true, image: true },
          },
          recipient: {
            select: { id: true, name: true, email: true, image: true },
          },
          _count: {
            select: { replies: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.message.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      messages,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 * Send a new message
 * Body: { recipientId, subject?, content, parentId? }
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recipientId, subject, content, parentId } = body;

    if (!recipientId) {
      return NextResponse.json(
        { ok: false, error: "Recipient is required" },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Message content is required" },
        { status: 400 }
      );
    }

    // Verify recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, isActive: true },
    });

    if (!recipient || !recipient.isActive) {
      return NextResponse.json(
        { ok: false, error: "Recipient not found or inactive" },
        { status: 404 }
      );
    }

    // If replying, verify parent exists
    if (parentId) {
      const parent = await prisma.message.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          { ok: false, error: "Parent message not found" },
          { status: 404 }
        );
      }
    }

    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        recipientId,
        subject: subject?.trim() || null,
        content: content.trim(),
        parentId: parentId || null,
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

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send message" },
      { status: 500 }
    );
  }
}
