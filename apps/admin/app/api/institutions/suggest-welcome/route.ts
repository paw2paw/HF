import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { getSuggestSettings } from "@/lib/system-settings";

/**
 * @api POST /api/institutions/suggest-welcome
 * @visibility internal
 * @auth OPERATOR
 * @tags institutions, institution-wizard
 * @description AI-suggests 3 welcome message options for a new institution.
 *   Used in the Create Institution wizard WelcomeStep.
 *
 * @request application/json
 *   institutionName: string (required)
 *   typeSlug: string (optional) — e.g. "school", "university", "business"
 *
 * @response 200 { ok, suggestions: string[] }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  let body: { institutionName: string; typeSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected JSON body" }, { status: 400 });
  }

  const institutionName = body.institutionName?.trim();
  if (!institutionName || institutionName.length < 2) {
    return NextResponse.json(
      { ok: false, error: "institutionName must be at least 2 characters" },
      { status: 400 },
    );
  }

  const typeSlug = body.typeSlug?.trim() || "institution";
  const { timeoutMs, maxInputLength } = await getSuggestSettings();
  const truncatedName = institutionName.slice(0, maxInputLength);

  try {
    // @ai-call institutions.suggest-welcome — Generate welcome messages for an institution | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "institutions.suggest-welcome",
        messages: [
          {
            role: "system",
            content: `You write 3 short, warm welcome messages for a ${typeSlug}. Return ONLY valid JSON, no markdown.
Format: {"suggestions": ["message1", "message2", "message3"]}

Each message must:
- Be 1-2 sentences, warm and welcoming
- Mention what AI tutors or the system does for learners
- Feel natural for a ${typeSlug}
- Not be too formal or generic
- Vary in tone (encouraging, professional, friendly)`,
          },
          { role: "user", content: `Institution: ${truncatedName}` },
        ],
        temperature: 0.5,
        maxTokens: 300,
        timeoutMs,
      },
      {
        sourceOp: "institution-wizard:suggest-welcome",
        userId: authResult.session.user.id,
        userName: authResult.session.user.name || undefined,
        entityLabel: institutionName,
        wizardName: "Institution",
        wizardStep: "Suggest Welcome",
      },
    );

    const raw = response.content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    let parsed: { suggestions?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? (parsed.suggestions as unknown[])
          .filter((s): s is string => typeof s === "string")
          .slice(0, 3)
      : [];

    return NextResponse.json({ ok: true, suggestions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[suggest-welcome] AI call failed:", message);
    return NextResponse.json({ ok: true, suggestions: [] });
  }
}
