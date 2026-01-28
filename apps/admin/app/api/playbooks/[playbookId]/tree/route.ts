import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playbooks/[playbookId]/tree
 *
 * Returns a hierarchical tree structure of the playbook including:
 * - Domain
 * - Playbook metadata
 * - PlaybookItems (specs, templates)
 *   - For each spec:
 *     - Triggers and Actions
 *     - Linked Parameters (with scoring anchors, behavior targets)
 *     - Config details
 *   - For each template:
 *     - Blocks and structure
 *
 * This provides a complete visual picture of what the playbook contains.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    // Load playbook with all nested data
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: true,
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            spec: {
              include: {
                triggers: {
                  include: {
                    actions: {
                      include: {
                        parameter: {
                          include: {
                            scoringAnchors: {
                              orderBy: { score: "asc" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            promptTemplate: true,
          },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    // Get all unique parameter IDs from specs to load behavior targets
    const parameterIds = new Set<string>();
    for (const item of playbook.items) {
      if (item.spec) {
        for (const trigger of item.spec.triggers) {
          for (const action of trigger.actions) {
            if (action.parameterId) {
              parameterIds.add(action.parameterId);
            }
          }
        }
        // Also check spec config for parameterId
        const config = item.spec.config as any;
        if (config?.parameterId) {
          parameterIds.add(config.parameterId);
        }
      }
    }

    // Load behavior targets for these parameters
    const behaviorTargets = await prisma.behaviorTarget.findMany({
      where: {
        parameterId: { in: Array.from(parameterIds) },
        effectiveUntil: null, // Only active targets
      },
      orderBy: [{ scope: "asc" }, { parameterId: "asc" }],
    });

    // Group targets by parameterId
    const targetsByParam = new Map<string, typeof behaviorTargets>();
    for (const target of behaviorTargets) {
      if (!targetsByParam.has(target.parameterId)) {
        targetsByParam.set(target.parameterId, []);
      }
      targetsByParam.get(target.parameterId)!.push(target);
    }

    // Build the tree structure
    const tree = buildPlaybookTree(playbook, targetsByParam);

    return NextResponse.json({
      ok: true,
      tree,
      stats: {
        totalItems: playbook.items.length,
        specCount: playbook.items.filter(i => i.spec).length,
        templateCount: playbook.items.filter(i => i.promptTemplate).length,
        parameterCount: parameterIds.size,
        targetCount: behaviorTargets.length,
      },
    });
  } catch (error: any) {
    console.error("Error building playbook tree:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to build playbook tree" },
      { status: 500 }
    );
  }
}

interface TreeNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
  children?: TreeNode[];
}

function buildPlaybookTree(
  playbook: any,
  targetsByParam: Map<string, any[]>
): TreeNode {
  const root: TreeNode = {
    id: playbook.id,
    type: "playbook",
    name: `${playbook.name} v${playbook.version}`,
    description: playbook.description,
    meta: {
      status: playbook.status,
      domain: playbook.domain?.name || "No domain",
      domainSlug: playbook.domain?.slug,
      measureSpecCount: playbook.measureSpecCount,
      learnSpecCount: playbook.learnSpecCount,
      adaptSpecCount: playbook.adaptSpecCount,
      parameterCount: playbook.parameterCount,
    },
    children: [],
  };

  // Check if items have groupId (new structure) or fall back to outputType grouping
  const hasGroups = playbook.items.some((item: any) => item.groupId);

  if (hasGroups) {
    // Group items by groupId for BDD/AC-based organization
    const itemsByGroup: Record<string, any[]> = {};
    const groupMeta: Record<string, { label: string; order: number }> = {};

    for (const item of playbook.items) {
      const groupId = item.groupId || "UNGROUPED";
      if (!itemsByGroup[groupId]) {
        itemsByGroup[groupId] = [];
        groupMeta[groupId] = {
          label: item.groupLabel || groupId,
          order: item.groupOrder ?? 999,
        };
      }
      itemsByGroup[groupId].push(item);
    }

    // Sort groups by order
    const sortedGroupIds = Object.keys(itemsByGroup).sort(
      (a, b) => (groupMeta[a]?.order ?? 999) - (groupMeta[b]?.order ?? 999)
    );

    for (const groupId of sortedGroupIds) {
      const items = itemsByGroup[groupId];
      const meta = groupMeta[groupId];

      const groupNode: TreeNode = {
        id: `group-${groupId}`,
        type: "group",
        name: getGroupIcon(groupId) + " " + meta.label,
        meta: { groupId, count: items.length, order: meta.order },
        children: [],
      };

      for (const item of items) {
        if (item.spec) {
          const specNode = buildSpecNode(item.spec, targetsByParam);
          groupNode.children!.push(specNode);
        } else if (item.promptTemplate) {
          const templateNode = buildTemplateNode(item.promptTemplate);
          groupNode.children!.push(templateNode);
        }
      }

      root.children!.push(groupNode);
    }
  } else {
    // Fall back to outputType-based grouping
    const itemsByType: Record<string, any[]> = {};
    for (const item of playbook.items) {
      const outputType = item.spec?.outputType || (item.promptTemplate ? "TEMPLATE" : "UNKNOWN");
      if (!itemsByType[outputType]) {
        itemsByType[outputType] = [];
      }
      itemsByType[outputType].push(item);
    }

    const typeOrder = [
      "BDD_STORY",
      "MEASURE",
      "MEASURE_AGENT",
      "LEARN",
      "AGGREGATE",
      "REWARD",
      "ADAPT",
      "COMPOSE",
      "TEMPLATE",
    ];

    for (const outputType of typeOrder) {
      const items = itemsByType[outputType];
      if (!items || items.length === 0) continue;

      const groupNode: TreeNode = {
        id: `group-${outputType}`,
        type: "group",
        name: getGroupLabel(outputType),
        meta: { outputType, count: items.length },
        children: [],
      };

      for (const item of items) {
        if (item.spec) {
          const specNode = buildSpecNode(item.spec, targetsByParam);
          groupNode.children!.push(specNode);
        } else if (item.promptTemplate) {
          const templateNode = buildTemplateNode(item.promptTemplate);
          groupNode.children!.push(templateNode);
        }
      }

      root.children!.push(groupNode);
    }
  }

  return root;
}

function getGroupIcon(groupId: string): string {
  if (groupId === "STORY") return "📋";
  if (groupId.startsWith("AC-")) return "✅";
  if (groupId === "PIPELINE") return "⚙️";
  if (groupId === "COMPOSE") return "✍️";
  if (groupId === "SLUGS") return "🏷️";
  return "📁";
}

function getGroupLabel(outputType: string): string {
  const labels: Record<string, string> = {
    BDD_STORY: "📋 BDD Stories (Acceptance Criteria)",
    MEASURE: "📊 Measure Caller",
    MEASURE_AGENT: "🤖 Measure Agent Behavior",
    LEARN: "🧠 Learn (Memory Extraction)",
    AGGREGATE: "📈 Aggregate (Personality)",
    REWARD: "🎯 Reward Computation",
    ADAPT: "🔄 Adapt (Target Learning)",
    COMPOSE: "✍️ Compose (Prompt Generation)",
    TEMPLATE: "📝 Prompt Templates",
  };
  return labels[outputType] || outputType;
}

function buildSpecNode(spec: any, targetsByParam: Map<string, any[]>): TreeNode {
  const node: TreeNode = {
    id: spec.id,
    type: "spec",
    name: spec.name,
    description: spec.description,
    meta: {
      slug: spec.slug,
      scope: spec.scope,
      outputType: spec.outputType,
      domain: spec.domain,
      priority: spec.priority,
      isActive: spec.isActive,
      hasPromptTemplate: !!spec.promptTemplate,
    },
    children: [],
  };

  // Add config summary if present
  if (spec.config) {
    const configNode = buildConfigNode(spec.config, spec.outputType);
    if (configNode.children && configNode.children.length > 0) {
      node.children!.push(configNode);
    }
  }

  // Add triggers and their actions
  if (spec.triggers && spec.triggers.length > 0) {
    for (const trigger of spec.triggers) {
      const triggerNode: TreeNode = {
        id: trigger.id,
        type: "trigger",
        name: `Trigger: ${trigger.event || "default"}`,
        meta: {
          event: trigger.event,
          condition: trigger.condition,
        },
        children: [],
      };

      for (const action of trigger.actions) {
        const actionNode = buildActionNode(action, targetsByParam);
        triggerNode.children!.push(actionNode);
      }

      if (triggerNode.children!.length > 0) {
        node.children!.push(triggerNode);
      }
    }
  }

  return node;
}

function buildConfigNode(config: any, outputType: string): TreeNode {
  const node: TreeNode = {
    id: `config-${Math.random().toString(36).slice(2)}`,
    type: "config",
    name: "⚙️ Configuration",
    children: [],
  };

  // Extract key config items based on output type
  if (outputType === "COMPOSE" && config.slugId) {
    node.children!.push({
      id: `slug-${config.slugId}`,
      type: "slug",
      name: `Slug: ${config.slugId}`,
      meta: { category: config.category },
    });
  }

  if (config.scoring) {
    node.children!.push({
      id: "scoring-config",
      type: "scoring",
      name: `Scoring: ${config.scoring.minScore}-${config.scoring.maxScore}`,
      meta: config.scoring,
    });
  }

  if (config.thresholds) {
    node.children!.push({
      id: "thresholds",
      type: "thresholds",
      name: "Thresholds",
      meta: config.thresholds,
    });
  }

  if (config.parameterId) {
    node.children!.push({
      id: `param-ref-${config.parameterId}`,
      type: "param-ref",
      name: `Parameter: ${config.parameterId}`,
    });
  }

  return node;
}

function buildActionNode(action: any, targetsByParam: Map<string, any[]>): TreeNode {
  const node: TreeNode = {
    id: action.id,
    type: "action",
    name: action.description || action.actionType || "Action",
    meta: {
      actionType: action.actionType,
      learnCategory: action.learnCategory,
      learnKeyPrefix: action.learnKeyPrefix,
    },
    children: [],
  };

  // Add parameter with scoring anchors if present
  if (action.parameter) {
    const paramNode = buildParameterNode(action.parameter, targetsByParam);
    node.children!.push(paramNode);
  }

  return node;
}

function buildParameterNode(param: any, targetsByParam: Map<string, any[]>): TreeNode {
  const targets = targetsByParam.get(param.parameterId) || [];

  const node: TreeNode = {
    id: param.id,
    type: "parameter",
    name: `📐 ${param.name}`,
    description: param.definition,
    meta: {
      parameterId: param.parameterId,
      dataType: param.dataType,
      minValue: param.minValue,
      maxValue: param.maxValue,
      tags: param.tags,
    },
    children: [],
  };

  // Add scoring anchors
  if (param.scoringAnchors && param.scoringAnchors.length > 0) {
    const anchorsNode: TreeNode = {
      id: `anchors-${param.parameterId}`,
      type: "anchor-group",
      name: `📍 Scoring Anchors (${param.scoringAnchors.length})`,
      children: param.scoringAnchors.map((anchor: any) => ({
        id: anchor.id,
        type: "anchor",
        name: `Score ${anchor.score}: ${anchor.example?.slice(0, 50) || "No example"}${anchor.example?.length > 50 ? "..." : ""}`,
        description: anchor.rationale,
        meta: {
          score: anchor.score,
          positiveSignals: anchor.positiveSignals,
          negativeSignals: anchor.negativeSignals,
        },
      })),
    };
    node.children!.push(anchorsNode);
  }

  // Add behavior targets
  if (targets.length > 0) {
    const targetsNode: TreeNode = {
      id: `targets-${param.parameterId}`,
      type: "target-group",
      name: `🎯 Behavior Targets (${targets.length})`,
      children: targets.map((target: any) => ({
        id: target.id,
        type: "target",
        name: `${target.scope}: ${target.targetValue.toFixed(2)} (conf: ${target.confidence.toFixed(2)})`,
        meta: {
          scope: target.scope,
          targetValue: target.targetValue,
          confidence: target.confidence,
          source: target.source,
        },
      })),
    };
    node.children!.push(targetsNode);
  }

  return node;
}

function buildTemplateNode(template: any): TreeNode {
  const node: TreeNode = {
    id: template.id,
    type: "template",
    name: `📝 ${template.name}`,
    description: template.description,
    meta: {
      slug: template.slug,
      version: template.version,
      isActive: template.isActive,
    },
    children: [],
  };

  return node;
}
