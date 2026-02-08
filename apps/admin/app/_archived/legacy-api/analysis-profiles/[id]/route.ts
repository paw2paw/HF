import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/analysis-profiles/[id]
 *
 * Get a single analysis profile with all its parameters
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const profile = await prisma.analysisProfile.findUnique({
      where: { id },
      include: {
        parameters: {
          include: {
            parameter: true,
          },
        },
        runs: {
          orderBy: { startedAt: "desc" },
          take: 5,
        },
        _count: {
          select: {
            parameters: true,
            runs: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Analysis profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      profile,
      parameterSet: profile, // Legacy field name
    });
  } catch (error: any) {
    console.error("[GET /api/analysis-profiles/[id]]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch analysis profile" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/analysis-profiles/[id]
 *
 * Update an analysis profile's parameters (EQ configuration)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Validate profile exists
    const existing = await prisma.analysisProfile.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Analysis profile not found" },
        { status: 404 }
      );
    }

    // Update name/description if provided
    if (body.name || body.description !== undefined) {
      await prisma.analysisProfile.update({
        where: { id },
        data: {
          ...(body.name && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
        },
      });
    }

    // Update parameter configurations if provided
    if (body.parameters && Array.isArray(body.parameters)) {
      for (const param of body.parameters) {
        await prisma.analysisProfileParameter.updateMany({
          where: {
            analysisProfileId: id,
            parameterId: param.parameterId,
          },
          data: {
            enabled: param.enabled ?? true,
            weight: param.weight ?? 1.0,
            biasValue: param.biasValue ?? null,
            thresholdLow: param.thresholdLow ?? null,
            thresholdHigh: param.thresholdHigh ?? null,
          },
        });
      }
    }

    // Fetch updated profile
    const updatedProfile = await prisma.analysisProfile.findUnique({
      where: { id },
      include: {
        parameters: {
          include: {
            parameter: true,
          },
        },
        _count: {
          select: {
            parameters: true,
            runs: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      profile: updatedProfile,
      parameterSet: updatedProfile, // Legacy field name
    });
  } catch (error: any) {
    console.error("[PUT /api/analysis-profiles/[id]]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update analysis profile" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analysis-profiles/[id]
 *
 * Delete an analysis profile
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if it has runs
    const profile = await prisma.analysisProfile.findUnique({
      where: { id },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Analysis profile not found" },
        { status: 404 }
      );
    }

    if (profile._count.runs > 0) {
      return NextResponse.json(
        { ok: false, error: "Cannot delete analysis profile with existing runs" },
        { status: 400 }
      );
    }

    await prisma.analysisProfile.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[DELETE /api/analysis-profiles/[id]]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete analysis profile" },
      { status: 500 }
    );
  }
}
