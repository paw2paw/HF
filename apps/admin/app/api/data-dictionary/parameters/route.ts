import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/data-dictionary/parameters
 * @visibility internal
 * @scope data-dictionary:read
 * @auth session
 * @tags data-dictionary
 * @description Returns all parameters enriched with cross-references: specs (via AnalysisAction), playbooks, behavior targets, prompt slugs, and scoring anchors. Supports filtering by domain group and orphan detection. Derives isActive from "active"/"mvp" tags.
 * @query domainGroup string - Filter by domain group (optional)
 * @query orphans string - Show only orphaned parameters with no relationships ("true" to filter)
 * @response 200 { ok: true, parameters: [...], summary: { total, active, withSpecs, withPlaybooks, withTargets, withAnchors, orphaned, byDomainGroup } }
 * @response 500 { ok: false, error: "Failed to fetch parameters" }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const domainGroup = searchParams.get("domainGroup");
    const withOrphans = searchParams.get("orphans") === "true";

    // Fetch all parameters with their relationships
    const parameters = await prisma.parameter.findMany({
      where: domainGroup ? { domainGroup } : undefined,
      orderBy: [{ domainGroup: "asc" }, { parameterId: "asc" }],
      include: {
        // Source feature set (provenance tracking)
        sourceFeatureSet: {
          select: { id: true, featureId: true, name: true, version: true },
        },
        // Scoring anchors
        scoringAnchors: {
          orderBy: { score: "desc" },
          select: {
            id: true,
            score: true,
            example: true,
            rationale: true,
            isGold: true,
          },
        },
        // Behavior targets
        behaviorTargets: {
          where: { effectiveUntil: null }, // Only active targets
          select: {
            id: true,
            scope: true,
            targetValue: true,
            confidence: true,
            source: true,
            playbook: {
              select: { id: true, name: true },
            },
          },
        },
        // Tags to check for active/mvp status
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // For each parameter, find specs that use it via actions
    const enrichedParameters = await Promise.all(
      parameters.map(async (param) => {
        // Derive isActive from tags (has "active" or "mvp" tag)
        const tagSlugs = param.tags.map((t) => t.tag.slug || t.tag.name.toLowerCase());
        const isActive = tagSlugs.includes("active") || tagSlugs.includes("mvp");

        // Find AnalysisActions that reference this parameter
        const actions = await prisma.analysisAction.findMany({
          where: { parameterId: param.parameterId },
          select: {
            id: true,
            description: true,
            weight: true,
            trigger: {
              select: {
                id: true,
                name: true,
                spec: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                    outputType: true,
                    scope: true,
                    domain: true,
                    isActive: true,
                    sourceFeatureSet: {
                      select: { id: true, featureId: true, name: true },
                    },
                  },
                },
              },
            },
          },
        });

        // Extract unique specs
        const specMap = new Map<
          string,
          {
            id: string;
            slug: string;
            name: string;
            outputType: string;
            scope: string;
            domain: string | null;
            isActive: boolean;
            sourceFeatureSet: { id: string; featureId: string; name: string } | null;
            actionCount: number;
            triggers: string[];
          }
        >();

        for (const action of actions) {
          if (action.trigger?.spec) {
            const spec = action.trigger.spec;
            const existing = specMap.get(spec.id);
            if (existing) {
              existing.actionCount++;
              if (action.trigger.name && !existing.triggers.includes(action.trigger.name)) {
                existing.triggers.push(action.trigger.name);
              }
            } else {
              specMap.set(spec.id, {
                ...spec,
                sourceFeatureSet: spec.sourceFeatureSet || null,
                actionCount: 1,
                triggers: action.trigger.name ? [action.trigger.name] : [],
              });
            }
          }
        }

        const specs = Array.from(specMap.values());

        // Find playbooks that include these specs
        const specIds = specs.map((s) => s.id);
        const playbookItems =
          specIds.length > 0
            ? await prisma.playbookItem.findMany({
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
                        select: { id: true, name: true, slug: true },
                      },
                    },
                  },
                },
              })
            : [];

        // Dedupe playbooks
        const playbookMap = new Map<
          string,
          {
            id: string;
            name: string;
            status: string;
            domain: { id: string; name: string; slug: string } | null;
          }
        >();
        for (const item of playbookItems) {
          if (!playbookMap.has(item.playbook.id)) {
            playbookMap.set(item.playbook.id, item.playbook);
          }
        }

        // Find prompt slugs that use this parameter via PromptSlugParameter
        const promptSlugParams = await prisma.promptSlugParameter.findMany({
          where: { parameterId: param.parameterId },
          select: {
            weight: true,
            mode: true,
            sortOrder: true,
            slug: {
              select: {
                id: true,
                slug: true,
                name: true,
                memoryCategory: true,
                memoryMode: true,
                fallbackPrompt: true,
                ranges: {
                  orderBy: { sortOrder: "asc" },
                  select: {
                    id: true,
                    minValue: true,
                    maxValue: true,
                    label: true,
                    prompt: true,
                    condition: true,
                  },
                },
              },
            },
          },
        });

        const promptSlugs = promptSlugParams.map((psp) => ({
          ...psp.slug,
          weight: psp.weight,
          mode: psp.mode,
          rangeCount: psp.slug.ranges.length,
        }));

        // Return enriched parameter (without the raw tags array)
        const { tags: _tags, ...paramWithoutTags } = param;

        return {
          ...paramWithoutTags,
          isActive,
          specs,
          playbooks: Array.from(playbookMap.values()),
          promptSlugs,
          // Compute relationship counts
          _counts: {
            specs: specs.length,
            activeSpecs: specs.filter((s) => s.isActive).length,
            playbooks: playbookMap.size,
            behaviorTargets: param.behaviorTargets.length,
            promptSlugs: promptSlugs.length,
            scoringAnchors: param.scoringAnchors.length,
          },
        };
      })
    );

    // Filter orphans if requested (parameters with no relationships)
    const filteredParameters = withOrphans
      ? enrichedParameters.filter(
          (p) =>
            p._counts.specs === 0 &&
            p._counts.playbooks === 0 &&
            p._counts.behaviorTargets === 0 &&
            p._counts.promptSlugs === 0
        )
      : enrichedParameters;

    // Group by domain for summary
    const domainGroups = new Map<string, number>();
    for (const param of filteredParameters) {
      const group = param.domainGroup || "uncategorized";
      domainGroups.set(group, (domainGroups.get(group) || 0) + 1);
    }

    // Summary stats
    const summary = {
      total: filteredParameters.length,
      active: filteredParameters.filter((p) => p.isActive).length,
      withSpecs: filteredParameters.filter((p) => p._counts.specs > 0).length,
      withPlaybooks: filteredParameters.filter((p) => p._counts.playbooks > 0).length,
      withTargets: filteredParameters.filter((p) => p._counts.behaviorTargets > 0).length,
      withAnchors: filteredParameters.filter((p) => p._counts.scoringAnchors > 0).length,
      orphaned: filteredParameters.filter(
        (p) =>
          p._counts.specs === 0 &&
          p._counts.playbooks === 0 &&
          p._counts.behaviorTargets === 0 &&
          p._counts.promptSlugs === 0
      ).length,
      byDomainGroup: Object.fromEntries(domainGroups),
    };

    return NextResponse.json({
      ok: true,
      parameters: filteredParameters,
      summary,
    });
  } catch (error: unknown) {
    console.error("Error fetching parameters:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch parameters" },
      { status: 500 }
    );
  }
}
