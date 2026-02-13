import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * @api GET /api/invite/verify
 * @visibility public
 * @auth none
 * @tags invites
 * @description Verifies an invite token and returns invite details for the accept form. Does not consume the invite.
 * @query token string - Invite token to verify (required)
 * @response 200 { ok: true, invite: { email, firstName, lastName, domainName?, expiresAt } }
 * @response 400 { ok: false, error: "Token is required" }
 * @response 404 { ok: false, error: "Invite not found, expired, or already used" }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token is required" },
      { status: 400 }
    );
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { domain: { select: { name: true } } },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { ok: false, error: "Invite not found, expired, or already used" },
      { status: 404 }
    );
  }

  // Check if user already exists with this email
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    return NextResponse.json(
      { ok: false, error: "An account already exists with this email. Please sign in instead." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    invite: {
      email: invite.email,
      firstName: invite.firstName,
      lastName: invite.lastName,
      domainName: invite.domain?.name || null,
      expiresAt: invite.expiresAt,
    },
  });
}
