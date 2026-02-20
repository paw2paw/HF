import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/communities
 * @visibility public
 * @scope communities:read
 * @auth session
 * @tags communities
 * @description List all communities (Domains with kind=COMMUNITY)
 * @response 200 { ok: true, communities: Domain[], count: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const communities = await prisma.domain.findMany({
      where: {
        kind: "COMMUNITY",
        isActive: true,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        _count: {
          select: {
            callers: true,
          },
        },
        onboardingIdentitySpec: {
          select: {
            id: true,
            config: true,
          },
        },
      },
    });

    // Transform to include friendly display fields
    const communityList = communities.map((community) => ({
      ...community,
      memberCount: community._count.callers,
      personaName: (community.onboardingIdentitySpec?.config as any)?.personaName || "Unknown",
      _count: undefined,
      onboardingIdentitySpec: undefined,
    }));

    return NextResponse.json({
      ok: true,
      communities: communityList,
      count: communities.length,
    });
  } catch (error: any) {
    console.error("Error fetching communities:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch communities" },
      { status: 500 }
    );
  }
}
