import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseWithAI,
  parseHybridWithAI,
  detectFileType,
  parseBDDSpec,
  isJsonSpec,
  ParsedHybridResult,
} from "@/lib/bdd/ai-parser";
import { AIEngine, getDefaultEngine, isEngineAvailable } from "@/lib/ai/client";

/**
 * POST /api/lab/uploads/validate-ai
 *
 * Validate uploaded files using AI to parse and extract structured data.
 * Supports XML, markdown, and plain text files.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ids, engine: requestedEngine } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No IDs provided" },
        { status: 400 }
      );
    }

    // Determine AI engine to use
    const engine: AIEngine = requestedEngine && isEngineAvailable(requestedEngine)
      ? requestedEngine
      : getDefaultEngine();

    if (engine === "mock") {
      return NextResponse.json(
        { ok: false, error: "No AI engine available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY." },
        { status: 400 }
      );
    }

    // Fetch uploads
    const uploads = await prisma.bDDUpload.findMany({
      where: { id: { in: ids } },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No uploads found" },
        { status: 400 }
      );
    }

    const results = [];

    for (const upload of uploads) {
      const content = upload.xmlContent;

      // Try JSON parsing first (no AI needed for well-formed JSON specs)
      if (isJsonSpec(content, upload.filename)) {
        const parseResult = await parseBDDSpec(content, upload.filename);

        if (parseResult.fileType === "HYBRID" && parseResult.success) {
          const hybridResult = parseResult as ParsedHybridResult;

          const parameterIds: string[] = [];
          if (hybridResult.parameterData?.parameters) {
            parameterIds.push(...hybridResult.parameterData.parameters.map((p) => p.id));
          }
          if (hybridResult.storyData?.parameterRefs) {
            parameterIds.push(...hybridResult.storyData.parameterRefs);
          }

          const storyId = hybridResult.storyData?.storyId || null;
          const name = hybridResult.storyData?.title ||
            hybridResult.parameterData?.parameters?.[0]?.name ||
            upload.filename;

          const combinedData = {
            _isHybrid: true,
            _isJsonSpec: true,
            parameters: hybridResult.parameterData?.parameters || [],
            story: hybridResult.storyData || null,
            specType: hybridResult.specType,
            outputType: hybridResult.outputType,
          };

          await prisma.bDDUpload.update({
            where: { id: upload.id },
            data: {
              status: "VALIDATED",
              fileType: "STORY",
              storyId,
              parameterIds: [...new Set(parameterIds)],
              name,
              validatedAt: new Date(),
              parseErrors: combinedData as any,
              errorMessage: undefined,
            },
          });

          const paramCount = hybridResult.parameterData?.parameters?.length || 0;
          const constraintCount = hybridResult.storyData?.constraints?.length || 0;
          const failureCount = hybridResult.storyData?.failureConditions?.length || 0;
          const acCount = hybridResult.storyData?.acceptanceCriteria?.length || 0;

          results.push({
            id: upload.id,
            filename: upload.filename,
            success: true,
            type: "HYBRID",
            parameterCount: paramCount,
            parameters: hybridResult.parameterData?.parameters?.map((p) => p.id || p.name).slice(0, 10) || [],
            storyId,
            storyTitle: hybridResult.storyData?.title || null,
            constraintCount: constraintCount + failureCount,
            acceptanceCriteriaCount: acCount,
            warnings: hybridResult.warnings,
            isHybrid: true,
            isJsonSpec: true,
            parseMethod: "direct-json",
          });
          continue;
        } else if (!parseResult.success) {
          // JSON parsing failed - report errors
          await prisma.bDDUpload.update({
            where: { id: upload.id },
            data: {
              status: "ERROR",
              errorMessage: (parseResult as any).errors?.join("; ") || "JSON parse failed",
              parseErrors: { errors: (parseResult as any).errors },
            },
          });

          results.push({
            id: upload.id,
            filename: upload.filename,
            success: false,
            error: (parseResult as any).errors?.join("; ") || "JSON parse failed",
            parseMethod: "direct-json",
          });
          continue;
        }
      }

      // Fall back to AI parsing for XML, markdown, etc.
      // Detect file type (can be STORY, PARAMETER, or HYBRID)
      const detectedType = detectFileType(content, upload.filename);

      // Handle hybrid files differently
      if (detectedType === "HYBRID") {
        const hybridResult = await parseHybridWithAI(content, engine);

        if (hybridResult.success && (hybridResult.parameterData || hybridResult.storyData)) {
          // Collect parameter IDs from both sources
          const parameterIds: string[] = [];
          if (hybridResult.parameterData?.parameters) {
            parameterIds.push(...hybridResult.parameterData.parameters.map((p) => p.id));
          }
          if (hybridResult.storyData?.parameterRefs) {
            parameterIds.push(...hybridResult.storyData.parameterRefs);
          }

          const storyId = hybridResult.storyData?.storyId || null;
          const name = hybridResult.storyData?.title ||
            hybridResult.parameterData?.parameters?.[0]?.name ||
            upload.filename;

          // Store combined data for compilation
          const combinedData = {
            _isHybrid: true,
            parameters: hybridResult.parameterData?.parameters || [],
            story: hybridResult.storyData || null,
          };

          await prisma.bDDUpload.update({
            where: { id: upload.id },
            data: {
              status: "VALIDATED",
              fileType: "STORY", // Store as STORY since it contains Gherkin
              storyId,
              parameterIds: [...new Set(parameterIds)], // Dedupe
              name,
              validatedAt: new Date(),
              parseErrors: combinedData as any,
              errorMessage: undefined,
            },
          });

          const paramCount = hybridResult.parameterData?.parameters?.length || 0;
          const constraintCount = hybridResult.storyData?.constraints?.length || 0;
          const failureCount = hybridResult.storyData?.failureConditions?.length || 0;
          const acCount = hybridResult.storyData?.acceptanceCriteria?.length || 0;

          results.push({
            id: upload.id,
            filename: upload.filename,
            success: true,
            type: "HYBRID",
            parameterCount: paramCount,
            parameters: hybridResult.parameterData?.parameters?.map((p) => p.id || p.name).slice(0, 10) || [],
            storyId,
            storyTitle: hybridResult.storyData?.title || null,
            constraintCount: constraintCount + failureCount,
            acceptanceCriteriaCount: acCount,
            warnings: hybridResult.warnings,
            isHybrid: true,
          });
        } else {
          // Hybrid parse failed
          await prisma.bDDUpload.update({
            where: { id: upload.id },
            data: {
              status: "ERROR",
              errorMessage: hybridResult.errors?.join("; ") || "Hybrid parse failed",
              parseErrors: { errors: hybridResult.errors },
            },
          });

          results.push({
            id: upload.id,
            filename: upload.filename,
            success: false,
            error: hybridResult.errors?.join("; ") || "Hybrid parse failed",
          });
        }
      } else {
        // Standard STORY or PARAMETER parsing
        const fileType = detectedType as "STORY" | "PARAMETER";
        const parseResult = await parseWithAI(content, fileType, engine);

        if (parseResult.success && parseResult.data) {
          // Store the parsed data
          const parameterIds = fileType === "PARAMETER"
            ? (parseResult.data as any).parameters?.map((p: any) => p.id) || []
            : (parseResult.data as any).parameterRefs || [];

          const storyId = fileType === "STORY"
            ? (parseResult.data as any).storyId
            : null;

          const name = fileType === "STORY"
            ? (parseResult.data as any).title
            : (parseResult.data as any).parameters?.[0]?.name || upload.filename;

          await prisma.bDDUpload.update({
            where: { id: upload.id },
            data: {
              status: "VALIDATED",
              fileType,
              storyId,
              parameterIds,
              name,
              validatedAt: new Date(),
              parseErrors: parseResult.data as any, // Store full parsed data for compilation
              errorMessage: undefined,
            },
          });

          const parsedData = parseResult.data as any;
          results.push({
            id: upload.id,
            filename: upload.filename,
            success: true,
            type: fileType,
            parameterCount: fileType === "PARAMETER"
              ? parsedData.parameters?.length || 0
              : 0,
            parameters: fileType === "PARAMETER"
              ? parsedData.parameters?.map((p: any) => p.id || p.name).slice(0, 10) || []
              : [],
            storyId,
            storyTitle: fileType === "STORY" ? parsedData.title : null,
            constraintCount: parsedData.constraints?.length || parsedData.failureConditions?.length || 0,
            acceptanceCriteriaCount: parsedData.acceptanceCriteria?.length || 0,
            warnings: parseResult.warnings,
          });
        } else {
          // Mark as error
          await prisma.bDDUpload.update({
            where: { id: upload.id },
            data: {
              status: "ERROR",
              errorMessage: parseResult.errors?.join("; ") || "Parse failed",
              parseErrors: { errors: parseResult.errors },
            },
          });

          results.push({
            id: upload.id,
            filename: upload.filename,
            success: false,
            error: parseResult.errors?.join("; ") || "Parse failed",
          });
        }
      }
    }

    const validated = results.filter((r) => r.success).length;
    const errors = results.filter((r) => !r.success).length;

    return NextResponse.json({
      ok: true,
      validated,
      errors,
      total: uploads.length,
      engine,
      results,
    });
  } catch (error: any) {
    console.error("Error validating BDD uploads with AI:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "AI validation failed" },
      { status: 500 }
    );
  }
}
