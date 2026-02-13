import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/playbooks/:playbookId/slugs
 * @visibility internal
 * @scope playbooks:read
 * @auth session
 * @tags playbooks
 * @description Returns a structured tree of all template variables/slugs available in this
 *   playbook. Shows what variables are available at runtime, which spec provides each,
 *   what values they resolve to, and what data MEASURE/LEARN/ADAPT specs produce.
 * @pathParam playbookId string - Playbook UUID
 * @response 200 { ok: true, playbook: { id, name, status }, tree: SlugNode[], counts: { identity, content, voice, measure, learn, adapt, reward, guardrail, compose, total } }
 * @response 404 { ok: false, error: "Playbook not found" }
 * @response 500 { ok: false, error: "..." }
 */

type SlugNode = {
  id: string;
  type: "category" | "spec" | "variable" | "value" | "produces";
  name: string;
  path?: string; // e.g., "{identity.role_statement}"
  value?: string | number | boolean | null;
  specId?: string;
  specSlug?: string;
  children?: SlugNode[];
  meta?: Record<string, any>;
};

// Recursively extract keys from an object into slug nodes
function extractConfigSlugs(
  obj: any,
  prefix: string,
  specId: string,
  specSlug: string
): SlugNode[] {
  if (obj === null || obj === undefined) return [];

  const nodes: SlugNode[] = [];

  if (Array.isArray(obj)) {
    // For arrays, show count and first few items
    const arrayNode: SlugNode = {
      id: `${specId}-${prefix}`,
      type: "variable",
      name: prefix.split(".").pop() || prefix,
      path: `{${prefix}}`,
      specId,
      specSlug,
      meta: { isArray: true, count: obj.length },
      children: [],
    };

    // Show first 3 items as examples
    obj.slice(0, 3).forEach((item, idx) => {
      if (typeof item === "object" && item !== null) {
        const itemNode: SlugNode = {
          id: `${specId}-${prefix}-${idx}`,
          type: "value",
          name: `[${idx}]`,
          path: `{${prefix}[${idx}]}`,
          specId,
          specSlug,
          children: extractConfigSlugs(item, `${prefix}[${idx}]`, specId, specSlug),
        };
        arrayNode.children!.push(itemNode);
      } else {
        arrayNode.children!.push({
          id: `${specId}-${prefix}-${idx}`,
          type: "value",
          name: `[${idx}]`,
          path: `{${prefix}[${idx}]}`,
          value: item,
          specId,
          specSlug,
        });
      }
    });

    if (obj.length > 3) {
      arrayNode.children!.push({
        id: `${specId}-${prefix}-more`,
        type: "value",
        name: `... and ${obj.length - 3} more`,
        specId,
        specSlug,
      });
    }

    nodes.push(arrayNode);
  } else if (typeof obj === "object") {
    // For objects, recurse into each key
    for (const [key, value] of Object.entries(obj)) {
      const childPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "object" && value !== null) {
        const childNodes = extractConfigSlugs(value, childPath, specId, specSlug);
        if (childNodes.length > 0) {
          // If it's a nested object, create a parent node
          if (!Array.isArray(value)) {
            nodes.push({
              id: `${specId}-${childPath}`,
              type: "variable",
              name: key,
              path: `{${childPath}}`,
              specId,
              specSlug,
              children: childNodes,
            });
          } else {
            nodes.push(...childNodes);
          }
        }
      } else {
        // Leaf value
        nodes.push({
          id: `${specId}-${childPath}`,
          type: "variable",
          name: key,
          path: `{${childPath}}`,
          value: value as string | number | boolean | null,
          specId,
          specSlug,
        });
      }
    }
  }

  return nodes;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { playbookId } = await params;

    // Load playbook with all specs
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
        domain: true,
        // curriculum: removed - FK relation no longer exists on Playbook model
        // curriculum: {
        //   include: {
        //     modules: {
        //       orderBy: { sortOrder: "asc" },
        //     },
        //   },
        // },
        items: {
          where: { isEnabled: true, itemType: "SPEC" },
          include: {
            spec: {
              include: {
                triggers: {
                  include: {
                    actions: {
                      include: {
                        parameter: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // specs: removed - PlaybookSystemSpec model no longer exists
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 }
      );
    }

    // Load all SYSTEM specs (implicitly included)
    const allSystemSpecs = await prisma.analysisSpec.findMany({
      where: { scope: "SYSTEM", isActive: true },
      include: {
        triggers: {
          include: {
            actions: {
              include: {
                parameter: true,
              },
            },
          },
        },
      },
    });

    // All system specs are now implicitly enabled (PlaybookSystemSpec model was removed)
    const enabledSystemSpecs = allSystemSpecs;

    // Categorize specs
    const identitySpecs: typeof enabledSystemSpecs = [];
    const contentSpecs: typeof enabledSystemSpecs = [];
    const voiceSpecs: typeof enabledSystemSpecs = [];
    const measureSpecs: typeof enabledSystemSpecs = [];
    const learnSpecs: typeof enabledSystemSpecs = [];
    const adaptSpecs: typeof enabledSystemSpecs = [];
    const rewardSpecs: typeof enabledSystemSpecs = [];
    const guardrailSpecs: typeof enabledSystemSpecs = [];
    const composeSpecs: typeof enabledSystemSpecs = [];
    const otherSpecs: typeof enabledSystemSpecs = [];

    // Combine all enabled specs (deduplicated by spec ID)
    const seenSpecIds = new Set<string>();
    const allEnabledSpecs: typeof enabledSystemSpecs = [];

    // Add system specs first
    for (const spec of enabledSystemSpecs) {
      if (!seenSpecIds.has(spec.id)) {
        seenSpecIds.add(spec.id);
        allEnabledSpecs.push(spec);
      }
    }

    // Add playbook item specs (skip if already added as system spec)
    for (const item of playbook.items) {
      if (item.spec && !seenSpecIds.has(item.spec.id)) {
        seenSpecIds.add(item.spec.id);
        allEnabledSpecs.push(item.spec);
      }
    }

    for (const spec of allEnabledSpecs) {
      const role = spec.specRole as string;
      const output = spec.outputType;

      if (role === "IDENTITY" && spec.domain !== "voice") {
        identitySpecs.push(spec);
      } else if (role === "CONTENT") {
        contentSpecs.push(spec);
      } else if (role === "VOICE" || (role === "IDENTITY" && spec.domain === "voice")) {
        voiceSpecs.push(spec);
      } else if (output === "MEASURE" || output === "MEASURE_AGENT") {
        measureSpecs.push(spec);
      } else if (output === "LEARN") {
        learnSpecs.push(spec);
      } else if (output === "ADAPT") {
        adaptSpecs.push(spec);
      } else if (output === "AGGREGATE") {
        measureSpecs.push(spec); // Aggregation is post-processing on measurements
      } else if (output === "REWARD" || role === "REWARD") {
        rewardSpecs.push(spec);
      } else if (output === "SUPERVISE" || role === "GUARDRAIL") {
        guardrailSpecs.push(spec);
      } else if (output === "COMPOSE") {
        composeSpecs.push(spec);
      } else {
        otherSpecs.push(spec);
      }
    }

    // Build the tree
    const tree: SlugNode[] = [];

    // IDENTITY category
    if (identitySpecs.length > 0) {
      const identityCategory: SlugNode = {
        id: "category-identity",
        type: "category",
        name: "IDENTITY",
        meta: { icon: "🎭", description: "WHO the agent is", specCount: identitySpecs.length },
        children: [],
      };

      for (const spec of identitySpecs) {
        const config = spec.config as Record<string, any> | null;
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: config ? extractConfigSlugs(config, "identity", spec.id, spec.slug) : [],
        };
        identityCategory.children!.push(specNode);
      }

      tree.push(identityCategory);
    }

    // CONTENT category
    if (contentSpecs.length > 0) {
      const contentCategory: SlugNode = {
        id: "category-content",
        type: "category",
        name: "CONTENT",
        meta: { icon: "📖", description: "WHAT the agent knows/teaches", specCount: contentSpecs.length },
        children: [],
      };

      // Note: curriculum FK relation was removed from Playbook model
      // Content specs now contain curriculum data directly in their config

      for (const spec of contentSpecs) {
        const config = spec.config as Record<string, any> | null;
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: config ? extractConfigSlugs(config, "content", spec.id, spec.slug) : [],
        };
        contentCategory.children!.push(specNode);
      }

      tree.push(contentCategory);
    }

    // VOICE category
    if (voiceSpecs.length > 0) {
      const voiceCategory: SlugNode = {
        id: "category-voice",
        type: "category",
        name: "VOICE",
        meta: { icon: "🎙️", description: "HOW the agent speaks", specCount: voiceSpecs.length },
        children: [],
      };

      for (const spec of voiceSpecs) {
        const config = spec.config as Record<string, any> | null;
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: config ? extractConfigSlugs(config, "voice", spec.id, spec.slug) : [],
        };
        voiceCategory.children!.push(specNode);
      }

      tree.push(voiceCategory);
    }

    // MEASURE category
    if (measureSpecs.length > 0) {
      const measureCategory: SlugNode = {
        id: "category-measure",
        type: "category",
        name: "MEASURE",
        meta: { icon: "📊", description: "Measures caller traits → CallScore", specCount: measureSpecs.length },
        children: [],
      };

      for (const spec of measureSpecs) {
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: [],
        };

        // Extract parameters that this spec measures
        const parameters = new Map<string, { name: string; id: string }>();
        for (const trigger of spec.triggers || []) {
          for (const action of trigger.actions || []) {
            if (action.parameter) {
              parameters.set(action.parameterId!, {
                name: action.parameter.name,
                id: action.parameter.id,
              });
            }
          }
        }

        if (parameters.size > 0) {
          specNode.children!.push({
            id: `${spec.id}-produces`,
            type: "produces",
            name: "Produces",
            meta: { outputType: "CallScore" },
            children: Array.from(parameters.entries()).map(([paramId, param]) => ({
              id: `${spec.id}-param-${paramId}`,
              type: "variable" as const,
              name: param.name,
              path: `{scores.${paramId}}`,
              meta: { parameterId: paramId, linkTo: `/parameters?id=${param.id}` },
            })),
          });
        }

        measureCategory.children!.push(specNode);
      }

      tree.push(measureCategory);
    }

    // LEARN category
    if (learnSpecs.length > 0) {
      const learnCategory: SlugNode = {
        id: "category-learn",
        type: "category",
        name: "LEARN",
        meta: { icon: "🧠", description: "Extracts insights → CallerMemory", specCount: learnSpecs.length },
        children: [],
      };

      for (const spec of learnSpecs) {
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: [],
        };

        // Extract memory categories/keys that this spec produces
        const memoryKeys = new Map<string, { category: string | null; prefix: string | null }>();
        for (const trigger of spec.triggers || []) {
          for (const action of trigger.actions || []) {
            if (action.learnCategory || action.learnKeyPrefix) {
              const key = action.learnKeyPrefix || action.learnCategory || "memory";
              memoryKeys.set(key, {
                category: action.learnCategory,
                prefix: action.learnKeyPrefix,
              });
            }
          }
        }

        if (memoryKeys.size > 0) {
          specNode.children!.push({
            id: `${spec.id}-produces`,
            type: "produces",
            name: "Produces",
            meta: { outputType: "CallerMemory" },
            children: Array.from(memoryKeys.entries()).map(([key, meta]) => ({
              id: `${spec.id}-memory-${key}`,
              type: "variable" as const,
              name: meta.prefix || meta.category || key,
              path: `{memory.${key}}`,
              meta: { category: meta.category, keyPrefix: meta.prefix },
            })),
          });
        }

        learnCategory.children!.push(specNode);
      }

      tree.push(learnCategory);
    }

    // ADAPT category
    if (adaptSpecs.length > 0) {
      const adaptCategory: SlugNode = {
        id: "category-adapt",
        type: "category",
        name: "ADAPT",
        meta: { icon: "🔄", description: "Adjusts behavior → BehaviorTarget", specCount: adaptSpecs.length },
        children: [],
      };

      for (const spec of adaptSpecs) {
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: [],
        };

        // Extract parameters that this spec adjusts
        const parameters = new Map<string, { name: string; id: string }>();
        for (const trigger of spec.triggers || []) {
          for (const action of trigger.actions || []) {
            if (action.parameter) {
              parameters.set(action.parameterId!, {
                name: action.parameter.name,
                id: action.parameter.id,
              });
            }
          }
        }

        if (parameters.size > 0) {
          specNode.children!.push({
            id: `${spec.id}-adjusts`,
            type: "produces",
            name: "Adjusts",
            meta: { outputType: "BehaviorTarget" },
            children: Array.from(parameters.entries()).map(([paramId, param]) => ({
              id: `${spec.id}-target-${paramId}`,
              type: "variable" as const,
              name: param.name,
              path: `{targets.${paramId}}`,
              meta: { parameterId: paramId, linkTo: `/parameters?id=${param.id}` },
            })),
          });
        }

        adaptCategory.children!.push(specNode);
      }

      tree.push(adaptCategory);
    }

    // REWARD category
    if (rewardSpecs.length > 0) {
      const rewardCategory: SlugNode = {
        id: "category-reward",
        type: "category",
        name: "REWARD",
        meta: { icon: "⭐", description: "Computes reward scores → RewardScore", specCount: rewardSpecs.length },
        children: [],
      };

      for (const spec of rewardSpecs) {
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: [],
        };

        const parameters = new Map<string, { name: string; id: string }>();
        for (const trigger of spec.triggers || []) {
          for (const action of trigger.actions || []) {
            if (action.parameter) {
              parameters.set(action.parameterId!, {
                name: action.parameter.name,
                id: action.parameter.id,
              });
            }
          }
        }

        if (parameters.size > 0) {
          specNode.children!.push({
            id: `${spec.id}-produces`,
            type: "produces",
            name: "Produces",
            meta: { outputType: "RewardScore" },
            children: Array.from(parameters.entries()).map(([paramId, param]) => ({
              id: `${spec.id}-reward-${paramId}`,
              type: "variable" as const,
              name: param.name,
              path: `{rewards.${paramId}}`,
              meta: { parameterId: paramId, linkTo: `/parameters?id=${param.id}` },
            })),
          });
        }

        rewardCategory.children!.push(specNode);
      }

      tree.push(rewardCategory);
    }

    // GUARDRAIL category (specRole=GUARDRAIL or outputType=SUPERVISE)
    if (guardrailSpecs.length > 0) {
      const guardrailCategory: SlugNode = {
        id: "category-guardrail",
        type: "category",
        name: "GUARDRAIL",
        meta: { icon: "🛡️", description: "Enforces safety bounds on computed values", specCount: guardrailSpecs.length },
        children: [],
      };

      for (const spec of guardrailSpecs) {
        const config = spec.config as Record<string, any> | null;
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: config ? extractConfigSlugs(config, "guardrail", spec.id, spec.slug) : [],
        };
        guardrailCategory.children!.push(specNode);
      }

      tree.push(guardrailCategory);
    }

    // COMPOSE category
    if (composeSpecs.length > 0) {
      const composeCategory: SlugNode = {
        id: "category-compose",
        type: "category",
        name: "COMPOSE",
        meta: { icon: "🧩", description: "Assembles final prompt from context → ComposedPrompt", specCount: composeSpecs.length },
        children: [],
      };

      for (const spec of composeSpecs) {
        const config = spec.config as Record<string, any> | null;
        const specNode: SlugNode = {
          id: spec.id,
          type: "spec",
          name: spec.name,
          specId: spec.id,
          specSlug: spec.slug,
          meta: { description: spec.description, scope: spec.scope },
          children: config ? extractConfigSlugs(config, "compose", spec.id, spec.slug) : [],
        };
        composeCategory.children!.push(specNode);
      }

      tree.push(composeCategory);
    }

    // Count totals
    const counts = {
      identity: identitySpecs.length,
      content: contentSpecs.length,
      voice: voiceSpecs.length,
      measure: measureSpecs.length,
      learn: learnSpecs.length,
      adapt: adaptSpecs.length,
      reward: rewardSpecs.length,
      guardrail: guardrailSpecs.length,
      compose: composeSpecs.length,
      total: allEnabledSpecs.length,
    };

    return NextResponse.json({
      ok: true,
      playbook: {
        id: playbook.id,
        name: playbook.name,
        status: playbook.status,
      },
      tree,
      counts,
    });
  } catch (error: any) {
    console.error("Error fetching playbook slugs:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch playbook slugs" },
      { status: 500 }
    );
  }
}
