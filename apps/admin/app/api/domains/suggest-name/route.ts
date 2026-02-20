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
            content: `You are an expert at setting up AI tutoring agents. Given a user's description of what they want to teach, return a JSON object.

Required fields:
- "name": a short, clear course/tutor name (2-5 words). Distill the essence — do NOT just truncate the input. Drop filler words like "for", "of", "the". The name should stand alone as a label.${personaClause}
- "goals": an array of 2-4 concise learning goals the user should achieve (each 3-10 words)

Examples:
Input: "11+ Creative Comprehension tutor for UK Key Stage 2 pupils aged 9-10"
→ {"name": "11+ Creative Comprehension", "goals": ["Analyse fiction and non-fiction passages", "Write creative responses under timed conditions", "Build inference and deduction skills"]}

Input: "GCSE Maths revision for Year 11 students"
→ {"name": "GCSE Maths Revision", "goals": ["Master algebraic equations", "Understand geometric proofs", "Solve word problems confidently"]}

Return ONLY valid JSON. No markdown, no backticks, no explanation.`,
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
      // Try to extract JSON object from within the response text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          const name = raw.replace(/^["']|["']$/g, "").replace(/\.$/, "");
          parsed = { name: name || undefined };
        }
      } else {
        // Fallback: treat entire response as a name (backward compat)
        const name = raw.replace(/^["']|["']$/g, "").replace(/\.$/, "");
        parsed = { name: name || undefined };
      }
    }

    const name = cleanName(parsed.name?.trim().replace(/^["']|["']$/g, "").replace(/\.$/, "") || "");

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

/** Strip trailing prepositions/articles that make names look truncated */
function cleanName(name: string): string {
  const trailing = /\s+(?:for|of|the|a|an|and|in|on|to|with|at|by|from|as|is|or)$/i;
  let cleaned = name;
  // Strip up to 2 trailing filler words (e.g. "Tutor For The" → "Tutor")
  for (let i = 0; i < 2; i++) {
    const next = cleaned.replace(trailing, "");
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
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
