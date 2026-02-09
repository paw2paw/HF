import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

/**
 * GET /api/onboarding/personas
 *
 * List all persona onboarding configurations from onboarding spec (default: INIT-001, configurable via ONBOARDING_SPEC_SLUG).
 * Returns summary of each persona's config for the persona selector UI.
 */
export async function GET() {
  try {
    // Get onboarding spec slug from config (env-configurable)
    const onboardingSlug = "spec-init-001";

    // Find onboarding spec
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [
          { slug: { contains: onboardingSlug.toLowerCase(), mode: "insensitive" } },
          { slug: { contains: "onboarding" } },
          { domain: "onboarding" },
        ],
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        config: true,
        updatedAt: true,
      },
    });

    if (!spec) {
      // Return hardcoded persona list if spec not seeded
      return NextResponse.json({
        ok: true,
        source: "hardcoded",
        specId: null,
        defaultPersona: "tutor",
        personas: [
          {
            slug: "tutor",
            name: "Tutor",
            description: "Educational and learning-focused conversations",
            targetCount: 5,
            phaseCount: 5,
            hasWelcomeSlug: false,
          },
          {
            slug: "companion",
            name: "Companion",
            description: "Thoughtful conversation partner for exploration and connection",
            targetCount: 5,
            phaseCount: 5,
            hasWelcomeSlug: false,
          },
          {
            slug: "coach",
            name: "Coach",
            description: "Strategic thinking partner for challenges and goal achievement",
            targetCount: 6,
            phaseCount: 5,
            hasWelcomeSlug: false,
          },
        ],
      });
    }

    const config = spec.config as any || {};
    const personasConfig = config.personas || {};
    const defaultPersona = personasConfig.defaultPersona || "tutor";

    // Build persona summaries
    const personaKeys = Object.keys(personasConfig).filter(k => !k.startsWith("_") && k !== "defaultPersona");
    const personas = personaKeys.map(slug => {
      const pc = personasConfig[slug] || {};
      return {
        slug,
        name: pc.name || slug,
        description: pc.description || null,
        targetCount: Object.keys(pc.defaultTargets || {}).length,
        phaseCount: pc.firstCallFlow?.phases?.length || 0,
        hasWelcomeSlug: !!pc.welcomeSlug,
        welcomeSlug: pc.welcomeSlug || null,
        successMetricCount: pc.firstCallFlow?.successMetrics?.length || 0,
      };
    });

    return NextResponse.json({
      ok: true,
      source: "database",
      specId: spec.id,
      specSlug: spec.slug,
      updatedAt: spec.updatedAt,
      defaultPersona,
      personas,
    });
  } catch (error: any) {
    console.error("Error fetching onboarding personas:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch onboarding personas" },
      { status: 500 }
    );
  }
}
