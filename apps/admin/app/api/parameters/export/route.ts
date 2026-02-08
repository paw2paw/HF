import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/parameters/export
 * Export all parameters as flat CSV with tags and slug links
 *
 * Format:
 * - tags: pipe-delimited tag names (e.g., "Active|MVP")
 * - slugLinks: pipe-delimited in format "slugSlug:weight:mode" (e.g., "openness-comm:1.0:ABSOLUTE")
 */
export async function GET() {
  try {
    const parameters = await prisma.parameter.findMany({
      orderBy: { parameterId: "asc" },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        promptSlugLinks: {
          include: {
            slug: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    // CSV headers
    const headers = [
      "parameterId",
      "name",
      "domainGroup",
      "sectionId",
      "scaleType",
      "directionality",
      "computedBy",
      "definition",
      "interpretationLow",
      "interpretationHigh",
      "measurementMvp",
      "measurementVoiceOnly",
      "tags",
      "slugLinks",
    ];

    // Helper to escape CSV values
    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV rows
    const rows = parameters.map((param) => {
      // Format tags as pipe-delimited
      const tagsStr = param.tags
        .map((t) => t.tag?.name)
        .filter(Boolean)
        .join("|");

      // Format slug links as pipe-delimited "slug:weight:mode"
      const slugLinksStr = param.promptSlugLinks
        .map((link) => `${link.slug?.slug}:${link.weight}:${link.mode}`)
        .filter((s) => !s.startsWith("undefined"))
        .join("|");

      return [
        escapeCSV(param.parameterId),
        escapeCSV(param.name),
        escapeCSV(param.domainGroup),
        escapeCSV(param.sectionId),
        escapeCSV(param.scaleType),
        escapeCSV(param.directionality),
        escapeCSV(param.computedBy),
        escapeCSV(param.definition),
        escapeCSV(param.interpretationLow),
        escapeCSV(param.interpretationHigh),
        escapeCSV(param.measurementMvp),
        escapeCSV(param.measurementVoiceOnly),
        escapeCSV(tagsStr),
        escapeCSV(slugLinksStr),
      ].join(",");
    });

    // Combine header and rows
    const csv = [headers.join(","), ...rows].join("\n");

    // Return as downloadable CSV
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="parameters-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to export parameters" },
      { status: 500 }
    );
  }
}
