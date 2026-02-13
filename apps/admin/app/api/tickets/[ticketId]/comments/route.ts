import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/tickets/:ticketId/comments
 * @visibility internal
 * @scope tickets:comments-list
 * @auth session
 * @tags tickets
 * @description Lists comments for a ticket with pagination. Includes author details.
 * @pathParam ticketId string - The ticket ID
 * @query limit number - Max comments to return (default 50, max 100)
 * @query offset number - Pagination offset (default 0)
 * @response 200 { ok: true, comments: [...], total: number, limit: number, offset: number }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 404 { ok: false, error: "Ticket not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { ticketId } = await params;
    const url = new URL(req.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    }

    const [comments, total] = await Promise.all([
      prisma.ticketComment.findMany({
        where: { ticketId },
        take: limit,
        skip: offset,
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.ticketComment.count({ where: { ticketId } }),
    ]);

    return NextResponse.json({
      ok: true,
      comments,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/tickets/[ticketId]/comments error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/tickets/:ticketId/comments
 * @visibility internal
 * @scope tickets:comments-create
 * @auth session
 * @tags tickets
 * @description Adds a comment to a ticket and updates the ticket's updatedAt timestamp.
 * @pathParam ticketId string - The ticket ID
 * @body content string - Comment text (required)
 * @body isInternal boolean - Whether comment is internal-only (default: false)
 * @response 201 { ok: true, comment: {...} }
 * @response 400 { ok: false, error: "Comment content is required" }
 * @response 401 { ok: false, error: "Unauthorized" }
 * @response 404 { ok: false, error: "Ticket not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const { ticketId } = await params;
    const body = await req.json();
    const { content, isInternal } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Comment content is required" },
        { status: 400 }
      );
    }

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        authorId: session.user.id,
        content: content.trim(),
        isInternal: isInternal || false,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Update ticket's updatedAt
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[ticketId]/comments error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to add comment" },
      { status: 500 }
    );
  }
}
