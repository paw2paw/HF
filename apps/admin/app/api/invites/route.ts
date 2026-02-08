import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

// GET /api/invites - List all invites
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can view invites
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}

// POST /api/invites - Create a new invite
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can create invites
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { email, role = "ADMIN" } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "User already exists with this email" },
      { status: 400 }
    );
  }

  // Check if invite already exists (and not used)
  const existingInvite = await prisma.invite.findFirst({
    where: { email, usedAt: null },
  });

  if (existingInvite) {
    return NextResponse.json(
      { error: "An active invite already exists for this email" },
      { status: 400 }
    );
  }

  // Create invite (expires in 7 days)
  const invite = await prisma.invite.create({
    data: {
      email,
      role,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ invite }, { status: 201 });
}

// DELETE /api/invites - Delete an invite
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
  }

  await prisma.invite.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
