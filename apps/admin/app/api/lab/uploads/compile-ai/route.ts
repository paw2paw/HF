import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ParsedParameterData, ParsedStoryData } from "@/lib/bdd/ai-parser";
import { generateScoringSpec } from "@/lib/bdd/spec-generator";

/**
 * POST /api/lab/uploads/compile-ai
 *
 * Compile AI-validated uploads into a Feature Set.
 * Takes the parsed data from validation and combines into a unified feature set.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ids, name: userProvidedName, description: userProvidedDescription, specType: userSpecType } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No IDs provided" },
        { status: 400 }
      );
    }

    // Fetch validated uploads
    const uploads = await prisma.bDDUpload.findMany({
      where: {
        id: { in: ids },
        status: { in: ["VALIDATED", "COMPILED"] },
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No validated uploads found. Run AI Validate first." },
        { status: 400 }
      );
    }

    // Compile the parsed data into a Feature Set
    const compiled = compileToFeatureSet(uploads);

    // Override with user-provided name and description if supplied
    if (userProvidedName) {
      compiled.name = userProvidedName;
    }
    if (userProvidedDescription) {
      compiled.description = userProvidedDescription;
    }

    // Generate the LLM-ready scoring specification
    const scoringSpec = generateScoringSpec(compiled);

    // Simplify scoringSpec for storage - keep essential fields only
    // Use JSON parse/stringify to ensure clean serialization
    const scoringSpecSimplified = JSON.parse(JSON.stringify({
      version: scoringSpec.version,
      featureId: scoringSpec.featureId,
      name: scoringSpec.name,
      instruction: scoringSpec.instruction,
      metadata: scoringSpec.metadata,
      // Store parameterSpecs as array (already serializable)
      parameterSpecs: scoringSpec.parameterSpecs,
      // Omit outputSchema as it's redundant (can be regenerated from parameterSpecs)
    }));

    // Also ensure all compiled data is cleanly serializable
    const cleanParameters = JSON.parse(JSON.stringify(compiled.parameters));
    const cleanConstraints = JSON.parse(JSON.stringify(compiled.constraints));
    const cleanValidations = JSON.parse(JSON.stringify(compiled.validations));
    const cleanPromptGuidance = JSON.parse(JSON.stringify(compiled.promptGuidance));
    const cleanDefinitions = JSON.parse(JSON.stringify(compiled.definitions));
    const cleanThresholds = JSON.parse(JSON.stringify(compiled.thresholds));

    // Check if feature set with this ID already exists
    const existing = await prisma.bDDFeatureSet.findUnique({
      where: { featureId: compiled.featureId },
    });

    let featureSet;

    if (existing) {
      // Update existing feature set with new version
      const newVersion = incrementVersion(existing.version);

      featureSet = await prisma.bDDFeatureSet.update({
        where: { id: existing.id },
        data: {
          name: compiled.name,
          description: compiled.description,
          version: newVersion,
          specType: userSpecType || existing.specType,
          parameters: cleanParameters,
          constraints: cleanConstraints,
          validations: cleanValidations,
          promptGuidance: cleanPromptGuidance,
          definitions: cleanDefinitions,
          thresholds: cleanThresholds,
          scoringSpec: scoringSpecSimplified,
          parameterCount: cleanParameters.length,
          constraintCount: cleanConstraints.length,
          definitionCount: Object.keys(cleanDefinitions).length,
        },
      });
    } else {
      // Create new feature set
      featureSet = await prisma.bDDFeatureSet.create({
        data: {
          featureId: compiled.featureId,
          name: compiled.name,
          description: compiled.description,
          version: "1.0",
          specType: userSpecType || "DOMAIN",
          parameters: cleanParameters,
          constraints: cleanConstraints,
          validations: cleanValidations,
          promptGuidance: cleanPromptGuidance,
          definitions: cleanDefinitions,
          thresholds: cleanThresholds,
          scoringSpec: scoringSpecSimplified,
          parameterCount: cleanParameters.length,
          constraintCount: cleanConstraints.length,
          definitionCount: Object.keys(cleanDefinitions).length,
        },
      });
    }

    // Update uploads to mark as compiled
    await prisma.bDDUpload.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "COMPILED",
      },
    });

    // Count uploads processed
    const uploadsProcessed = uploads.length;

    return NextResponse.json({
      ok: true,
      featureSet: {
        id: featureSet.id,
        featureId: featureSet.featureId,
        name: featureSet.name,
        version: featureSet.version,
        specType: featureSet.specType,
        parameterCount: featureSet.parameterCount,
        constraintCount: featureSet.constraintCount,
        definitionCount: featureSet.definitionCount,
      },
      compilationDetails: {
        uploadsProcessed,
        scoringSpec: !!scoringSpec,
        isUpdate: !!existing,
      },
    });
  } catch (error: any) {
    console.error("Error compiling BDD uploads:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Compilation failed" },
      { status: 500 }
    );
  }
}

interface CompiledFeatureSet {
  featureId: string;
  name: string;
  description?: string;
  parameters: any[];
  constraints: any[];
  validations: any[];
  promptGuidance: Record<string, any>;
  definitions: Record<string, any>;
  thresholds: Record<string, any>;
}

function compileToFeatureSet(uploads: any[]): CompiledFeatureSet {
  const parameters: any[] = [];
  const constraints: any[] = [];
  const validations: any[] = [];
  const promptGuidance: Record<string, any> = {};
  const definitions: Record<string, any> = {};
  const thresholds: Record<string, any> = {};

  let featureId = "";
  let featureName = "";
  let featureDescription = "";

  const seenParams = new Set<string>();
  const seenConstraints = new Set<string>();

  for (const upload of uploads) {
    // The parsed data is stored in parseErrors field (we reused this field for parsed data)
    const parsedData = upload.parseErrors as any;
    if (!parsedData) continue;

    // Check if this is hybrid data (contains both parameters and story)
    if (parsedData._isHybrid) {
      // Process parameters from hybrid
      if (parsedData.parameters && Array.isArray(parsedData.parameters)) {
        processParameters(
          { parameters: parsedData.parameters },
          parameters, definitions, thresholds, seenParams, upload.filename, promptGuidance
        );
      }

      // Process story from hybrid
      if (parsedData.story) {
        const result = processStory(
          parsedData.story,
          constraints, validations, definitions, thresholds, seenConstraints
        );
        if (!featureId && result.featureId) {
          featureId = result.featureId;
          featureName = result.featureName;
          featureDescription = result.featureDescription;
        }
      }
      continue;
    }

    if (upload.fileType === "STORY") {
      const storyData = parsedData as ParsedStoryData;

      // Set feature ID from first story
      if (!featureId && storyData.storyId) {
        featureId = storyData.storyId;
        featureName = storyData.title || "Untitled Feature";
        if (storyData.userStory) {
          featureDescription = `As ${storyData.userStory.asA}, I want ${storyData.userStory.iWant} so that ${storyData.userStory.soThat}`;
        }
      }

      // Add user story to definitions
      if (storyData.storyId && storyData.userStory) {
        definitions[`${storyData.storyId}-user-story`] = {
          term: "User Story",
          definition: featureDescription,
          source: storyData.storyId,
          type: "term",
        };
      }

      // Process acceptance criteria
      if (storyData.acceptanceCriteria) {
        for (const ac of storyData.acceptanceCriteria) {
          // Add AC as definition
          definitions[ac.id] = {
            term: ac.title || ac.id,
            definition: `GIVEN ${ac.given} WHEN ${ac.when} THEN ${ac.then}`,
            source: storyData.storyId,
            type: "acceptance_criterion",
          };

          // Add thresholds
          if (ac.thresholds) {
            for (const [name, thresh] of Object.entries(ac.thresholds)) {
              const thresholdKey = `${ac.id}.${name}`;
              thresholds[thresholdKey] = {
                name,
                ...thresh,
                source: ac.id,
              };
            }
          }

          // Add validation from gherkin
          if (ac.gherkin) {
            validations.push({
              name: ac.title || ac.id,
              given: [ac.given],
              when: [ac.when],
              then: [ac.then],
              source: storyData.storyId,
              acId: ac.id,
              gherkin: ac.gherkin,
            });
          }
        }
      }

      // Process constraints
      if (storyData.constraints) {
        for (const c of storyData.constraints) {
          if (!seenConstraints.has(c.id)) {
            seenConstraints.add(c.id);
            constraints.push({
              id: c.id,
              type: c.type,
              description: c.description,
              severity: c.severity || "warning",
              source: storyData.storyId,
            });

            definitions[c.id] = {
              term: c.id,
              definition: c.description,
              source: storyData.storyId,
              type: "constraint",
            };
          }
        }
      }

      // Process failure conditions
      if (storyData.failureConditions) {
        for (const fc of storyData.failureConditions) {
          const fcId = `failure-${fc.id}`;
          if (!seenConstraints.has(fcId)) {
            seenConstraints.add(fcId);
            constraints.push({
              id: fcId,
              description: `${fc.trigger}${fc.implication ? ` - ${fc.implication}` : ""}`,
              severity: fc.severity === "critical" ? "critical" : "warning",
              threshold: fc.threshold ? `${fc.threshold.operator} ${fc.threshold.value}` : undefined,
              source: storyData.storyId,
            });

            if (fc.threshold) {
              thresholds[fcId] = {
                name: fc.trigger,
                value: fc.threshold.value,
                operator: fc.threshold.operator,
                source: storyData.storyId,
              };
            }
          }
        }
      }
    } else if (upload.fileType === "PARAMETER") {
      const paramData = parsedData as ParsedParameterData;

      if (paramData.parameters) {
        for (const param of paramData.parameters) {
          if (!seenParams.has(param.id)) {
            seenParams.add(param.id);

            // Add full parameter with submetrics
            parameters.push({
              id: param.id,
              name: param.name,
              definition: param.description,
              section: param.section,
              formula: param.formula,
              targetRange: param.targetRange,
              submetrics: param.submetrics?.map((sm) => ({
                id: sm.id,
                name: sm.name,
                weight: sm.weight,
                description: sm.description,
                formula: sm.formula,
                inputs: sm.inputs,
              })),
              interpretationScale: param.interpretationScale,
              actionThresholds: param.actionThresholds,
              workedExample: param.workedExample,
              scoringAnchors: param.scoringAnchors,
              source: "parameter",
            });

            // Extract prompt guidance for this parameter
            if (param.promptGuidance && Array.isArray(param.promptGuidance)) {
              for (const pg of param.promptGuidance) {
                const pgKey = pg.id || `${param.id}-guidance`;
                promptGuidance[pgKey] = {
                  parameterId: param.id,
                  term: pg.term,
                  definition: pg.definition,
                  whenHigh: pg.whenHigh,
                  whenLow: pg.whenLow,
                  whenMedium: pg.whenMedium,
                  promptTemplate: pg.promptTemplate,
                };
              }
            }

            // Add parameter to definitions
            definitions[param.id] = {
              term: param.name,
              definition: param.description,
              source: upload.filename,
              type: "parameter",
            };

            // Add submetrics to definitions
            if (param.submetrics) {
              for (const sm of param.submetrics) {
                definitions[sm.id] = {
                  term: sm.name,
                  definition: sm.description,
                  source: param.id,
                  type: "submetric",
                  weight: sm.weight,
                  formula: sm.formula,
                };

                // Add submetric thresholds
                if (sm.thresholds) {
                  for (const [name, thresh] of Object.entries(sm.thresholds)) {
                    const key = `${sm.id}.${name}`;
                    thresholds[key] = {
                      name,
                      ...thresh,
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

                // Add assumptions as definitions
                if (sm.assumptions) {
                  for (let i = 0; i < sm.assumptions.length; i++) {
                    definitions[`${sm.id}.assumption.${i}`] = {
                      term: `Assumption (${sm.name})`,
                      definition: sm.assumptions[i],
                      source: sm.id,
                      type: "assumption",
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

            // Add action thresholds
            if (param.actionThresholds) {
              for (const at of param.actionThresholds) {
                const key = `${param.id}.${at.status}`;
                thresholds[key] = {
                  name: at.status,
                  value: at.value,
                  operator: at.operator,
                  action: at.action,
                  source: param.id,
                  parameterId: param.id,
                };
              }
            }

            // Add target range as threshold
            if (param.targetRange) {
              thresholds[`${param.id}.target`] = {
                name: "target_range",
                value: `${param.targetRange.min}-${param.targetRange.max}`,
                source: param.id,
                parameterId: param.id,
              };
            }
          }
        }
      }
    }
  }

  // Generate feature ID if none found
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

function incrementVersion(version: string): string {
  const parts = version.split(".");
  if (parts.length === 2) {
    const minor = parseInt(parts[1]) + 1;
    return `${parts[0]}.${minor}`;
  }
  return version + ".1";
}

/**
 * Process story data and add to collections
 */
function processStory(
  storyData: ParsedStoryData,
  constraints: any[],
  validations: any[],
  definitions: Record<string, any>,
  thresholds: Record<string, any>,
  seenConstraints: Set<string>
): { featureId: string; featureName: string; featureDescription: string } {
  let featureId = "";
  let featureName = "";
  let featureDescription = "";

  // Set feature ID from story
  if (storyData.storyId) {
    featureId = storyData.storyId;
    featureName = storyData.title || "Untitled Feature";
    if (storyData.userStory) {
      featureDescription = `As ${storyData.userStory.asA}, I want ${storyData.userStory.iWant} so that ${storyData.userStory.soThat}`;
    }
  }

  // Add user story to definitions
  if (storyData.storyId && storyData.userStory) {
    definitions[`${storyData.storyId}-user-story`] = {
      term: "User Story",
      definition: featureDescription,
      source: storyData.storyId,
      type: "term",
    };
  }

  // Process acceptance criteria
  if (storyData.acceptanceCriteria) {
    for (const ac of storyData.acceptanceCriteria) {
      // Add AC as definition
      definitions[ac.id] = {
        term: ac.title || ac.id,
        definition: `GIVEN ${ac.given} WHEN ${ac.when} THEN ${ac.then}`,
        source: storyData.storyId,
        type: "acceptance_criterion",
      };

      // Add thresholds
      if (ac.thresholds) {
        for (const [name, thresh] of Object.entries(ac.thresholds)) {
          const thresholdKey = `${ac.id}.${name}`;
          thresholds[thresholdKey] = {
            name,
            ...thresh,
            source: ac.id,
          };
        }
      }

      // Add validation from gherkin
      if (ac.gherkin) {
        validations.push({
          name: ac.title || ac.id,
          given: Array.isArray(ac.given) ? ac.given : [ac.given],
          when: Array.isArray(ac.when) ? ac.when : [ac.when],
          then: Array.isArray(ac.then) ? ac.then : [ac.then],
          source: storyData.storyId,
          acId: ac.id,
          gherkin: ac.gherkin,
        });
      }
    }
  }

  // Process constraints
  if (storyData.constraints) {
    for (const c of storyData.constraints) {
      if (!seenConstraints.has(c.id)) {
        seenConstraints.add(c.id);
        constraints.push({
          id: c.id,
          type: c.type,
          description: c.description,
          severity: c.severity || "warning",
          source: storyData.storyId,
        });

        definitions[c.id] = {
          term: c.id,
          definition: c.description,
          source: storyData.storyId,
          type: "constraint",
        };
      }
    }
  }

  // Process failure conditions
  if (storyData.failureConditions) {
    for (const fc of storyData.failureConditions) {
      const fcId = `failure-${fc.id}`;
      if (!seenConstraints.has(fcId)) {
        seenConstraints.add(fcId);
        constraints.push({
          id: fcId,
          description: `${fc.trigger}${fc.implication ? ` - ${fc.implication}` : ""}`,
          severity: fc.severity === "critical" ? "critical" : "warning",
          threshold: fc.threshold ? `${fc.threshold.operator} ${fc.threshold.value}` : undefined,
          source: storyData.storyId,
        });

        if (fc.threshold) {
          thresholds[fcId] = {
            name: fc.trigger,
            value: fc.threshold.value,
            operator: fc.threshold.operator,
            source: storyData.storyId,
          };
        }
      }
    }
  }

  return { featureId, featureName, featureDescription };
}

/**
 * Process parameter data and add to collections
 */
function processParameters(
  paramData: ParsedParameterData,
  parameters: any[],
  definitions: Record<string, any>,
  thresholds: Record<string, any>,
  seenParams: Set<string>,
  sourceFilename: string,
  promptGuidance?: Record<string, any>
): void {
  if (!paramData.parameters) return;

  for (const param of paramData.parameters) {
    if (!seenParams.has(param.id)) {
      seenParams.add(param.id);

      // Add full parameter with submetrics and scoringAnchors
      parameters.push({
        id: param.id,
        name: param.name,
        definition: param.description,
        section: param.section,
        formula: param.formula,
        targetRange: param.targetRange,
        submetrics: param.submetrics?.map((sm) => ({
          id: sm.id,
          name: sm.name,
          weight: sm.weight,
          description: sm.description,
          formula: sm.formula,
          inputs: sm.inputs,
        })),
        interpretationScale: param.interpretationScale,
        actionThresholds: param.actionThresholds,
        workedExample: param.workedExample,
        scoringAnchors: (param as any).scoringAnchors,
        source: "parameter",
      });

      // Extract prompt guidance for this parameter
      if (promptGuidance && (param as any).promptGuidance && Array.isArray((param as any).promptGuidance)) {
        for (const pg of (param as any).promptGuidance) {
          const pgKey = pg.id || `${param.id}-guidance`;
          promptGuidance[pgKey] = {
            parameterId: param.id,
            term: pg.term,
            definition: pg.definition,
            whenHigh: pg.whenHigh,
            whenLow: pg.whenLow,
            whenMedium: pg.whenMedium,
            promptTemplate: pg.promptTemplate,
          };
        }
      }

      // Add parameter to definitions
      definitions[param.id] = {
        term: param.name,
        definition: param.description,
        source: sourceFilename,
        type: "parameter",
      };

      // Add submetrics to definitions
      if (param.submetrics) {
        for (const sm of param.submetrics) {
          definitions[sm.id] = {
            term: sm.name,
            definition: sm.description,
            source: param.id,
            type: "submetric",
            weight: sm.weight,
            formula: sm.formula,
          };

          // Add submetric thresholds
          if (sm.thresholds) {
            for (const [name, thresh] of Object.entries(sm.thresholds)) {
              const key = `${sm.id}.${name}`;
              thresholds[key] = {
                name,
                ...thresh,
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

          // Add assumptions as definitions
          if (sm.assumptions) {
            for (let i = 0; i < sm.assumptions.length; i++) {
              definitions[`${sm.id}.assumption.${i}`] = {
                term: `Assumption (${sm.name})`,
                definition: sm.assumptions[i],
                source: sm.id,
                type: "assumption",
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

      // Add action thresholds
      if (param.actionThresholds) {
        for (const at of param.actionThresholds) {
          const key = `${param.id}.${at.status}`;
          thresholds[key] = {
            name: at.status,
            value: at.value,
            operator: at.operator,
            action: at.action,
            source: param.id,
            parameterId: param.id,
          };
        }
      }

      // Add target range as threshold
      if (param.targetRange) {
        thresholds[`${param.id}.target`] = {
          name: "target_range",
          value: `${param.targetRange.min}-${param.targetRange.max}`,
          source: param.id,
          parameterId: param.id,
        };
      }
    }
  }
}
