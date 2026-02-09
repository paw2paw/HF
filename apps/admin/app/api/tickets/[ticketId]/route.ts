import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/tickets/[ticketId]
 * Get a single ticket with comments
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

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    console.error("GET /api/tickets/[ticketId] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tickets/[ticketId]
 * Update ticket status, priority, assignee, etc.
 */
export async function PATCH(
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
    const { status, priority, category, assigneeId, title, description, tags } = body;

    const existing = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    }

    // Verify assignee if changing
    if (assigneeId !== undefined && assigneeId !== null) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, isActive: true },
      });
      if (!assignee || !assignee.isActive) {
        return NextResponse.json(
          { ok: false, error: "Assignee not found or inactive" },
          { status: 404 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (tags !== undefined) updateData.tags = tags;

    // Set resolved/closed timestamps
    if (status === "RESOLVED" && existing.status !== "RESOLVED") {
      updateData.resolvedAt = new Date();
    }
    if (status === "CLOSED" && existing.status !== "CLOSED") {
      updateData.closedAt = new Date();
    }
    // Clear timestamps if reopening
    if (status === "OPEN" || status === "IN_PROGRESS") {
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    return NextResponse.json({ ok: true, ticket });
  } catch (error) {
    console.error("PATCH /api/tickets/[ticketId] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update ticket" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tickets/[ticketId]
 * Delete a ticket (admin only or creator)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { ticketId } = await params;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, creatorId: true },
    });

    if (!ticket) {
      return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
    }

    // Only allow creator or admin to delete
    if (ticket.creatorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.ticket.delete({
      where: { id: ticketId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/tickets/[ticketId] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete ticket" },
      { status: 500 }
    );
  }
}
