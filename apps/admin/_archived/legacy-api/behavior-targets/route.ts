import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/behavior-targets
 * List all behavior targets with their parameters
 *
 * Query params:
 * - scope: Filter by scope (SYSTEM, SEGMENT, CALLER)
 * - parameterId: Filter by parameter
 * - activeOnly: Only return currently active targets (no effectiveUntil)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const parameterId = searchParams.get("parameterId");
    const activeOnly = searchParams.get("activeOnly") === "true";

    const where: any = {};

    if (scope) {
      where.scope = scope;
    }

    if (parameterId) {
      where.parameterId = parameterId;
    }

    if (activeOnly) {
      where.effectiveUntil = null;
    }

    const targets = await prisma.behaviorTarget.findMany({
      where,
      include: {
        parameter: {
          select: {
            parameterId: true,
            name: true,
            domainGroup: true,
            parameterType: true,
          },
        },
        segment: {
          select: {
            id: true,
            name: true,
          },
        },
        callerIdentity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { scope: "asc" },
        { parameterId: "asc" },
        { effectiveFrom: "desc" },
      ],
    });

    return NextResponse.json({
      ok: true,
      targets,
      count: targets.length,
    });
  } catch (error: any) {
    console.error("GET /api/behavior-targets error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch behavior targets" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/behavior-targets
 * Create a new behavior target
 *
 * Body: {
 *   parameterId: string,       // Required: which BEHAVIOR parameter
 *   scope: "SYSTEM" | "SEGMENT" | "CALLER",
 *   targetValue: number,       // 0.0 - 1.0
 *   confidence?: number,       // 0.0 - 1.0, default 0.5
 *   source?: "SEED" | "LEARNED" | "MANUAL",
 *   segmentId?: string,        // Required if scope is SEGMENT
 *   callerIdentityId?: string, // Required if scope is CALLER
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      parameterId,
      scope,
      targetValue,
      confidence = 0.5,
      source = "MANUAL",
      segmentId,
      callerIdentityId,
    } = body;

    // Validation
    if (!parameterId) {
      return NextResponse.json(
        { ok: false, error: "parameterId is required" },
        { status: 400 }
      );
    }

    if (!scope || !["SYSTEM", "SEGMENT", "CALLER"].includes(scope)) {
      return NextResponse.json(
        { ok: false, error: "scope must be SYSTEM, SEGMENT, or CALLER" },
        { status: 400 }
      );
    }

    if (targetValue === undefined || targetValue < 0 || targetValue > 1) {
      return NextResponse.json(
        { ok: false, error: "targetValue must be between 0.0 and 1.0" },
        { status: 400 }
      );
    }

    if (scope === "SEGMENT" && !segmentId) {
      return NextResponse.json(
        { ok: false, error: "segmentId is required for SEGMENT scope" },
        { status: 400 }
      );
    }

    if (scope === "CALLER" && !callerIdentityId) {
      return NextResponse.json(
        { ok: false, error: "callerIdentityId is required for CALLER scope" },
        { status: 400 }
      );
    }

    // Verify parameter exists and is a BEHAVIOR type
    const parameter = await prisma.parameter.findUnique({
      where: { parameterId },
    });

    if (!parameter) {
      return NextResponse.json(
        { ok: false, error: `Parameter ${parameterId} not found` },
        { status: 404 }
      );
    }

    if (parameter.parameterType !== "BEHAVIOR") {
      return NextResponse.json(
        {
          ok: false,
          error: `Parameter ${parameterId} is type ${parameter.parameterType}, not BEHAVIOR. Targets can only be set for BEHAVIOR parameters.`,
        },
        { status: 400 }
      );
    }

    // Check for existing active target with same scope+parameter+segment/caller
    const existingWhere: any = {
      parameterId,
      scope,
      effectiveUntil: null, // Currently active
    };
    if (scope === "SEGMENT") existingWhere.segmentId = segmentId;
    if (scope === "CALLER") existingWhere.callerIdentityId = callerIdentityId;

    const existing = await prisma.behaviorTarget.findFirst({
      where: existingWhere,
    });

    // If exists, supersede it
    if (existing) {
      await prisma.behaviorTarget.update({
        where: { id: existing.id },
        data: { effectiveUntil: new Date() },
      });
    }

    // Create new target
    const target = await prisma.behaviorTarget.create({
      data: {
        parameterId,
        scope,
        targetValue,
        confidence,
        source,
        segmentId: scope === "SEGMENT" ? segmentId : null,
        callerIdentityId: scope === "CALLER" ? callerIdentityId : null,
        supersededById: null,
        effectiveFrom: new Date(),
        effectiveUntil: null,
      },
      include: {
        parameter: {
          select: {
            parameterId: true,
            name: true,
            domainGroup: true,
          },
        },
      },
    });

    // Update supersededById on old target
    if (existing) {
      await prisma.behaviorTarget.update({
        where: { id: existing.id },
        data: { supersededById: target.id },
      });
    }

    return NextResponse.json({
      ok: true,
      target,
      superseded: existing ? existing.id : null,
    });
  } catch (error: any) {
    console.error("POST /api/behavior-targets error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create behavior target" },
      { status: 500 }
    );
  }
}
