import { NextResponse } from "next/server";

/**
 * POST /api/x/seed-transcripts
 *
 * Recursively imports all transcript files from the HF_KB_PATH/sources/transcripts/raw directory
 * and all subdirectories. This is a wrapper around the existing
 * /api/transcripts/import endpoint that automatically finds and imports
 * all .json and .txt transcript files.
 */
export async function POST(request: Request) {
  try {
    // Determine domain - check if companion domain exists, otherwise use default
    const domainSlug = await determineDomainSlug();

    // Call the existing import endpoint with fromKbPath mode
    const importUrl = new URL("/api/transcripts/import", request.url);
    const importResponse = await fetch(importUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromKbPath: true,
        domainSlug,
      }),
    });

    const importResult = await importResponse.json();

    if (importResult.ok) {
      return NextResponse.json({
        ok: true,
        message: `Imported ${importResult.callsImported} calls from ${importResult.created} new callers (${importResult.filesProcessed} files processed)`,
        sourceDir: importResult.sourceDir,
        details: importResult,
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: importResult.error || "Import failed",
          details: importResult,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("POST /api/x/seed-transcripts error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to import transcripts",
      },
      { status: 500 }
    );
  }
}

/**
 * Determines which domain to assign imported callers to
 * Priority: companion > wnf > default
 */
async function determineDomainSlug(): Promise<string> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    // Check for companion domain
    const companion = await prisma.domain.findUnique({
      where: { slug: "companion" },
    });
    if (companion) return "companion";

    // Check for WNF domain
    const wnf = await prisma.domain.findUnique({
      where: { slug: "wnf" },
    });
    if (wnf) return "wnf";

    // Check for default domain
    const defaultDomain = await prisma.domain.findFirst({
      where: { slug: "default" },
    });
    if (defaultDomain) return "default";

    // If no domains exist, use "default" (will be created by import)
    return "default";
  } finally {
    await prisma.$disconnect();
  }
}
