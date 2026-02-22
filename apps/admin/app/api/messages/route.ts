import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { parsePagination } from "@/lib/api-utils";

/**
 * @api GET /api/messages
 * @visibility internal
 * @auth session
 * @tags messages
 * @description List messages for the current user (inbox or sent)
 * @query type string - Message view: "inbox" or "sent" (default: "inbox")
 * @query limit number - Max results (default: 50, max: 100)
 * @query offset number - Pagination offset (default: 0)
 * @query unreadOnly boolean - Only show unread messages (default: false)
 * @response 200 { ok: true, messages: Array, total: number, limit: number, offset: number }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 500 { ok: false, error: string }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "inbox"; // inbox | sent
    const { limit, offset } = parsePagination(url.searchParams, { defaultLimit: 50, maxLimit: 100 });
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
 * @api POST /api/messages
 * @visibility internal
 * @auth session
 * @tags messages
 * @description Send a new message to another user
 * @body recipientId string - Recipient user ID (required)
 * @body subject string - Message subject (optional)
 * @body content string - Message body (required)
 * @body parentId string - Parent message ID for threading (optional)
 * @response 201 { ok: true, message: object }
 * @response 400 { ok: false, error: "Recipient is required" | "Message content is required" }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 404 { ok: false, error: "Recipient not found or inactive" | "Parent message not found" }
 * @response 500 { ok: false, error: string }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

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
