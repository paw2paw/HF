import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/domains/[domainId]/onboarding
 *
 * Get domain onboarding configuration
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        onboardingWelcome: true,
        onboardingIdentitySpecId: true,
        onboardingFlowPhases: true,
        onboardingDefaultTargets: true,
        onboardingIdentitySpec: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 }
      );
    }

    // Get available identity specs for dropdown
    const identitySpecs = await prisma.analysisSpec.findMany({
      where: {
        specRole: "IDENTITY",
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      ok: true,
      domain,
      identitySpecs,
    });
  } catch (error: any) {
    console.error("Error fetching domain onboarding:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch domain onboarding" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/domains/[domainId]/onboarding
 *
 * Update domain onboarding configuration
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;
    const body = await req.json();

    const {
      onboardingWelcome,
      onboardingIdentitySpecId,
      onboardingFlowPhases,
      onboardingDefaultTargets,
    } = body;

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true, slug: true },
    });

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 }
      );
    }

    // If identitySpecId provided, verify it exists
    if (onboardingIdentitySpecId) {
      const spec = await prisma.analysisSpec.findUnique({
        where: { id: onboardingIdentitySpecId },
        select: { id: true, specRole: true },
      });

      if (!spec) {
        return NextResponse.json(
          { ok: false, error: "Identity spec not found" },
          { status: 400 }
        );
      }

      if (spec.specRole !== "IDENTITY") {
        return NextResponse.json(
          { ok: false, error: "Spec must have specRole=IDENTITY" },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: {
      onboardingWelcome?: string | null;
      onboardingIdentitySpecId?: string | null;
      onboardingFlowPhases?: any;
      onboardingDefaultTargets?: any;
    } = {};

    if (onboardingWelcome !== undefined) updateData.onboardingWelcome = onboardingWelcome;
    if (onboardingIdentitySpecId !== undefined) updateData.onboardingIdentitySpecId = onboardingIdentitySpecId;
    if (onboardingFlowPhases !== undefined) updateData.onboardingFlowPhases = onboardingFlowPhases;
    if (onboardingDefaultTargets !== undefined) updateData.onboardingDefaultTargets = onboardingDefaultTargets;

    // Update domain
    const updatedDomain = await prisma.domain.update({
      where: { id: domainId },
      data: updateData,
      select: {
        id: true,
        slug: true,
        name: true,
        onboardingWelcome: true,
        onboardingIdentitySpecId: true,
        onboardingFlowPhases: true,
        onboardingDefaultTargets: true,
        onboardingIdentitySpec: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    console.log(`[domain-onboarding-api] Updated onboarding config for domain ${domain.slug}`);

    return NextResponse.json({
      ok: true,
      domain: updatedDomain,
    });
  } catch (error: any) {
    console.error("Error updating domain onboarding:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update domain onboarding" },
      { status: 500 }
    );
  }
}
