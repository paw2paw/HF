import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import {
  requireCohortOwnership,
  isCohortOwnershipError,
} from "@/lib/cohort-access";
import { sendInviteEmail } from "@/lib/email";

/**
 * @api GET /api/cohorts/:cohortId/invite
 * @visibility public
 * @scope cohorts:read
 * @auth session
 * @tags cohorts
 * @description List pending invites for a cohort.
 * @pathParam cohortId string - Cohort group ID
 * @response 200 { ok: true, invites }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "R");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;

    const invites = await prisma.invite.findMany({
      where: {
        cohortGroupId: cohortId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        expiresAt: true,
        sentAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, invites });
  } catch (error: any) {
    console.error("Error fetching cohort invites:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch invites" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/cohorts/:cohortId/invite
 * @visibility public
 * @scope cohorts:update
 * @auth session
 * @tags cohorts
 * @description Send email invites to pupils for this cohort. Creates Invite records
 *   and sends invitation emails.
 * @pathParam cohortId string - Cohort group ID
 * @body emails string[] - Email addresses to invite
 * @response 200 { ok: true, created, skipped, sent }
 * @response 400 { ok: false, error: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const authResult = await requireEntityAccess("cohorts", "U");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const { cohortId } = await params;

    const ownershipResult = await requireCohortOwnership(
      cohortId,
      session,
      scope
    );
    if (isCohortOwnershipError(ownershipResult)) return ownershipResult.error;
    const { cohort } = ownershipResult;

    const body = await req.json();
    const { emails } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one email is required" },
        { status: 400 }
      );
    }

    // Validate and deduplicate
    const validEmails = [
      ...new Set(
        emails
          .map((e: string) => e.trim().toLowerCase())
          .filter((e: string) => e.includes("@") && e.length > 3)
      ),
    ];

    if (validEmails.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid email addresses provided" },
        { status: 400 }
      );
    }

    // Check for existing pending invites
    const existingInvites = await prisma.invite.findMany({
      where: { email: { in: validEmails }, usedAt: null },
      select: { email: true },
    });
    const existingEmails = new Set(existingInvites.map((i) => i.email));
    const newEmails = validEmails.filter(
      (e: string) => !existingEmails.has(e)
    );

    if (newEmails.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: validEmails.length,
        sent: 0,
        message: "All email addresses already have pending invites",
      });
    }

    // Create invites with 30-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invites = await prisma.invite.createMany({
      data: newEmails.map((email: string) => ({
        email,
        role: "TESTER" as const,
        callerRole: "LEARNER" as const,
        cohortGroupId: cohortId,
        domainId: (cohort as any).domainId || (cohort as any).domain?.id,
        invitedById: session.user.id,
        expiresAt,
      })),
      skipDuplicates: true,
    });

    // Send invite emails
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
    let sent = 0;

    // Fetch the created invites to get their tokens
    const createdInvites = await prisma.invite.findMany({
      where: {
        email: { in: newEmails },
        cohortGroupId: cohortId,
        usedAt: null,
      },
      select: { email: true, token: true },
    });

    const domainName = (cohort as any).domain?.name;

    for (const invite of createdInvites) {
      try {
        const inviteUrl = `${baseUrl}/invite/accept?token=${invite.token}`;
        await sendInviteEmail({
          to: invite.email,
          inviteUrl,
          domainName,
        });
        await prisma.invite.updateMany({
          where: { email: invite.email, cohortGroupId: cohortId, usedAt: null },
          data: { sentAt: new Date() },
        });
        sent++;
      } catch (emailErr) {
        console.error(`Failed to send invite to ${invite.email}:`, emailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      created: invites.count,
      skipped: validEmails.length - newEmails.length,
      sent,
    });
  } catch (error: any) {
    console.error("Error creating cohort invites:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create invites" },
      { status: 500 }
    );
  }
}
