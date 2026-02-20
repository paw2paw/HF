import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/communities/[communityId]
 * @visibility public
 * @scope communities:read
 * @auth session
 * @tags communities
 * @description Get a single community detail
 * @param communityId string - Community domain ID
 * @response 200 { ok: true, community: Domain }
 * @response 404 { ok: false, error: "Community not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const community = await prisma.domain.findUnique({
      where: { id: params.communityId },
      include: {
        _count: {
          select: {
            callers: true,
            playbooks: true,
          },
        },
        onboardingIdentitySpec: {
          select: {
            id: true,
            config: true,
          },
        },
        callers: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!community || community.kind !== "COMMUNITY") {
      return NextResponse.json(
        { ok: false, error: "Community not found" },
        { status: 404 }
      );
    }

    const response = {
      ...community,
      memberCount: community._count.callers,
      playbookCount: community._count.playbooks,
      personaName: (community.onboardingIdentitySpec?.config as any)?.personaName || "Unknown",
      recentMembers: community.callers,
      _count: undefined,
      callers: undefined,
      onboardingIdentitySpec: undefined,
    };

    return NextResponse.json({
      ok: true,
      community: response,
    });
  } catch (error: any) {
    console.error("Error fetching community:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch community" },
      { status: 500 }
    );
  }
}

/**
 * @api PATCH /api/communities/[communityId]
 * @visibility public
 * @scope communities:write
 * @auth session
 * @tags communities
 * @description Update a community
 * @param communityId string - Community domain ID
 * @body name string - Community name
 * @body description string - Community description
 * @body onboardingWelcome string - Welcome message for first call
 * @response 200 { ok: true, community: Domain }
 * @response 404 { ok: false, error: "Community not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    // Verify it's a community
    const existing = await prisma.domain.findUnique({
      where: { id: params.communityId },
      select: { kind: true },
    });

    if (!existing || existing.kind !== "COMMUNITY") {
      return NextResponse.json(
        { ok: false, error: "Community not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, onboardingWelcome } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (onboardingWelcome !== undefined) updateData.onboardingWelcome = onboardingWelcome;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    const community = await prisma.domain.update({
      where: { id: params.communityId },
      data: updateData,
      include: {
        _count: {
          select: {
            callers: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      community: {
        ...community,
        memberCount: community._count.callers,
        _count: undefined,
      },
    });
  } catch (error: any) {
    console.error("Error updating community:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update community" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/communities/[communityId]
 * @visibility public
 * @scope communities:write
 * @auth session
 * @tags communities
 * @description Archive a community (soft delete)
 * @param communityId string - Community domain ID
 * @response 200 { ok: true, message: "Community archived" }
 * @response 404 { ok: false, error: "Community not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { communityId: string } }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    // Verify it's a community
    const existing = await prisma.domain.findUnique({
      where: { id: params.communityId },
      select: { kind: true },
    });

    if (!existing || existing.kind !== "COMMUNITY") {
      return NextResponse.json(
        { ok: false, error: "Community not found" },
        { status: 404 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.domain.update({
      where: { id: params.communityId },
      data: { isActive: false },
    });

    return NextResponse.json({
      ok: true,
      message: "Community archived",
    });
  } catch (error: any) {
    console.error("Error deleting community:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete community" },
      { status: 500 }
    );
  }
}
