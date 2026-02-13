import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { randomUUID } from "crypto";
import { sendInviteEmail } from "@/lib/email";
import { config } from "@/lib/config";

/**
 * @api GET /api/invites
 * @visibility internal
 * @scope invites:list
 * @auth session
 * @tags users
 * @description Lists all invites, ordered by creation date. Admin-only.
 * @response 200 { invites: [...] }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden" }
 */
export async function GET() {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    include: { domain: { select: { id: true, name: true, slug: true } } },
  });

  return NextResponse.json({ invites });
}

/**
 * @api POST /api/invites
 * @visibility internal
 * @scope invites:create
 * @auth session
 * @tags users
 * @description Creates a new invite for a field tester and sends magic link email. Expires in 7 days. Admin-only.
 * @body email string - Email address to invite (required)
 * @body role string - User role (default: "OPERATOR")
 * @body firstName string - Tester's first name (optional, pre-fills accept form)
 * @body lastName string - Tester's last name (optional, pre-fills accept form)
 * @body domainId string - Lock tester to specific domain (optional, null = domain chooser)
 * @body sendEmail boolean - Whether to send the invite email (default: true)
 * @response 201 { ok: true, invite: {...}, inviteUrl: string }
 * @response 400 { error: "Email is required" | "User already exists..." | "Invalid domain ID" | ... }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden" }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

  const body = await req.json();
  const {
    email,
    role = "OPERATOR",
    firstName,
    lastName,
    domainId,
    sendEmail: shouldSendEmail = true,
  } = body;

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

  // Validate domain if provided
  let domainName: string | undefined;
  if (domainId) {
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });
    if (!domain) {
      return NextResponse.json(
        { error: "Invalid domain ID" },
        { status: 400 }
      );
    }
    domainName = domain.name;
  }

  // Create invite (expires in 7 days)
  const invite = await prisma.invite.create({
    data: {
      email,
      role,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: session.user.id,
      firstName: firstName || null,
      lastName: lastName || null,
      domainId: domainId || null,
    },
  });

  const inviteUrl = `${config.app.url}/invite/accept?token=${invite.token}`;

  // Send invite email (don't fail the request if email fails)
  let emailSent = false;
  if (shouldSendEmail) {
    try {
      await sendInviteEmail({
        to: invite.email,
        firstName: invite.firstName || undefined,
        inviteUrl,
        domainName,
      });
      emailSent = true;

      await prisma.invite.update({
        where: { id: invite.id },
        data: { sentAt: new Date() },
      });
    } catch (emailError) {
      console.error("[Invites] Failed to send invite email:", emailError);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      invite: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        role: invite.role,
        expiresAt: invite.expiresAt,
        firstName: invite.firstName,
        lastName: invite.lastName,
        domainId: invite.domainId,
      },
      inviteUrl,
      emailSent,
    },
    { status: 201 }
  );
}

/**
 * @api DELETE /api/invites
 * @visibility internal
 * @scope invites:delete
 * @auth session
 * @tags users
 * @description Deletes an invite by ID. Admin-only.
 * @query id string - Invite ID to delete
 * @response 200 { success: true }
 * @response 400 { error: "Invite ID required" }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden" }
 */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
  }

  await prisma.invite.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
