import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/data-dictionary/dependencies
 *
 * Reverse index: List all specs/playbooks with what taxonomy items each one uses.
 * This is the "flip" of the xrefs endpoint.
 */
export async function GET() {
  try {
    // Fetch all analysis specs with their relationships
    const specs = await prisma.analysisSpec.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        outputType: true,
        specRole: true,
        promptTemplate: true,
        triggers: {
          select: {
            given: true,
            when: true,
            then: true,
            actions: {
              select: {
                learnKeyPrefix: true,
                learnCategory: true,
                description: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Fetch all published playbooks with their items
    const playbooks = await prisma.playbook.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        version: true,
        domain: {
          select: { name: true },
        },
        items: {
          select: {
            spec: {
              select: {
                id: true,
                name: true,
                outputType: true,
              },
            },
            promptTemplate: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Regex to find mustache variables
    const variableRegex = /\{\{([^{}]+)\}\}/g;

    // Process specs to extract dependencies
    const specDependencies = specs.map((spec) => {
      const variables = new Set<string>();
      const prefixes = new Set<string>();

      // Extract variables from promptTemplate
      if (spec.promptTemplate) {
        const matches = spec.promptTemplate.matchAll(variableRegex);
        for (const match of matches) {
          variables.add(`{{${match[1]}}}`);
        }
      }

      // Extract from triggers
      for (const trigger of spec.triggers) {
        for (const field of [trigger.given, trigger.when, trigger.then]) {
          if (field) {
            const matches = field.matchAll(variableRegex);
            for (const match of matches) {
              variables.add(`{{${match[1]}}}`);
            }
          }
        }

        // Extract prefixes and variables from actions
        for (const action of trigger.actions) {
          if (action.learnKeyPrefix) {
            prefixes.add(action.learnKeyPrefix);
          }
          if (action.description) {
            const matches = action.description.matchAll(variableRegex);
            for (const match of matches) {
              variables.add(`{{${match[1]}}}`);
            }
          }
        }
      }

      return {
        id: spec.id,
        name: spec.name,
        slug: spec.slug,
        type: "spec" as const,
        outputType: spec.outputType,
        specRole: spec.specRole,
        variables: Array.from(variables).sort(),
        prefixes: Array.from(prefixes).sort(),
      };
    });

    // Process playbooks to extract dependencies
    const playbookDependencies = playbooks.map((pb) => {
      const specsInPlaybook: Array<{ id: string; name: string; outputType: string }> = [];
      const templates: Array<{ id: string; slug: string; name: string }> = [];

      for (const item of pb.items) {
        if (item.spec) {
          specsInPlaybook.push({
            id: item.spec.id,
            name: item.spec.name,
            outputType: item.spec.outputType,
          });
        }
        if (item.promptTemplate) {
          templates.push({
            id: item.promptTemplate.id,
            slug: item.promptTemplate.slug,
            name: item.promptTemplate.name,
          });
        }
      }

      return {
        id: pb.id,
        name: pb.name,
        type: "playbook" as const,
        version: pb.version,
        domain: pb.domain?.name || null,
        specs: specsInPlaybook,
        templates,
      };
    });

    return NextResponse.json({
      ok: true,
      specs: specDependencies,
      playbooks: playbookDependencies,
      summary: {
        totalSpecs: specDependencies.length,
        totalPlaybooks: playbookDependencies.length,
        specsWithVariables: specDependencies.filter((s) => s.variables.length > 0).length,
        specsWithPrefixes: specDependencies.filter((s) => s.prefixes.length > 0).length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching dependencies:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch dependencies" },
      { status: 500 }
    );
  }
}
