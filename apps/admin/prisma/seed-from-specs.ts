/**
 * Seed From Specs - Load and activate BDD spec files
 *
 * This module provides the single source of truth for seeding:
 * - Reads JSON spec files from bdd-specs/ folder
 * - Creates BDDFeatureSet records
 * - Activates them to derive Parameters, ScoringAnchors, PromptSlugs, etc.
 *
 * Usage:
 *   import { seedFromSpecs } from "./seed-from-specs";
 *   await seedFromSpecs();
 */

import * as fs from "fs";
import * as path from "path";
import {
  PrismaClient,
  ParameterType,
  SpecificationScope,
  AnalysisOutputType,
  SpecType,
  SpecRole,
  MemoryCategory,
} from "@prisma/client";
import {
  parseJsonSpec,
  convertJsonSpecToHybrid,
  JsonFeatureSpec,
} from "../lib/bdd/ai-parser";
import { compileSpecToTemplate } from "../lib/bdd/compile-specs";
import { ContractRegistry, ensureContractsLoaded } from "../lib/contracts/registry";

const prisma = new PrismaClient();

// Path to spec files
// Use process.cwd() instead of __dirname to work in both CLI and Next.js API contexts
function getSpecsFolder(): string {
  // Try process.cwd() first (works in Next.js API routes)
  const cwdPath = path.join(process.cwd(), "bdd-specs");
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  // Fallback to __dirname for CLI scripts
  return path.join(__dirname, "../bdd-specs");
}

export interface SeedSpecResult {
  specId: string;
  title: string;
  parametersCreated: number;
  parametersUpdated: number;
  anchorsCreated: number;
  specsCreated: number;
  triggersCreated: number;
  actionsCreated: number;
  promptSlugsCreated: number;
  agentCreated: boolean;
  curriculumCreated: boolean;
}

/**
 * Load all .spec.json files from the bdd-specs folder
 */
export function loadSpecFiles(): { filename: string; content: JsonFeatureSpec; rawJson: any }[] {
  const specs: { filename: string; content: JsonFeatureSpec; rawJson: any }[] = [];
  const specsFolder = getSpecsFolder();

  if (!fs.existsSync(specsFolder)) {
    console.log(`   Warning: Specs folder not found at ${specsFolder}`);
    return specs;
  }

  const files = fs.readdirSync(specsFolder).filter(f =>
    f.endsWith(".spec.json") &&
    !f.includes("schema") &&
    !f.includes("config")
  );
  console.log(`   Found ${files.length} spec files in ${specsFolder}`);

  for (const filename of files) {
    const filePath = path.join(specsFolder, filename);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const rawJson = JSON.parse(content); // Keep raw JSON for storage
      const parseResult = parseJsonSpec(content);

      if (parseResult.success) {
        specs.push({ filename, content: parseResult.data, rawJson });
      } else {
        console.log(`   Warning: Failed to parse ${filename}: ${parseResult.errors.join(", ")}`);
      }
    } catch (e: any) {
      console.log(`   Warning: Error reading ${filename}: ${e.message}`);
    }
  }

  return specs;
}

/**
 * Create or update a BDDFeatureSet from a parsed spec
 * Now also stores the raw JSON for production runtime (no filesystem dependency)
 */
async function upsertFeatureSet(spec: JsonFeatureSpec, filename: string, rawJson?: any) {
  const hybrid = convertJsonSpecToHybrid(spec);

  // Extract data from hybrid result - note the nested structure
  const parameters = hybrid.parameterData?.parameters || [];
  const storyData = hybrid.storyData;

  // Build scoring spec metadata from raw JSON
  const scoringSpec = rawJson ? {
    domain: rawJson.domain || "general",
    outputType: rawJson.outputType || "MEASURE",
    specRole: rawJson.specRole || undefined,
  } : null;

  // Build the feature set data
  // Note: parameters is required, so we ensure it's always an array
  const featureSetData = {
    featureId: spec.id,
    name: spec.title,
    description: spec.story ? `As ${spec.story.asA}, I want ${spec.story.iWant} so that ${spec.story.soThat}` : undefined,
    version: spec.version || "1.0",
    specType: spec.specType || "DOMAIN",
    // Store the raw spec JSON for production runtime (removes filesystem dependency)
    rawSpec: rawJson || null,
    // Store scoring spec metadata for activation
    scoringSpec: scoringSpec as any,
    // Store the parsed data (ensure parameters is always an array, never undefined)
    parameters: parameters as any,
    constraints: (storyData?.constraints || []) as any,
    validations: [] as any, // Validations are extracted during activation
    definitions: {} as any, // Definitions are derived during activation
    thresholds: [] as any, // Thresholds are derived during activation
    promptGuidance: {} as any,
    // Stats
    parameterCount: parameters.length,
    constraintCount: storyData?.constraints?.length || 0,
    definitionCount: 0,
  };

  // Upsert the feature set
  const existing = await prisma.bDDFeatureSet.findFirst({
    where: { featureId: spec.id },
  });

  if (existing) {
    return prisma.bDDFeatureSet.update({
      where: { id: existing.id },
      data: featureSetData,
    });
  } else {
    return prisma.bDDFeatureSet.create({
      data: featureSetData,
    });
  }
}

/**
 * Activate a feature set - creates all derived records
 * (This is essentially the same logic as activate/route.ts but callable directly)
 */
async function activateFeatureSet(featureSetId: string): Promise<SeedSpecResult> {
  const featureSet = await prisma.bDDFeatureSet.findUnique({
    where: { id: featureSetId },
  });

  if (!featureSet) {
    throw new Error(`Feature set not found: ${featureSetId}`);
  }

  const compiledParams = (featureSet.parameters as any[]) || [];
  const compiledConstraints = (featureSet.constraints as any[]) || [];
  const compiledDefinitions = (featureSet.definitions as Record<string, any>) || {};
  const scoringSpec = featureSet.scoringSpec as any;
  const rawSpecData = featureSet.rawSpec as any;

  // Map specType string to valid SpecType enum (only SYSTEM and DOMAIN are valid)
  const rawSpecType = featureSet.specType || "DOMAIN";
  const specType = rawSpecType === "SYSTEM" ? SpecType.SYSTEM : SpecType.DOMAIN;

  const declaredOutputType = (scoringSpec?.outputType as AnalysisOutputType) || AnalysisOutputType.MEASURE;

  // Determine specRole (UI category) based on declared specRole or outputType
  // This maps the old META catch-all to specific categories
  let specRole: SpecRole;
  const declaredSpecRole = scoringSpec?.specRole as SpecRole | undefined;

  if (declaredSpecRole === SpecRole.IDENTITY) {
    specRole = SpecRole.IDENTITY;
  } else if (declaredSpecRole === SpecRole.CONTENT) {
    specRole = SpecRole.CONTENT;
  } else if (declaredSpecRole === SpecRole.VOICE) {
    specRole = SpecRole.VOICE;
  } else if (declaredSpecRole === SpecRole.GUARDRAIL) {
    specRole = SpecRole.GUARDRAIL;
  } else {
    // Map outputType to specRole for META/unspecified specs
    switch (declaredOutputType) {
      case AnalysisOutputType.MEASURE:
      case AnalysisOutputType.MEASURE_AGENT:
      case AnalysisOutputType.LEARN:
        specRole = SpecRole.MEASURE;
        break;
      case AnalysisOutputType.ADAPT:
        specRole = SpecRole.ADAPT;
        break;
      case AnalysisOutputType.REWARD:
        specRole = SpecRole.REWARD;
        break;
      case AnalysisOutputType.SUPERVISE:
        specRole = SpecRole.GUARDRAIL;
        break;
      default:
        specRole = SpecRole.MEASURE; // Default for COMPOSE, AGGREGATE, etc.
    }
  }

  // Determine outputType: IDENTITY/CONTENT/VOICE specs use COMPOSE (they contribute to prompts)
  // Other specs use their declared outputType
  let outputType: AnalysisOutputType;
  if (specRole === SpecRole.IDENTITY || specRole === SpecRole.CONTENT || specRole === SpecRole.VOICE) {
    outputType = AnalysisOutputType.COMPOSE; // Prompt contributors
  } else {
    outputType = declaredOutputType;
  }

  const results: SeedSpecResult = {
    specId: featureSet.featureId,
    title: featureSet.name,
    parametersCreated: 0,
    parametersUpdated: 0,
    anchorsCreated: 0,
    specsCreated: 0,
    triggersCreated: 0,
    actionsCreated: 0,
    promptSlugsCreated: 0,
    agentCreated: false,
    curriculumCreated: false,
  };

  // 1. Create/update Parameter records
  for (const param of compiledParams) {
    const parameterId = param.id || param.parameterId;
    if (!parameterId) continue;

    const existingParam = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    // Determine parameter type based on spec
    let parameterType: ParameterType = ParameterType.STATE;
    if (scoringSpec?.domain === "personality") {
      parameterType = ParameterType.TRAIT;
    } else if (param.isAdjustable) {
      parameterType = ParameterType.BEHAVIOR;
    }

    // Extract interpretation from interpretationScale
    let interpretationHigh: string | null = null;
    let interpretationLow: string | null = null;
    if (param.interpretationScale && Array.isArray(param.interpretationScale)) {
      const highRange = param.interpretationScale.find((r: any) => r.max >= 0.9 || r.label?.toLowerCase().includes("high"));
      const lowRange = param.interpretationScale.find((r: any) => r.min <= 0.1 || r.label?.toLowerCase().includes("low") || r.label?.toLowerCase().includes("disengaged"));
      if (highRange) interpretationHigh = `${highRange.label}: ${highRange.implication || ""}`;
      if (lowRange) interpretationLow = `${lowRange.label}: ${lowRange.implication || ""}`;
    }

    const paramData = {
      parameterId,
      name: param.name || parameterId,
      definition: param.description || param.definition || null,
      sectionId: param.section || scoringSpec?.domain || "imported",
      domainGroup: scoringSpec?.domain || "general",
      scaleType: "0-1",
      directionality: "positive",
      computedBy: `spec:${featureSet.featureId}`,
      parameterType,
      isAdjustable: param.isAdjustable || false,
      interpretationHigh,
      interpretationLow,
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

    // 2. Create scoring anchors from param.scoringAnchors
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
              source: `spec:${featureSet.featureId}`,
              isGold: anchor.isGold ?? true,
            },
          });
          results.anchorsCreated++;
        }
      }
    }

    // 3. Create prompt slugs from param.promptGuidance
    if (param.promptGuidance && Array.isArray(param.promptGuidance)) {
      for (const pg of param.promptGuidance) {
        const slugId = `spec-${parameterId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-guidance`;

        const existingSlug = await prisma.promptSlug.findUnique({
          where: { slug: slugId },
        });

        if (!existingSlug && (pg.whenHigh || pg.whenLow)) {
          const promptSlugRecord = await prisma.promptSlug.create({
            data: {
              slug: slugId,
              name: `${param.name} Guidance`,
              description: param.description,
              sourceType: "PARAMETER",
              priority: 50,
              isActive: true,
              memorySummaryTemplate: pg.promptTemplate || null,
            },
          });

          // Create ranges
          const ranges: { minValue: number; maxValue: number; label: string; prompt: string }[] = [];

          if (pg.whenHigh) {
            ranges.push({ minValue: 0.7, maxValue: 1.0, label: "High", prompt: pg.whenHigh });
          }
          if (pg.whenLow) {
            ranges.push({ minValue: 0.0, maxValue: 0.3, label: "Low", prompt: pg.whenLow });
          }
          if (pg.whenMedium) {
            ranges.push({ minValue: 0.3, maxValue: 0.7, label: "Medium", prompt: pg.whenMedium });
          }

          for (let i = 0; i < ranges.length; i++) {
            await prisma.promptSlugRange.create({
              data: {
                slugId: promptSlugRecord.id,
                minValue: ranges[i].minValue,
                maxValue: ranges[i].maxValue,
                label: ranges[i].label,
                prompt: ranges[i].prompt,
                sortOrder: i,
              },
            });
          }

          // Link to parameter
          await prisma.promptSlugParameter.create({
            data: {
              slugId: promptSlugRecord.id,
              parameterId,
              weight: 1.0,
              mode: "ABSOLUTE",
              sortOrder: 0,
            },
          });

          results.promptSlugsCreated++;
        }
      }
    }
  }

  // 3b. For ADAPT specs: Auto-create behavior parameters from adaptation rules
  if (outputType === AnalysisOutputType.ADAPT) {
    console.log(`      🔗 Processing ADAPT spec - extracting target parameters from adaptation rules...`);

    // Extract all targetParameter values from adaptation rules in all parameters
    const targetParameterIds = new Set<string>();
    const targetParameterMetadata = new Map<string, { section?: string; rationale?: string }>();

    for (const param of compiledParams) {
      if (param.config?.adaptationRules && Array.isArray(param.config.adaptationRules)) {
        for (const rule of param.config.adaptationRules) {
          if (rule.actions && Array.isArray(rule.actions)) {
            for (const action of rule.actions) {
              if (action.targetParameter) {
                targetParameterIds.add(action.targetParameter);

                // Store metadata for parameter creation
                if (!targetParameterMetadata.has(action.targetParameter)) {
                  targetParameterMetadata.set(action.targetParameter, {
                    section: param.section,
                    rationale: action.rationale,
                  });
                }
              }
            }
          }
        }
      }
    }

    console.log(`      Found ${targetParameterIds.size} unique target parameters: ${Array.from(targetParameterIds).join(", ")}`);

    // Create missing behavior parameters
    for (const parameterId of targetParameterIds) {
      const existing = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      if (!existing) {
        const metadata = targetParameterMetadata.get(parameterId);

        // Infer name from parameterId (convert kebab-case to Title Case)
        const name = parameterId
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        // Infer domainGroup from section or use default
        const domainGroup = metadata?.section || scoringSpec?.domain || "teaching";

        // Create the parameter
        await prisma.parameter.create({
          data: {
            parameterId,
            name,
            definition: metadata?.rationale || `Behavior parameter auto-created from ${featureSet.featureId} adaptation rules`,
            sectionId: metadata?.section || "teaching",
            domainGroup,
            scaleType: "0-1",
            directionality: "positive",
            computedBy: `spec:${featureSet.featureId}`,
            parameterType: ParameterType.BEHAVIOR,
            isAdjustable: true,
            interpretationHigh: null,
            interpretationLow: null,
          },
        });

        results.parametersCreated++;
        console.log(`      ✓ Auto-created BEHAVIOR parameter: ${parameterId} (${domainGroup})`);
      }
    }
  }

  // 4. Create AnalysisSpec for the feature
  const specSlug = `spec-${featureSet.featureId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // Build description from story
  const description = featureSet.description || `Analysis spec from ${featureSet.featureId}`;

  // Determine scope based on specType
  let scope: SpecificationScope = SpecificationScope.DOMAIN;
  if (specType === SpecType.SYSTEM) {
    scope = SpecificationScope.SYSTEM;
  }

  const existingSpec = await prisma.analysisSpec.findUnique({
    where: { slug: specSlug },
  });

  // Build config from parameters based on spec type
  // This makes the config available to compose-prompt and pipeline for reading spec-defined values
  let config: Record<string, any> | null = null;

  // For COMPOSE specs: preserve the full parameters array so code can look up by parameter ID
  // This is critical - specs define behavior, not hardcoded values in code
  // For CONTENT specs, we need the full parameter structure (section, name, description) for curriculum composer
  if (outputType === AnalysisOutputType.COMPOSE) {
    // If this is a CONTENT spec, preserve full parameter structure from featureSet
    if (specRole === SpecRole.CONTENT && featureSet.parameters) {
      config = {
        parameters: featureSet.parameters,
      };
      console.log(`      Built COMPOSE config with ${(featureSet.parameters as any[]).length} parameters (full structure preserved for CONTENT spec)`);
    } else {
      // For other COMPOSE specs, use compiled params
      config = {
        parameters: compiledParams.map(p => ({
          id: p.id || p.parameterId,
          config: p.config || {},
        })),
      };
      console.log(`      Built COMPOSE config with ${compiledParams.length} parameters`);
    }
    // Also flatten top-level for backward compatibility
    for (const param of compiledParams) {
      if (param.config) {
        Object.assign(config, param.config);
      }
    }
    // Copy metadata from rawSpec if present (required for contract-based specs)
    if (rawSpecData?.metadata) {
      config.metadata = rawSpecData.metadata;
      console.log(`      Copied metadata from rawSpec (sections: ${Object.keys(rawSpecData.metadata).join(", ")})`);
    }
    // Copy sections from rawSpec if present (for COMP-001 composition pipeline)
    if (rawSpecData?.sections) {
      config.sections = rawSpecData.sections;
      console.log(`      Copied ${rawSpecData.sections.length} composition sections from rawSpec`);
    }
  }
  // For IDENTITY and CONTENT specs: preserve parameters array AND flatten for backward compat
  else if (specRole === SpecRole.IDENTITY || specRole === SpecRole.CONTENT) {
    // NEW: Preserve full parameter structure (needed for generic curriculum composer)
    config = {
      parameters: featureSet.parameters || [],
    };

    // Also flatten top-level config properties for backward compatibility
    for (const param of compiledParams) {
      const paramId = param.id || param.parameterId;
      // Extract the config object from each parameter
      if (param.config) {
        // Flatten top-level config properties into the config object
        Object.assign(config, param.config);
      }
      // Also store by parameter ID for reference
      if (paramId && param.config) {
        config[paramId] = param.config;
      }
    }
    // Copy metadata from rawSpec if present (required for contract-based specs)
    if (rawSpecData?.metadata) {
      config.metadata = rawSpecData.metadata;
      console.log(`      Copied metadata from rawSpec (sections: ${Object.keys(rawSpecData.metadata).join(", ")})`);
    }
    console.log(`      Built config for ${specRole} spec with ${(config.parameters as any[]).length} parameters and keys: ${Object.keys(config).slice(0, 5).join(", ")}...`);
  }
  // For ADAPT, AGGREGATE, etc.: preserve parameters array for pipeline to read configs
  else if (compiledParams.length > 0 && compiledParams.some(p => p.config)) {
    config = {
      parameters: compiledParams.map(p => ({
        id: p.id || p.parameterId,
        config: p.config || {},
      })),
    };
    console.log(`      Built config with ${compiledParams.length} parameters for ${outputType} spec`);
  }

  // Compile the spec to generate promptTemplate from rawSpec in database
  // rawSpec is required - filesystem is only used during seeding, not activation
  let promptTemplate: string | null = null;

  if (featureSet.rawSpec) {
    // Use rawSpec from database (production-ready, no filesystem dependency)
    const parseResult = parseJsonSpec(JSON.stringify(featureSet.rawSpec));
    if (parseResult.success) {
      const compileResult = compileSpecToTemplate(parseResult.data);
      promptTemplate = compileResult.promptTemplate;
      if (compileResult.warnings.length > 0) {
        console.log(`      ⚠️ Compile warnings: ${compileResult.warnings.join(", ")}`);
      }
      console.log(`      ✓ Compiled promptTemplate (${compileResult.sections.length} sections, ${promptTemplate.length} chars)`);
    } else {
      console.log(`      ⚠️ Failed to parse rawSpec: ${parseResult.errors.join(", ")}`);
    }
  } else {
    console.log(`      ⚠️ No rawSpec in database - re-run seed to populate rawSpec`);
  }

  const specData = {
    name: featureSet.name,
    description,
    scope,
    outputType,
    specRole,
    specType,
    domain: scoringSpec?.domain || "general",
    priority: specType === SpecType.SYSTEM ? 50 : 10,
    isActive: true,
    version: featureSet.version,
    compiledAt: new Date(),
    compiledSetId: featureSet.id,
    isDirty: false,
    ...(config && { config }),
    ...(promptTemplate && { promptTemplate }),
  };

  let spec;
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

  // Validate contract implementation if spec declares "implements"
  const implementedContracts = rawSpecData?.implements || [];
  if (implementedContracts.length > 0) {
    console.log(`      ℹ️ Spec declares implementation of: ${implementedContracts.join(", ")}`);

    for (const contractId of implementedContracts) {
      const validation = ContractRegistry.validateSpec(
        featureSet.featureId,
        specData.config || {},
        {
          contractId,
          version: undefined, // Use any version
          role: "producer", // Specs produce data according to contracts
          produces: [],
          consumes: [],
        }
      );

      if (!validation.valid) {
        const errorMsg = `Contract validation failed for ${featureSet.featureId} implementing ${contractId}:\n` +
          validation.errors.map(e => `  - ${e}`).join("\n");
        console.error(`      ✗ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      if (validation.warnings.length > 0) {
        console.log(`      ⚠️ Contract warnings: ${validation.warnings.join(", ")}`);
      }

      console.log(`      ✓ Contract validation passed: ${contractId}`);
    }
  }

  // ⚠️ DEPRECATED: Agent creation from IDENTITY specs is disabled
  // The Agent model is being phased out - identity data should remain in AnalysisSpec.config
  // See prisma/schema.prisma for deprecation notes
  //
  // Original code preserved below for reference:
  // if (specRole === SpecRole.IDENTITY) {
  //   ... Agent creation code removed ...
  // }
  if (specRole === SpecRole.IDENTITY) {
    console.log(`      ⚠️ Agent creation skipped (deprecated) - identity data stored in spec.config`);
  }

  // 4c. Create Curriculum record for CONTENT specs
  if (specRole === SpecRole.CONTENT) {
    // Create slug from spec ID (e.g., "WNF-CONTENT-001" -> "wnf-content-001")
    const curriculumSlug = featureSet.featureId.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Extract content config from parameters
    let authors: string[] = [];
    let sourceTitle: string | null = null;
    let sourceYear: number | null = null;
    let notableInfo: any = null;
    let coreArgument: any = null;
    let caseStudies: any = null;
    let discussionQuestions: any = null;
    let critiques: any = null;
    let deliveryConfig: any = null;

    for (const param of compiledParams) {
      const cfg = param.config || {};
      if (param.id === "source_metadata" || param.name?.includes("Source")) {
        authors = cfg.authors || [];
        sourceTitle = cfg.title || null;
        sourceYear = cfg.year || null;
        notableInfo = cfg.notableInfo || null;
      }
      if (param.id === "core_argument" || param.name?.includes("Core Argument") || param.name?.includes("Thesis")) {
        coreArgument = cfg;
      }
      if (param.id === "case_studies" || param.name?.includes("Case Studies")) {
        caseStudies = cfg.studies || cfg;
      }
      if (param.id === "discussion_questions" || param.name?.includes("Discussion")) {
        discussionQuestions = cfg.questions || cfg;
      }
      if (param.id === "critiques" || param.name?.includes("Critiques")) {
        critiques = cfg.critiques || cfg;
      }
      if (param.id === "delivery_config" || param.name?.includes("Delivery")) {
        deliveryConfig = cfg;
      }
    }

    // Upsert the curriculum
    const existingCurriculum = await prisma.curriculum.findUnique({
      where: { slug: curriculumSlug },
    });

    if (existingCurriculum) {
      await prisma.curriculum.update({
        where: { slug: curriculumSlug },
        data: {
          name: featureSet.name,
          description: featureSet.description,
          authors,
          sourceTitle,
          sourceYear,
          notableInfo,
          coreArgument,
          caseStudies,
          discussionQuestions,
          critiques,
          deliveryConfig,
          constraints: compiledConstraints,
          sourceSpecId: spec.id,
          version: featureSet.version,
        },
      });
      console.log(`      ✓ Updated Curriculum: ${curriculumSlug}`);
    } else {
      await prisma.curriculum.create({
        data: {
          slug: curriculumSlug,
          name: featureSet.name,
          description: featureSet.description,
          authors,
          sourceTitle,
          sourceYear,
          notableInfo,
          coreArgument,
          caseStudies,
          discussionQuestions,
          critiques,
          deliveryConfig,
          constraints: compiledConstraints,
          sourceSpecId: spec.id,
          version: featureSet.version,
        },
      });
      results.curriculumCreated = true;
      console.log(`      ✓ Created Curriculum: ${curriculumSlug}`);
    }
  }

  // 5. Create trigger and actions
  await prisma.analysisTrigger.deleteMany({
    where: { specId: spec.id },
  });

  // Check if spec has explicit triggers array (from rawSpec in database)
  const explicitTriggers = rawSpecData?.triggers || [];

  // If spec has explicit triggers, use those instead of auto-generating
  if (explicitTriggers.length > 0 && outputType !== AnalysisOutputType.ADAPT) {
    // ADAPT specs are handled separately below with special targetValue logic
    for (let i = 0; i < explicitTriggers.length; i++) {
      const t = explicitTriggers[i];
      const trigger = await prisma.analysisTrigger.create({
        data: {
          specId: spec.id,
          given: t.given || "A call transcript is available",
          when: t.when || "The analysis pipeline runs",
          then: t.then || "Process the trigger",
          name: t.name || `Trigger ${i + 1}`,
          sortOrder: i,
        },
      });
      results.triggersCreated++;

      // Create actions from the trigger's actions array
      const triggerActions = t.actions || [];
      for (let j = 0; j < triggerActions.length; j++) {
        const a = triggerActions[j];

        // Handle MEASURE/MEASURE_AGENT actions with parameterId
        if (a.parameterId) {
          const paramExists = await prisma.parameter.findUnique({
            where: { parameterId: a.parameterId },
          });

          await prisma.analysisAction.create({
            data: {
              triggerId: trigger.id,
              description: a.description || `Process ${a.parameterId}`,
              weight: a.weight ?? 1.0,
              parameterId: paramExists ? a.parameterId : null,
              sortOrder: j,
            },
          });
          results.actionsCreated++;
        }
        // Handle LEARN actions with learnCategory/learnKeyPrefix
        else if (a.learnCategory) {
          // Map string category to enum
          let memoryCategory: MemoryCategory = MemoryCategory.FACT;
          const cat = (a.learnCategory || "").toUpperCase();
          if (cat === "PREFERENCE") memoryCategory = MemoryCategory.PREFERENCE;
          else if (cat === "EVENT") memoryCategory = MemoryCategory.EVENT;
          else if (cat === "TOPIC") memoryCategory = MemoryCategory.TOPIC;
          else if (cat === "RELATIONSHIP") memoryCategory = MemoryCategory.RELATIONSHIP;
          else if (cat === "CONTEXT") memoryCategory = MemoryCategory.CONTEXT;
          else if (cat === "FACT") memoryCategory = MemoryCategory.FACT;

          await prisma.analysisAction.create({
            data: {
              triggerId: trigger.id,
              description: a.description || `Extract ${a.learnKeyPrefix || "memory"}`,
              weight: a.weight ?? 1.0,
              learnCategory: memoryCategory,
              learnKeyPrefix: a.learnKeyPrefix || null,
              learnKeyHint: a.learnKeyHint || null,
              sortOrder: j,
            },
          });
          results.actionsCreated++;
        }
        // Handle generic actions (COMPOSE, etc.)
        else {
          await prisma.analysisAction.create({
            data: {
              triggerId: trigger.id,
              description: a.description || "Process action",
              weight: a.weight ?? 1.0,
              sortOrder: j,
            },
          });
          results.actionsCreated++;
        }
      }
    }
  }
  // Fall back to auto-generating triggers from parameters for specs without explicit triggers
  else if (outputType === AnalysisOutputType.MEASURE && explicitTriggers.length === 0) {
    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "A call transcript is available for analysis",
        when: "The analysis pipeline processes the call",
        then: `Score the following parameters: ${compiledParams.map((p: any) => p.id || p.name).join(", ")}`,
        name: featureSet.name,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      const parameterId = param.id || param.parameterId;

      const paramRecord = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      if (paramRecord) {
        await prisma.analysisAction.create({
          data: {
            triggerId: trigger.id,
            description: param.description || `Score ${parameterId}`,
            weight: 1.0,
            parameterId,
            sortOrder: i,
          },
        });
        results.actionsCreated++;
      }
    }
  }

  // For LEARN specs, create triggers for memory extraction (only if no explicit triggers)
  if (outputType === AnalysisOutputType.LEARN && explicitTriggers.length === 0) {
    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];

      // Map parameter to memory category
      let memoryCategory: MemoryCategory = MemoryCategory.FACT;
      const name = (param.name || "").toLowerCase();
      if (name.includes("preference")) memoryCategory = MemoryCategory.PREFERENCE;
      else if (name.includes("event")) memoryCategory = MemoryCategory.EVENT;
      else if (name.includes("topic")) memoryCategory = MemoryCategory.TOPIC;
      else if (name.includes("relation")) memoryCategory = MemoryCategory.RELATIONSHIP;
      else if (name.includes("context")) memoryCategory = MemoryCategory.CONTEXT;

      const trigger = await prisma.analysisTrigger.create({
        data: {
          specId: spec.id,
          given: "A caller is sharing information during conversation",
          when: `The system identifies ${param.name || "information"}`,
          then: `Extract and store ${param.name || "memory"}`,
          name: param.name || `Extract ${param.id}`,
          sortOrder: i,
        },
      });
      results.triggersCreated++;

      await prisma.analysisAction.create({
        data: {
          triggerId: trigger.id,
          description: param.description || `Extract ${param.id}`,
          weight: 1.0,
          learnCategory: memoryCategory,
          sortOrder: 0,
        },
      });
      results.actionsCreated++;
    }
  }

  // For MEASURE_AGENT specs, create a trigger with actions for each behavior parameter (only if no explicit triggers)
  if (outputType === AnalysisOutputType.MEASURE_AGENT && explicitTriggers.length === 0) {
    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "Agent responses are available for analysis",
        when: "The analysis pipeline processes agent behavior",
        then: `Measure agent behavior: ${compiledParams.map((p: any) => p.name || p.id).join(", ")}`,
        name: featureSet.name,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      const parameterId = param.id || param.parameterId;

      const paramRecord = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      if (paramRecord) {
        await prisma.analysisAction.create({
          data: {
            triggerId: trigger.id,
            description: param.description || `Measure ${parameterId}`,
            weight: 1.0,
            parameterId,
            sortOrder: i,
          },
        });
        results.actionsCreated++;
      }
    }
  }

  // For REWARD specs, create a trigger with actions for each reward signal (only if no explicit triggers)
  if (outputType === AnalysisOutputType.REWARD && explicitTriggers.length === 0) {
    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "Call measurements and context are available",
        when: "The reward computation phase runs",
        then: `Compute reward signals: ${compiledParams.map((p: any) => p.name || p.id).join(", ")}`,
        name: featureSet.name,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      const parameterId = param.id || param.parameterId;

      const paramRecord = await prisma.parameter.findUnique({
        where: { parameterId },
      });

      if (paramRecord) {
        await prisma.analysisAction.create({
          data: {
            triggerId: trigger.id,
            description: param.description || `Compute ${parameterId}`,
            weight: 1.0,
            parameterId,
            sortOrder: i,
          },
        });
        results.actionsCreated++;
      }
    }
  }

  // For ADAPT specs, create triggers from the spec's triggers array (from rawSpec in DB)
  // These map personality/engagement signals to behavior parameters
  if (outputType === AnalysisOutputType.ADAPT) {
    // Use explicitTriggers extracted from rawSpec earlier
    const specTriggers = explicitTriggers;

    for (let i = 0; i < specTriggers.length; i++) {
      const t = specTriggers[i];
      const trigger = await prisma.analysisTrigger.create({
        data: {
          specId: spec.id,
          given: t.given,
          when: t.when,
          then: t.then,
          name: t.name,
          sortOrder: i,
        },
      });
      results.triggersCreated++;

      // Create action with the target parameterId
      // Store targetValue in description for pipeline reference
      if (t.parameterId) {
        // Check if parameter exists (BEH-* params may be seeded later)
        const paramExists = await prisma.parameter.findUnique({
          where: { parameterId: t.parameterId },
        });

        if (paramExists) {
          await prisma.analysisAction.create({
            data: {
              triggerId: trigger.id,
              description: `${t.then} [targetValue=${t.targetValue ?? 0.5}]`,
              weight: t.targetValue ?? 0.5, // Use weight to store target value
              parameterId: t.parameterId,
              sortOrder: 0,
            },
          });
          results.actionsCreated++;
        } else {
          // Parameter doesn't exist yet - create action without parameterId
          // and store the intended parameterId in description
          await prisma.analysisAction.create({
            data: {
              triggerId: trigger.id,
              description: `${t.then} [targetValue=${t.targetValue ?? 0.5}] [parameterId=${t.parameterId}]`,
              weight: t.targetValue ?? 0.5,
              sortOrder: 0,
            },
          });
          results.actionsCreated++;
        }
      }
    }
  }

  // For COMPOSE specs, create a trigger for prompt composition (only if no explicit triggers)
  if (outputType === AnalysisOutputType.COMPOSE && explicitTriggers.length === 0) {
    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "All measurements and context have been gathered",
        when: "The compose phase runs",
        then: "Assemble the final prompt from gathered context",
        name: featureSet.name,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    // For COMPOSE, actions represent context assembly steps
    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      await prisma.analysisAction.create({
        data: {
          triggerId: trigger.id,
          description: param.description || `Include ${param.name || param.id}`,
          weight: 1.0,
          sortOrder: i,
        },
      });
      results.actionsCreated++;
    }
  }

  // For IDENTITY specs (based on specRole), create a trigger for identity definition (only if no explicit triggers)
  if (specRole === SpecRole.IDENTITY && explicitTriggers.length === 0) {
    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "A playbook needs to define agent identity",
        when: "The identity is assembled",
        then: "Define who the agent is and how it behaves",
        name: featureSet.name,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    // For IDENTITY, actions represent identity definition components
    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      await prisma.analysisAction.create({
        data: {
          triggerId: trigger.id,
          description: param.description || `Define ${param.name || param.id}`,
          weight: 1.0,
          sortOrder: i,
        },
      });
      results.actionsCreated++;
    }
  }

  // For CONTENT specs (based on specRole), create a trigger for content/curriculum definition (only if no explicit triggers)
  if (specRole === SpecRole.CONTENT && explicitTriggers.length === 0) {
    const trigger = await prisma.analysisTrigger.create({
      data: {
        specId: spec.id,
        given: "A playbook needs to define content/curriculum",
        when: "The content is assembled",
        then: "Define what the agent knows and teaches",
        name: featureSet.name,
        sortOrder: 0,
      },
    });
    results.triggersCreated++;

    // For CONTENT, actions represent content/curriculum components
    for (let i = 0; i < compiledParams.length; i++) {
      const param = compiledParams[i];
      await prisma.analysisAction.create({
        data: {
          triggerId: trigger.id,
          description: param.description || `Provide ${param.name || param.id}`,
          weight: 1.0,
          sortOrder: i,
        },
      });
      results.actionsCreated++;
    }
  }

  // Update feature set as active
  await prisma.bDDFeatureSet.update({
    where: { id: featureSetId },
    data: {
      isActive: true,
      activatedAt: new Date(),
    },
  });

  return results;
}

/**
 * Re-seed a single spec by featureId.
 * Reads the file from disk, parses it, upserts the BDDFeatureSet, and activates all derived records.
 */
export async function reseedSingleSpec(
  featureId: string
): Promise<SeedSpecResult> {
  ensureContractsLoaded();

  const specsFolder = getSpecsFolder();
  const files = fs.readdirSync(specsFolder).filter(
    (f) => f.startsWith(featureId) && f.endsWith(".spec.json")
  );

  if (files.length === 0) {
    throw new Error(`No source file found for ${featureId} in ${specsFolder}`);
  }

  const filename = files[0];
  const filePath = path.join(specsFolder, filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const rawJson = JSON.parse(content);
  const parseResult = parseJsonSpec(content);

  if (!parseResult.success) {
    throw new Error(`Failed to parse ${filename}: ${parseResult.errors.join(", ")}`);
  }

  const featureSet = await upsertFeatureSet(parseResult.data, filename, rawJson);
  return activateFeatureSet(featureSet.id);
}

/**
 * Main function - seed from all spec files
 */
export async function seedFromSpecs(): Promise<SeedSpecResult[]> {
  console.log("\n📋 SEEDING FROM BDD SPEC FILES\n");
  console.log("━".repeat(60));

  // Load contracts before validating specs
  ensureContractsLoaded();

  const specFiles = loadSpecFiles();

  if (specFiles.length === 0) {
    console.log("   No spec files found in bdd-specs/ folder");
    return [];
  }

  console.log(`   Found ${specFiles.length} spec file(s):\n`);

  const results: SeedSpecResult[] = [];

  for (const { filename, content, rawJson } of specFiles) {
    console.log(`   📄 Processing: ${filename}`);
    console.log(`      ID: ${content.id}, Type: ${content.specType || "DOMAIN"}, Role: ${content.specRole || "META"}, Output: ${content.outputType || "MEASURE"}`);

    try {
      // Create/update the feature set (now stores rawSpec for production runtime)
      const featureSet = await upsertFeatureSet(content, filename, rawJson);

      // Activate it to create all derived records
      const result = await activateFeatureSet(featureSet.id);
      results.push(result);

      console.log(`      ✓ Parameters: ${result.parametersCreated} created, ${result.parametersUpdated} updated`);
      console.log(`      ✓ Scoring Anchors: ${result.anchorsCreated} created`);
      console.log(`      ✓ Prompt Slugs: ${result.promptSlugsCreated} created`);
      console.log(`      ✓ Specs: ${result.specsCreated} created`);
      console.log(`      ✓ Triggers: ${result.triggersCreated}, Actions: ${result.actionsCreated}`);
      console.log("");
    } catch (e: any) {
      console.log(`      ✗ Error: ${e.message}`);
      console.log("");
    }
  }

  // Summary
  const totals = results.reduce(
    (acc, r) => ({
      params: acc.params + r.parametersCreated + r.parametersUpdated,
      anchors: acc.anchors + r.anchorsCreated,
      slugs: acc.slugs + r.promptSlugsCreated,
      specs: acc.specs + r.specsCreated,
      agents: acc.agents + (r.agentCreated ? 1 : 0),
      curricula: acc.curricula + (r.curriculumCreated ? 1 : 0),
    }),
    { params: 0, anchors: 0, slugs: 0, specs: 0, agents: 0, curricula: 0 }
  );

  console.log(`   ✅ Loaded ${specFiles.length} specs → ${totals.params} params, ${totals.anchors} anchors, ${totals.slugs} slugs, ${totals.specs} specs`);
  console.log(`   ✅ First-class entities: ${totals.agents} agents, ${totals.curricula} curricula\n`);

  return results;
}

// Allow running directly
if (require.main === module) {
  seedFromSpecs()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((e) => {
      console.error("Error:", e);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
