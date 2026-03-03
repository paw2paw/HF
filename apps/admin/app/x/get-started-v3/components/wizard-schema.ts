/**
 * Wizard Schema V3 — re-exports option constants from V2.
 *
 * V3 uses the graph evaluator (lib/wizard/graph-evaluator.ts) instead
 * of computeCurrentPhase / WIZARD_PHASES. Option sets and slider defs
 * are shared with V2 to avoid duplication.
 */

// Re-export all option sets and types from V2
export {
  type WizardOption,
  type SliderDef,
  APPROACH_OPTIONS,
  EMPHASIS_OPTIONS,
  SESSION_COUNT_OPTIONS,
  DURATION_OPTIONS,
  PLAN_EMPHASIS_OPTIONS,
  LESSON_MODEL_OPTIONS,
  PERSONALITY_SLIDERS,
  INSTITUTION_TYPE_OPTIONS,
  WIZARD_FIELDS,
  type WizardFieldDef,
} from "../../get-started-v2/components/wizard-schema";
