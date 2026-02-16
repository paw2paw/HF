import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { getConfiguredMeteredAICompletion } from "@/lib/metering/instrumented-ai";

type Params = { params: Promise<{ curriculumId: string }> };

// ── Types ──────────────────────────────────────────────

const VALID_SESSION_TYPES = [
  "onboarding",
  "introduce",
  "deepen",
  "review",
  "assess",
  "consolidate",
] as const;

interface LessonPlanEntry {
  session: number;
  type: string;
  moduleId: string | null;
  moduleLabel: string;
  label: string;
  notes?: string;
  estimatedDurationMins?: number;
  assertionCount?: number;
}

interface LessonPlan {
  estimatedSessions: number;
  entries: LessonPlanEntry[];
  generatedAt?: string;
  generatedFrom?: string;
}

// ── Helpers ────────────────────────────────────────────

function getDeliveryConfig(curriculum: { deliveryConfig: any }): Record<string, any> {
  if (curriculum.deliveryConfig && typeof curriculum.deliveryConfig === "object") {
    return curriculum.deliveryConfig as Record<string, any>;
  }
  return {};
}

function getLessonPlan(curriculum: { deliveryConfig: any }): LessonPlan | null {
  const dc = getDeliveryConfig(curriculum);
  return dc.lessonPlan || null;
}

function validateEntries(entries: any[]): string | null {
  if (!Array.isArray(entries) || entries.length === 0) {
    return "entries must be a non-empty array";
  }
  if (entries.length > 100) {
    return "Maximum 100 sessions in a lesson plan";
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.session !== i + 1) {
      return `Session numbers must be sequential starting at 1 (got ${e.session} at position ${i})`;
    }
    if (!VALID_SESSION_TYPES.includes(e.type)) {
      return `Invalid session type "${e.type}" at session ${e.session}. Valid: ${VALID_SESSION_TYPES.join(", ")}`;
    }
    if (!e.label || typeof e.label !== "string") {
      return `Missing label at session ${e.session}`;
    }
  }
  return null;
}

// ── GET — Read lesson plan ─────────────────────────────

/**
 * @api GET /api/curricula/:curriculumId/lesson-plan
 * @visibility public
 * @scope curricula:read
 * @auth session (VIEWER+)
 * @tags curricula, lesson-plan
 * @description Get the lesson plan for a curriculum. Returns null if no plan exists.
 * @response 200 { ok: true, plan: LessonPlan | null }
 * @response 404 { ok: false, error: "Curriculum not found" }
 */
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  try {
    const auth = await requireAuth("VIEWER");
    if (isAuthError(auth)) return auth.error;

    const { curriculumId } = await params;

    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { id: true, deliveryConfig: true },
    });

    if (!curriculum) {
      return NextResponse.json({ ok: false, error: "Curriculum not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, plan: getLessonPlan(curriculum) });
  } catch (error: any) {
    console.error("[curricula/:id/lesson-plan] GET error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// ── PUT — Save lesson plan ─────────────────────────────

/**
 * @api PUT /api/curricula/:curriculumId/lesson-plan
 * @visibility public
 * @scope curricula:write
 * @auth session (OPERATOR+)
 * @tags curricula, lesson-plan
 * @description Save or update the lesson plan. Validates session numbers and types.
 * @body { entries: LessonPlanEntry[] }
 * @response 200 { ok: true, plan: LessonPlan }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "Curriculum not found" }
 */
export async function PUT(
  request: NextRequest,
  { params }: Params,
) {
  try {
    const auth = await requireAuth("OPERATOR");
    if (isAuthError(auth)) return auth.error;

    const { curriculumId } = await params;
    const body = await request.json();
    const { entries } = body;

    // Validate
    const validationError = validateEntries(entries);
    if (validationError) {
      return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
    }

    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { id: true, deliveryConfig: true },
    });

    if (!curriculum) {
      return NextResponse.json({ ok: false, error: "Curriculum not found" }, { status: 404 });
    }

    // Merge lesson plan into existing deliveryConfig
    const existingDC = getDeliveryConfig(curriculum);
    const plan: LessonPlan = {
      estimatedSessions: entries.length,
      entries: entries.map((e: any, i: number) => ({
        session: i + 1,
        type: e.type,
        moduleId: e.moduleId || null,
        moduleLabel: e.moduleLabel || "",
        label: e.label,
        notes: e.notes || undefined,
        estimatedDurationMins: e.estimatedDurationMins || undefined,
        assertionCount: e.assertionCount || undefined,
      })),
      generatedFrom: "manual",
    };

    await prisma.curriculum.update({
      where: { id: curriculumId },
      data: {
        deliveryConfig: { ...existingDC, lessonPlan: plan } as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ ok: true, plan });
  } catch (error: any) {
    console.error("[curricula/:id/lesson-plan] PUT error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// ── POST — AI-generate lesson plan ─────────────────────

/**
 * @api POST /api/curricula/:curriculumId/lesson-plan
 * @visibility public
 * @scope curricula:write
 * @auth session (OPERATOR+)
 * @tags curricula, lesson-plan
 * @description AI-generate a lesson plan from curriculum modules and assertion counts.
 * @body { totalSessionTarget?: number }
 * @response 200 { ok: true, plan: LessonPlanEntry[], estimatedSessions: number, reasoning: string }
 * @response 404 { ok: false, error: "Curriculum not found" }
 */
export async function POST(
  request: NextRequest,
  { params }: Params,
) {
  try {
    const auth = await requireAuth("OPERATOR");
    if (isAuthError(auth)) return auth.error;

    const { curriculumId } = await params;
    const body = await request.json().catch(() => ({}));
    const totalSessionTarget = body.totalSessionTarget || null;

    // Load curriculum with modules
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: {
        id: true,
        name: true,
        description: true,
        notableInfo: true,
        subjectId: true,
      },
    });

    if (!curriculum) {
      return NextResponse.json({ ok: false, error: "Curriculum not found" }, { status: 404 });
    }

    // Extract modules from notableInfo
    const notableInfo = (curriculum.notableInfo as Record<string, any>) || {};
    const modules: any[] = notableInfo.modules || [];

    if (modules.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Curriculum has no modules. Generate the curriculum first." },
        { status: 400 },
      );
    }

    // Count assertions per module topic (if we have subject linkage)
    const assertionCounts: Record<string, number> = {};
    if (curriculum.subjectId) {
      const assertions = await prisma.contentAssertion.groupBy({
        by: ["topicSlug"],
        where: {
          source: {
            subjects: { some: { subjectId: curriculum.subjectId } },
          },
          topicSlug: { not: null },
        },
        _count: true,
      });
      for (const group of assertions) {
        if (group.topicSlug) {
          assertionCounts[group.topicSlug] = group._count;
        }
      }
    }

    // Build module summary for AI
    const moduleSummary = modules.map((m: any, i: number) => {
      const count = assertionCounts[m.id] || assertionCounts[m.topicSlug] || 0;
      return `Module ${i + 1}: "${m.title}" (${m.learningOutcomes?.length || 0} LOs, ${count} assertions)`;
    }).join("\n");

    const targetHint = totalSessionTarget
      ? `The educator has requested approximately ${totalSessionTarget} sessions total.`
      : "Propose a reasonable number of sessions based on the content depth.";

    const systemPrompt = `You are a curriculum planning assistant. Given a set of teaching modules, propose a structured lesson plan — an ordered sequence of call sessions that covers all modules effectively.

Rules:
- Each session has a type: onboarding (first session), introduce (first exposure to module), deepen (revisit module for mastery), review (consolidate multiple modules), assess (test knowledge), consolidate (final synthesis)
- First session should always be onboarding
- Each module should have at least an "introduce" session, and larger modules (more assertions) should also have "deepen" sessions
- Include periodic "review" sessions every 3-4 modules
- End with an "assess" and "consolidate" session
- ${targetHint}

Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "reasoning": "Brief explanation of your plan structure",
  "entries": [
    { "session": 1, "type": "onboarding", "moduleId": null, "moduleLabel": "", "label": "Welcome + Background Probe" },
    { "session": 2, "type": "introduce", "moduleId": "MOD-1", "moduleLabel": "Module Name", "label": "Introduction to Module Name", "estimatedDurationMins": 30, "assertionCount": 23 },
    ...
  ]
}`;

    const userMessage = `Curriculum: "${curriculum.name}"
${curriculum.description ? `Description: ${curriculum.description}` : ""}

Modules:
${moduleSummary}

Total modules: ${modules.length}`;

    const result = await getConfiguredMeteredAICompletion({
      callPoint: "lesson-plan.generate",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      maxTokens: 4000,
    });

    // Parse response
    const content = typeof result === "string" ? result : result?.content || "";
    let parsed: any;
    try {
      // Strip markdown fences if present
      const cleaned = content.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { ok: false, error: "AI did not return valid JSON. Try again." },
        { status: 500 },
      );
    }

    const entries: LessonPlanEntry[] = (parsed.entries || []).map((e: any, i: number) => ({
      session: i + 1,
      type: VALID_SESSION_TYPES.includes(e.type) ? e.type : "introduce",
      moduleId: e.moduleId || null,
      moduleLabel: e.moduleLabel || "",
      label: e.label || `Session ${i + 1}`,
      notes: e.notes || undefined,
      estimatedDurationMins: e.estimatedDurationMins || undefined,
      assertionCount: e.assertionCount || undefined,
    }));

    return NextResponse.json({
      ok: true,
      plan: entries,
      estimatedSessions: entries.length,
      reasoning: parsed.reasoning || "",
    });
  } catch (error: any) {
    console.error("[curricula/:id/lesson-plan] POST error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
