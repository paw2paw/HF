import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorCohortOwnership,
} from "@/lib/educator-access";

/**
 * @api POST /api/educator/classrooms/[id]/invite
 * @visibility internal
 * @scope educator:write
 * @auth bearer
 * @tags educator, classrooms, invites
 * @description Send email invites to students for this classroom. Creates TESTER-role invites with LEARNER caller role and 30-day expiry. Deduplicates against existing pending invites.
 * @body emails string[] - Array of email addresses to invite
 * @response 200 { ok: true, created: number, skipped: number }
 * @response 400 { ok: false, error: "At least one email is required" }
 * @response 403 { ok: false, error: "Not authorized" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id } = await params;
  const ownership = await requireEducatorCohortOwnership(id, auth.callerId);
  if ("error" in ownership) return ownership.error;

  const { cohort } = ownership;
  const body = await request.json();
  const { emails } = body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one email is required" },
      { status: 400 }
    );
  }

  // Validate and deduplicate emails
  const validEmails = [...new Set(
    emails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => e.includes("@") && e.length > 3)
  )];

  if (validEmails.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No valid email addresses provided" },
      { status: 400 }
    );
  }

  // Check for existing invites and users
  const existingInvites = await prisma.invite.findMany({
    where: { email: { in: validEmails }, usedAt: null },
    select: { email: true },
  });
  const existingEmails = new Set(existingInvites.map((i) => i.email));

  const newEmails = validEmails.filter((e: string) => !existingEmails.has(e));

  if (newEmails.length === 0) {
    return NextResponse.json({
      ok: true,
      created: 0,
      skipped: validEmails.length,
      message: "All email addresses already have pending invites",
    });
  }

  // Create invites
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry for student invites

  const invites = await prisma.invite.createMany({
    data: newEmails.map((email: string) => ({
      email,
      role: "TESTER" as const,
      callerRole: "LEARNER" as const,
      cohortGroupId: id,
      domainId: cohort.domainId,
      invitedById: auth.session.user.id,
      expiresAt,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    ok: true,
    created: invites.count,
    skipped: validEmails.length - newEmails.length,
  });
}
