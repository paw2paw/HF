import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { getSuggestSettings } from "@/lib/system-settings";
import type { TeachingMode } from "@/lib/content-trust/resolve-config";

/**
 * @api POST /api/courses/suggest-type
 * @visibility internal
 * @auth OPERATOR
 * @tags courses, teach-wizard
 * @description AI-suggests the best TeachingMode for a given course name.
 *   Used as fallback when client-side keyword matching finds no match.
 *
 * @request application/json
 *   courseName: string (required) — The course name to classify
 *
 * @response 200 { ok, mode, confidence }
 */

const VALID_MODES = new Set<string>(["recall", "comprehension", "practice", "syllabus"]);

export async function POST(req: NextRequest) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  let body: { courseName: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected JSON body" }, { status: 400 });
  }

  const courseName = body.courseName?.trim();
  if (!courseName || courseName.length < 3) {
    return NextResponse.json({ ok: false, error: "courseName must be at least 3 characters" }, { status: 400 });
  }

  const { timeoutMs, maxInputLength } = await getSuggestSettings();
  const truncatedName = courseName.slice(0, maxInputLength);

  try {
    // @ai-call courses.suggest-type — Classify course name into teaching mode | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "courses.suggest-type",
        messages: [
          {
            role: "system",
            content: `You classify course names into one of four teaching modes. Return ONLY valid JSON, no markdown.

Modes:
- "recall" — Fact-heavy subjects where students need to learn and remember information. Examples: History, Biology, Geography, Chemistry, Law, Medicine.
- "comprehension" — Subjects focused on reading, analysis, discussion, and critical thinking. Examples: English Literature, Philosophy, Negotiation, Leadership, Languages, Communication.
- "practice" — Problem-solving subjects where students work through exercises. Examples: Maths, Physics, Accounting, Programming, Engineering, Statistics.
- "syllabus" — Structured coverage/compliance subjects with a fixed body of material to complete. Examples: Food Safety, BTEC, Apprenticeships, Health & Safety, GDPR, Induction.

Return: {"mode": "<mode>", "confidence": <0.0-1.0>}`,
          },
          { role: "user", content: truncatedName },
        ],
        temperature: 0.2,
        maxTokens: 60,
        timeoutMs,
      },
      {
        sourceOp: "teach-wizard:suggest-type",
        userId: authResult.session.user.id,
        userName: authResult.session.user.name || undefined,
        entityLabel: courseName,
        wizardName: "Teach",
        wizardStep: "Suggest Type",
      }
    );

    const raw = response.content.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    let parsed: { mode?: string; confidence?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    const mode = VALID_MODES.has(parsed.mode ?? "") ? (parsed.mode as TeachingMode) : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

    return NextResponse.json({ ok: true, mode, confidence });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[suggest-type] AI call failed:", message);
    return NextResponse.json({ ok: true, mode: null, confidence: 0 });
  }
}
