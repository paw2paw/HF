/**
 * @api POST /api/educator/classrooms/:id/artifacts
 * @auth EDUCATOR
 * @desc Send an artifact to all students in a classroom. Fan-out creates
 *       one ConversationArtifact per student and delivers immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorCohortOwnership,
} from "@/lib/educator-access";
import { getDeliveryChannel } from "@/lib/artifacts/channels";

const VALID_TYPES = [
  "SUMMARY", "KEY_FACT", "FORMULA", "EXERCISE",
  "RESOURCE_LINK", "STUDY_NOTE", "REMINDER", "MEDIA",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireEducator();
  if (isEducatorAuthError(auth)) return auth.error;

  const { id: classroomId } = await params;
  const ownership = await requireEducatorCohortOwnership(classroomId, auth.callerId);
  if ("error" in ownership) return ownership.error;

  const body = await request.json();
  const { type, title, content, mediaUrl, mediaType } = body;

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { ok: false, error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!title || typeof title !== "string") {
    return NextResponse.json(
      { ok: false, error: "title is required" },
      { status: 400 },
    );
  }
  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { ok: false, error: "content is required" },
      { status: 400 },
    );
  }

  // Get all LEARNER members of this classroom
  const members = await prisma.caller.findMany({
    where: { cohortGroupId: classroomId, role: "LEARNER" },
    select: { id: true },
  });

  if (members.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No students in this classroom" },
      { status: 400 },
    );
  }

  const channel = getDeliveryChannel();
  let created = 0;
  let delivered = 0;
  let failed = 0;

  // Create + deliver for each student
  for (const member of members) {
    try {
      const artifact = await prisma.conversationArtifact.create({
        data: {
          callerId: member.id,
          callId: null,
          type: type as any,
          title: title.trim().slice(0, 200),
          content: content.trim(),
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          contentAssertionIds: [],
          trustLevel: "VERIFIED",
          confidence: 1.0,
          status: "PENDING",
          channel: "educator",
          createdBy: auth.session.user?.id || null,
        },
      });
      created++;

      const caller = await prisma.caller.findUnique({ where: { id: member.id } });
      if (caller && channel.canDeliver(caller)) {
        await channel.deliver(artifact, caller);
        delivered++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json(
    { ok: true, created, delivered, failed, total: members.length },
    { status: 201 },
  );
}
