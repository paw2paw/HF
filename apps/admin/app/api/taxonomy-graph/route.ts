import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TODO: Add proper tagging system - we may want ubiquitous tagging across all entities
// Currently Tag/ParameterTag tables exist in schema but are unpopulated
// When implemented, add "tag" back to NodeType and create tag->entity edges
type NodeType = "spec" | "parameter" | "playbook" | "domain" | "trigger" | "action" | "anchor" | "promptSlug" | "behaviorTarget" | "range";

interface NodeDetail {
  label: string;
  value: string | number | boolean | null;
}

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  slug?: string;
  group?: string;
  isOrphan?: boolean; // true if node has no edges (for top-level types only)
  details?: NodeDetail[]; // Field+value pairs shown on hover
}

interface GraphEdge {
  from: string;
  to: string;
  type: string; // "uses" | "contains" | "belongs_to" | "tagged"
}

/**
 * GET /api/taxonomy-graph
 *
 * Returns nodes and edges for the taxonomy graph visualization.
 * Optional query params:
 * - focus: node ID to center on (returns only connected nodes)
 * - depth: how many hops from focus (default 2)
 * - minimal: if "1", excludes pipeline-only implementation details (triggers, actions)
 *            These are redundant with spec→parameter edges and clutter the graph.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let focusId = searchParams.get("focus");
    const depth = parseInt(searchParams.get("depth") || "2", 10);
    const minimal = searchParams.get("minimal") === "1";

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Helper to add node if not exists
    const addNode = (node: GraphNode) => {
      if (!nodeIds.has(node.id)) {
        nodes.push(node);
        nodeIds.add(node.id);
      }
    };

    // Fetch all entities - include deeper data when focused
    const [specs, parameters, playbooks, domains, playbookItems, promptSlugs, behaviorTargets] = await Promise.all([
      prisma.analysisSpec.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          promptTemplate: true,
          domain: true,
          outputType: true,
          scope: true,
          isActive: true,
          triggers: {
            select: {
              id: true,
              name: true,
              given: true,
              when: true,
              then: true,
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
              rationale: true,
              isGold: true,
            },
            orderBy: { score: "desc" },
            take: 5, // Limit to top 5 anchors per parameter
          },
        },
      }),
      prisma.playbook.findMany({
        select: {
          id: true,
          name: true,
          domainId: true,
          status: true,
          description: true,
        },
      }),
      prisma.domain.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      }),
      prisma.playbookItem.findMany({
        where: { itemType: "SPEC" },
        select: {
          playbookId: true,
          specId: true,
        },
      }),
      prisma.promptSlug.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          memoryCategory: true,
          memoryMode: true,
          fallbackPrompt: true,
          parameters: {
            select: {
              parameterId: true,
              weight: true,
              mode: true,
            },
          },
          ranges: {
            select: {
              id: true,
              minValue: true,
              maxValue: true,
              label: true,
              prompt: true,
              condition: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      }),
      prisma.behaviorTarget.findMany({
        where: { effectiveUntil: null }, // Only active targets
        select: {
          id: true,
          scope: true,
          targetValue: true,
          confidence: true,
          source: true,
          parameterId: true,
          playbookId: true,
        },
      }),
    ]);

    // Build lookup from parameterId string to Parameter.id UUID (needed for action->param edges)
    const paramIdToUuid = new Map<string, string>();
    for (const p of parameters) {
      paramIdToUuid.set(p.parameterId, p.id);
    }

    // Convert focus parameter from "type/slug" format to "type:{uuid}" format
    // Supports: spec/slug, param/parameterId, playbook/name, domain/slug
    if (focusId && focusId.includes("/")) {
      const [focusType, focusSlug] = focusId.split("/", 2);
      if (focusType === "spec") {
        const spec = specs.find((s) => s.slug === focusSlug);
        if (spec) focusId = `spec:${spec.id}`;
      } else if (focusType === "param") {
        const param = parameters.find((p) => p.parameterId === focusSlug);
        if (param) focusId = `param:${param.id}`;
      } else if (focusType === "playbook") {
        const playbook = playbooks.find((p) => p.name === focusSlug);
        if (playbook) focusId = `playbook:${playbook.id}`;
      } else if (focusType === "domain") {
        const domain = domains.find((d) => d.slug === focusSlug);
        if (domain) focusId = `domain:${domain.id}`;
      }
    }

    // Add all nodes with details

    // Specs
    for (const spec of specs) {
      addNode({
        id: `spec:${spec.id}`,
        label: spec.slug || spec.name,
        type: "spec",
        slug: spec.slug,
        group: spec.domain || undefined,
        details: [
          { label: "Name", value: spec.name },
          { label: "Slug", value: spec.slug },
          { label: "Output Type", value: spec.outputType },
          { label: "Scope", value: spec.scope },
          { label: "Domain", value: spec.domain },
          { label: "Active", value: spec.isActive },
          { label: "Triggers", value: spec.triggers?.length || 0 },
        ].filter(d => d.value !== null && d.value !== undefined),
      });

      // Add trigger and action nodes (skip in minimal mode - these are implementation details)
      // In minimal mode, we rely on spec→parameter edges via promptSlug parameters instead
      if (!minimal) {
        for (const trigger of spec.triggers || []) {
          const triggerLabel = trigger.name || `${trigger.given?.slice(0, 20)}...`;
          addNode({
            id: `trigger:${spec.id}/${trigger.id}`,
            label: triggerLabel,
            type: "trigger",
            group: spec.domain || undefined,
            details: [
              { label: "Name", value: trigger.name },
              { label: "Given", value: trigger.given?.slice(0, 100) },
              { label: "When", value: trigger.when?.slice(0, 100) },
              { label: "Then", value: trigger.then?.slice(0, 100) },
              { label: "Actions", value: trigger.actions?.length || 0 },
            ].filter(d => d.value !== null && d.value !== undefined),
          });

          // Edge: spec -> trigger
          edges.push({
            from: `spec:${spec.id}`,
            to: `trigger:${spec.id}/${trigger.id}`,
            type: "has_trigger",
          });

          for (const action of trigger.actions || []) {
            const actionLabel = action.description?.slice(0, 25) || `Action`;
            addNode({
              id: `action:${spec.id}/${action.id}`,
              label: actionLabel,
              type: "action",
              group: spec.domain || undefined,
              details: [
                { label: "Description", value: action.description },
                { label: "Parameter", value: action.parameterId },
                { label: "Weight", value: action.weight },
              ].filter(d => d.value !== null && d.value !== undefined),
            });

            // Edge: trigger -> action
            edges.push({
              from: `trigger:${spec.id}/${trigger.id}`,
              to: `action:${spec.id}/${action.id}`,
              type: "has_action",
            });

            // Edge: action -> parameter (if exists)
            if (action.parameterId) {
              const paramUuid = paramIdToUuid.get(action.parameterId);
              if (paramUuid) {
                edges.push({
                  from: `action:${spec.id}/${action.id}`,
                  to: `param:${paramUuid}`,
                  type: "targets",
                });
              }
            }
          }
        }
      }
    }

    // Parameters
    for (const param of parameters) {
      addNode({
        id: `param:${param.id}`,
        label: param.parameterId,
        type: "parameter",
        slug: param.parameterId,
        group: param.sectionId,
        details: [
          { label: "ID", value: param.parameterId },
          { label: "Name", value: param.name },
          { label: "Domain Group", value: param.domainGroup },
          { label: "Section", value: param.sectionId },
          { label: "Scale Type", value: param.scaleType },
          { label: "Definition", value: param.definition?.slice(0, 100) || null },
          { label: "Anchors", value: param.scoringAnchors?.length || 0 },
        ].filter(d => d.value !== null && d.value !== undefined),
      });

      // Add scoring anchor nodes
      for (const anchor of param.scoringAnchors || []) {
        const anchorLabel = anchor.isGold
          ? `★ ${anchor.score.toFixed(1)}`
          : `${anchor.score.toFixed(1)}`;
        addNode({
          id: `anchor:${param.id}/${anchor.id}`,
          label: anchorLabel,
          type: "anchor",
          slug: anchor.example?.slice(0, 50),
          details: [
            { label: "Score", value: anchor.score },
            { label: "Gold", value: anchor.isGold },
            { label: "Example", value: anchor.example?.slice(0, 150) ?? null },
            { label: "Rationale", value: anchor.rationale?.slice(0, 150) ?? null },
          ].filter(d => d.value !== null && d.value !== undefined),
        });

        // Edge: parameter -> anchor
        edges.push({
          from: `param:${param.id}`,
          to: `anchor:${param.id}/${anchor.id}`,
          type: "has_anchor",
        });
      }
    }

    // Playbooks
    for (const playbook of playbooks) {
      addNode({
        id: `playbook:${playbook.id}`,
        label: playbook.name,
        type: "playbook",
        group: playbook.domainId || undefined,
        details: [
          { label: "Name", value: playbook.name },
          { label: "Status", value: playbook.status },
          { label: "Description", value: playbook.description?.slice(0, 100) ?? null },
        ].filter(d => d.value !== null && d.value !== undefined),
      });
    }

    // Domains
    for (const domain of domains) {
      addNode({
        id: `domain:${domain.id}`,
        label: domain.name,
        type: "domain",
        slug: domain.slug,
        details: [
          { label: "Name", value: domain.name },
          { label: "Slug", value: domain.slug },
          { label: "Description", value: domain.description?.slice(0, 100) ?? null },
        ].filter(d => d.value !== null && d.value !== undefined),
      });
    }

    // PromptSlugs (NEW)
    for (const slug of promptSlugs) {
      addNode({
        id: `promptSlug:${slug.id}`,
        label: slug.slug || slug.name,
        type: "promptSlug",
        slug: slug.slug,
        details: [
          { label: "Slug", value: slug.slug },
          { label: "Name", value: slug.name },
          { label: "Memory Category", value: slug.memoryCategory ?? null },
          { label: "Memory Mode", value: slug.memoryMode ?? null },
          { label: "Fallback", value: slug.fallbackPrompt?.slice(0, 100) ?? null },
          { label: "Parameters", value: slug.parameters?.length || 0 },
          { label: "Ranges", value: slug.ranges?.length || 0 },
        ].filter(d => d.value !== null && d.value !== undefined),
      });

      // Add range nodes for this slug
      for (const range of slug.ranges || []) {
        const rangeLabel = range.label || `${range.minValue}-${range.maxValue}`;
        addNode({
          id: `range:${slug.id}/${range.id}`,
          label: rangeLabel,
          type: "range",
          details: [
            { label: "Label", value: range.label ?? null },
            { label: "Min", value: range.minValue ?? null },
            { label: "Max", value: range.maxValue ?? null },
            { label: "Condition", value: range.condition ?? null },
            { label: "Prompt", value: range.prompt?.slice(0, 150) ?? null },
          ].filter(d => d.value !== null && d.value !== undefined),
        });

        // Edge: promptSlug -> range
        edges.push({
          from: `promptSlug:${slug.id}`,
          to: `range:${slug.id}/${range.id}`,
          type: "has_range",
        });
      }

      // Edge: parameter -> promptSlug (via PromptSlugParameter)
      for (const psp of slug.parameters || []) {
        const paramUuid = paramIdToUuid.get(psp.parameterId);
        if (paramUuid) {
          edges.push({
            from: `param:${paramUuid}`,
            to: `promptSlug:${slug.id}`,
            type: "used_by_slug",
          });
        }
      }
    }

    // BehaviorTargets (NEW)
    for (const target of behaviorTargets) {
      const paramUuid = paramIdToUuid.get(target.parameterId);
      const targetLabel = `${target.targetValue?.toFixed(1) || "?"} (${target.scope})`;

      addNode({
        id: `target:${target.id}`,
        label: targetLabel,
        type: "behaviorTarget",
        details: [
          { label: "Target Value", value: target.targetValue },
          { label: "Scope", value: target.scope },
          { label: "Confidence", value: target.confidence },
          { label: "Source", value: target.source },
          { label: "Parameter", value: target.parameterId },
        ].filter(d => d.value !== null && d.value !== undefined),
      });

      // Edge: parameter -> behaviorTarget
      if (paramUuid) {
        edges.push({
          from: `param:${paramUuid}`,
          to: `target:${target.id}`,
          type: "has_target",
        });
      }

      // Edge: playbook -> behaviorTarget (if scoped to playbook)
      if (target.playbookId) {
        edges.push({
          from: `playbook:${target.playbookId}`,
          to: `target:${target.id}`,
          type: "defines_target",
        });
      }
    }


    // Build additional edges

    // 1. Spec -> Parameter (direct edge for simpler view)
    for (const spec of specs) {
      // Collect unique parameter IDs from all triggers/actions
      const paramIds = new Set<string>();
      for (const trigger of spec.triggers || []) {
        for (const action of trigger.actions || []) {
          if (action.parameterId) {
            paramIds.add(action.parameterId);
          }
        }
      }
      // Create edges
      for (const paramId of paramIds) {
        const paramUuid = paramIdToUuid.get(paramId);
        if (paramUuid) {
          edges.push({
            from: `spec:${spec.id}`,
            to: `param:${paramUuid}`,
            type: "measures",
          });
        }
      }
    }

    // 2. Playbook -> Specs (via PlaybookItem)
    for (const item of playbookItems) {
      if (item.specId) {
        edges.push({
          from: `playbook:${item.playbookId}`,
          to: `spec:${item.specId}`,
          type: "contains",
        });
      }
    }

    // 3. Playbook -> Domain
    for (const playbook of playbooks) {
      if (playbook.domainId) {
        edges.push({
          from: `playbook:${playbook.id}`,
          to: `domain:${playbook.domainId}`,
          type: "belongs_to",
        });
      }
    }

    // 4. Spec domain is a string category, not a relation to Domain table
    // So we skip spec->domain edges (they don't link to Domain entities)


    // Detect orphan nodes (nodes with no edges)
    // Only flag top-level types as orphans (specs, parameters, playbooks, domains, promptSlugs)
    // Child types (triggers, actions, anchors, ranges, targets) are always connected to their parents
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    }

    const orphanTypes = new Set<NodeType>(["spec", "parameter", "playbook", "domain", "promptSlug"]);
    const orphanCounts: Record<string, number> = {};

    for (const node of nodes) {
      if (orphanTypes.has(node.type) && !connectedNodeIds.has(node.id)) {
        node.isOrphan = true;
        orphanCounts[node.type] = (orphanCounts[node.type] || 0) + 1;
      }
    }

    const totalOrphans = Object.values(orphanCounts).reduce((a, b) => a + b, 0);

    // If focus is specified, filter to only connected nodes
    if (focusId) {
      const connectedNodes = new Set<string>([focusId]);

      // BFS to find connected nodes up to depth
      let frontier = new Set<string>([focusId]);
      for (let d = 0; d < depth; d++) {
        const nextFrontier = new Set<string>();
        for (const edge of edges) {
          if (frontier.has(edge.from) && !connectedNodes.has(edge.to)) {
            nextFrontier.add(edge.to);
            connectedNodes.add(edge.to);
          }
          if (frontier.has(edge.to) && !connectedNodes.has(edge.from)) {
            nextFrontier.add(edge.from);
            connectedNodes.add(edge.from);
          }
        }
        frontier = nextFrontier;
      }

      // Filter nodes and edges
      const filteredNodes = nodes.filter((n) => connectedNodes.has(n.id));
      const filteredEdges = edges.filter(
        (e) => connectedNodes.has(e.from) && connectedNodes.has(e.to)
      );

      return NextResponse.json({
        ok: true,
        nodes: filteredNodes,
        edges: filteredEdges,
        focus: focusId,
        depth,
        counts: {
          nodes: filteredNodes.length,
          edges: filteredEdges.length,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      nodes,
      edges,
      counts: {
        nodes: nodes.length,
        edges: edges.length,
        byType: {
          specs: specs.length,
          parameters: parameters.length,
          playbooks: playbooks.length,
          domains: domains.length,
          promptSlugs: promptSlugs.length,
          behaviorTargets: behaviorTargets.length,
        },
      },
      orphans: {
        total: totalOrphans,
        byType: orphanCounts,
      },
    });
  } catch (error: any) {
    console.error("Error building taxonomy graph:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to build graph" },
      { status: 500 }
    );
  }
}
