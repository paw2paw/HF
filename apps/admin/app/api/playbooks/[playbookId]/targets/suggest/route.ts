import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";

/**
 * @api POST /api/playbooks/:playbookId/targets/suggest
 * @visibility internal
 * @scope playbooks:write
 * @auth session
 * @tags playbooks, ai
 * @description AI-generates "behavior pills" (concept-level bundles) from a natural language
 *   style description. Each pill maps to multiple underlying behavior parameters.
 *   Mode "initial" returns 3-5 pills from the user's intent.
 *   Mode "more" returns 2-3 domain-contextual extras.
 *
 * @pathParam playbookId string - Playbook UUID
 * @body intent string - Natural language style description (e.g. "warm, patient, exam-focused")
 * @body mode "initial" | "more" - Whether to generate from intent or suggest domain extras
 * @body existingPillIds? string[] - IDs of pills already shown (for "more" mode dedup)
 * @response 200 { ok, pills: BehaviorPill[], interpretation: string }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Playbook not found" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { playbookId } = await params;

    const body = await request.json();
    const intent = body.intent?.trim();
    const mode = body.mode || "initial";
    const existingPillIds: string[] = body.existingPillIds || [];

    if (!intent || intent.length < 3) {
      return NextResponse.json(
        { ok: false, error: "intent must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (mode !== "initial" && mode !== "more") {
      return NextResponse.json(
        { ok: false, error: 'mode must be "initial" or "more"' },
        { status: 400 }
      );
    }

    // Load playbook with domain
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: { select: { id: true, slug: true, name: true } },
        behaviorTargets: {
          where: { scope: "PLAYBOOK", effectiveUntil: null },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    // Load all adjustable BEHAVIOR parameters with interpretations
    const allParams = await prisma.parameter.findMany({
      where: { parameterType: "BEHAVIOR", isAdjustable: true },
      select: {
        parameterId: true,
        name: true,
        definition: true,
        domainGroup: true,
        interpretationHigh: true,
        interpretationLow: true,
      },
      orderBy: [{ domainGroup: "asc" }, { name: "asc" }],
    });

    // Get current effective values (playbook override > system default > 0.5)
    const systemTargets = await prisma.behaviorTarget.findMany({
      where: {
        scope: "SYSTEM",
        parameterId: { in: allParams.map((p) => p.parameterId) },
        effectiveUntil: null,
      },
    });

    const systemMap = new Map(systemTargets.map((t) => [t.parameterId, t.targetValue]));
    const playbookMap = new Map(
      playbook.behaviorTargets.map((t) => [t.parameterId, t.targetValue])
    );

    // Build parameter context for AI
    const paramContext = allParams.map((p) => ({
      id: p.parameterId,
      name: p.name,
      group: p.domainGroup,
      currentValue: playbookMap.get(p.parameterId) ?? systemMap.get(p.parameterId) ?? 0.5,
      high: p.interpretationHigh || "High",
      low: p.interpretationLow || "Low",
    }));

    // Build AI prompt
    const systemPrompt = buildSystemPrompt(mode, playbook.domain.name, existingPillIds);
    const userMessage = buildUserMessage(mode, intent, paramContext, existingPillIds);

    // @ai-call targets.suggest — Generate behavior pills from intent | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "targets.suggest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.4,
        maxTokens: 2048,
      },
      { sourceOp: "targets:suggest" }
    );

    // Parse AI response
    const raw = response.content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    let parsed: { pills: RawPill[]; interpretation: string };
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.error("[targets/suggest] Failed to parse AI response:", raw);
      return NextResponse.json(
        { ok: false, error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    // Validate and sanitize pills
    const validParamIds = new Set(allParams.map((p) => p.parameterId));
    const pills = (parsed.pills || [])
      .filter((pill) => pill.id && pill.label && Array.isArray(pill.parameters))
      .map((pill) => ({
        id: pill.id,
        label: pill.label,
        description: pill.description || "",
        intensity: clamp(pill.intensity ?? 0.7, 0, 1),
        source: (mode === "initial" ? "intent" : "domain-context") as
          | "intent"
          | "domain-context",
        parameters: pill.parameters
          .filter((p) => validParamIds.has(p.parameterId))
          .map((p) => {
            const current =
              playbookMap.get(p.parameterId) ?? systemMap.get(p.parameterId) ?? 0.5;
            return {
              parameterId: p.parameterId,
              atFull: clamp(p.atFull, 0, 1),
              atZero: current,
            };
          }),
      }))
      .filter((pill) => pill.parameters.length > 0);

    return NextResponse.json({
      ok: true,
      pills,
      interpretation: parsed.interpretation || "",
    });
  } catch (error: any) {
    console.error("Error suggesting behavior pills:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

// ── Helpers ──────────────────────────────────────

interface RawPill {
  id: string;
  label: string;
  description?: string;
  intensity?: number;
  parameters: Array<{
    parameterId: string;
    atFull: number;
  }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSystemPrompt(
  mode: "initial" | "more",
  domainName: string,
  existingPillIds: string[]
): string {
  const base = `You are an expert at configuring AI tutoring agents. You translate natural language style descriptions into "behavior pills" — high-level concept bundles that each control a group of behavior parameters.

Each pill has:
- id: kebab-case slug (e.g. "warm-tone")
- label: Short display name (2-4 words, e.g. "Warm Tone")
- description: One sentence explaining the concept
- intensity: Default 0.0-1.0 (how strongly to apply this concept)
- parameters: Array of { parameterId, atFull } — what each parameter should be at full intensity

Rules:
- Each pill should bundle 2-5 related parameters that form a coherent concept
- Prefer minimal overlap between pills (a parameter in multiple pills is OK but not ideal)
- atFull values must be 0.0-1.0
- Only reference parameterId values from the provided list
- Return ONLY valid JSON, no markdown fences, no explanation

Domain context: This is for the "${domainName}" domain.`;

  if (mode === "more") {
    return (
      base +
      `\n\nYou are generating ADDITIONAL suggestions beyond what was already shown. Think about what behavioral dimensions would be valuable specifically for the "${domainName}" domain that the user may not have thought of. Do NOT duplicate these existing pills: [${existingPillIds.join(", ")}].`
    );
  }

  return base;
}

function buildUserMessage(
  mode: "initial" | "more",
  intent: string,
  paramContext: Array<{
    id: string;
    name: string;
    group: string;
    currentValue: number;
    high: string;
    low: string;
  }>,
  existingPillIds: string[]
): string {
  const paramList = paramContext
    .map(
      (p) =>
        `${p.id} (${p.name}, group: ${p.group}, current: ${p.currentValue.toFixed(2)}, high="${p.high}", low="${p.low}")`
    )
    .join("\n");

  if (mode === "more") {
    return `User's original intent: "${intent}"
Already showing pills: [${existingPillIds.join(", ")}]

Generate 2-3 additional behavior pills that would be useful for this domain but weren't in the original intent. Think about what's unique or important for this specific subject area.

Available parameters:
${paramList}

Return JSON: { "pills": [...], "interpretation": "brief explanation of extras" }`;
  }

  return `User describes their desired agent style: "${intent}"

Generate 3-5 behavior pills that capture this intent. Each pill should be a coherent behavioral concept.

Available parameters:
${paramList}

Return JSON: { "pills": [...], "interpretation": "brief summary of suggested style" }`;
}
