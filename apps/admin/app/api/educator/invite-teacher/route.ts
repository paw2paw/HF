import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { requireEducator, isEducatorAuthError } from "@/lib/educator-access";
import { randomUUID } from "crypto";

/**
 * @api POST /api/educator/invite-teacher
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, invites
 * @description Invite another educator (teacher) to the platform. Creates an EDUCATOR-role invite with TEACHER caller role and 30-day expiry. Returns the invite URL for sharing.
 * @body email string - Email address (required)
 * @body firstName? string - First name
 * @body lastName? string - Last name
 * @response 200 { ok: true, invite: { id, email, expiresAt }, inviteUrl: string }
 * @response 400 { ok: false, error: "A valid email address is required" }
 * @response 400 { ok: false, error: "A user with this email already exists" }
 * @response 400 { ok: false, error: "An invite is already pending for this email" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const body = await request.json();
  const { email, firstName, lastName } = body;

  // Validate email
  const trimmedEmail = (email || "").trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@") || trimmedEmail.length < 5) {
    return NextResponse.json(
      { ok: false, error: "A valid email address is required" },
      { status: 400 }
    );
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: trimmedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { ok: false, error: "A user with this email already exists" },
      { status: 400 }
    );
  }

  // Check for existing invite
  const existingInvite = await prisma.invite.findUnique({
    where: { email: trimmedEmail },
    select: { id: true, usedAt: true },
  });

  if (existingInvite) {
    if (!existingInvite.usedAt) {
      // Pending invite — don't create a duplicate
      return NextResponse.json(
        { ok: false, error: "An invite is already pending for this email" },
        { status: 400 }
      );
    }
    // Used invite — delete the old record so we can create a new one
    await prisma.invite.delete({ where: { id: existingInvite.id } });
  }

  // Create invite
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const invite = await prisma.invite.create({
    data: {
      email: trimmedEmail,
      token: randomUUID(),
      role: "EDUCATOR",
      callerRole: "TEACHER",
      invitedById: auth.session.user.id,
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      expiresAt,
    },
    select: {
      id: true,
      email: true,
      token: true,
      expiresAt: true,
    },
  });

  const baseUrl = config.app.url;
  const inviteUrl = `${baseUrl}/invite/accept?token=${invite.token}`;

  return NextResponse.json({
    ok: true,
    invite: {
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
    },
    inviteUrl,
  });
}
