import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import type { SpecConfig } from "@/lib/types/json-fields";

/**
 * @api GET /api/playbooks/:playbookId/tree
 * @visibility public
 * @scope playbooks:read
 * @auth session
 * @tags playbooks
 * @description Returns a hierarchical tree structure of the playbook including domain,
 *   metadata, items (specs with triggers/actions/parameters/anchors, templates),
 *   system specs, and behavior targets. Provides a complete visual picture of playbook contents.
 * @pathParam playbookId string - Playbook UUID
 * @response 200 { ok: true, tree: TreeNode, stats: { totalItems, specCount, templateCount, systemSpecCount, systemSpecEnabledCount, parameterCount, targetCount } }
 * @response 404 { ok: false, error: "Playbook not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { playbookId } = await params;

    // Load playbook with all nested data
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: true,
        // agent: removed - FK relation deprecated, agentId is now just a string reference
        // curriculum: removed - FK relation no longer exists on Playbook model
        // specs: removed - PlaybookSystemSpec model no longer exists, system specs are implicitly included
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

    // Load ALL SYSTEM specs directly (not from PlaybookSystemSpec)
    // These are platform-managed specs that apply to all playbooks
    const allSystemSpecs = await prisma.analysisSpec.findMany({
      where: {
        specType: "SYSTEM",
        isActive: true,
      },
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
      orderBy: [{ outputType: "asc" }, { name: "asc" }],
    });

    // Create system specs array with enabled state
    // Note: PlaybookSystemSpec model was removed - all system specs are now implicitly enabled
    const systemSpecsWithState = allSystemSpecs.map((spec) => ({
      spec,
      isEnabled: true, // All system specs are enabled by default
    }));

    // Get all unique parameter IDs from specs to load behavior targets
    const parameterIds = new Set<string>();

    // Collect from playbook items (DOMAIN specs)
    for (const item of playbook.items) {
      if (item.spec) {
        for (const trigger of item.spec.triggers) {
          for (const action of trigger.actions) {
            if (action.parameterId) {
              parameterIds.add(action.parameterId);
            }
          }
        }
        const config = item.spec.config as SpecConfig;
        if (config?.parameterId) {
          parameterIds.add(config.parameterId);
        }
      }
    }

    // Collect from system specs
    for (const ss of systemSpecsWithState) {
      if (ss.spec) {
        for (const trigger of ss.spec.triggers) {
          for (const action of trigger.actions) {
            if (action.parameterId) {
              parameterIds.add(action.parameterId);
            }
          }
        }
        const config = ss.spec.config as SpecConfig;
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
    const tree = buildPlaybookTree(playbook, targetsByParam, systemSpecsWithState);

    const enabledCount = systemSpecsWithState.filter((s) => s.isEnabled).length;
    return NextResponse.json({
      ok: true,
      tree,
      stats: {
        totalItems: playbook.items.length,
        specCount: playbook.items.filter((i: any) => i.spec).length,
        templateCount: playbook.items.filter((i: any) => i.promptTemplate).length,
        systemSpecCount: systemSpecsWithState.length,
        systemSpecEnabledCount: enabledCount,
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
  targetsByParam: Map<string, any[]>,
  systemSpecs: Array<{ spec: any; isEnabled: boolean }>
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
      // agent: deprecated - identity comes from PlaybookItems with specRole=IDENTITY
      agentId: playbook.agentId || undefined, // String reference only (no FK)
      curriculum: playbook.curriculum?.name,
      curriculumSlug: playbook.curriculum?.slug,
      measureSpecCount: playbook.measureSpecCount,
      learnSpecCount: playbook.learnSpecCount,
      adaptSpecCount: playbook.adaptSpecCount,
      parameterCount: playbook.parameterCount,
    },
    children: [],
  };

  // Add System Specs group first (platform-managed specs with ON/OFF toggles)
  const enabledSystemSpecs = systemSpecs.filter((ss) => ss.isEnabled);
  if (systemSpecs.length > 0) {
    const systemSpecsGroup: TreeNode = {
      id: "group-SYSTEM",
      type: "group",
      name: `System Specs (${enabledSystemSpecs.length}/${systemSpecs.length} enabled)`,
      meta: {
        outputType: "SYSTEM",
        count: systemSpecs.length,
        enabledCount: enabledSystemSpecs.length,
      },
      children: [],
    };

    // Group system specs by outputType
    const systemByOutput: Record<string, typeof systemSpecs> = {};
    for (const ss of systemSpecs) {
      if (ss.spec) {
        const outputType = ss.spec.outputType || "OTHER";
        if (!systemByOutput[outputType]) systemByOutput[outputType] = [];
        systemByOutput[outputType].push(ss);
      }
    }

    const outputOrder = ["MEASURE", "LEARN", "ADAPT", "COMPOSE", "AGGREGATE", "REWARD", "OTHER"];
    for (const outputType of outputOrder) {
      const specs = systemByOutput[outputType];
      if (!specs || specs.length === 0) continue;

      const outputNode: TreeNode = {
        id: `system-${outputType}`,
        type: "output-group",
        name: `${outputType} (${specs.filter((s) => s.isEnabled).length}/${specs.length})`,
        meta: { outputType },
        children: [],
      };

      for (const ss of specs) {
        const specNode = buildSpecNode(ss.spec, targetsByParam);
        specNode.meta = {
          ...specNode.meta,
          isEnabled: ss.isEnabled,
          isSystemSpec: true,
        };
        if (!ss.isEnabled) {
          specNode.name = `🚫 ${specNode.name}`;
        }
        outputNode.children!.push(specNode);
      }

      systemSpecsGroup.children!.push(outputNode);
    }

    root.children!.push(systemSpecsGroup);
  }

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
        name: meta.label,
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
  // Icons are now handled by nodeIcons in ExplorerTree.tsx
  // Return empty string to avoid double icons
  return "";
}

function getGroupLabel(outputType: string): string {
  // Icons are handled by nodeIcons in ExplorerTree.tsx - don't embed emojis here
  const labels: Record<string, string> = {
    BDD_STORY: "BDD Stories (Acceptance Criteria)",
    MEASURE: "Measure Caller",
    MEASURE_AGENT: "Measure Agent Behavior",
    LEARN: "Learn (Memory Extraction)",
    AGGREGATE: "Aggregate (Personality)",
    REWARD: "Reward Computation",
    ADAPT: "Adapt (Target Learning)",
    COMPOSE: "Compose (Prompt Generation)",
    TEMPLATE: "Prompt Templates",
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

  // Add prompt template summary if present (this is key content!)
  if (spec.promptTemplate) {
    const templatePreview = spec.promptTemplate.slice(0, 200).replace(/\n/g, " ").trim();
    node.children!.push({
      id: `template-${spec.id}`,
      type: "template-content",
      name: `Template: ${templatePreview}${spec.promptTemplate.length > 200 ? "..." : ""}`,
      meta: {
        fullTemplate: spec.promptTemplate,
        length: spec.promptTemplate.length,
      },
    });
  }

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

      if (trigger.actions && trigger.actions.length > 0) {
        for (const action of trigger.actions) {
          const actionNode = buildActionNode(action, targetsByParam);
          triggerNode.children!.push(actionNode);
        }
      } else {
        // Show that trigger has no actions configured
        triggerNode.children!.push({
          id: `no-actions-${trigger.id}`,
          type: "info",
          name: "No actions configured",
        });
      }

      node.children!.push(triggerNode);
    }
  }

  // If spec still has no children, add an info node so it's not empty
  if (node.children!.length === 0 && spec.description) {
    node.children!.push({
      id: `info-${spec.id}`,
      type: "info",
      name: spec.description.slice(0, 100) + (spec.description.length > 100 ? "..." : ""),
      meta: { fullDescription: spec.description },
    });
  }

  return node;
}

function buildConfigNode(config: any, outputType: string): TreeNode {
  const node: TreeNode = {
    id: `config-${Math.random().toString(36).slice(2)}`,
    type: "config",
    name: "Configuration",
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
      weight: action.weight !== 1.0 ? action.weight : undefined,
    },
    children: [],
  };

  // Add LEARN-specific info as child nodes
  if (action.learnCategory || action.learnKeyPrefix || action.learnKeyHint) {
    const learnNode: TreeNode = {
      id: `learn-${action.id}`,
      type: "learn-config",
      name: `Learn: ${action.learnCategory || "memory"}`,
      meta: {
        category: action.learnCategory,
        keyPrefix: action.learnKeyPrefix,
        keyHint: action.learnKeyHint,
      },
      children: [],
    };

    if (action.learnKeyPrefix) {
      learnNode.children!.push({
        id: `prefix-${action.id}`,
        type: "config-item",
        name: `Key prefix: "${action.learnKeyPrefix}"`,
      });
    }
    if (action.learnKeyHint) {
      learnNode.children!.push({
        id: `hint-${action.id}`,
        type: "config-item",
        name: `Hint: ${action.learnKeyHint}`,
      });
    }
    node.children!.push(learnNode);
  }

  // Add parameter with scoring anchors if present (MEASURE actions)
  if (action.parameter) {
    const paramNode = buildParameterNode(action.parameter, targetsByParam);
    node.children!.push(paramNode);
  }

  // If action still has no children, it's a simple instruction/guideline
  // Add the full description as content so it's not empty
  if (node.children!.length === 0 && action.description) {
    node.children!.push({
      id: `desc-${action.id}`,
      type: "instruction",
      name: action.description,
      meta: {
        fullText: action.description,
        weight: action.weight,
        sortOrder: action.sortOrder,
      },
    });
  }

  return node;
}

function buildParameterNode(param: any, targetsByParam: Map<string, any[]>): TreeNode {
  const targets = targetsByParam.get(param.parameterId) || [];

  const node: TreeNode = {
    id: param.id,
    type: "parameter",
    name: param.name,
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
      name: `Scoring Anchors (${param.scoringAnchors.length})`,
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
      name: `Behavior Targets (${targets.length})`,
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
    name: template.name,
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
