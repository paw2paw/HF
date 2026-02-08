import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/specs/tree
 *
 * Returns a hierarchical tree structure of ALL specs grouped by:
 * - Domain (personality, memory, engagement, etc.)
 *   - Scope (SYSTEM, DOMAIN, CALLER)
 *     - OutputType (MEASURE, LEARN, ADAPT, COMPOSE, AGGREGATE, REWARD)
 *       - Individual specs with triggers, actions, parameters
 *
 * Query params:
 * - active: "true" | "false" | "all" (default "all")
 */

interface TreeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  children?: TreeNode[];
}

const OUTPUT_TYPE_ORDER = ["MEASURE", "LEARN", "ADAPT", "COMPOSE", "AGGREGATE", "REWARD"];
const SCOPE_ORDER = ["SYSTEM", "DOMAIN", "CALLER"];

const outputTypeLabels: Record<string, string> = {
  MEASURE: "Measure",
  LEARN: "Learn",
  ADAPT: "Adapt",
  COMPOSE: "Compose",
  AGGREGATE: "Aggregate",
  REWARD: "Reward",
};

const scopeLabels: Record<string, string> = {
  SYSTEM: "System-wide",
  DOMAIN: "Per-Domain",
  CALLER: "Per-Caller",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const activeFilter = url.searchParams.get("active") || "all";

    // Build where clause
    const where: any = {};
    if (activeFilter === "true") {
      where.isActive = true;
    } else if (activeFilter === "false") {
      where.isActive = false;
    }

    // Load all specs with full nested data
    const specs = await prisma.analysisSpec.findMany({
      where,
      orderBy: [{ domain: "asc" }, { scope: "asc" }, { outputType: "asc" }, { name: "asc" }],
      include: {
        triggers: {
          orderBy: { sortOrder: "asc" },
          include: {
            actions: {
              orderBy: { sortOrder: "asc" },
              include: {
                parameter: {
                  include: {
                    scoringAnchors: {
                      orderBy: [{ score: "asc" }, { sortOrder: "asc" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Group specs by domain -> scope -> outputType
    const domainMap = new Map<string, Map<string, Map<string, typeof specs>>>();

    for (const spec of specs) {
      const domain = spec.domain || "(no domain)";
      const scope = spec.scope;
      const outputType = spec.outputType;

      if (!domainMap.has(domain)) {
        domainMap.set(domain, new Map());
      }
      const scopeMap = domainMap.get(domain)!;

      if (!scopeMap.has(scope)) {
        scopeMap.set(scope, new Map());
      }
      const outputTypeMap = scopeMap.get(scope)!;

      if (!outputTypeMap.has(outputType)) {
        outputTypeMap.set(outputType, []);
      }
      outputTypeMap.get(outputType)!.push(spec);
    }

    // Build tree structure
    const domainNodes: TreeNode[] = [];

    // Sort domains alphabetically, but put "(no domain)" last
    const sortedDomains = Array.from(domainMap.keys()).sort((a, b) => {
      if (a === "(no domain)") return 1;
      if (b === "(no domain)") return -1;
      return a.localeCompare(b);
    });

    for (const domain of sortedDomains) {
      const scopeMap = domainMap.get(domain)!;
      const scopeNodes: TreeNode[] = [];

      // Sort scopes in defined order
      const sortedScopes = Array.from(scopeMap.keys()).sort(
        (a, b) => SCOPE_ORDER.indexOf(a) - SCOPE_ORDER.indexOf(b)
      );

      for (const scope of sortedScopes) {
        const outputTypeMap = scopeMap.get(scope)!;
        const outputTypeNodes: TreeNode[] = [];

        // Sort output types in defined order
        const sortedOutputTypes = Array.from(outputTypeMap.keys()).sort(
          (a, b) => OUTPUT_TYPE_ORDER.indexOf(a) - OUTPUT_TYPE_ORDER.indexOf(b)
        );

        for (const outputType of sortedOutputTypes) {
          const specsInGroup = outputTypeMap.get(outputType)!;
          const specNodes: TreeNode[] = specsInGroup.map((spec) => buildSpecNode(spec));

          outputTypeNodes.push({
            id: `output-${domain}-${scope}-${outputType}`,
            type: "output-group",
            name: `${outputTypeLabels[outputType] || outputType} (${specsInGroup.length})`,
            meta: {
              outputType,
              count: specsInGroup.length,
            },
            children: specNodes,
          });
        }

        // Count total specs in this scope
        const scopeSpecCount = Array.from(outputTypeMap.values()).reduce(
          (sum, arr) => sum + arr.length,
          0
        );

        // Map scope to specific node type for distinct icons
        const scopeNodeType = scope === "SYSTEM" ? "scope-system"
          : scope === "DOMAIN" ? "scope-domain"
          : scope === "CALLER" ? "scope-caller"
          : "scope";

        scopeNodes.push({
          id: `scope-${domain}-${scope}`,
          type: scopeNodeType,
          name: `${scopeLabels[scope] || scope} (${scopeSpecCount})`,
          meta: {
            scope,
            count: scopeSpecCount,
          },
          children: outputTypeNodes,
        });
      }

      // Count total specs in this domain
      const domainSpecCount = scopeNodes.reduce(
        (sum, node) => sum + (node.meta?.count || 0),
        0
      );

      domainNodes.push({
        id: `domain-${domain}`,
        type: "domain",
        name: `${domain === "(no domain)" ? "Uncategorized" : capitalizeFirst(domain)} (${domainSpecCount})`,
        meta: {
          domain: domain === "(no domain)" ? null : domain,
          count: domainSpecCount,
        },
        children: scopeNodes,
      });
    }

    // Build root node
    const tree: TreeNode = {
      id: "root",
      type: "root",
      name: `All Specs (${specs.length})`,
      meta: {
        totalSpecs: specs.length,
      },
      children: domainNodes,
    };

    // Build stats
    const stats = {
      total: specs.length,
      byDomain: {} as Record<string, number>,
      byScope: {} as Record<string, number>,
      byOutputType: {} as Record<string, number>,
    };

    for (const spec of specs) {
      const domain = spec.domain || "(no domain)";
      stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;
      stats.byScope[spec.scope] = (stats.byScope[spec.scope] || 0) + 1;
      stats.byOutputType[spec.outputType] = (stats.byOutputType[spec.outputType] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      tree,
      stats,
    });
  } catch (error: any) {
    console.error("Error building specs tree:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to build specs tree" },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function buildSpecNode(spec: any): TreeNode {
  const children: TreeNode[] = [];

  // Add triggers
  if (spec.triggers && spec.triggers.length > 0) {
    for (const trigger of spec.triggers) {
      const triggerChildren: TreeNode[] = [];

      // Add actions
      if (trigger.actions && trigger.actions.length > 0) {
        for (const action of trigger.actions) {
          const actionChildren: TreeNode[] = [];

          // Add learn config if present
          if (action.learnCategory) {
            actionChildren.push({
              id: `learn-${action.id}`,
              type: "learn-config",
              name: `Learn: ${action.learnCategory}`,
              meta: {
                category: action.learnCategory,
                keyPrefix: action.learnKeyPrefix,
                keyHint: action.learnKeyHint,
              },
            });
          }

          // Add parameter if present
          if (action.parameter) {
            const param = action.parameter;
            const paramChildren: TreeNode[] = [];

            // Add scoring anchors
            if (param.scoringAnchors && param.scoringAnchors.length > 0) {
              const anchorNodes: TreeNode[] = param.scoringAnchors.map((anchor: any) => ({
                id: `anchor-${anchor.id}`,
                type: "anchor",
                name: `Score ${anchor.score}: ${truncate(anchor.example || "(no example)", 40)}`,
                description: anchor.rationale,
                meta: {
                  score: anchor.score,
                  isGold: anchor.isGold,
                  positiveSignals: anchor.positiveSignals,
                  negativeSignals: anchor.negativeSignals,
                },
              }));

              paramChildren.push({
                id: `anchors-${param.parameterId}`,
                type: "anchor-group",
                name: `Scoring Anchors (${param.scoringAnchors.length})`,
                meta: { count: param.scoringAnchors.length },
                children: anchorNodes,
              });
            }

            actionChildren.push({
              id: `param-${action.id}-${param.parameterId}`,
              type: "parameter",
              name: param.name,
              description: param.definition,
              meta: {
                parameterId: param.parameterId,
                scaleType: param.scaleType,
                interpretationHigh: param.interpretationHigh,
                interpretationLow: param.interpretationLow,
              },
              children: paramChildren.length > 0 ? paramChildren : undefined,
            });
          }

          // Add instruction if no parameter and has description
          if (!action.parameter && action.description) {
            actionChildren.push({
              id: `instruction-${action.id}`,
              type: "instruction",
              name: truncate(action.description, 50),
              meta: {
                fullText: action.description,
              },
            });
          }

          triggerChildren.push({
            id: `action-${action.id}`,
            type: "action",
            name: action.description || action.actionType || "Action",
            meta: {
              actionType: action.actionType,
              weight: action.weight !== 1.0 ? action.weight : undefined,
            },
            children: actionChildren.length > 0 ? actionChildren : undefined,
          });
        }
      }

      children.push({
        id: `trigger-${trigger.id}`,
        type: "trigger",
        name: trigger.name || "Trigger",
        description: buildTriggerDescription(trigger),
        meta: {
          given: trigger.given,
          when: trigger.when,
          then: trigger.then,
        },
        children: triggerChildren.length > 0 ? triggerChildren : undefined,
      });
    }
  }

  // Add prompt template preview if exists
  if (spec.promptTemplate) {
    children.push({
      id: `template-${spec.id}`,
      type: "template-content",
      name: `Template: ${truncate(spec.promptTemplate, 50)}`,
      meta: {
        fullTemplate: spec.promptTemplate,
        length: spec.promptTemplate.length,
      },
    });
  }

  return {
    id: `spec-${spec.id}`,
    type: "spec",
    name: spec.name,
    description: spec.description,
    meta: {
      specId: spec.id,
      slug: spec.slug,
      scope: spec.scope,
      outputType: spec.outputType,
      specRole: spec.specRole,
      domain: spec.domain,
      priority: spec.priority,
      isActive: spec.isActive,
      isLocked: spec.isLocked,
      version: spec.version,
      triggerCount: spec.triggers?.length || 0,
    },
    children: children.length > 0 ? children : undefined,
  };
}

function buildTriggerDescription(trigger: any): string {
  const parts: string[] = [];
  if (trigger.given) parts.push(`Given: ${truncate(trigger.given, 30)}`);
  if (trigger.when) parts.push(`When: ${truncate(trigger.when, 30)}`);
  if (trigger.then) parts.push(`Then: ${truncate(trigger.then, 30)}`);
  return parts.join(" | ") || undefined as any;
}

function truncate(str: string, maxLen: number): string {
  if (!str) return str;
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
