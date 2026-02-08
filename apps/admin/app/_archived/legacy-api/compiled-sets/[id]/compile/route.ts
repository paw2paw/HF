import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

type ValidationError = {
  type: "spec" | "parameter" | "anchor";
  id: string;
  name: string;
  error: string;
  severity: "error" | "warning";
};

/**
 * POST /api/compiled-sets/[id]/compile
 * Compile a draft set: validate, gather RAG context, mark as READY
 *
 * Body: {
 *   force?: boolean,      // Compile even with warnings
 *   enrichMissing?: boolean,  // Auto-enrich parameters missing enrichment
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { force = false } = body;

    // Load the compiled set
    const compiledSet = await prisma.compiledAnalysisSet.findUnique({
      where: { id },
      include: {
        analysisProfile: true,
      },
    });

    if (!compiledSet) {
      return NextResponse.json(
        { ok: false, error: "Compiled set not found" },
        { status: 404 }
      );
    }

    if (compiledSet.status === "READY") {
      return NextResponse.json(
        { ok: false, error: "Compiled set is already READY. Create a new version to recompile." },
        { status: 400 }
      );
    }

    if (compiledSet.status === "COMPILING") {
      return NextResponse.json(
        { ok: false, error: "Compilation already in progress" },
        { status: 400 }
      );
    }

    // Mark as compiling
    await prisma.compiledAnalysisSet.update({
      where: { id },
      data: { status: "COMPILING" },
    });

    try {
      // Load specs
      const specs = await prisma.analysisSpec.findMany({
        where: { id: { in: compiledSet.specIds } },
        include: {
          triggers: {
            include: {
              actions: {
                include: {
                  parameter: {
                    include: {
                      scoringAnchors: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Validation
      const errors: ValidationError[] = [];
      const measureSpecs = specs.filter(s => s.outputType === "MEASURE");
      const learnSpecs = specs.filter(s => s.outputType === "LEARN");

      // Collect unique parameters
      const parameterMap = new Map<string, any>();
      let totalAnchors = 0;

      // Validate MEASURE specs
      for (const spec of measureSpecs) {
        let hasParameter = false;

        for (const trigger of spec.triggers) {
          for (const action of trigger.actions) {
            if (action.parameterId && action.parameter) {
              hasParameter = true;
              const param = action.parameter;

              if (!parameterMap.has(param.parameterId)) {
                parameterMap.set(param.parameterId, param);

                // Check anchor count
                const anchorCount = param.scoringAnchors?.length || 0;
                totalAnchors += anchorCount;

                if (anchorCount < 3) {
                  errors.push({
                    type: "anchor",
                    id: param.parameterId,
                    name: param.name,
                    error: `Parameter has only ${anchorCount} scoring anchor(s). Minimum 3 recommended for reliable scoring.`,
                    severity: anchorCount === 0 ? "error" : "warning",
                  });
                }

                // Check enrichment
                if (!param.enrichedAt) {
                  errors.push({
                    type: "parameter",
                    id: param.parameterId,
                    name: param.name,
                    error: "Parameter is not enriched. Consider running enrichment for better RAG context.",
                    severity: "warning",
                  });
                }
              }
            }
          }
        }

        if (!hasParameter) {
          errors.push({
            type: "spec",
            id: spec.id,
            name: spec.name,
            error: "MEASURE spec has no actions with parameters attached.",
            severity: "error",
          });
        }
      }

      // Validate LEARN specs
      for (const spec of learnSpecs) {
        let hasLearnAction = false;

        for (const trigger of spec.triggers) {
          for (const action of trigger.actions) {
            if (action.learnCategory) {
              hasLearnAction = true;
            }
          }
        }

        if (!hasLearnAction) {
          errors.push({
            type: "spec",
            id: spec.id,
            name: spec.name,
            error: "LEARN spec has no actions with learn categories configured.",
            severity: "error",
          });
        }
      }

      // Check for critical errors
      const criticalErrors = errors.filter(e => e.severity === "error");
      const warnings = errors.filter(e => e.severity === "warning");

      if (criticalErrors.length > 0 && !force) {
        await prisma.compiledAnalysisSet.update({
          where: { id },
          data: {
            status: "ERROR",
            validationErrors: errors,
            validationPassed: false,
          },
        });

        return NextResponse.json({
          ok: false,
          error: "Compilation failed with validation errors",
          errors: criticalErrors,
          warnings,
          hint: "Fix the errors and try again, or use force=true to compile with warnings only",
        });
      }

      // Build RAG context from enriched parameters
      const ragLines: string[] = [];
      for (const [, param] of parameterMap) {
        ragLines.push(`## ${param.name} (${param.parameterId})`);
        ragLines.push(`Definition: ${param.definition || "Not defined"}`);
        if (param.enrichedHigh) {
          ragLines.push(`High (1.0): ${param.enrichedHigh}`);
        } else if (param.interpretationHigh) {
          ragLines.push(`High (1.0): ${param.interpretationHigh}`);
        }
        if (param.enrichedLow) {
          ragLines.push(`Low (0.0): ${param.enrichedLow}`);
        } else if (param.interpretationLow) {
          ragLines.push(`Low (0.0): ${param.interpretationLow}`);
        }
        ragLines.push("");
      }

      const ragContext = ragLines.join("\n");

      // Collect KB chunk IDs from enriched parameters
      const kbChunkIds = new Set<string>();
      for (const [, param] of parameterMap) {
        if (param.enrichmentChunkIds) {
          for (const chunkId of param.enrichmentChunkIds) {
            kbChunkIds.add(chunkId);
          }
        }
      }

      // Update compiled set as READY
      const updatedSet = await prisma.compiledAnalysisSet.update({
        where: { id },
        data: {
          status: "READY",
          compiledAt: new Date(),
          validationErrors: errors.length > 0 ? errors : Prisma.JsonNull,
          validationPassed: criticalErrors.length === 0,
          ragContext,
          kbChunksUsed: Array.from(kbChunkIds),
          measureSpecCount: measureSpecs.length,
          learnSpecCount: learnSpecs.length,
          parameterCount: parameterMap.size,
          anchorCount: totalAnchors,
        },
      });

      return NextResponse.json({
        ok: true,
        compiledSet: updatedSet,
        validation: {
          passed: criticalErrors.length === 0,
          errors: criticalErrors,
          warnings,
        },
        summary: {
          measureSpecs: measureSpecs.length,
          learnSpecs: learnSpecs.length,
          parameters: parameterMap.size,
          enrichedParameters: Array.from(parameterMap.values()).filter(p => p.enrichedAt).length,
          totalAnchors,
          kbChunksUsed: kbChunkIds.size,
        },
        message: criticalErrors.length === 0
          ? "Compilation successful. Set is READY for use."
          : "Compilation completed with warnings (force=true).",
      });
    } catch (compileError: any) {
      // Revert to ERROR status on failure
      await prisma.compiledAnalysisSet.update({
        where: { id },
        data: {
          status: "ERROR",
          validationErrors: [{ type: "system", error: compileError.message }],
        },
      });
      throw compileError;
    }
  } catch (error: any) {
    console.error("Compilation error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compile set" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/compiled-sets/[id]/compile
 * Get compilation status and validation results
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const compiledSet = await prisma.compiledAnalysisSet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        compiledAt: true,
        compiledBy: true,
        validationErrors: true,
        validationPassed: true,
        measureSpecCount: true,
        learnSpecCount: true,
        parameterCount: true,
        anchorCount: true,
      },
    });

    if (!compiledSet) {
      return NextResponse.json(
        { ok: false, error: "Compiled set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: compiledSet.status,
      compiledAt: compiledSet.compiledAt,
      validationPassed: compiledSet.validationPassed,
      validationErrors: compiledSet.validationErrors,
      stats: {
        measureSpecCount: compiledSet.measureSpecCount,
        learnSpecCount: compiledSet.learnSpecCount,
        parameterCount: compiledSet.parameterCount,
        anchorCount: compiledSet.anchorCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get compilation status" },
      { status: 500 }
    );
  }
}
