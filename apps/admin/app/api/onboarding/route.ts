import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PARAMS } from "@/lib/registry";
import { config } from "@/lib/config";

/**
 * GET /api/onboarding
 *
 * Fetch onboarding spec data for visualization (default: INIT-001, configurable via ONBOARDING_SPEC_SLUG).
 * Supports ?persona=tutor|companion|coach for persona-specific config.
 * Returns default targets, first-call flow, and welcome templates.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaSlug = searchParams.get("persona");

    // Get onboarding spec slug (default: spec-init-001)
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
        name: true,
        description: true,
        config: true,
        updatedAt: true,
      },
    });

    if (!spec) {
      // Return hardcoded defaults from INIT-001 spec file if not seeded
      const defaultPersonasList = [
        { slug: "tutor", name: "Tutor", description: "Educational and learning-focused conversations", icon: "📚", color: { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" } },
        { slug: "companion", name: "Companion", description: "Thoughtful conversation partner for exploration and connection", icon: "💭", color: { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" } },
        { slug: "coach", name: "Coach", description: "Strategic thinking partner for challenges and goal achievement", icon: "🏆", color: { bg: "#d1fae5", border: "#10b981", text: "#065f46" } },
      ];
      const selectedHardcoded = personaSlug || "tutor";
      const selectedPersonaData = defaultPersonasList.find(p => p.slug === selectedHardcoded) || defaultPersonasList[0];
      return NextResponse.json({
        ok: true,
        source: "hardcoded",
        spec: null,
        selectedPersona: selectedHardcoded,
        availablePersonas: ["tutor", "companion", "coach"],
        personasList: defaultPersonasList,
        personaName: selectedPersonaData.name,
        personaDescription: selectedPersonaData.description,
        personaIcon: selectedPersonaData.icon,
        personaColor: selectedPersonaData.color,
        defaultTargets: {
          [PARAMS.BEH_FORMALITY]: { value: 0.5, confidence: 0.3, rationale: "Start neutral, adapt based on caller's style" },
          [PARAMS.BEH_RESPONSE_LEN]: { value: 0.5, confidence: 0.3, rationale: "Medium responses until we learn preference" },
          [PARAMS.BEH_WARMTH]: { value: 0.65, confidence: 0.4, rationale: "Slightly warm for welcoming first impression" },
          [PARAMS.BEH_DIRECTNESS]: { value: 0.5, confidence: 0.3, rationale: "Balanced until we learn their style" },
          [PARAMS.BEH_EMPATHY_RATE]: { value: 0.6, confidence: 0.4, rationale: "Higher empathy for new relationship" },
          [PARAMS.BEH_QUESTION_RATE]: { value: 0.6, confidence: 0.4, rationale: "More questions to learn about them" },
          [PARAMS.BEH_CONVERSATIONAL_DEPTH]: { value: 0.7, confidence: 0.5, rationale: "Moderate depth for first call discovery" },
          [PARAMS.BEH_PROACTIVE]: { value: 0.4, confidence: 0.3, rationale: "Less proactive, more responsive initially" },
          [PARAMS.BEH_CONVERSATIONAL_TONE]: { value: 0.6, confidence: 0.4, rationale: "Warm and inviting tone to build rapport" },
          [PARAMS.BEH_PACE_MATCH]: { value: 0.6, confidence: 0.4, rationale: "Match their pace to feel natural" },
          [PARAMS.BEH_MEMORY_REFERENCE]: { value: 0.3, confidence: 0.2, rationale: "Low - we don't know them yet" },
        },
        firstCallFlow: {
          phases: [
            { phase: "welcome", duration: "1-2 min", priority: "critical", goals: ["Warm greeting", "Acknowledge first time", "Create psychological safety"], avoid: ["Overwhelming", "Rushing", "Generic scripts"] },
            { phase: "orient", duration: "1-2 min", priority: "high", goals: ["Explain what we offer", "Set expectations", "Invite questions"], avoid: ["Long monologues", "Feature lists", "Jargon"] },
            { phase: "discover", duration: "3-5 min", priority: "critical", goals: ["Understand their goals", "Learn their context", "Identify motivations"], avoid: ["Interrogating", "Assuming", "Rushing to solutions"] },
            { phase: "sample", duration: "5-10 min", priority: "high", goals: ["Give them a taste of value", "Demonstrate capability", "Build excitement"], avoid: ["Overdelivering", "Going too deep", "Losing them"] },
            { phase: "close", duration: "1-2 min", priority: "high", goals: ["Summarize what we learned", "Preview next session", "End on high note"], avoid: ["Abrupt endings", "Forgetting to summarize", "Open loops without acknowledgment"] },
          ],
          successMetrics: [
            "Caller expressed at least one goal",
            "Caller experienced one 'aha' or value moment",
            "Caller seemed comfortable by end of call",
            "Agent learned at least 3 facts about caller",
          ],
        },
        welcomeTemplate: "Welcome! I'm really glad you're here...",
        welcomeTemplates: {
          tutor: "Welcome! I'm really glad you're here. I'll be your tutor, and my goal is to make learning feel like a conversation, not a lecture. We'll go at your pace, and I'll adapt to how you learn best. What topic or subject brought you here today?",
          companion: "Hello! It's wonderful to meet you. I'm here to be a thoughtful conversation partner - someone to explore ideas with, share stories, or just chat. What would you like to talk about today?",
          coach: "Welcome aboard! I'm excited to work with you. My role is to help you think through challenges and develop strategies that work for you. What's on your mind today - what would be most helpful to focus on?",
        },
      });
    }

    const config = spec.config as any || {};
    const personas = config.personas || {};
    const defaultPersona = personas.defaultPersona || "tutor";

    // Get available persona keys (excluding metadata keys)
    const availablePersonaKeys = Object.keys(personas).filter(k => !k.startsWith("_") && k !== "defaultPersona");
    const selectedPersona = personaSlug && availablePersonaKeys.includes(personaSlug) ? personaSlug : defaultPersona;
    const personaConfig = personas[selectedPersona] || {};

    // Build personas list with display properties for tabs
    const personasList = availablePersonaKeys.map(slug => {
      const pc = personas[slug] || {};
      return {
        slug,
        name: pc.name || slug,
        description: pc.description || null,
        icon: pc.icon || "🎭",
        color: pc.color || { bg: "#e5e7eb", border: "#6b7280", text: "#374151" },
      };
    });

    // Extract system defaults from parameters
    const defaultTargetsParam = config.parameters?.find((p: any) => p.id === "default_targets_quality");
    const welcomeParam = config.parameters?.find((p: any) => p.id === "welcome_quality");
    const systemDefaultTargets = defaultTargetsParam?.config?.defaultTargets || config.defaultTargets || {};
    const systemWelcomeTemplates = welcomeParam?.config?.welcomeTemplates || config.welcomeTemplates || {};

    // Merge system defaults with persona-specific overrides
    const mergedTargets = {
      ...systemDefaultTargets,
      ...(personaConfig.defaultTargets || {}),
    };

    // Get persona-specific flow or fall back to system default
    const personaFlow = personaConfig.firstCallFlow || config.firstCallFlow || {};

    return NextResponse.json({
      ok: true,
      source: "database",
      spec: {
        id: spec.id,
        slug: spec.slug,
        name: spec.name,
        description: spec.description,
        updatedAt: spec.updatedAt,
      },
      // Persona info
      selectedPersona,
      availablePersonas: availablePersonaKeys,
      personasList, // Full list with icons and colors for tabs
      personaName: personaConfig.name || selectedPersona,
      personaDescription: personaConfig.description || null,
      personaIcon: personaConfig.icon || "🎭",
      personaColor: personaConfig.color || { bg: "#e5e7eb", border: "#6b7280", text: "#374151" },
      // Persona-specific data (merged with system defaults)
      defaultTargets: mergedTargets,
      firstCallFlow: personaFlow,
      welcomeTemplate: personaConfig.welcomeTemplate || systemWelcomeTemplates[selectedPersona] || "",
      welcomeSlug: personaConfig.welcomeSlug || null,
      // All welcome templates (for reference)
      welcomeTemplates: systemWelcomeTemplates,
      // Full persona config for editing
      personaConfig: personaConfig,
      // System-level parameters for detailed view
      parameters: config.parameters || [],
    });
  } catch (error: any) {
    console.error("Error fetching onboarding spec:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch onboarding spec" },
      { status: 500 }
    );
  }
}
