import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { sendInviteEmail } from "@/lib/email";
import { config } from "@/lib/config";
import { randomUUID } from "crypto";

/**
 * @api POST /api/invites/[id]/resend
 * @visibility internal
 * @scope invites:write
 * @auth session
 * @tags invites
 * @description Resend an existing invite email. Regenerates token and extends expiry for expired invites. Admin-only.
 * @param id string - Invite ID (path parameter)
 * @response 200 { ok: true, invite: {...}, inviteUrl: string, emailSent: boolean }
 * @response 400 { ok: false, error: "Invite is already used" }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden" }
 * @response 404 { ok: false, error: "Invite not found" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const { id } = await params;

  // Fetch invite
  const invite = await prisma.invite.findUnique({
    where: { id },
  });

  if (!invite) {
    return NextResponse.json(
      { ok: false, error: "Invite not found" },
      { status: 404 }
    );
  }

  // Check if invite is already used
  if (invite.usedAt) {
    return NextResponse.json(
      { ok: false, error: "Invite is already used" },
      { status: 400 }
    );
  }

  // Fetch domain name if domainId is set
  let domainName: string | undefined;
  if (invite.domainId) {
    const domain = await prisma.domain.findUnique({
      where: { id: invite.domainId },
      select: { name: true },
    });
    domainName = domain?.name;
  }

  // Regenerate token and extend expiry if expired
  const now = new Date();
  const newToken = randomUUID();
  let newExpiresAt = invite.expiresAt;

  if (invite.expiresAt < now) {
    // Extend by 7 days
    newExpiresAt = new Date(now);
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);
  }

  // Update invite with new token and expiry
  const updatedInvite = await prisma.invite.update({
    where: { id },
    data: {
      token: newToken,
      expiresAt: newExpiresAt,
      sentAt: new Date(),
    },
  });

  const inviteUrl = `${config.app.url}/invite/accept?token=${newToken}`;

  // Send invite email
  let emailSent = false;
  try {
    await sendInviteEmail({
      to: updatedInvite.email,
      firstName: updatedInvite.firstName || undefined,
      inviteUrl,
      domainName,
    });
    emailSent = true;
  } catch (emailError) {
    console.error("[Invites Resend] Failed to send invite email:", emailError);
    // Continue - don't fail the request if email fails
  }

  return NextResponse.json({
    ok: true,
    invite: {
      id: updatedInvite.id,
      email: updatedInvite.email,
      role: updatedInvite.role,
      expiresAt: updatedInvite.expiresAt,
    },
    inviteUrl,
    emailSent,
  });
}
