/**
 * @api POST /api/educator/students/:id/artifacts
 * @auth EDUCATOR
 * @desc Send an artifact to a student. Creates a ConversationArtifact
 *       with no call binding (educator-created) and delivers immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireEducator,
  isEducatorAuthError,
  requireEducatorStudentAccess,
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

  const { id: studentCallerId } = await params;
  const access = await requireEducatorStudentAccess(studentCallerId, auth.callerId);
  if ("error" in access) return access.error;

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

  const artifact = await prisma.conversationArtifact.create({
    data: {
      callerId: studentCallerId,
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

  // Deliver immediately
  const channel = getDeliveryChannel();
  const caller = await prisma.caller.findUnique({
    where: { id: studentCallerId },
  });
  if (caller && channel.canDeliver(caller)) {
    await channel.deliver(artifact, caller);
  }

  return NextResponse.json({ ok: true, artifact }, { status: 201 });
}
