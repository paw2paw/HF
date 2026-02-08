/**
 * BDD Compiler
 *
 * Compiles parsed BDD uploads into a Feature Set with:
 * - Parameters (extracted from specs)
 * - Constraints (extracted from acceptance criteria)
 * - Validations (Gherkin scenarios)
 * - Prompt Guidance (for LLM scoring)
 * - Definitions (data dictionary)
 * - Thresholds (all threshold values)
 */

import {
  parseBDDXml,
  ParsedParameter,
  AcceptanceCriterion,
  Constraint as ParsedConstraint,
  Submetric,
  ThresholdDef,
} from "./parser";

export type CompiledFeatureSet = {
  featureId: string;
  name: string;
  description?: string;
  parameters: CompiledParameter[];
  constraints: CompiledConstraint[];
  validations: CompiledValidation[];
  promptGuidance: Record<string, string>;
  definitions: Record<string, Definition>;
  thresholds: Record<string, ThresholdValue>;
};

export type CompiledParameter = {
  id: string;
  name: string;
  definition: string;
  formula?: string;
  targetRange?: { min: number; max: number };
  submetrics?: CompiledSubmetric[];
  source: "story" | "parameter";
};

export type CompiledSubmetric = {
  id: string;
  name: string;
  weight: number;
  description?: string;
  formula?: string;
  inputs?: { name: string; source: string; required: boolean; description?: string }[];
};

export type CompiledConstraint = {
  id: string;
  type?: string;
  description: string;
  severity: "critical" | "warning";
  threshold?: string | number;
  source: string;
};

export type CompiledValidation = {
  name: string;
  tags?: string[];
  given: string[];
  when: string[];
  then: string[];
  source: string;
  acId?: string;
};

export type Definition = {
  term: string;
  definition: string;
  source: string;
  type: "parameter" | "submetric" | "threshold" | "constraint" | "acceptance_criterion" | "term";
};

export type ThresholdValue = {
  name: string;
  value: string | number;
  operator?: string;
  basis?: string;
  source: string;
  parameterId?: string;
};

type BDDUpload = {
  id: string;
  filename: string;
  fileType: "STORY" | "PARAMETER";
  xmlContent: string;
  storyId?: string | null;
  parameterIds?: string[];
  name?: string | null;
  version?: string | null;
};

/**
 * Compile BDD uploads into a Feature Set
 */
export function compileBDDToFeatureSet(uploads: BDDUpload[]): CompiledFeatureSet {
  const parameters: CompiledParameter[] = [];
  const constraints: CompiledConstraint[] = [];
  const validations: CompiledValidation[] = [];
  const promptGuidance: Record<string, string> = {};
  const definitions: Record<string, Definition> = {};
  const thresholds: Record<string, ThresholdValue> = {};

  // Track what we've seen to avoid duplicates
  const seenParams = new Set<string>();
  const seenConstraints = new Set<string>();

  // Derive feature ID from first story or generate one
  let featureId = "";
  let featureName = "";
  let featureDescription = "";

  for (const upload of uploads) {
    const parsed = parseBDDXml(upload.xmlContent, upload.fileType);

    // Process story
    if (parsed.story) {
      const story = parsed.story;

      if (!featureId) {
        featureId = story.id;
        featureName = story.title;
        featureDescription = `As ${story.asA}, I want ${story.iWant} so that ${story.soThat}`;
      }

      // Add user story to definitions
      definitions[`${story.id}-user-story`] = {
        term: "User Story",
        definition: featureDescription,
        source: story.id,
        type: "term",
      };

      // Add time window to definitions
      if (story.timeWindow) {
        definitions[`${story.id}-time-window`] = {
          term: `Time Window: ${story.timeWindow.name}`,
          definition: `Start: ${story.timeWindow.start || "N/A"}, End: ${story.timeWindow.end || "N/A"}`,
          source: story.id,
          type: "term",
        };
      }

      // Extract from acceptance criteria
      for (const ac of story.acceptanceCriteria) {
        // Add AC as a definition
        definitions[ac.id] = {
          term: ac.title || ac.id,
          definition: `GIVEN ${ac.given} WHEN ${ac.when} THEN ${ac.then}`,
          source: story.id,
          type: "acceptance_criterion",
        };

        // Extract thresholds from AC
        if (ac.thresholds) {
          for (const [name, thresh] of Object.entries(ac.thresholds)) {
            const thresholdKey = `${ac.id}.${name}`;
            thresholds[thresholdKey] = {
              name,
              value: thresh.value,
              operator: thresh.operator,
              basis: thresh.basis,
              source: ac.id,
              parameterId: thresh.parameter,
            };

            // Add to definitions
            definitions[thresholdKey] = {
              term: name,
              definition: `${thresh.operator || "="} ${thresh.value}${thresh.basis ? ` (${thresh.basis})` : ""}`,
              source: ac.id,
              type: "threshold",
            };
          }
        }

        // Add Gherkin from AC as validation
        if (ac.gherkin) {
          // Parse embedded Gherkin scenarios
          const scenarioMatches = ac.gherkin.matchAll(/Scenario(?:\s+Outline)?:\s*([^\n]+)([\s\S]*?)(?=\n\s*Scenario|$)/g);
          for (const sm of scenarioMatches) {
            const scenarioName = sm[1].trim();
            const content = sm[2];

            const givenSteps: string[] = [];
            const whenSteps: string[] = [];
            const thenSteps: string[] = [];

            // Simple line-by-line parsing
            const lines = content.split("\n");
            let currentSection = "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("Given ")) {
                currentSection = "given";
                givenSteps.push(trimmed.replace("Given ", ""));
              } else if (trimmed.startsWith("When ")) {
                currentSection = "when";
                whenSteps.push(trimmed.replace("When ", ""));
              } else if (trimmed.startsWith("Then ")) {
                currentSection = "then";
                thenSteps.push(trimmed.replace("Then ", ""));
              } else if (trimmed.startsWith("And ")) {
                const step = trimmed.replace("And ", "");
                if (currentSection === "given") givenSteps.push(step);
                else if (currentSection === "when") whenSteps.push(step);
                else if (currentSection === "then") thenSteps.push(step);
              }
            }

            if (givenSteps.length > 0 || whenSteps.length > 0 || thenSteps.length > 0) {
              validations.push({
                name: scenarioName,
                given: givenSteps,
                when: whenSteps,
                then: thenSteps,
                source: story.id,
                acId: ac.id,
              });
            }
          }
        }
      }

      // Extract constraints from story
      if (story.constraints) {
        for (const c of story.constraints) {
          if (!seenConstraints.has(c.id)) {
            seenConstraints.add(c.id);
            constraints.push({
              id: c.id,
              type: c.type,
              description: c.description,
              severity: c.severity || "warning",
              source: story.id,
            });

            definitions[c.id] = {
              term: c.id,
              definition: c.description,
              source: story.id,
              type: "constraint",
            };
          }
        }
      }

      // Extract failure conditions as constraints
      if (story.failureConditions) {
        for (const fc of story.failureConditions) {
          const fcId = `failure-${fc.id}`;
          if (!seenConstraints.has(fcId)) {
            seenConstraints.add(fcId);
            constraints.push({
              id: fcId,
              description: `${fc.trigger}${fc.implication ? ` - ${fc.implication}` : ""}`,
              severity: fc.severity === "critical" ? "critical" : "warning",
              threshold: fc.threshold ? `${fc.threshold.operator} ${fc.threshold.value}` : undefined,
              source: story.id,
            });

            if (fc.threshold) {
              thresholds[fcId] = {
                name: fc.trigger,
                value: fc.threshold.value,
                operator: fc.threshold.operator,
                source: story.id,
              };
            }
          }
        }
      }

      // Also add scenario-level validations
      for (const scenario of story.scenarios) {
        validations.push({
          name: scenario.name,
          tags: scenario.tags,
          given: scenario.given,
          when: scenario.when,
          then: scenario.then,
          source: story.id,
        });
      }
    }

    // Process parameters from parameter measurement guide
    if (parsed.parameters) {
      for (const param of parsed.parameters) {
        if (!seenParams.has(param.id)) {
          seenParams.add(param.id);

          // Convert submetrics
          const compiledSubmetrics: CompiledSubmetric[] | undefined = param.submetrics?.map((sm) => ({
            id: sm.id,
            name: sm.name,
            weight: sm.weight,
            description: sm.description,
            formula: sm.formula,
            inputs: sm.inputs,
          }));

          parameters.push({
            id: param.id,
            name: param.name,
            definition: param.definition || "",
            formula: param.formula,
            targetRange: param.targetRange,
            submetrics: compiledSubmetrics,
            source: "parameter",
          });

          // Add parameter to definitions
          definitions[param.id] = {
            term: param.name,
            definition: param.definition || param.name,
            source: upload.filename,
            type: "parameter",
          };

          // Add submetrics to definitions
          if (param.submetrics) {
            for (const sm of param.submetrics) {
              definitions[sm.id] = {
                term: sm.name,
                definition: sm.description || sm.name,
                source: param.id,
                type: "submetric",
              };

              // Add submetric thresholds
              if (sm.thresholds) {
                for (const [name, thresh] of Object.entries(sm.thresholds)) {
                  const key = `${sm.id}.${name}`;
                  thresholds[key] = {
                    name,
                    value: thresh.value,
                    basis: thresh.basis,
                    source: sm.id,
                    parameterId: param.id,
                  };
                }
              }

              // Add submetric definitions
              if (sm.definitions) {
                for (const [term, def] of Object.entries(sm.definitions)) {
                  definitions[`${sm.id}.${term}`] = {
                    term,
                    definition: def,
                    source: sm.id,
                    type: "term",
                  };
                }
              }
            }
          }

          // Add interpretation scale to definitions
          if (param.interpretationScale) {
            for (const range of param.interpretationScale) {
              definitions[`${param.id}.${range.label}`] = {
                term: `${param.name}: ${range.label}`,
                definition: `${range.min}-${range.max}${range.implication ? ` → ${range.implication}` : ""}`,
                source: param.id,
                type: "threshold",
              };
            }
          }

          // Add parameter target range as threshold
          if (param.targetRange) {
            thresholds[`${param.id}.target`] = {
              name: "target_range",
              value: `${param.targetRange.min}-${param.targetRange.max}`,
              source: param.id,
              parameterId: param.id,
            };
          }

          // Add action thresholds
          if (param.thresholds) {
            for (const [status, thresh] of Object.entries(param.thresholds)) {
              const key = `${param.id}.${status}`;
              thresholds[key] = {
                name: status,
                value: thresh.value,
                operator: thresh.operator,
                source: param.id,
                parameterId: param.id,
              };
            }
          }
        }
      }
    }
  }

  // Generate a feature ID if we don't have one
  if (!featureId) {
    featureId = `feature-${Date.now().toString(36)}`;
  }
  if (!featureName) {
    featureName = uploads[0]?.name || "Unnamed Feature";
  }

  return {
    featureId,
    name: featureName,
    description: featureDescription || undefined,
    parameters,
    constraints,
    validations,
    promptGuidance,
    definitions,
    thresholds,
  };
}
