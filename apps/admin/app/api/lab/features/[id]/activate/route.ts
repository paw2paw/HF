import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ParameterType, AnalysisOutputType, SpecificationScope, MemoryCategory, SpecType } from "@prisma/client";

/**
 * POST /api/lab/features/[id]/activate
 *
 * Activate a BDDFeatureSet by creating/updating:
 * 1. Parameter records for each parameter in the feature set
 * 2. ParameterScoringAnchor records for calibration
 * 3. AnalysisSpec records with triggers and actions (MEASURE for parameters)
 * 4. AnalysisSpec records for memory extraction (LEARN specs)
 * 5. PromptSlug records for personality-based prompt composition
 *
 * This bridges the Lab → Analysis pipeline.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { activate } = body;

    // If deactivating, just toggle the flag
    if (!activate) {
      const feature = await prisma.bDDFeatureSet.update({
        where: { id },
        data: {
          isActive: false,
          activatedAt: null,
        },
        select: {
          id: true,
          featureId: true,
          name: true,
          isActive: true,
          activatedAt: true,
        },
      });
      return NextResponse.json({ ok: true, feature, deactivated: true });
    }

    // Fetch the full feature set
    const featureSet = await prisma.bDDFeatureSet.findUnique({
      where: { id },
    });

    if (!featureSet) {
      return NextResponse.json(
        { ok: false, error: "Feature set not found" },
        { status: 404 }
      );
    }

    // Parse the compiled data
    const compiledParams = (featureSet.parameters as any[]) || [];
    const compiledConstraints = (featureSet.constraints as any[]) || [];
    const compiledDefinitions = (featureSet.definitions as Record<string, any>) || {};
    const scoringSpec = featureSet.scoringSpec as any;
    const promptGuidance = (featureSet.promptGuidance as Record<string, any>) || {};
    // Use specType from feature set, defaulting to DOMAIN
    const specType = featureSet.specType || SpecType.DOMAIN;

    const results = {
      parametersCreated: 0,
      parametersUpdated: 0,
      anchorsCreated: 0,
      specsCreated: 0,
      learnSpecsCreated: 0,
      triggersCreated: 0,
      actionsCreated: 0,
      promptSlugsCreated: 0,
    };

    // Extract learn specs from definitions (type: "learn_spec")
    const learnSpecs: any[] = [];
    for (const [key, def] of Object.entries(compiledDefinitions)) {
      if (def.type === "learn_spec" || def.type === "memory_extraction") {
        learnSpecs.push({ id: key, ...def });
      }
    }

    // Extract prompt guidance specs from definitions (type: "prompt_guidance")
    const promptSpecs: any[] = [];
    for (const [key, def] of Object.entries(compiledDefinitions)) {
      if (def.type === "prompt_guidance" || def.type === "personality_prompt") {
        promptSpecs.push({ id: key, ...def });
      }
    }
    // Also include promptGuidance from feature set
    for (const [key, guidance] of Object.entries(promptGuidance)) {
      if (typeof guidance === "object") {
        promptSpecs.push({ id: key, ...guidance });
      }
    }
    // Also extract promptGuidance directly from each parameter
    for (const param of compiledParams) {
      if (param.promptGuidance && Array.isArray(param.promptGuidance)) {
        for (const pg of param.promptGuidance) {
          promptSpecs.push({
            id: pg.id || `${param.id}-guidance`,
            parameterId: param.id,
            ...pg,
          });
        }
      }
    }

    // 1. Create/update Parameter records
    for (const param of compiledParams) {
      const parameterId = param.id || param.parameterId;
      if (!parameterId) continue;

      const existingParam = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      const paramData = {
        parameterId,
        name: param.name || parameterId,
        definition: param.description || param.definition || null,
        sectionId: param.section || "lab-imported",
        domainGroup: param.domain || "lab",
        scaleType: param.scaleType || "0-1",
        directionality: param.directionality || "positive",
        computedBy: "lab-bdd",
        parameterType: ParameterType.STATE, // Default to STATE for analyzed parameters
        interpretationHigh: param.interpretationHigh || null,
        interpretationLow: param.interpretationLow || null,
      };

      if (existingParam) {
        await prisma.parameter.update({
          where: { parameterId },
          data: paramData,
        });
        results.parametersUpdated++;
      } else {
        await prisma.parameter.create({
          data: paramData,
        });
        results.parametersCreated++;
      }

      // 2. Create scoring anchors - first from direct scoringAnchors array
      if (param.scoringAnchors && Array.isArray(param.scoringAnchors)) {
        for (const anchor of param.scoringAnchors) {
          const existing = await prisma.parameterScoringAnchor.findFirst({
            where: {
              parameterId,
              example: anchor.example,
            },
          });
          if (!existing && anchor.example) {
            await prisma.parameterScoringAnchor.create({
              data: {
                parameterId,
                example: anchor.example,
                score: anchor.score ?? 0.5,
                rationale: anchor.rationale || null,
                source: `lab:${featureSet.featureId}`,
                isGold: anchor.isGold ?? true, // Direct anchors from BDD are authoritative
              },
            });
            results.anchorsCreated++;
          }
        }
      }

      // Also create scoring anchors from submetrics or examples
      if (param.submetrics && Array.isArray(param.submetrics)) {
        for (const sub of param.submetrics) {
          // Extract example definitions as anchors
          if (sub.definitions) {
            for (const [term, def] of Object.entries(sub.definitions)) {
              // Skip if anchor already exists
              const existing = await prisma.parameterScoringAnchor.findFirst({
                where: {
                  parameterId,
                  example: { contains: term },
                },
              });
              if (!existing) {
                await prisma.parameterScoringAnchor.create({
                  data: {
                    parameterId,
                    example: `${term}: ${def}`,
                    score: 0.5, // Default middle score - can be refined
                    rationale: `Definition from submetric ${sub.id || sub.name}`,
                    source: `lab:${featureSet.featureId}`,
                  },
                });
                results.anchorsCreated++;
              }
            }
          }

          // Extract thresholds as anchors
          if (sub.thresholds) {
            for (const [name, thresh] of Object.entries(sub.thresholds as Record<string, any>)) {
              const score = typeof thresh.value === "number" ? thresh.value / 100 : 0.5;
              const existing = await prisma.parameterScoringAnchor.findFirst({
                where: {
                  parameterId,
                  example: { contains: name },
                },
              });
              if (!existing) {
                await prisma.parameterScoringAnchor.create({
                  data: {
                    parameterId,
                    example: `Threshold "${name}": ${thresh.basis || thresh.value}`,
                    score: Math.min(1, Math.max(0, score)),
                    rationale: thresh.basis || `Threshold from ${sub.id || sub.name}`,
                    source: `lab:${featureSet.featureId}`,
                  },
                });
                results.anchorsCreated++;
              }
            }
          }
        }
      }

      // Add interpretation scale as anchors
      if (param.interpretationScale && Array.isArray(param.interpretationScale)) {
        for (const range of param.interpretationScale) {
          const avgScore = ((range.min || 0) + (range.max || 1)) / 2;
          const existing = await prisma.parameterScoringAnchor.findFirst({
            where: {
              parameterId,
              example: { contains: range.label },
            },
          });
          if (!existing) {
            await prisma.parameterScoringAnchor.create({
              data: {
                parameterId,
                example: `${range.label}: ${range.implication || ""}`,
                score: avgScore,
                rationale: `Interpretation range ${range.min}-${range.max}`,
                source: `lab:${featureSet.featureId}`,
                isGold: true, // Interpretation scales are authoritative
              },
            });
            results.anchorsCreated++;
          }
        }
      }
    }

    // 3. Create AnalysisSpec for the feature set
    const specSlug = `lab-${featureSet.featureId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    // Build instruction from scoring spec or constraints
    let instruction = "";
    if (scoringSpec?.instruction) {
      instruction = scoringSpec.instruction;
    } else if (compiledConstraints.length > 0) {
      instruction = compiledConstraints
        .map((c: any) => `- ${c.description || c.rule || c.name}`)
        .join("\n");
    } else {
      instruction = `Analyze the transcript and score the following parameters: ${compiledParams.map((p: any) => p.id || p.name).join(", ")}`;
    }

    // Upsert the AnalysisSpec
    const existingSpec = await prisma.analysisSpec.findUnique({
      where: { slug: specSlug },
    });

    let spec;
    const specData = {
      name: featureSet.name,
      description: featureSet.description || `Analysis spec generated from BDD Lab feature ${featureSet.featureId}`,
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      specType, // Use specType from feature set
      domain: "lab",
      priority: 10,
      isActive: true,
      version: featureSet.version,
      promptTemplate: instruction,
      compiledAt: new Date(),
      compiledSetId: featureSet.id,
      isDirty: false,
    };

    if (existingSpec) {
      spec = await prisma.analysisSpec.update({
        where: { slug: specSlug },
        data: specData,
      });
    } else {
      spec = await prisma.analysisSpec.create({
        data: {
          slug: specSlug,
          ...specData,
        },
      });
      results.specsCreated++;
    }

    // 4. Create AnalysisTrigger (one per spec, contains the full Gherkin)
    // First, delete existing triggers to replace them
    await prisma.analysisTrigger.deleteMany({
      where: { specId: spec.id },
    });

    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "A call transcript is available for analysis",
        when: "The analysis pipeline processes the call",
        then: `Score the following parameters: ${compiledParams.map((p: any) => p.id || p.name).join(", ")}`,
        name: featureSet.name,
        notes: instruction,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    // 5. Create AnalysisAction for each parameter
    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      const parameterId = param.id || param.parameterId;

      // Verify parameter exists
      const paramRecord = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      if (paramRecord) {
        await prisma.analysisAction.create({
          data: {
            triggerId: trigger.id,
            description: param.description || `Score ${parameterId} based on transcript evidence`,
            weight: 1.0,
            parameterId,
            sortOrder: i,
          },
        });
        results.actionsCreated++;
      }
    }

    // 6. Create LEARN specs for memory extraction
    const createdLearnSpecs: any[] = [];
    for (const learnSpec of learnSpecs) {
      const learnSlug = `lab-learn-${learnSpec.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

      const existingLearnSpec = await prisma.analysisSpec.findUnique({
        where: { slug: learnSlug },
      });

      const learnSpecData = {
        name: learnSpec.term || learnSpec.name || `Learn: ${learnSpec.id}`,
        description: learnSpec.definition || learnSpec.description || `Extract ${learnSpec.category || "facts"} from transcript`,
        scope: SpecificationScope.DOMAIN,
        outputType: AnalysisOutputType.LEARN,
        specType, // Use specType from feature set (LEARN specs usually SYSTEM)
        domain: learnSpec.domain || "memory",
        priority: learnSpec.priority || 5,
        isActive: true,
        version: featureSet.version,
        promptTemplate: learnSpec.promptTemplate || null,
        compiledAt: new Date(),
        compiledSetId: featureSet.id,
        isDirty: false,
      };

      let learnSpecRecord;
      if (existingLearnSpec) {
        learnSpecRecord = await prisma.analysisSpec.update({
          where: { slug: learnSlug },
          data: learnSpecData,
        });
      } else {
        learnSpecRecord = await prisma.analysisSpec.create({
          data: {
            slug: learnSlug,
            ...learnSpecData,
          },
        });
        results.learnSpecsCreated++;
      }

      // Delete existing triggers for this learn spec
      await prisma.analysisTrigger.deleteMany({
        where: { specId: learnSpecRecord.id },
      });

      // Create trigger for the learn spec
      const learnTrigger = await prisma.analysisTrigger.create({
        data: {
          specId: learnSpecRecord.id,
          given: learnSpec.given || "A call transcript is available",
          when: learnSpec.when || "The caller mentions personal information",
          then: learnSpec.then || `Extract ${learnSpec.category || "facts"} about the caller`,
          name: learnSpec.term || learnSpec.name,
          notes: learnSpec.definition,
          sortOrder: 0,
        },
      });
      results.triggersCreated++;

      // Create actions for each extraction target
      const extractionTargets = learnSpec.extractions || learnSpec.targets || [learnSpec];
      for (let i = 0; i < extractionTargets.length; i++) {
        const target = extractionTargets[i];
        const category = (target.category || learnSpec.category || "FACT").toUpperCase();

        // Map category string to MemoryCategory enum
        let memoryCategory: MemoryCategory;
        switch (category) {
          case "PREFERENCE": memoryCategory = MemoryCategory.PREFERENCE; break;
          case "EVENT": memoryCategory = MemoryCategory.EVENT; break;
          case "TOPIC": memoryCategory = MemoryCategory.TOPIC; break;
          case "RELATIONSHIP": memoryCategory = MemoryCategory.RELATIONSHIP; break;
          case "CONTEXT": memoryCategory = MemoryCategory.CONTEXT; break;
          default: memoryCategory = MemoryCategory.FACT; break;
        }

        await prisma.analysisAction.create({
          data: {
            triggerId: learnTrigger.id,
            description: target.description || target.definition || `Extract ${target.keyPrefix || category.toLowerCase()} information`,
            weight: 1.0,
            learnCategory: memoryCategory,
            learnKeyPrefix: target.keyPrefix || target.key_prefix || null,
            learnKeyHint: target.keyHint || target.hint || null,
            sortOrder: i,
          },
        });
        results.actionsCreated++;
      }

      createdLearnSpecs.push({
        id: learnSpecRecord.id,
        slug: learnSpecRecord.slug,
        name: learnSpecRecord.name,
      });
    }

    // 7. Create PromptSlug records for personality-based prompt composition
    const createdPromptSlugs: any[] = [];
    for (const promptSpec of promptSpecs) {
      const slugId = `lab-prompt-${promptSpec.id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

      const existingSlug = await prisma.promptSlug.findUnique({
        where: { slug: slugId },
      });

      if (!existingSlug) {
        // Determine source type based on spec
        const sourceType = promptSpec.parameterId ? "PARAMETER" : "COMPOSITE";

        const promptSlugRecord = await prisma.promptSlug.create({
          data: {
            slug: slugId,
            name: promptSpec.term || promptSpec.name || promptSpec.id,
            description: promptSpec.definition || promptSpec.description,
            sourceType,
            fallbackPrompt: promptSpec.fallback || null,
            priority: promptSpec.priority || 0,
            isActive: true,
            version: featureSet.version,
          },
        });

        // Create ranges if provided (high/low personality thresholds)
        if (promptSpec.ranges || promptSpec.whenHigh || promptSpec.whenLow) {
          const ranges = promptSpec.ranges || [];

          // Add high range
          if (promptSpec.whenHigh) {
            ranges.push({
              minValue: 0.7,
              maxValue: 1.0,
              label: "High",
              prompt: promptSpec.whenHigh,
            });
          }

          // Add low range
          if (promptSpec.whenLow) {
            ranges.push({
              minValue: 0.0,
              maxValue: 0.3,
              label: "Low",
              prompt: promptSpec.whenLow,
            });
          }

          // Add medium range if both high and low exist
          if (promptSpec.whenMedium || (promptSpec.whenHigh && promptSpec.whenLow)) {
            ranges.push({
              minValue: 0.3,
              maxValue: 0.7,
              label: "Medium",
              prompt: promptSpec.whenMedium || promptSpec.fallback || "",
            });
          }

          for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            await prisma.promptSlugRange.create({
              data: {
                slugId: promptSlugRecord.id,
                minValue: range.minValue ?? range.min ?? null,
                maxValue: range.maxValue ?? range.max ?? null,
                label: range.label,
                prompt: range.prompt || range.text || "",
                sortOrder: i,
              },
            });
          }
        }

        // Link to parameter if specified
        if (promptSpec.parameterId) {
          const paramExists = await prisma.parameter.findUnique({
            where: { parameterId: promptSpec.parameterId },
          });
          if (paramExists) {
            await prisma.promptSlugParameter.create({
              data: {
                slugId: promptSlugRecord.id,
                parameterId: promptSpec.parameterId,
                weight: 1.0,
                mode: "ABSOLUTE",
                sortOrder: 0,
              },
            });
          }
        }

        results.promptSlugsCreated++;
        createdPromptSlugs.push({
          id: promptSlugRecord.id,
          slug: promptSlugRecord.slug,
          name: promptSlugRecord.name,
        });
      }
    }

    // 8. Update the feature set as active
    const updatedFeature = await prisma.bDDFeatureSet.update({
      where: { id },
      data: {
        isActive: true,
        activatedAt: new Date(),
      },
      select: {
        id: true,
        featureId: true,
        name: true,
        isActive: true,
        activatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      feature: updatedFeature,
      specs: {
        measure: {
          id: spec.id,
          slug: spec.slug,
          name: spec.name,
        },
        learn: createdLearnSpecs,
        promptSlugs: createdPromptSlugs,
      },
      results,
    });
  } catch (error: any) {
    console.error("Error activating feature set:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to activate feature set" },
      { status: 500 }
    );
  }
}
