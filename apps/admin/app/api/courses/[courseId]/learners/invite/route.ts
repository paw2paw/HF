import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { sendInviteEmail } from "@/lib/email";

const bodySchema = z.object({
  emails: z.array(z.string().email()).min(1, "At least one email is required"),
});

/**
 * @api POST /api/courses/:courseId/learners/invite
 * @visibility public
 * @scope courses:update
 * @auth OPERATOR
 * @tags courses, learners, invites
 * @description Invite learners to a course by email. Resolves the course's default
 *   cohort, creates Invite records, and sends invitation emails. Skips emails that
 *   already have a pending invite or are already enrolled.
 * @pathParam courseId string - Playbook (course) ID
 * @body emails string[] - Email addresses to invite
 * @response 200 { ok: true, created: number, skipped: number, total: number }
 * @response 400 { ok: false, error: string }
 * @response 500 { ok: false, error: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
): Promise<NextResponse> {
  try {
    const auth = await requireAuth("OPERATOR");
    if (isAuthError(auth)) return auth.error;

    const { courseId } = await params;

    // Parse + validate body
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    // Deduplicate and normalise
    const validEmails = [
      ...new Set(parsed.data.emails.map((e) => e.trim().toLowerCase())),
    ];

    // Resolve default cohort for this course
    const cohort = await prisma.cohortGroup.findFirst({
      where: { playbooks: { some: { playbookId: courseId } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, domainId: true },
    });

    if (!cohort) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No cohort configured for this course. Open the Learners tab first.",
        },
        { status: 400 }
      );
    }

    // Find emails that already have a pending invite for this cohort
    const existingInvites = await prisma.invite.findMany({
      where: {
        email: { in: validEmails },
        cohortGroupId: cohort.id,
        usedAt: null,
      },
      select: { email: true },
    });
    const pendingEmails = new Set(existingInvites.map((i) => i.email));

    // Find emails already enrolled as callers in this cohort
    const enrolledCallers = await prisma.caller.findMany({
      where: {
        email: { in: validEmails },
        cohortMemberships: { some: { cohortGroupId: cohort.id } },
      },
      select: { email: true },
    });
    const enrolledEmails = new Set(
      enrolledCallers.filter((c) => c.email).map((c) => c.email!)
    );

    const newEmails = validEmails.filter(
      (e) => !pendingEmails.has(e) && !enrolledEmails.has(e)
    );

    if (newEmails.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: validEmails.length,
        total: validEmails.length,
      });
    }

    // Create invite records
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const invites = await prisma.invite.createMany({
      data: newEmails.map((email) => ({
        email,
        role: "STUDENT" as const,
        callerRole: "LEARNER" as const,
        cohortGroupId: cohort.id,
        domainId: cohort.domainId,
        invitedById: auth.session.user.id,
        expiresAt,
      })),
      skipDuplicates: true,
    });

    // Send invite emails
    const createdInvites = await prisma.invite.findMany({
      where: {
        email: { in: newEmails },
        cohortGroupId: cohort.id,
        usedAt: null,
      },
      select: { email: true, token: true },
    });

    const baseUrl = config.app.url;

    for (const invite of createdInvites) {
      try {
        const inviteUrl = `${baseUrl}/invite/accept?token=${invite.token}`;
        await sendInviteEmail({ to: invite.email, inviteUrl });
        await prisma.invite.updateMany({
          where: {
            email: invite.email,
            cohortGroupId: cohort.id,
            usedAt: null,
          },
          data: { sentAt: new Date() },
        });
      } catch (emailErr) {
        console.error(`Failed to send invite to ${invite.email}:`, emailErr);
      }
    }

    return NextResponse.json({
      ok: true,
      created: invites.count,
      skipped: validEmails.length - newEmails.length,
      total: validEmails.length,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to create invites";
    console.error("Error creating course invites:", error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
