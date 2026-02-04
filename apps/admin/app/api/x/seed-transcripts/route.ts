import { NextResponse } from "next/server";

/**
 * POST /api/x/seed-transcripts
 *
 * Recursively imports all transcript files from the HF_KB_PATH/sources/transcripts/raw directory
 * and all subdirectories. This is a wrapper around the existing
 * /api/transcripts/import endpoint that automatically finds and imports
 * all .json and .txt transcript files.
 *
 * Body:
 * - mode: "replace" | "keep" (optional, defaults to "keep")
 *   - "replace": Deletes ALL existing Callers and Calls before importing
 *   - "keep": Keeps existing data, skips duplicates
 */
export async function POST(request: Request) {
  try {
    // Parse body to get mode
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || "keep";

    // If replace mode, delete all existing callers and calls first
    if (mode === "replace") {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      try {
        console.log("🗑️  REPLACE mode: Deleting all existing Callers and Calls...");

        // Delete in correct order due to foreign key constraints
        // First: tables that reference Call
        await prisma.personalityObservation.deleteMany({});
        await prisma.callScore.deleteMany({});
        await prisma.callTarget.deleteMany({});
        await prisma.composedPrompt.deleteMany({});
        // Then: Call itself
        await prisma.call.deleteMany({});
        // Then: tables that reference Caller
        await prisma.callerTarget.deleteMany({});
        await prisma.behaviorTarget.deleteMany({ where: { scope: "CALLER" } });
        await prisma.callerMemorySummary.deleteMany({});
        await prisma.callerMemory.deleteMany({});
        await prisma.callerPersonality.deleteMany({});
        await prisma.callerPersonalityProfile.deleteMany({});
        await prisma.callerIdentity.deleteMany({});
        await prisma.callerAttribute.deleteMany({});
        // Finally: Caller itself
        await prisma.caller.deleteMany({});

        console.log("   ✓ All Callers and Calls deleted");
      } finally {
        await prisma.$disconnect();
      }
    }

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
      const modeLabel = mode === "replace" ? " (replaced all existing)" : " (kept existing, skipped duplicates)";
      return NextResponse.json({
        ok: true,
        message: `Imported ${importResult.callsImported} calls from ${importResult.created} new callers (${importResult.filesProcessed} files processed)${modeLabel}`,
        sourceDir: importResult.sourceDir,
        mode,
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
