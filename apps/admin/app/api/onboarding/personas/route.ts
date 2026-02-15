import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { config } from "@/lib/config";
import { getOnboardingPersonasFallback } from "@/lib/fallback-settings";
import type { SpecConfig } from "@/lib/types/json-fields";

/**
 * @api GET /api/onboarding/personas
 * @visibility internal
 * @auth session
 * @tags onboarding
 * @description List all persona onboarding configurations from INIT-001 spec. Falls back to SystemSettings if spec not found.
 * @response 200 { ok: true, source: "database" | "fallback", specId?: string, defaultPersona: string, personas: Array<{ slug, name, description, targetCount, phaseCount, hasWelcomeSlug }> }
 * @response 500 { ok: false, error: string }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    // Get onboarding spec slug from config (env-configurable, default: INIT-001)
    const onboardingSlug = config.specs.onboarding.toLowerCase();

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
      // Spec not found — fall back to SystemSettings
      const fallbackPersonas = await getOnboardingPersonasFallback();
      return NextResponse.json({
        ok: true,
        source: "fallback",
        defaultPersona: fallbackPersonas[0]?.slug || "tutor",
        personas: fallbackPersonas.map(p => ({
          slug: p.slug,
          name: p.name,
          description: p.description,
          targetCount: 0,
          phaseCount: 0,
          hasWelcomeSlug: false,
          welcomeSlug: null,
          successMetricCount: 0,
        })),
      });
    }

    const specConfig = spec.config as SpecConfig || {};
    const personasConfig = specConfig.personas || {};
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
