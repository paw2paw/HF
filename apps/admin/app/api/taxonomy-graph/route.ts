import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TODO: Add proper tagging system - we may want ubiquitous tagging across all entities
// Currently Tag/ParameterTag tables exist in schema but are unpopulated
// When implemented, add "tag" back to NodeType and create tag->entity edges
type NodeType = "spec" | "parameter" | "playbook" | "domain" | "trigger" | "action" | "anchor";

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  slug?: string;
  group?: string;
  isOrphan?: boolean; // true if node has no edges (for top-level types only)
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
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const focusId = searchParams.get("focus");
    const depth = parseInt(searchParams.get("depth") || "2", 10);

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
    const [specs, parameters, playbooks, domains, playbookItems] = await Promise.all([
      prisma.analysisSpec.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          promptTemplate: true,
          domain: true,
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
          scoringAnchors: {
            select: {
              id: true,
              score: true,
              example: true,
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
        },
      }),
      prisma.domain.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
      prisma.playbookItem.findMany({
        where: { itemType: "SPEC" },
        select: {
          playbookId: true,
          specId: true,
        },
      }),
    ]);

    // Build lookup from parameterId string to Parameter.id UUID (needed for action->param edges)
    const paramIdToUuid = new Map<string, string>();
    for (const p of parameters) {
      paramIdToUuid.set(p.parameterId, p.id);
    }

    // Add all nodes
    for (const spec of specs) {
      addNode({
        id: `spec:${spec.id}`,
        label: spec.slug || spec.name,
        type: "spec",
        slug: spec.slug,
        group: spec.domain || undefined,
      });

      // Add trigger and action nodes (these create more detail when focused)
      for (const trigger of spec.triggers || []) {
        const triggerLabel = trigger.name || `${trigger.given?.slice(0, 20)}...`;
        addNode({
          id: `trigger:${spec.id}/${trigger.id}`,
          label: triggerLabel,
          type: "trigger",
          group: spec.domain || undefined,
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

    for (const param of parameters) {
      addNode({
        id: `param:${param.id}`,
        label: param.parameterId,
        type: "parameter",
        slug: param.parameterId,
        group: param.sectionId,
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
        });

        // Edge: parameter -> anchor
        edges.push({
          from: `param:${param.id}`,
          to: `anchor:${param.id}/${anchor.id}`,
          type: "has_anchor",
        });
      }
    }

    for (const playbook of playbooks) {
      addNode({
        id: `playbook:${playbook.id}`,
        label: playbook.name,
        type: "playbook",
        group: playbook.domainId || undefined,
      });
    }

    for (const domain of domains) {
      addNode({
        id: `domain:${domain.id}`,
        label: domain.name,
        type: "domain",
        slug: domain.slug,
      });
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
    // Only flag top-level types as orphans (specs, parameters, playbooks, domains, tags)
    // Child types (triggers, actions, anchors) are always connected to their parents
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    }

    const orphanTypes = new Set<NodeType>(["spec", "parameter", "playbook", "domain"]);
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
