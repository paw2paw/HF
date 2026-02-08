import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/playbooks/[playbookId]/triggers
 *
 * Returns all triggers and actions across all specs in this playbook.
 * Organized by spec and trigger, showing the full Given/When/Then structure.
 */

type ActionInfo = {
  id: string;
  description: string;
  weight: number;
  parameterId: string | null;
  parameterName: string | null;
  learnCategory: string | null;
  learnKeyPrefix: string | null;
  learnKeyHint: string | null;
};

type TriggerInfo = {
  id: string;
  name: string | null;
  given: string;
  when: string;
  then: string;
  actions: ActionInfo[];
};

type SpecTriggers = {
  specId: string;
  specSlug: string;
  specName: string;
  specType: string;
  outputType: string;
  triggers: TriggerInfo[];
};

type TriggersByOutputType = {
  outputType: string;
  icon: string;
  description: string;
  specs: SpecTriggers[];
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  try {
    const { playbookId } = await params;

    // Load playbook with all specs and their triggers/actions
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      include: {
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
                      orderBy: { weight: "desc" },
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
              orderBy: { weight: "desc" },
            },
          },
        },
      },
    });

    // All system specs are now implicitly enabled (PlaybookSystemSpec model was removed)
    const enabledSystemSpecs = allSystemSpecs;

    // Combine all enabled specs
    const allEnabledSpecs = [
      ...enabledSystemSpecs,
      ...playbook.items.filter((i) => i.spec).map((i) => i.spec!),
    ];

    // Group specs by output type
    const outputTypeGroups: Record<string, SpecTriggers[]> = {};

    for (const spec of allEnabledSpecs) {
      const specTriggers: SpecTriggers = {
        specId: spec.id,
        specSlug: spec.slug,
        specName: spec.name,
        specType: spec.specType,
        outputType: spec.outputType,
        triggers: (spec.triggers || []).map((trigger) => ({
          id: trigger.id,
          name: trigger.name,
          given: trigger.given,
          when: trigger.when,
          then: trigger.then,
          actions: (trigger.actions || []).map((action) => ({
            id: action.id,
            description: action.description,
            weight: action.weight,
            parameterId: action.parameterId,
            parameterName: action.parameter?.name || null,
            learnCategory: action.learnCategory,
            learnKeyPrefix: action.learnKeyPrefix,
            learnKeyHint: action.learnKeyHint,
          })),
        })),
      };

      // Only include specs with triggers
      if (specTriggers.triggers.length > 0) {
        const outputType = spec.outputType;
        if (!outputTypeGroups[outputType]) {
          outputTypeGroups[outputType] = [];
        }
        outputTypeGroups[outputType].push(specTriggers);
      }
    }

    // Build categorized output
    const outputTypeInfo: Record<string, { icon: string; description: string }> = {
      MEASURE: { icon: "📊", description: "Measures traits → produces CallScore values" },
      MEASURE_AGENT: { icon: "🤖", description: "Measures behaviour → produces CallScore values" },
      LEARN: { icon: "🧠", description: "Extracts insights → produces CallerMemory entries" },
      ADAPT: { icon: "🔄", description: "Adapts behavior → produces BehaviorTarget values" },
      COMPOSE: { icon: "✍️", description: "Composes prompts → produces prompt sections" },
      REWARD: { icon: "⭐", description: "Computes rewards → produces reward signals" },
      INJECT: { icon: "💉", description: "Injects data → pre-call context injection" },
      AGGREGATE: { icon: "📈", description: "Aggregates data → cross-call statistics" },
    };

    const categories: TriggersByOutputType[] = [];

    // Order output types logically
    const outputTypeOrder = ["MEASURE", "MEASURE_AGENT", "LEARN", "ADAPT", "COMPOSE", "REWARD", "INJECT", "AGGREGATE"];

    for (const outputType of outputTypeOrder) {
      if (outputTypeGroups[outputType]) {
        categories.push({
          outputType,
          icon: outputTypeInfo[outputType]?.icon || "📋",
          description: outputTypeInfo[outputType]?.description || outputType,
          specs: outputTypeGroups[outputType].sort((a, b) => a.specName.localeCompare(b.specName)),
        });
      }
    }

    // Add any remaining output types not in the predefined order
    for (const outputType of Object.keys(outputTypeGroups)) {
      if (!outputTypeOrder.includes(outputType)) {
        categories.push({
          outputType,
          icon: "📋",
          description: outputType,
          specs: outputTypeGroups[outputType].sort((a, b) => a.specName.localeCompare(b.specName)),
        });
      }
    }

    // Count totals
    const totalSpecs = Object.values(outputTypeGroups).flat().length;
    const totalTriggers = Object.values(outputTypeGroups)
      .flat()
      .reduce((sum, spec) => sum + spec.triggers.length, 0);
    const totalActions = Object.values(outputTypeGroups)
      .flat()
      .reduce(
        (sum, spec) =>
          sum + spec.triggers.reduce((tSum, t) => tSum + t.actions.length, 0),
        0
      );

    return NextResponse.json({
      ok: true,
      playbook: {
        id: playbook.id,
        name: playbook.name,
        status: playbook.status,
      },
      categories,
      counts: {
        specs: totalSpecs,
        triggers: totalTriggers,
        actions: totalActions,
        outputTypes: categories.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching playbook triggers:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch playbook triggers" },
      { status: 500 }
    );
  }
}
