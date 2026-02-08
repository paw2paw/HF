import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * GET /api/bdd-features/[featureId]/calibration
 * Export calibration data in a format suitable for AI prompting
 *
 * Query params:
 * - format: "prompt" | "json" (default "json")
 * - goldOnly: "true" to only include gold-standard examples
 *
 * The "prompt" format returns markdown suitable for system prompts:
 *
 * ## Scoring Rubric: Session Continuity After Break
 *
 * ### Scenario: Caller returns after 2+ week break
 * Given: The caller hasn't contacted us in more than 2 weeks
 * When: They initiate a new conversation
 * Then: Acknowledge the absence warmly and demonstrate memory of previous context
 *
 * #### Criteria 1: Acknowledge absence warmly (weight: 1.0)
 * Parameter: acknowledgment_warmth
 * Scale: 0-1 (continuous)
 *
 * **Scoring Anchors:**
 *
 * | Score | Example | Rationale |
 * |-------|---------|-----------|
 * | 0.9 | "Welcome back! I remember we were discussing X last time..." | Demonstrates warmth AND memory |
 * | 0.5 | "Hi there! It's been a while." | Acknowledges absence but no context |
 * | 0.2 | "Hello, how can I help you today?" | Generic greeting, no acknowledgment |
 *
 * **Positive signals:** references_previous, warm_greeting, uses_name
 * **Negative signals:** generic_greeting, no_memory_reference
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { featureId } = await params;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";
    const goldOnly = url.searchParams.get("goldOnly") === "true";

    const feature = await prisma.bddFeature.findFirst({
      where: {
        OR: [{ id: featureId }, { slug: featureId }],
      },
      include: {
        scenarios: {
          orderBy: { sortOrder: "asc" },
          include: {
            criteria: {
              orderBy: { sortOrder: "asc" },
              include: {
                parameter: {
                  select: { parameterId: true, name: true, definition: true },
                },
                anchors: {
                  where: goldOnly ? { isGold: true } : undefined,
                  orderBy: [{ score: "desc" }, { sortOrder: "asc" }],
                },
              },
            },
          },
        },
      },
    });

    if (!feature) {
      return NextResponse.json(
        { ok: false, error: "Feature not found" },
        { status: 404 }
      );
    }

    if (format === "prompt") {
      // Generate markdown prompt format
      const lines: string[] = [];

      lines.push(`## Scoring Rubric: ${feature.name}`);
      lines.push("");

      if (feature.description) {
        lines.push(feature.description);
        lines.push("");
      }

      for (const scenario of feature.scenarios) {
        lines.push(`### Scenario: ${scenario.name || "Unnamed"}`);
        lines.push(`**Given:** ${scenario.given}`);
        lines.push(`**When:** ${scenario.when}`);
        lines.push(`**Then:** ${scenario.then}`);
        lines.push("");

        for (let i = 0; i < scenario.criteria.length; i++) {
          const c = scenario.criteria[i];
          lines.push(`#### Criteria ${i + 1}: ${c.description} (weight: ${c.weight})`);

          if (c.parameter) {
            lines.push(`Parameter: \`${c.parameter.parameterId}\` - ${c.parameter.name}`);
          }

          lines.push(`Scale: ${c.minScore}-${c.maxScore} (${c.scaleType})`);
          lines.push("");

          if (c.anchors.length > 0) {
            lines.push("**Scoring Anchors:**");
            lines.push("");
            lines.push("| Score | Example | Rationale |");
            lines.push("|-------|---------|-----------|");

            for (const anchor of c.anchors) {
              const example = anchor.example.replace(/\|/g, "\\|").replace(/\n/g, " ");
              const rationale = (anchor.rationale || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
              lines.push(`| ${anchor.score} | ${example} | ${rationale} |`);
            }
            lines.push("");

            // Collect all signals across anchors
            const positiveSignals = new Set<string>();
            const negativeSignals = new Set<string>();

            for (const anchor of c.anchors) {
              for (const s of anchor.positiveSignals) positiveSignals.add(s);
              for (const s of anchor.negativeSignals) negativeSignals.add(s);
            }

            if (positiveSignals.size > 0) {
              lines.push(`**Positive signals:** ${Array.from(positiveSignals).join(", ")}`);
            }
            if (negativeSignals.size > 0) {
              lines.push(`**Negative signals:** ${Array.from(negativeSignals).join(", ")}`);
            }
            lines.push("");
          }
        }
      }

      return new Response(lines.join("\n"), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
        },
      });
    }

    // JSON format with structured calibration data
    const calibration = {
      feature: {
        id: feature.id,
        slug: feature.slug,
        name: feature.name,
        description: feature.description,
        version: feature.version,
      },
      scenarios: feature.scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        given: s.given,
        when: s.when,
        then: s.then,
        criteria: s.criteria.map((c) => ({
          id: c.id,
          description: c.description,
          scaleType: c.scaleType,
          minScore: c.minScore,
          maxScore: c.maxScore,
          weight: c.weight,
          parameter: c.parameter
            ? {
                id: c.parameter.parameterId,
                name: c.parameter.name,
              }
            : null,
          anchors: c.anchors.map((a) => ({
            score: a.score,
            example: a.example,
            rationale: a.rationale,
            positiveSignals: a.positiveSignals,
            negativeSignals: a.negativeSignals,
            isGold: a.isGold,
          })),
        })),
      })),
    };

    return NextResponse.json({ ok: true, calibration });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to export calibration" },
      { status: 500 }
    );
  }
}
