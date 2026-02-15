import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { config } from "@/lib/config";
import type { SpecConfig } from "@/lib/types/json-fields";

/**
 * @api POST /api/onboarding/personas/manage
 * @visibility internal
 * @auth session
 * @tags onboarding
 * @description Create a new persona in the onboarding spec with default welcome message and first-call flow
 * @body slug string - Persona slug, lowercase alphanumeric with hyphens (required)
 * @body name string - Persona display name (required)
 * @body description string - Persona description
 * @body icon string - Emoji icon (default: flag in hole)
 * @body color object - Color config { bg, border, text }
 * @response 200 { ok: true, message: string, persona: object }
 * @response 400 { ok: false, error: "slug and name are required" | "Slug must be lowercase..." | "Persona already exists" }
 * @response 404 { ok: false, error: "INIT-001 spec not found" }
 * @response 500 { ok: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json();
    const { slug, name, description, icon, color } = body;

    if (!slug || !name) {
      return NextResponse.json(
        { ok: false, error: "slug and name are required" },
        { status: 400 }
      );
    }

    // Validate slug format (lowercase, alphanumeric, hyphens)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { ok: false, error: "Slug must be lowercase alphanumeric with hyphens only" },
        { status: 400 }
      );
    }

    // Get onboarding spec slug from config (env-configurable, default: INIT-001)
    const onboardingSlug = config.specs.onboarding.toLowerCase();

    // Find onboarding spec
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [
          { slug: { contains: onboardingSlug, mode: "insensitive" } },
          { slug: { contains: "onboarding" } },
          { domain: "onboarding" },
        ],
        isActive: true,
      },
      select: {
        id: true,
        config: true,
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "INIT-001 spec not found. Import it via /x/admin/spec-sync." },
        { status: 404 }
      );
    }

    const specConfig = spec.config as SpecConfig || {};
    const personas = specConfig.personas || {};

    // Check if slug already exists
    if (personas[slug]) {
      return NextResponse.json(
        { ok: false, error: `Persona '${slug}' already exists` },
        { status: 400 }
      );
    }

    // Clone the base flow from the default persona (or from spec file if needed)
    const defaultPersonaSlug = personas.defaultPersona || "tutor";
    let baseFlow = personas[defaultPersonaSlug]?.firstCallFlow;

    // If no default persona flow in DB, use empty structure
    if (!baseFlow) {
      baseFlow = { phases: [], successMetrics: [] };
    }

    // Re-slug the cloned phases for the new persona
    const slugPrefix = config.specs.onboardingSlugPrefix;
    const clonedPhases = (baseFlow?.phases || []).map((phase: any) => ({
      ...phase,
      instructionSlug: `${slugPrefix}phase.${phase.phase}.${slug}`,
    }));

    // Create new persona with cloned structure from default
    const newPersona = {
      name,
      description: description || "",
      icon: icon || "🎭",
      color: color || { bg: "#e5e7eb", border: "#6b7280", text: "#374151" },
      welcomeSlug: `${slugPrefix}welcome.${slug}`,
      welcomeTemplate: `Welcome! I'm your ${name.toLowerCase()}. How can I help you today?`,
      defaultTargets: {},
      firstCallFlow: {
        phases: clonedPhases,
        successMetrics: baseFlow?.successMetrics || [],
      },
    };

    // Update the spec config
    const newConfig = {
      ...specConfig,
      personas: {
        ...personas,
        [slug]: newPersona,
      },
    };

    // Save to database
    await prisma.analysisSpec.update({
      where: { id: spec.id },
      data: {
        config: newConfig,
        updatedAt: new Date(),
      },
    });

    // Create the welcome PromptSlug
    const welcomeSlug = `${slugPrefix}welcome.${slug}`;
    await prisma.promptSlug.upsert({
      where: { slug: welcomeSlug },
      update: {
        fallbackPrompt: newPersona.welcomeTemplate,
        updatedAt: new Date(),
      },
      create: {
        slug: welcomeSlug,
        name: `${name} Welcome Message`,
        description: `First-call welcome message for ${slug} persona`,
        sourceType: "COMPOSITE",
        fallbackPrompt: newPersona.welcomeTemplate,
        priority: 100,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Persona '${slug}' created successfully`,
      persona: { slug, ...newPersona },
    });
  } catch (error: any) {
    console.error("Error creating persona:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create persona" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/onboarding/personas/manage
 * @visibility internal
 * @auth session
 * @tags onboarding
 * @description Delete a persona from the onboarding spec. Cannot delete the default persona.
 * @query slug string - The persona slug to delete (required)
 * @response 200 { ok: true, message: string }
 * @response 400 { ok: false, error: "slug query param is required" | "Cannot delete the default persona" }
 * @response 404 { ok: false, error: "INIT-001 spec not found" | "Persona not found" }
 * @response 500 { ok: false, error: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "slug query param is required" },
        { status: 400 }
      );
    }

    // Get onboarding spec slug from config (env-configurable, default: INIT-001)
    const onboardingSlug = config.specs.onboarding.toLowerCase();

    // Find onboarding spec
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [
          { slug: { contains: onboardingSlug, mode: "insensitive" } },
          { slug: { contains: "onboarding" } },
          { domain: "onboarding" },
        ],
        isActive: true,
      },
      select: {
        id: true,
        config: true,
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "INIT-001 spec not found. Import it via /x/admin/spec-sync." },
        { status: 404 }
      );
    }

    const specConfig = spec.config as SpecConfig || {};
    const personas = specConfig.personas || {};

    if (!personas[slug]) {
      return NextResponse.json(
        { ok: false, error: `Persona '${slug}' not found` },
        { status: 404 }
      );
    }

    // Don't allow deleting the default persona
    if (personas.defaultPersona === slug) {
      return NextResponse.json(
        { ok: false, error: `Cannot delete the default persona. Change defaultPersona first.` },
        { status: 400 }
      );
    }

    // Remove the persona
    const { [slug]: removed, ...remainingPersonas } = personas;

    // Update the spec config
    const newConfig = {
      ...specConfig,
      personas: remainingPersonas,
    };

    // Save to database
    await prisma.analysisSpec.update({
      where: { id: spec.id },
      data: {
        config: newConfig,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Persona '${slug}' deleted successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting persona:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete persona" },
      { status: 500 }
    );
  }
}
