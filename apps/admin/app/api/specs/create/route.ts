import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient, SpecType } from "@prisma/client";
import { convertJsonSpecToHybrid, JsonFeatureSpec } from "@/lib/bdd/ai-parser";
import { compileSpecToTemplate } from "@/lib/bdd/compile-specs";
import { activateFeatureSet } from "@/lib/lab/activate-feature";
import { validateSourceAuthority, hasSourceAuthority } from "@/lib/content-trust/validate-source-authority";
import * as fs from "fs";
import * as path from "path";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

// Directory where spec files are stored (archived — only for initial import)
const BDD_SPECS_DIR = path.join(process.cwd(), "docs-archive", "bdd-specs");

/**
 * Generate a filename from spec ID and title
 * e.g., "VARK-001" + "Learning Modality Assessment" → "VARK-001-learning-modality-assessment.spec.json"
 */
function generateFilename(specId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${specId}-${slug}.spec.json`;
}

/**
 * Write spec to docs-archive/bdd-specs/ folder
 * Returns the filename written, or null if failed
 */
function writeSpecFile(jsonSpec: JsonFeatureSpec): { filename: string; filePath: string } | null {
  try {
    // Ensure directory exists
    if (!fs.existsSync(BDD_SPECS_DIR)) {
      console.warn("docs-archive/bdd-specs directory does not exist, creating it");
      fs.mkdirSync(BDD_SPECS_DIR, { recursive: true });
    }

    const filename = generateFilename(jsonSpec.id, jsonSpec.title);
    const filePath = path.join(BDD_SPECS_DIR, filename);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.warn(`Spec file already exists: ${filename}`);
      // Don't overwrite - return existing path
      return { filename, filePath };
    }

    // Build the full spec object with schema reference and date
    const fullSpec = {
      $schema: "./feature-spec-schema.json",
      ...jsonSpec,
      date: new Date().toISOString().split("T")[0], // YYYY-MM-DD format
    };

    // Write with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(fullSpec, null, 2) + "\n", "utf-8");
    console.log(`Wrote spec file: ${filename}`);

    return { filename, filePath };
  } catch (error) {
    console.error("Failed to write spec file:", error);
    return null;
  }
}

// Input parameter from the form (subset of JsonParameter)
interface FormParameter {
  id: string;
  name: string;
  description: string;
  section?: string;
  isAdjustable?: boolean;
  targetRange?: { min: number; max: number };
  scoringAnchors?: Array<{ score: number; example: string; rationale?: string; isGold?: boolean }>;
  promptGuidance?: { whenHigh?: string; whenLow?: string };
  learningOutcomes?: string[];
}

/**
 * @api POST /api/specs/create
 * @visibility public
 * @scope specs:write
 * @auth session
 * @tags specs
 * @description Create a new BDD spec from JSON body, write to docs-archive/bdd-specs/ file, and optionally auto-activate
 * @body spec SpecFormData - The spec form data (id, title, version, domain, specType, specRole, outputType, story, parameters, etc.)
 * @body autoActivate boolean - Whether to activate after creation (default: true)
 * @response 200 { ok: true, specId: string, featureSetId: string, featureId: string, activated: boolean, fileWritten: string|null }
 * @response 400 { ok: false, error: "ID is required" }
 * @response 409 { ok: false, error: "A spec with ID ... already exists" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json();
    const { spec, autoActivate = true } = body;

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "spec is required" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!spec.id || !spec.id.trim()) {
      return NextResponse.json(
        { ok: false, error: "ID is required" },
        { status: 400 }
      );
    }

    if (!spec.title || !spec.title.trim()) {
      return NextResponse.json(
        { ok: false, error: "Title is required" },
        { status: 400 }
      );
    }

    // Check if a spec with this ID already exists
    const existing = await prisma.bDDFeatureSet.findFirst({
      where: { featureId: spec.id },
    });

    if (existing) {
      return NextResponse.json(
        { ok: false, error: `A spec with ID "${spec.id}" already exists` },
        { status: 409 }
      );
    }

    // Convert form data to JsonFeatureSpec format
    const jsonSpec: JsonFeatureSpec = {
      id: spec.id,
      title: spec.title,
      version: spec.version || "1.0",
      status: spec.status || "Draft",
      domain: spec.domain || undefined,
      specType: spec.specType || "DOMAIN",
      specRole: spec.specRole || undefined,
      outputType: spec.outputType || "MEASURE",
      story: spec.story || { asA: "", iWant: "", soThat: "" },
      parameters: (spec.parameters || []).map((p: FormParameter) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        section: p.section,
        isAdjustable: p.isAdjustable ?? true,
        targetRange: p.targetRange,
        scoringAnchors: p.scoringAnchors || [],
        promptGuidance: p.promptGuidance,
        learningOutcomes: p.learningOutcomes || undefined,
      })),
      acceptanceCriteria: spec.acceptanceCriteria || [],
      constraints: spec.constraints || [],
      context: spec.context,
      metadata: spec.metadata || undefined,
    };

    // =========================================================================
    // STEP 0.5: Validate sourceAuthority if present (CONTENT specs)
    // =========================================================================
    let sourceValidation = null;
    const specConfig = spec.config || (jsonSpec as any).config;
    if (specConfig && hasSourceAuthority(specConfig)) {
      sourceValidation = await validateSourceAuthority(specConfig.sourceAuthority);
      if (!sourceValidation.valid) {
        return NextResponse.json(
          {
            ok: false,
            error: "Source authority validation failed",
            sourceErrors: sourceValidation.errors,
            sourceWarnings: sourceValidation.warnings,
          },
          { status: 422 }
        );
      }
    }

    // =========================================================================
    // STEP 1: Write spec to docs-archive/bdd-specs/ file (for version control)
    // =========================================================================
    const fileResult = writeSpecFile(jsonSpec);
    if (!fileResult) {
      console.warn("Could not write spec file, continuing with DB-only creation");
    }

    // Convert to hybrid format for storage
    const hybrid = convertJsonSpecToHybrid(jsonSpec);
    const parameters = hybrid.parameterData?.parameters || [];
    const storyData = hybrid.storyData;

    // Build the feature set data
    const featureSetData = {
      featureId: jsonSpec.id,
      name: jsonSpec.title,
      description: jsonSpec.story
        ? `As ${jsonSpec.story.asA}, I want ${jsonSpec.story.iWant} so that ${jsonSpec.story.soThat}`
        : undefined,
      version: jsonSpec.version,
      specType: (jsonSpec.specType as SpecType) || SpecType.DOMAIN,
      rawSpec: jsonSpec as unknown as Prisma.InputJsonValue,
      parameters: parameters as unknown as Prisma.InputJsonValue,
      constraints: (storyData?.constraints || []) as unknown as Prisma.InputJsonValue,
      validations: [] as unknown as Prisma.InputJsonValue,
      definitions: {} as unknown as Prisma.InputJsonValue,
      thresholds: {} as unknown as Prisma.InputJsonValue,
      promptGuidance: {} as unknown as Prisma.InputJsonValue,
      scoringSpec: {
        source: "create-page",
        domain: jsonSpec.domain,
        outputType: jsonSpec.outputType,
        specRole: jsonSpec.specRole,
      } as unknown as Prisma.InputJsonValue,
      parameterCount: parameters.length,
      constraintCount: storyData?.constraints?.length || 0,
      definitionCount: 0,
    };

    // Create the feature set
    const featureSet = await prisma.bDDFeatureSet.create({
      data: featureSetData,
    });

    // Compile the spec to generate promptTemplate
    const compileResult = compileSpecToTemplate(jsonSpec);

    let activationResult = null;

    // If auto-activate, trigger the activation to create AnalysisSpec, Parameters, etc.
    if (autoActivate) {
      try {
        activationResult = await activateFeatureSet(featureSet.id);
        if (!activationResult.ok) {
          console.error("Activation failed:", activationResult.error);
        }
      } catch (activateError) {
        console.error("Activation error:", activateError);
      }
    }

    // Get the created AnalysisSpec ID if activation succeeded
    let analysisSpecId = null;
    if (activationResult?.specs?.measure?.id) {
      analysisSpecId = activationResult.specs.measure.id;
    } else {
      // Try to find the AnalysisSpec by looking up by sourceFeatureSetId
      const analysisSpec = await prisma.analysisSpec.findFirst({
        where: { sourceFeatureSetId: featureSet.id },
        select: { id: true },
      });
      analysisSpecId = analysisSpec?.id;
    }

    return NextResponse.json({
      ok: true,
      specId: analysisSpecId || featureSet.id,
      featureSetId: featureSet.id,
      featureId: jsonSpec.id,
      activated: autoActivate,
      fileWritten: fileResult?.filename || null,
      compileWarnings: compileResult.warnings.length > 0 ? compileResult.warnings : undefined,
      ...(sourceValidation?.warnings?.length && {
        sourceWarnings: sourceValidation.warnings,
      }),
    });
  } catch (error) {
    console.error("Error creating spec:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create spec" },
      { status: 500 }
    );
  }
}
