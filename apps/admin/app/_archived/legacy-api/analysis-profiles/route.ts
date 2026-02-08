import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analysis-profiles
 *
 * List all analysis profiles (formerly parameter sets)
 */
export async function GET() {
  try {
    const profiles = await prisma.analysisProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: {
          select: {
            parameters: true,
            runs: true,
          },
        },
      },
    });

    // Return both new and legacy field names for backwards compatibility
    return NextResponse.json({
      ok: true,
      profiles,
      parameterSets: profiles, // Legacy field name
      count: profiles.length
    });
  } catch (error: any) {
    console.error("[GET /api/analysis-profiles]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch analysis profiles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analysis-profiles
 *
 * Create a new analysis profile with EQ configuration
 *
 * Body:
 * - name: string - Name for this profile
 * - description?: string - Optional description
 * - parameters: array of parameter configs with enabled, weight, biasValue etc.
 * - cloneFromId?: string - Optionally clone settings from existing profile
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, parameters, cloneFromId } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Name is required" },
        { status: 400 }
      );
    }

    // If cloning, get the source profile's parameters
    let sourceParams: any[] = [];
    if (cloneFromId) {
      const sourceProfile = await prisma.analysisProfile.findUnique({
        where: { id: cloneFromId },
        include: { parameters: { include: { parameter: true } } },
      });
      if (sourceProfile) {
        sourceParams = sourceProfile.parameters;
      }
    }

    // If no parameters provided, get all active parameters
    let paramsToCreate = parameters;
    if (!paramsToCreate || paramsToCreate.length === 0) {
      const allParams = await prisma.parameter.findMany({
        include: {
          tags: {
            include: { tag: true },
          },
        },
      });

      // Use source params if cloning, otherwise use all params with defaults
      if (sourceParams.length > 0) {
        paramsToCreate = sourceParams.map((sp) => ({
          parameterId: sp.parameterId,
          definition: sp.definition,
          scaleType: sp.scaleType,
          directionality: sp.directionality,
          interpretationLow: sp.interpretationLow,
          interpretationHigh: sp.interpretationHigh,
          enabled: sp.enabled ?? true,
          weight: sp.weight ?? 1.0,
          biasValue: sp.biasValue ?? null,
          thresholdLow: sp.thresholdLow ?? null,
          thresholdHigh: sp.thresholdHigh ?? null,
        }));
      } else {
        paramsToCreate = allParams.map((p) => ({
          parameterId: p.parameterId,
          definition: p.definition,
          scaleType: p.scaleType,
          directionality: p.directionality,
          interpretationLow: p.interpretationLow,
          interpretationHigh: p.interpretationHigh,
          enabled: true,
          weight: 1.0,
          biasValue: null,
          thresholdLow: null,
          thresholdHigh: null,
        }));
      }
    }

    // Create the analysis profile with its parameters
    const profile = await prisma.analysisProfile.create({
      data: {
        name,
        description: description || null,
        parameters: {
          create: paramsToCreate.map((p: any) => ({
            parameterId: p.parameterId,
            definition: p.definition || null,
            scaleType: p.scaleType || null,
            directionality: p.directionality || null,
            interpretationLow: p.interpretationLow || null,
            interpretationHigh: p.interpretationHigh || null,
            enabled: p.enabled ?? true,
            weight: p.weight ?? 1.0,
            biasValue: p.biasValue ?? null,
            thresholdLow: p.thresholdLow ?? null,
            thresholdHigh: p.thresholdHigh ?? null,
          })),
        },
      },
      include: {
        parameters: {
          include: { parameter: true },
        },
        _count: {
          select: {
            parameters: true,
            runs: true,
          },
        },
      },
    });

    // Return both new and legacy field names
    return NextResponse.json({
      ok: true,
      profile,
      parameterSet: profile, // Legacy field name
    }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/analysis-profiles]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create analysis profile" },
      { status: 500 }
    );
  }
}
