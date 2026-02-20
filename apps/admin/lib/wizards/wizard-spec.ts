/**
 * Wizard Spec Loader
 *
 * Loads wizard step definitions from ORCHESTRATE specs in the database.
 * Specs define the step sequence, skip conditions, task types, and progress labels.
 *
 * Contract: Each step declares what data keys it requires (reads from flow bag),
 * and what it produces (writes to flow bag). The spec encodes this metadata so
 * the frontend can enforce the contract.
 */

import { prisma } from "@/lib/prisma";
import type { SpecConfig } from "@/lib/types/json-fields";

export interface WizardStep {
  /** Unique step identifier (used as flow data bag key prefix) */
  id: string;

  /** Display label for this step in the stepper UI */
  label: string;

  /** Active label shown in the step flow banner while step is running */
  activeLabel: string;

  /** Sort order within the wizard (1-based) */
  order: number;

  /** Can user skip this step? */
  skippable: boolean;

  /** Optional: condition to auto-skip (e.g. "!hasFile"). Evaluated against flow bag keys */
  skipWhen?: string;

  /** Optional: UserTask type to poll while this step is running. Examples: "extraction", "curriculum_generation" */
  taskType?: string;

  /** Optional: per-step configuration from spec (tuning args like maxAssertions, etc.) */
  args?: Record<string, any>;

  /** Optional: human-readable description of what this step does */
  description?: string;
}

/**
 * Load wizard steps from a spec in the database.
 *
 * @param specSlug - Spec slug (e.g., "CONTENT-SOURCE-SETUP-001")
 * @returns Steps sorted by order, or null if spec not found (allows fallback to hardcoded)
 */
export async function loadWizardSteps(specSlug: string): Promise<WizardStep[] | null> {
  try {
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        slug: { contains: specSlug.toLowerCase(), mode: "insensitive" },
        isActive: true,
        specRole: "ORCHESTRATE",
      },
      select: {
        slug: true,
        config: true,
      },
    });

    if (!spec?.config) {
      return null;
    }

    const specConfig = spec.config as SpecConfig;
    const wizardParam = specConfig.parameters?.find(
      (p: any) => p.id === "wizard_steps"
    );

    if (!wizardParam?.config?.steps) {
      return null;
    }

    const steps = wizardParam.config.steps as WizardStep[];

    // Sort by order and validate
    return steps
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        id: step.id,
        label: step.label,
        activeLabel: step.activeLabel,
        order: step.order,
        skippable: step.skippable ?? false,
        skipWhen: step.skipWhen,
        taskType: step.taskType,
        args: step.args,
        description: step.description,
      }));
  } catch (err) {
    console.error(`[wizard-spec] Failed to load wizard steps for ${specSlug}:`, err);
    return null;
  }
}

/**
 * Evaluate a skip condition against flow data bag.
 *
 * @param condition - Expression like "!hasFile" or "!sourceId"
 * @param flowBag - Current StepFlowContext.data
 * @returns true if step should be skipped
 */
export function evaluateSkipCondition(
  condition: string | undefined,
  flowBag: Record<string, unknown>
): boolean {
  if (!condition) return false;

  try {
    // Simple negation support: "!keyName" means "skip if keyName is falsy"
    if (condition.startsWith("!")) {
      const key = condition.slice(1);
      return !flowBag[key];
    }

    // Could extend with more complex expressions later (e.g., "!hasFile && !sourceId")
    // For now, keep it simple
    return false;
  } catch (err) {
    console.warn(`[wizard-spec] Failed to evaluate skip condition: ${condition}`, err);
    return false;
  }
}
