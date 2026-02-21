import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api POST /api/communities/[communityId]/members
 * @visibility public
 * @scope communities:write
 * @auth session
 * @tags communities, members
 * @description Add a caller to a community by setting their domainId
 * @param communityId string - Community domain ID
 * @body callerId string - Caller ID to add
 * @response 200 { ok: true, member: { id, name, email } }
 * @response 400 { ok: false, error: "callerId is required" }
 * @response 404 { ok: false, error: "Community not found" }
 * @response 409 { ok: false, error: "Caller is already a member" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { communityId } = await params;

    // Verify it's a community
    const community = await prisma.domain.findUnique({
      where: { id: communityId },
      select: { kind: true },
    });

    if (!community || community.kind !== "COMMUNITY") {
      return NextResponse.json(
        { ok: false, error: "Community not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { callerId } = body;

    if (!callerId) {
      return NextResponse.json(
        { ok: false, error: "callerId is required" },
        { status: 400 }
      );
    }

    // Check caller exists
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: { id: true, name: true, email: true, domainId: true },
    });

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Check if already a member
    if (caller.domainId === communityId) {
      return NextResponse.json(
        { ok: false, error: "Caller is already a member of this community" },
        { status: 409 }
      );
    }

    // Add to community by setting domainId
    const updated = await prisma.caller.update({
      where: { id: callerId },
      data: { domainId: communityId },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({
      ok: true,
      member: updated,
    });
  } catch (error: any) {
    console.error("Error adding community member:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to add member" },
      { status: 500 }
    );
  }
}
