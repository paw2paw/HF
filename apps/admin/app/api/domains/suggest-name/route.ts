import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";

/**
 * @api POST /api/domains/suggest-name
 * @visibility internal
 * @auth OPERATOR
 * @tags domains, quick-launch
 * @description AI-generates field suggestions (name, persona, goals) from a free-text brief.
 *
 * @request application/json
 *   brief: string (required) — Free-text course description
 *   personaSlugs?: string[] — Available persona slugs to choose from
 *
 * @response 200 { ok, name, slug, persona?, goals? }
 */

export async function POST(req: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  let body: { brief: string; personaSlugs?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected JSON body" },
      { status: 400 }
    );
  }

  const brief = body.brief?.trim();
  if (!brief || brief.length < 5) {
    return NextResponse.json(
      { ok: false, error: "brief must be at least 5 characters" },
      { status: 400 }
    );
  }

  const personaSlugs = body.personaSlugs ?? [];

  try {
    const personaClause = personaSlugs.length > 0
      ? `\n- "persona": pick the best-fitting slug from this list: [${personaSlugs.map(s => `"${s}"`).join(", ")}]. If none fit, return null.`
      : "";

    // @ai-call quick-launch.suggest-name — Suggest field values from brief | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "quick-launch.suggest-name",
        messages: [
          {
            role: "system",
            content: `You are an expert at setting up AI agents. Given a description, return a JSON object with:
- "name": a short, clear agent/course name (2-6 words)${personaClause}
- "goals": an array of 2-4 concise learning goals the user should achieve (each 3-10 words)

Return ONLY valid JSON, no markdown fences, no explanation.`,
          },
          {
            role: "user",
            content: brief,
          },
        ],
        temperature: 0.3,
        maxTokens: 200,
      },
      { sourceOp: "quick-launch:suggest-name" }
    );

    const raw = response.content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    let parsed: { name?: string; persona?: string; goals?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: treat entire response as a name (backward compat)
      const name = raw.replace(/^["']|["']$/g, "").replace(/\.$/, "");
      parsed = { name: name || undefined };
    }

    const name = parsed.name?.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "");

    return NextResponse.json({
      ok: true,
      name: name && name.length >= 2 ? name : fallbackName(brief),
      slug: toSlug(name && name.length >= 2 ? name : fallbackName(brief)),
      persona: parsed.persona || null,
      goals: Array.isArray(parsed.goals) ? parsed.goals.filter(g => typeof g === "string" && g.trim()) : null,
    });
  } catch (err: any) {
    console.warn("[suggest-name] AI call failed, using fallback:", err.message);
    const name = fallbackName(brief);
    return NextResponse.json({
      ok: true,
      name,
      slug: toSlug(name),
      persona: null,
      goals: null,
    });
  }
}

/** Fallback: first 5 words, title-cased */
function fallbackName(brief: string): string {
  return brief
    .split(/\s+/)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
