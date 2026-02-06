import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, SpecType } from "@prisma/client";
import {
  parseJsonSpec,
  convertJsonSpecToHybrid,
  JsonFeatureSpec,
} from "@/lib/bdd/ai-parser";
import { compileSpecToTemplate } from "@/lib/bdd/compile-specs";

const prisma = new PrismaClient();

interface ImportResult {
  specId: string;
  name: string;
  status: "created" | "updated" | "error";
  error?: string;
  compileWarnings?: string[];
}

/**
 * Store a spec in the database (BDDFeatureSet) and optionally activate it
 */
async function upsertAndActivateSpec(
  spec: JsonFeatureSpec,
  rawSpecJson: any,
  filename: string,
  autoActivate: boolean
): Promise<ImportResult> {
  try {
    const hybrid = convertJsonSpecToHybrid(spec);
    const parameters = hybrid.parameterData?.parameters || [];
    const storyData = hybrid.storyData;

    // Build the feature set data
    const featureSetData = {
      featureId: spec.id,
      name: spec.title,
      description: spec.story
        ? `As ${spec.story.asA}, I want ${spec.story.iWant} so that ${spec.story.soThat}`
        : undefined,
      version: spec.version,
      specType: (spec.specType as SpecType) || SpecType.DOMAIN,
      // Store the raw spec JSON for future reference/re-compilation
      rawSpec: rawSpecJson,
      // Store parsed data
      parameters: parameters as any,
      constraints: (storyData?.constraints || []) as any,
      validations: [] as any,
      definitions: {} as any,
      thresholds: {} as any,
      promptGuidance: {} as any,
      scoringSpec: {
        source: filename,
        domain: spec.domain,
        outputType: spec.outputType,
        specRole: spec.specRole,
        agentScope: spec.agentScope,
        extendsAgent: spec.extendsAgent,
      } as any,
    };

    // Upsert the feature set
    const existing = await prisma.bDDFeatureSet.findFirst({
      where: { featureId: spec.id },
    });

    let featureSet;
    let status: "created" | "updated" = "created";

    if (existing) {
      featureSet = await prisma.bDDFeatureSet.update({
        where: { id: existing.id },
        data: featureSetData,
      });
      status = "updated";
    } else {
      featureSet = await prisma.bDDFeatureSet.create({
        data: featureSetData,
      });
    }

    // Compile the spec to generate promptTemplate
    const compileResult = compileSpecToTemplate(spec);

    const result: ImportResult = {
      specId: spec.id,
      name: spec.title,
      status,
      compileWarnings: compileResult.warnings.length > 0 ? compileResult.warnings : undefined,
    };

    // If auto-activate, trigger the activation to create AnalysisSpec, Parameters, etc.
    if (autoActivate) {
      // Import and call the activation function from seed-from-specs
      // For now, we'll call the existing activate API endpoint
      const activateRes = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/bdd/feature-sets/${featureSet.id}/activate`,
        { method: "POST" }
      );

      if (!activateRes.ok) {
        result.compileWarnings = [
          ...(result.compileWarnings || []),
          `Activation failed: ${await activateRes.text()}`,
        ];
      }
    }

    return result;
  } catch (error: any) {
    return {
      specId: spec.id || filename,
      name: spec.title || filename,
      status: "error",
      error: error.message,
    };
  }
}

/**
 * POST /api/specs/import
 * Import BDD spec files into the database
 *
 * Accepts:
 * - FormData with files[] - browser uploads of .spec.json files
 * - autoActivate: boolean - whether to activate specs after import (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const autoActivate = formData.get("autoActivate") !== "false";

    if (!files || files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files uploaded" },
        { status: 400 }
      );
    }

    const results: ImportResult[] = [];
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const file of files) {
      // Validate file extension
      if (!file.name.endsWith(".spec.json")) {
        results.push({
          specId: file.name,
          name: file.name,
          status: "error",
          error: "File must have .spec.json extension",
        });
        errors++;
        continue;
      }

      try {
        const content = await file.text();
        const rawJson = JSON.parse(content);

        // Parse the spec
        const parseResult = parseJsonSpec(content);

        if (!parseResult.success) {
          results.push({
            specId: file.name,
            name: file.name,
            status: "error",
            error: `Parse error: ${parseResult.errors.join(", ")}`,
          });
          errors++;
          continue;
        }

        // Store and optionally activate
        const result = await upsertAndActivateSpec(
          parseResult.data,
          rawJson,
          file.name,
          autoActivate
        );

        results.push(result);

        if (result.status === "created") created++;
        else if (result.status === "updated") updated++;
        else if (result.status === "error") errors++;
      } catch (error: any) {
        results.push({
          specId: file.name,
          name: file.name,
          status: "error",
          error: `JSON parse error: ${error.message}`,
        });
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      errors,
      total: files.length,
      results,
    });
  } catch (error: any) {
    console.error("POST /api/specs/import error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to import specs" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/specs/import
 * List all specs stored in the database
 */
export async function GET() {
  try {
    const specs = await prisma.bDDFeatureSet.findMany({
      select: {
        id: true,
        featureId: true,
        name: true,
        version: true,
        specType: true,
        isActive: true,
        rawSpec: true,
      },
      orderBy: { featureId: "asc" },
    });

    return NextResponse.json({
      ok: true,
      count: specs.length,
      specs: specs.map((s) => ({
        ...s,
        hasRawSpec: s.rawSpec !== null,
        rawSpec: undefined, // Don't send full rawSpec in list view
      })),
    });
  } catch (error: any) {
    console.error("GET /api/specs/import error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
