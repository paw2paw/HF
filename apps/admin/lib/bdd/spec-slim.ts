/**
 * Spec Slim — Strip already-extracted fields from spec parameters
 *
 * During seeding, several fields are extracted from spec parameters
 * into dedicated DB tables:
 *   - interpretationScale → Parameter.interpretationHigh/Low
 *   - scoringAnchors → ParameterScoringAnchor table
 *   - promptGuidance → PromptSlug / PromptSlugRange tables
 *
 * After extraction, keeping these in AnalysisSpec.config is pure
 * redundancy (~43% of config JSON size). This utility strips them.
 *
 * BDDFeatureSet.rawSpec is NOT modified — it keeps the full archive.
 */

/** Fields on each parameter object that are extracted to dedicated tables */
const EXTRACTED_PARAM_FIELDS = [
  "interpretationScale",
  "scoringAnchors",
  "promptGuidance",
  "subMetrics",       // documentation-only sub-metric definitions
  "formula",          // documentation-only scoring formula
  "workedExamples",   // seed-time reference only
];

/** Root-level fields that are BDD documentation, not runtime config */
const STRIPPED_ROOT_FIELDS = [
  "acceptanceCriteria",
  "failureConditions",
  "workedExamples",
];

/**
 * Strip already-extracted fields from parameters for AnalysisSpec.config.
 * Returns a new array with cleaned parameter objects.
 */
export function slimParameters(params: any[]): any[] {
  if (!Array.isArray(params)) return params;

  return params.map((param) => {
    const slim = { ...param };
    for (const field of EXTRACTED_PARAM_FIELDS) {
      delete slim[field];
    }
    return slim;
  });
}

/**
 * Strip BDD documentation fields from root-level rawSpec data.
 * Returns a new object without the stripped fields.
 */
export function slimRootFields(rawSpecData: Record<string, any>): Record<string, any> {
  if (!rawSpecData || typeof rawSpecData !== "object") return rawSpecData;

  const slim = { ...rawSpecData };
  for (const field of STRIPPED_ROOT_FIELDS) {
    delete slim[field];
  }
  return slim;
}

/**
 * Summary of what was stripped (for seed logging).
 */
export function slimSummary(originalParams: any[]): string {
  if (!Array.isArray(originalParams)) return "no parameters";

  let stripped = 0;
  for (const param of originalParams) {
    for (const field of EXTRACTED_PARAM_FIELDS) {
      if (param[field]) stripped++;
    }
  }
  return stripped > 0
    ? `stripped ${stripped} extracted field(s) from ${originalParams.length} parameters`
    : "nothing to strip";
}
