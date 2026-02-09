import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

/**
 * POST /api/onboarding/personas/manage
 *
 * Create a new persona in the onboarding spec (default: INIT-001, configurable via ONBOARDING_SPEC_SLUG).
 */
export async function POST(request: NextRequest) {
  try {
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
        config: true,
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "INIT-001 spec not found. Run db:seed first." },
        { status: 404 }
      );
    }

    const config = spec.config as any || {};
    const personas = config.personas || {};

    // Check if slug already exists
    if (personas[slug]) {
      return NextResponse.json(
        { ok: false, error: `Persona '${slug}' already exists` },
        { status: 400 }
      );
    }

    // Create new persona with default structure
    const newPersona = {
      name,
      description: description || "",
      icon: icon || "🎭",
      color: color || { bg: "#e5e7eb", border: "#6b7280", text: "#374151" },
      welcomeSlug: `init.welcome.${slug}`,
      welcomeTemplate: `Welcome! I'm your ${name.toLowerCase()}. How can I help you today?`,
      defaultTargets: {},
      firstCallFlow: {
        phases: [
          {
            phase: "welcome",
            duration: "1-2 min",
            priority: "critical",
            instructionSlug: `init.phase.welcome.${slug}`,
            goals: ["Warm greeting", "Acknowledge first time", "Create psychological safety"],
            avoid: ["Overwhelming", "Rushing", "Generic scripts"],
          },
          {
            phase: "orient",
            duration: "1-2 min",
            priority: "high",
            instructionSlug: `init.phase.orient.${slug}`,
            goals: ["Explain what we offer", "Set expectations", "Invite questions"],
            avoid: ["Long monologues", "Feature lists", "Jargon"],
          },
          {
            phase: "discover",
            duration: "3-5 min",
            priority: "critical",
            instructionSlug: `init.phase.discover.${slug}`,
            goals: ["Understand their goals", "Learn their context", "Identify motivations"],
            avoid: ["Interrogating", "Assuming", "Rushing to solutions"],
          },
          {
            phase: "sample",
            duration: "5-10 min",
            priority: "high",
            instructionSlug: `init.phase.sample.${slug}`,
            goals: ["Give them a taste of value", "Demonstrate capability", "Build excitement"],
            avoid: ["Overdelivering", "Going too deep", "Losing them"],
          },
          {
            phase: "close",
            duration: "1-2 min",
            priority: "high",
            instructionSlug: `init.phase.close.${slug}`,
            goals: ["Summarize what we learned", "Preview next session", "End on high note"],
            avoid: ["Abrupt endings", "Forgetting to summarize", "Open loops without acknowledgment"],
          },
        ],
        successMetrics: [
          "Caller expressed at least one goal",
          "Caller experienced one 'aha' or value moment",
          "Caller seemed comfortable by end of call",
          "Agent learned at least 3 facts about caller",
        ],
      },
    };

    // Update the spec config
    const newConfig = {
      ...config,
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
    await prisma.promptSlug.upsert({
      where: { slug: `init.welcome.${slug}` },
      update: {
        fallbackPrompt: newPersona.welcomeTemplate,
        updatedAt: new Date(),
      },
      create: {
        slug: `init.welcome.${slug}`,
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
 * DELETE /api/onboarding/personas/manage
 *
 * Delete a persona from the onboarding spec (default: INIT-001, configurable via ONBOARDING_SPEC_SLUG).
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "slug query param is required" },
        { status: 400 }
      );
    }

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
        config: true,
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "INIT-001 spec not found. Run db:seed first." },
        { status: 404 }
      );
    }

    const config = spec.config as any || {};
    const personas = config.personas || {};

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
      ...config,
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
