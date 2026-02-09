import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/tickets
 * List tickets with optional filters
 * Query params: status, priority, category, assigneeId, creatorId, limit, offset
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const category = url.searchParams.get("category");
    const assigneeId = url.searchParams.get("assigneeId");
    const creatorId = url.searchParams.get("creatorId");
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (assigneeId) where.assigneeId = assigneeId === "unassigned" ? null : assigneeId;
    if (creatorId) where.creatorId = creatorId;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        take: limit,
        skip: offset,
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
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      tickets,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tickets
 * Create a new ticket
 * Body: { title, description, priority?, category?, assigneeId?, tags? }
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, priority, category, assigneeId, tags } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Title is required" },
        { status: 400 }
      );
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Description is required" },
        { status: 400 }
      );
    }

    // Verify assignee exists if provided
    if (assigneeId) {
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

    const ticket = await prisma.ticket.create({
      data: {
        creatorId: session.user.id,
        title: title.trim(),
        description: description.trim(),
        priority: priority || "MEDIUM",
        category: category || "OTHER",
        assigneeId: assigneeId || null,
        tags: tags || [],
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
