import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/data-dictionary/xrefs
 *
 * Find cross-references for template variables and key prefixes.
 *
 * Query params:
 * - type: "variable" | "prefix"
 * - pattern: the variable name (e.g., "{{memories.facts}}") or prefix (e.g., "location_")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "variable" or "prefix"
    const pattern = searchParams.get("pattern");

    if (!type || !pattern) {
      return NextResponse.json(
        { ok: false, error: "type and pattern are required" },
        { status: 400 }
      );
    }

    const xrefs: {
      analysisSpecs: Array<{ id: string; name: string; slug: string; outputType: string; field: string }>;
      promptTemplates: Array<{ id: string; name: string; slug: string; field: string }>;
      promptSlugs: Array<{ id: string; slug: string; name: string; field: string }>;
      playbooks: Array<{ id: string; name: string; status: string; domain: string | null }>;
    } = {
      analysisSpecs: [],
      promptTemplates: [],
      promptSlugs: [],
      playbooks: [],
    };

    if (type === "variable") {
      // Search for mustache-style variables in templates
      // Strip the {{ }} for searching
      const searchPattern = pattern.replace(/\{\{|\}\}/g, "");

      // Search AnalysisSpec promptTemplate field
      const specs = await prisma.analysisSpec.findMany({
        where: {
          promptTemplate: {
            contains: searchPattern,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          outputType: true,
        },
      });

      xrefs.analysisSpecs = specs.map(s => ({
        ...s,
        field: "promptTemplate",
      }));

      // Search PromptTemplate systemPrompt and contextTemplate fields
      const templatesWithSystemPrompt = await prisma.promptTemplate.findMany({
        where: {
          systemPrompt: {
            contains: searchPattern,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      const templatesWithContext = await prisma.promptTemplate.findMany({
        where: {
          contextTemplate: {
            contains: searchPattern,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      // Combine and dedupe
      const templateMap = new Map<string, { id: string; name: string; slug: string; field: string }>();
      for (const t of templatesWithSystemPrompt) {
        templateMap.set(t.id, { ...t, field: "systemPrompt" });
      }
      for (const t of templatesWithContext) {
        if (templateMap.has(t.id)) {
          templateMap.get(t.id)!.field += ", contextTemplate";
        } else {
          templateMap.set(t.id, { ...t, field: "contextTemplate" });
        }
      }
      xrefs.promptTemplates = Array.from(templateMap.values());

      // Search PromptSlug memorySummaryTemplate and range prompts
      const slugsWithSummary = await prisma.promptSlug.findMany({
        where: {
          memorySummaryTemplate: {
            contains: searchPattern,
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
        },
      });

      const slugsWithRanges = await prisma.promptSlug.findMany({
        where: {
          ranges: {
            some: {
              prompt: {
                contains: searchPattern,
              },
            },
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
        },
      });

      // Combine and dedupe
      const slugMap = new Map<string, { id: string; slug: string; name: string; field: string }>();
      for (const s of slugsWithSummary) {
        slugMap.set(s.id, { ...s, field: "summaryTemplate" });
      }
      for (const s of slugsWithRanges) {
        if (slugMap.has(s.id)) {
          slugMap.get(s.id)!.field += ", ranges";
        } else {
          slugMap.set(s.id, { ...s, field: "ranges" });
        }
      }
      xrefs.promptSlugs = Array.from(slugMap.values());

    } else if (type === "prefix") {
      // Search for key prefixes in AnalysisAction learnKeyPrefix field
      const actionsWithPrefix = await prisma.analysisAction.findMany({
        where: {
          learnKeyPrefix: {
            startsWith: pattern,
          },
        },
        select: {
          id: true,
          learnKeyPrefix: true,
          trigger: {
            select: {
              spec: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  outputType: true,
                },
              },
            },
          },
        },
      });

      // Get unique specs
      const specMap = new Map<string, { id: string; name: string; slug: string; outputType: string; field: string }>();
      for (const action of actionsWithPrefix) {
        if (action.trigger?.spec) {
          const spec = action.trigger.spec;
          if (!specMap.has(spec.id)) {
            specMap.set(spec.id, {
              ...spec,
              field: `learnKeyPrefix: ${action.learnKeyPrefix}`,
            });
          }
        }
      }
      xrefs.analysisSpecs = Array.from(specMap.values());

      // Also search CallerMemory for actual usage of this prefix
      const memoryCount = await prisma.callerMemory.count({
        where: {
          key: {
            startsWith: pattern,
          },
        },
      });

      // Search PromptSlug summaryTemplate for memory category references
      // e.g., if prefix is "location_", search for "memories.facts" or similar in templates
      // This is approximate - we can't perfectly map prefix to template variable
    }

    // Find playbooks that use the specs we found
    if (xrefs.analysisSpecs.length > 0) {
      const specIds = xrefs.analysisSpecs.map(s => s.id);
      const playbookItems = await prisma.playbookItem.findMany({
        where: {
          specId: { in: specIds },
          itemType: "SPEC",
        },
        select: {
          playbook: {
            select: {
              id: true,
              name: true,
              status: true,
              domain: {
                select: { name: true },
              },
            },
          },
        },
      });

      // Dedupe playbooks
      const playbookMap = new Map<string, { id: string; name: string; status: string; domain: string | null }>();
      for (const item of playbookItems) {
        if (!playbookMap.has(item.playbook.id)) {
          playbookMap.set(item.playbook.id, {
            id: item.playbook.id,
            name: item.playbook.name,
            status: item.playbook.status,
            domain: item.playbook.domain?.name || null,
          });
        }
      }
      xrefs.playbooks = Array.from(playbookMap.values());
    }

    return NextResponse.json({
      ok: true,
      pattern,
      type,
      xrefs,
      counts: {
        analysisSpecs: xrefs.analysisSpecs.length,
        promptTemplates: xrefs.promptTemplates.length,
        promptSlugs: xrefs.promptSlugs.length,
        playbooks: xrefs.playbooks.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching xrefs:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch cross-references" },
      { status: 500 }
    );
  }
}
