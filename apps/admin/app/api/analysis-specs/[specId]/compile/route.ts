import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

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
 * @api POST /api/analysis-specs/:specId/compile
 * @visibility internal
 * @scope analysis-specs:write
 * @auth session
 * @tags analysis-specs
 * @description Compile a spec: validate triggers/actions/parameters/anchors, and mark as compiled if validation passes
 * @pathParam specId string - Spec UUID or slug
 * @body force boolean - Compile even with critical errors (default: false)
 * @response 200 { ok: true, spec: AnalysisSpec, validation: { passed, errors, warnings }, message: string }
 * @response 404 { ok: false, error: "Spec not found" }
 * @response 423 { ok: false, error: "Spec is locked and cannot be compiled..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
                  error: `Parameter "${param.name}" has ${anchorCount} anchor(s). Add ${3 - anchorCount} more for calibration.`,
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
              error: "Set learnCategory (FACT, PREFERENCE, EVENT, RELATIONSHIP, TOPIC, or CONTEXT)",
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
      const typeHint = spec.outputType === "MEASURE"
        ? "MEASURE specs require: triggers with actions, each action linked to a parameter, and 3+ anchors per parameter"
        : "LEARN specs require: triggers with actions, each action must have a learnCategory set";
      return NextResponse.json({
        ok: false,
        error: "Compilation failed with validation errors",
        errors: criticalErrors,
        warnings,
        hint: typeHint,
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
 * @api GET /api/analysis-specs/:specId/compile
 * @visibility internal
 * @scope analysis-specs:read
 * @auth session
 * @tags analysis-specs
 * @description Get compilation status for a spec (compiled/dirty/locked state)
 * @pathParam specId string - Spec UUID or slug
 * @response 200 { ok: true, status: { isCompiled, isDirty, dirtyReason, compiledAt, compiledSetId, isLocked, lockedReason, usageCount } }
 * @response 404 { ok: false, error: "Spec not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ specId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
