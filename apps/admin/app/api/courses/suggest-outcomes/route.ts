import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";
import { getSuggestSettings } from "@/lib/system-settings";

/**
 * @api POST /api/courses/suggest-outcomes
 * @visibility internal
 * @auth OPERATOR
 * @tags courses, course-wizard
 * @description AI-suggests 4 learning outcomes for a given course name.
 *   Used in the Create Course wizard IntentStep to help educators define outcomes.
 *
 * @request application/json
 *   courseName: string (required) — The course name to generate outcomes for
 *
 * @response 200 { ok, outcomes: string[] }
 */
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
    return NextResponse.json(
      { ok: false, error: "courseName must be at least 3 characters" },
      { status: 400 },
    );
  }

  const { timeoutMs, maxInputLength } = await getSuggestSettings();
  const truncatedName = courseName.slice(0, maxInputLength);

  try {
    // @ai-call courses.suggest-outcomes — Generate learning outcomes for a course name | config: /x/ai-config
    const response = await getConfiguredMeteredAICompletion(
      {
        callPoint: "courses.suggest-outcomes",
        messages: [
          {
            role: "system",
            content: `You suggest 4 clear, measurable learning outcomes for a course. Return ONLY valid JSON, no markdown.
Format: {"outcomes": ["outcome1", "outcome2", "outcome3", "outcome4"]}

Each outcome must:
- Start with an action verb (Understand, Apply, Analyse, Create, Explain, Describe, Evaluate, etc.)
- Be concise — under 12 words
- Be specific and realistic for this subject
- Cover different cognitive levels (knowledge, application, analysis)`,
          },
          { role: "user", content: `Course: ${truncatedName}` },
        ],
        temperature: 0.4,
        maxTokens: 250,
        timeoutMs,
      },
      { sourceOp: "course-wizard:suggest-outcomes" },
    );

    const raw = response.content
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "");

    let parsed: { outcomes?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    const outcomes = Array.isArray(parsed.outcomes)
      ? (parsed.outcomes as unknown[])
          .filter((o): o is string => typeof o === "string")
          .slice(0, 4)
      : [];

    return NextResponse.json({ ok: true, outcomes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[suggest-outcomes] AI call failed:", message);
    return NextResponse.json({ ok: true, outcomes: [] });
  }
}
