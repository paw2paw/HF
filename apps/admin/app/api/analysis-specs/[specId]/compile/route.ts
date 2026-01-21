import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

type ValidationError = {
  type: "parameter" | "anchor" | "action" | "trigger";
  id: string;
  name: string;
  error: string;
  severity: "error" | "warning";
};

/**
 * POST /api/analysis-specs/[specId]/compile
 * Compile a single spec: validate, check parameters/anchors, mark as compiled
 *
 * Body: {
 *   force?: boolean,  // Compile even with warnings
 * }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;
    const body = await req.json().catch(() => ({}));
    const { force = false } = body;

    // Load the spec with full details
    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [{ id: specId }, { slug: specId }],
      },
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

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    if (spec.isLocked) {
      return NextResponse.json(
        { ok: false, error: "Spec is locked and cannot be compiled. It may be in use by callers." },
        { status: 423 }
      );
    }

    // Validation
    const errors: ValidationError[] = [];

    if (spec.triggers.length === 0) {
      errors.push({
        type: "trigger",
        id: spec.id,
        name: spec.name,
        error: "Spec has no triggers defined",
        severity: "error",
      });
    }

    // Validate based on output type
    if (spec.outputType === "MEASURE") {
      let hasParameter = false;
      const parameterMap = new Map<string, any>();

      for (const trigger of spec.triggers) {
        if (trigger.actions.length === 0) {
          errors.push({
            type: "trigger",
            id: trigger.id,
            name: trigger.name || `Trigger ${trigger.sortOrder + 1}`,
            error: "Trigger has no actions defined",
            severity: "warning",
          });
        }

        for (const action of trigger.actions) {
          if (!action.parameterId || !action.parameter) {
            errors.push({
              type: "action",
              id: action.id,
              name: action.description.substring(0, 50),
              error: "MEASURE action has no parameter attached",
              severity: "error",
            });
          } else {
            hasParameter = true;
            const param = action.parameter;

            if (!parameterMap.has(param.parameterId)) {
              parameterMap.set(param.parameterId, param);

              // Check anchor count
              const anchorCount = param.scoringAnchors?.length || 0;
              if (anchorCount < 3) {
                errors.push({
                  type: "anchor",
                  id: param.parameterId,
                  name: param.name,
                  error: `Parameter has only ${anchorCount} scoring anchor(s). Minimum 3 recommended.`,
                  severity: anchorCount === 0 ? "error" : "warning",
                });
              }
            }
          }
        }
      }

      if (!hasParameter) {
        errors.push({
          type: "parameter",
          id: spec.id,
          name: spec.name,
          error: "MEASURE spec has no parameters attached to any action",
          severity: "error",
        });
      }
    } else if (spec.outputType === "LEARN") {
      let hasLearnAction = false;

      for (const trigger of spec.triggers) {
        if (trigger.actions.length === 0) {
          errors.push({
            type: "trigger",
            id: trigger.id,
            name: trigger.name || `Trigger ${trigger.sortOrder + 1}`,
            error: "Trigger has no actions defined",
            severity: "warning",
          });
        }

        for (const action of trigger.actions) {
          if (action.learnCategory) {
            hasLearnAction = true;
          } else {
            errors.push({
              type: "action",
              id: action.id,
              name: action.description.substring(0, 50),
              error: "LEARN action has no category configured",
              severity: "warning",
            });
          }
        }
      }

      if (!hasLearnAction) {
        errors.push({
          type: "action",
          id: spec.id,
          name: spec.name,
          error: "LEARN spec has no actions with learn categories",
          severity: "error",
        });
      }
    }

    // Check for critical errors
    const criticalErrors = errors.filter(e => e.severity === "error");
    const warnings = errors.filter(e => e.severity === "warning");

    if (criticalErrors.length > 0 && !force) {
      return NextResponse.json({
        ok: false,
        error: "Compilation failed with validation errors",
        errors: criticalErrors,
        warnings,
        hint: "Fix the errors and try again, or use force=true to compile with warnings only",
      });
    }

    // Mark spec as compiled
    const updatedSpec = await prisma.analysisSpec.update({
      where: { id: spec.id },
      data: {
        compiledAt: new Date(),
        isDirty: false,
        dirtyReason: null,
      },
    });

    return NextResponse.json({
      ok: true,
      spec: updatedSpec,
      validation: {
        passed: criticalErrors.length === 0,
        errors: criticalErrors,
        warnings,
      },
      message: criticalErrors.length === 0
        ? "Spec compiled successfully"
        : "Spec compiled with warnings (force=true)",
    });
  } catch (error: any) {
    console.error("Spec compilation error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to compile spec" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analysis-specs/[specId]/compile
 * Get compilation status for a spec
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const { specId } = await params;

    const spec = await prisma.analysisSpec.findFirst({
      where: {
        OR: [{ id: specId }, { slug: specId }],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        compiledAt: true,
        compiledSetId: true,
        isDirty: true,
        dirtyReason: true,
        isLocked: true,
        lockedReason: true,
        usageCount: true,
      },
    });

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: "Spec not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: {
        isCompiled: spec.compiledAt !== null,
        isDirty: spec.isDirty,
        dirtyReason: spec.dirtyReason,
        compiledAt: spec.compiledAt,
        compiledSetId: spec.compiledSetId,
        isLocked: spec.isLocked,
        lockedReason: spec.lockedReason,
        usageCount: spec.usageCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get compilation status" },
      { status: 500 }
    );
  }
}
