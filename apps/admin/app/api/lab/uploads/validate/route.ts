import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBDDXml } from "@/lib/bdd/parser";

/**
 * POST /api/lab/uploads/validate
 *
 * Validate uploaded XML files by parsing them
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No IDs provided" },
        { status: 400 }
      );
    }

    // Fetch uploads (allow re-validation of any status)
    const uploads = await prisma.bDDUpload.findMany({
      where: {
        id: { in: ids },
      },
    });

    if (uploads.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No uploads found" },
        { status: 400 }
      );
    }

    let validated = 0;
    let errors = 0;

    for (const upload of uploads) {
      try {
        // Parse the XML
        const parsed = parseBDDXml(upload.xmlContent, upload.fileType);

        // Update the upload with parsed data
        await prisma.bDDUpload.update({
          where: { id: upload.id },
          data: {
            status: "VALIDATED",
            storyId: parsed.storyId || null,
            parameterIds: parsed.parameterIds || [],
            name: parsed.name || null,
            version: parsed.version || null,
            validatedAt: new Date(),
            parseErrors: undefined,
            errorMessage: undefined,
          },
        });

        validated++;
      } catch (parseError: any) {
        // Mark as error
        await prisma.bDDUpload.update({
          where: { id: upload.id },
          data: {
            status: "ERROR",
            errorMessage: parseError.message || "Parse failed",
            parseErrors: { error: parseError.message },
          },
        });

        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      validated,
      errors,
      total: uploads.length,
    });
  } catch (error: any) {
    console.error("Error validating BDD uploads:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Validation failed" },
      { status: 500 }
    );
  }
}
