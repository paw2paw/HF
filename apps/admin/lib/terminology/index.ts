export {
  type TermKey,
  type TerminologyProfile,
  type TerminologyOverrides,
  type TerminologyPresetId,
  type TerminologyConfig,
  TERMINOLOGY_PRESETS,
  DEFAULT_PRESET,
  DEFAULT_TERMINOLOGY,
  resolveTerminology,
  pluralize,
  lc,
  PRESET_OPTIONS,
} from "./types";

export { getTerminology, getTerminologyForUser } from "./server";
