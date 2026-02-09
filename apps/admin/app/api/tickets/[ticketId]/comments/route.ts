import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/tickets/[ticketId]/comments
 * List comments for a ticket
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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
 * POST /api/tickets/[ticketId]/comments
 * Add a comment to a ticket
 * Body: { content, isInternal? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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
