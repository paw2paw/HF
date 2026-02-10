import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/parameters/display-config
 *
 * Returns parameter display configuration for UI rendering.
 * Fetches from Parameter table - fully dynamic, no hardcoding.
 *
 * Groups parameters by section for organized display:
 * - Big Five personality traits (B5-*)
 * - VARK learning modalities (VARK-*)
 * - Other parameters
 */
export async function GET() {
  try {
    // Fetch all canonical parameters that should be displayed in personality profiles
    const parameters = await prisma.parameter.findMany({
      where: {
        isCanonical: true,
        deprecatedAt: null,
      },
      select: {
        parameterId: true,
        name: true,
        definition: true,
        sectionId: true,
        scaleType: true,
        interpretationHigh: true,
        interpretationLow: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Group parameters by category for organized display
    const grouped: Record<string, any[]> = {
      "Big Five": [],
      "VARK": [],
      "Other": [],
    };

    // Assign default colors based on parameter type
    const colorPalette = {
      "B5-O": "#3b82f6",      // blue
      "B5-C": "#8b5cf6",      // violet
      "B5-E": "#10b981",      // emerald
      "B5-A": "#f59e0b",      // amber
      "B5-N": "#ef4444",      // red
      "VARK-V": "#3b82f6",    // blue
      "VARK-A": "#8b5cf6",    // violet
      "VARK-R": "#10b981",    // emerald
      "VARK-K": "#f59e0b",    // amber
    };

    for (const param of parameters) {
      const displayInfo = {
        parameterId: param.parameterId,
        label: param.name
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        description: param.definition || '',
        color: colorPalette[param.parameterId as keyof typeof colorPalette] || "#6b7280", // default gray
        section: param.sectionId || 'Other',
        scaleType: param.scaleType,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
      };

      // Categorize by parameter ID prefix
      if (param.parameterId.startsWith('B5-')) {
        grouped["Big Five"].push(displayInfo);
      } else if (param.parameterId.startsWith('VARK-')) {
        grouped["VARK"].push(displayInfo);
      } else {
        grouped["Other"].push(displayInfo);
      }
    }

    // Build flat map for quick lookups
    const paramMap: Record<string, any> = {};
    parameters.forEach(param => {
      paramMap[param.parameterId] = {
        parameterId: param.parameterId,
        label: param.name
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        description: param.definition || '',
        color: colorPalette[param.parameterId as keyof typeof colorPalette] || "#6b7280",
        section: param.sectionId || 'Other',
      };
    });

    return NextResponse.json({
      ok: true,
      grouped,
      params: paramMap,
      totalParameters: parameters.length,
    });
  } catch (error: any) {
    console.error("[api/parameters/display-config] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to fetch parameter display config",
      },
      { status: 500 }
    );
  }
}
