import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

interface TreeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  children?: TreeNode[];
}

/**
 * @api GET /api/taxonomy-tree
 * @visibility internal
 * @scope visualizations:taxonomy
 * @auth session
 * @tags visualizations
 * @description Returns a hierarchical tree of the full taxonomy:
 *   Domain -> Playbook -> Spec -> Parameter -> Anchors/Targets.
 *   Includes orphan detection for unlinked specs and parameters.
 * @response 200 { ok: true, tree: TreeNode[], stats: {...} }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const [domains, playbooks, playbookItems, specs, parameters, promptSlugs, behaviorTargets] =
      await Promise.all([
        prisma.domain.findMany({
          select: { id: true, name: true, slug: true, description: true },
          orderBy: { name: "asc" },
        }),
        prisma.playbook.findMany({
          select: {
            id: true,
            name: true,
            domainId: true,
            status: true,
            description: true,
          },
          orderBy: { name: "asc" },
        }),
        prisma.playbookItem.findMany({
          where: { itemType: "SPEC" },
          select: { playbookId: true, specId: true, sortOrder: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.analysisSpec.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            outputType: true,
            scope: true,
            isActive: true,
            triggers: {
              select: {
                id: true,
                name: true,
                actions: {
                  select: {
                    id: true,
                    description: true,
                    parameterId: true,
                    weight: true,
                  },
                },
              },
            },
          },
          orderBy: { name: "asc" },
        }),
        prisma.parameter.findMany({
          select: {
            id: true,
            parameterId: true,
            name: true,
            sectionId: true,
            domainGroup: true,
            scaleType: true,
            definition: true,
            scoringAnchors: {
              select: {
                id: true,
                score: true,
                example: true,
                isGold: true,
              },
              orderBy: { score: "asc" },
              take: 5,
            },
          },
          orderBy: { name: "asc" },
        }),
        prisma.promptSlug.findMany({
          select: {
            id: true,
            slug: true,
            name: true,
            parameters: { select: { parameterId: true, weight: true } },
            ranges: {
              select: {
                id: true,
                label: true,
                minValue: true,
                maxValue: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { slug: "asc" },
        }),
        prisma.behaviorTarget.findMany({
          where: { effectiveUntil: null },
          select: {
            id: true,
            scope: true,
            targetValue: true,
            confidence: true,
            parameterId: true,
            playbookId: true,
          },
        }),
      ]);

    // ── Lookup Maps ──────────────────────────────────────

    // parameterId string → Parameter UUID
    const paramIdToUuid = new Map<string, string>();
    for (const p of parameters) paramIdToUuid.set(p.parameterId, p.id);

    // specId → playbookIds[]
    const specToPlaybooks = new Map<string, string[]>();
    for (const item of playbookItems) {
      if (!item.specId) continue;
      const list = specToPlaybooks.get(item.specId) || [];
      list.push(item.playbookId);
      specToPlaybooks.set(item.specId, list);
    }

    // playbookId → domainId
    const playbookToDomain = new Map<string, string>();
    for (const pb of playbooks) {
      if (pb.domainId) playbookToDomain.set(pb.id, pb.domainId);
    }

    // domainId → playbooks
    const domainPlaybooks = new Map<string, typeof playbooks>();
    for (const pb of playbooks) {
      const domId = pb.domainId || "__none__";
      const list = domainPlaybooks.get(domId) || [];
      list.push(pb);
      domainPlaybooks.set(domId, list);
    }

    // playbookId → specIds (ordered)
    const playbookSpecs = new Map<string, string[]>();
    for (const item of playbookItems) {
      if (!item.specId) continue;
      const list = playbookSpecs.get(item.playbookId) || [];
      list.push(item.specId);
      playbookSpecs.set(item.playbookId, list);
    }

    // specId → spec object
    const specMap = new Map(specs.map((s) => [s.id, s]));

    // parameterId string → parameter object
    const paramBySemanticId = new Map(parameters.map((p) => [p.parameterId, p]));

    // Collect all parameterIds referenced by spec actions
    const referencedParamIds = new Set<string>();
    for (const spec of specs) {
      for (const trigger of spec.triggers) {
        for (const action of trigger.actions) {
          if (action.parameterId) referencedParamIds.add(action.parameterId);
        }
      }
    }

    // parameterId → behaviorTargets
    const targetsByParamId = new Map<string, typeof behaviorTargets>();
    for (const t of behaviorTargets) {
      const list = targetsByParamId.get(t.parameterId) || [];
      list.push(t);
      targetsByParamId.set(t.parameterId, list);
    }

    // parameterId → promptSlugs (via PromptSlugParameter)
    const slugsByParamId = new Map<string, typeof promptSlugs>();
    for (const slug of promptSlugs) {
      for (const psp of slug.parameters) {
        const list = slugsByParamId.get(psp.parameterId) || [];
        list.push(slug);
        slugsByParamId.set(psp.parameterId, list);
      }
    }

    // ── Tree Building ────────────────────────────────────

    function buildParameterNode(paramId: string): TreeNode | null {
      const param = paramBySemanticId.get(paramId);
      if (!param) return null;

      const children: TreeNode[] = [];

      // Scoring anchors
      if (param.scoringAnchors.length > 0) {
        children.push({
          id: `anchors-${param.parameterId}`,
          type: "anchor-group",
          name: `Scoring Anchors (${param.scoringAnchors.length})`,
          children: param.scoringAnchors.map((a) => ({
            id: a.id,
            type: "anchor",
            name: `Score ${a.score}: ${a.example?.slice(0, 60) || "No example"}${(a.example?.length || 0) > 60 ? "..." : ""}`,
            meta: { score: a.score, isGold: a.isGold },
          })),
        });
      }

      // Behavior targets
      const targets = targetsByParamId.get(paramId) || [];
      if (targets.length > 0) {
        children.push({
          id: `targets-${param.parameterId}`,
          type: "target-group",
          name: `Behavior Targets (${targets.length})`,
          children: targets.map((t) => ({
            id: t.id,
            type: "target",
            name: `${t.scope}: ${t.targetValue?.toFixed(2) ?? "?"} (conf: ${t.confidence?.toFixed(2) ?? "?"})`,
            meta: { scope: t.scope, targetValue: t.targetValue, confidence: t.confidence },
          })),
        });
      }

      // Prompt slugs that reference this parameter
      const slugs = slugsByParamId.get(paramId) || [];
      for (const slug of slugs) {
        const slugChildren: TreeNode[] = slug.ranges.map((r) => ({
          id: r.id,
          type: "slug",
          name: r.label || `${r.minValue}-${r.maxValue}`,
          meta: { minValue: r.minValue, maxValue: r.maxValue },
        }));
        children.push({
          id: slug.id,
          type: "slug",
          name: slug.slug || slug.name,
          meta: { ranges: slug.ranges.length },
          children: slugChildren.length > 0 ? slugChildren : undefined,
        });
      }

      return {
        id: param.id,
        type: "parameter",
        name: param.name,
        description: param.definition?.slice(0, 200) || undefined,
        meta: {
          parameterId: param.parameterId,
          domainGroup: param.domainGroup,
          section: param.sectionId,
          scaleType: param.scaleType,
        },
        children: children.length > 0 ? children : undefined,
      };
    }

    function buildSpecNode(spec: typeof specs[0]): TreeNode {
      const children: TreeNode[] = [];

      // Collect unique parameterIds from this spec's actions
      const paramIds = new Set<string>();
      for (const trigger of spec.triggers) {
        for (const action of trigger.actions) {
          if (action.parameterId) paramIds.add(action.parameterId);
        }
      }

      for (const paramId of paramIds) {
        const paramNode = buildParameterNode(paramId);
        if (paramNode) children.push(paramNode);
      }

      return {
        id: spec.id,
        type: "spec",
        name: spec.name,
        meta: {
          slug: spec.slug,
          outputType: spec.outputType,
          scope: spec.scope,
          isActive: spec.isActive,
          parameters: paramIds.size,
        },
        children: children.length > 0 ? children : undefined,
      };
    }

    function buildPlaybookNode(pb: typeof playbooks[0]): TreeNode {
      const specIds = playbookSpecs.get(pb.id) || [];

      // Group specs by outputType
      const specsByOutput = new Map<string, TreeNode[]>();
      for (const specId of specIds) {
        const spec = specMap.get(specId);
        if (!spec) continue;
        const outputType = spec.outputType || "OTHER";
        const list = specsByOutput.get(outputType) || [];
        list.push(buildSpecNode(spec));
        specsByOutput.set(outputType, list);
      }

      const children: TreeNode[] = [];
      const outputOrder = ["MEASURE", "MEASURE_AGENT", "LEARN", "AGGREGATE", "REWARD", "ADAPT", "COMPOSE", "OTHER"];
      for (const ot of outputOrder) {
        const specNodes = specsByOutput.get(ot);
        if (!specNodes || specNodes.length === 0) continue;
        children.push({
          id: `${pb.id}-group-${ot}`,
          type: "output-group",
          name: getOutputLabel(ot),
          meta: { outputType: ot, count: specNodes.length },
          children: specNodes,
        });
      }

      return {
        id: pb.id,
        type: "playbook",
        name: pb.name,
        description: pb.description || undefined,
        meta: { status: pb.status, specs: specIds.length },
        children: children.length > 0 ? children : undefined,
      };
    }

    // Build tree root: one node per domain
    const tree: TreeNode[] = [];

    for (const domain of domains) {
      const pbs = domainPlaybooks.get(domain.id) || [];
      const pbNodes = pbs.map(buildPlaybookNode);

      tree.push({
        id: domain.id,
        type: "domain",
        name: domain.name,
        description: domain.description || undefined,
        meta: { slug: domain.slug, playbooks: pbs.length },
        children: pbNodes.length > 0 ? pbNodes : undefined,
      });
    }

    // Playbooks with no domain
    const noDomainPlaybooks = domainPlaybooks.get("__none__") || [];
    if (noDomainPlaybooks.length > 0) {
      tree.push({
        id: "no-domain-playbooks",
        type: "group",
        name: `Unassigned Playbooks (${noDomainPlaybooks.length})`,
        meta: { isOrphan: true },
        children: noDomainPlaybooks.map(buildPlaybookNode),
      });
    }

    // ── Orphan Detection ─────────────────────────────────

    // Specs not in any playbook
    const orphanSpecs = specs.filter((s) => !specToPlaybooks.has(s.id));
    if (orphanSpecs.length > 0) {
      tree.push({
        id: "orphan-specs",
        type: "group",
        name: `Orphan Specs (${orphanSpecs.length})`,
        meta: { isOrphan: true },
        children: orphanSpecs.map(buildSpecNode),
      });
    }

    // Parameters not referenced by any spec action
    const orphanParams = parameters.filter((p) => !referencedParamIds.has(p.parameterId));
    if (orphanParams.length > 0) {
      tree.push({
        id: "orphan-params",
        type: "group",
        name: `Orphan Parameters (${orphanParams.length})`,
        meta: { isOrphan: true },
        children: orphanParams.map((p) => ({
          id: p.id,
          type: "parameter",
          name: p.name,
          description: p.definition?.slice(0, 200) || undefined,
          meta: {
            parameterId: p.parameterId,
            domainGroup: p.domainGroup,
            section: p.sectionId,
          },
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      tree,
      stats: {
        domains: domains.length,
        playbooks: playbooks.length,
        specs: specs.length,
        parameters: parameters.length,
        promptSlugs: promptSlugs.length,
        orphanSpecs: orphanSpecs.length,
        orphanParameters: orphanParams.length,
      },
    });
  } catch (error: any) {
    console.error("Error building taxonomy tree:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to build taxonomy tree" },
      { status: 500 }
    );
  }
}

function getOutputLabel(outputType: string): string {
  const labels: Record<string, string> = {
    MEASURE: "Measure Caller",
    MEASURE_AGENT: "Measure Agent Behavior",
    LEARN: "Learn (Memory Extraction)",
    AGGREGATE: "Aggregate (Personality)",
    REWARD: "Reward Computation",
    ADAPT: "Adapt (Target Learning)",
    COMPOSE: "Compose (Prompt Generation)",
    OTHER: "Other",
  };
  return labels[outputType] || outputType;
}
