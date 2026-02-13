import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/lab/uploads
 * @visibility internal
 * @scope lab:read
 * @auth session
 * @tags lab
 * @description List BDD uploads with optional status filter and limit
 * @query limit number - Max results (default: 50)
 * @query status string - Filter by upload status
 * @response 200 { ok: true, uploads: BDDUpload[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const status = url.searchParams.get("status");

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const uploads = await prisma.bDDUpload.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        filename: true,
        status: true,
        error: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, uploads });
  } catch (error: any) {
    console.error("Error fetching BDD uploads:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch uploads" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/lab/uploads
 * @visibility internal
 * @scope lab:write
 * @auth session
 * @tags lab
 * @description Upload one or more BDD files (XML, markdown, text, JSON) via multipart form data
 * @body files File[] - Files to upload (multipart/form-data)
 * @response 200 { ok: true, uploads: BDDUpload[], count: number }
 * @response 400 { ok: false, error: "No files provided" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files provided" },
        { status: 400 }
      );
    }

    const uploads = [];

    for (const file of files) {
      // Accept XML, markdown, text, and JSON files
      const validExtensions = [".xml", ".md", ".txt", ".markdown", ".json"];
      if (!validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        continue;
      }

      const content = await file.text();
      const lowerName = file.name.toLowerCase();
      const lowerContent = content.toLowerCase();

      // Detect file type based on filename pattern or content
      // Support both underscore and hyphen variations
      let fileType: "STORY" | "PARAMETER" = "STORY";
      if (
        lowerName.includes(".param.") ||
        lowerName.includes("parameter") ||
        lowerContent.includes("<parameter_measurement_guide") ||
        lowerContent.includes("<parameter-measurement-guide") ||
        lowerContent.includes("parameter measurement guide") ||
        lowerContent.includes("submetric") ||
        (lowerContent.includes("target range") && lowerContent.includes("formula"))
      ) {
        fileType = "PARAMETER";
      } else if (
        lowerName.includes(".bdd.") ||
        lowerName.includes("story") ||
        lowerContent.includes("<bdd_story") ||
        lowerContent.includes("<bdd-story") ||
        lowerContent.includes("user story") ||
        lowerContent.includes("acceptance criteria") ||
        (lowerContent.includes("as a") && lowerContent.includes("i want") && lowerContent.includes("so that"))
      ) {
        fileType = "STORY";
      }

      const upload = await prisma.bDDUpload.create({
        data: {
          filename: file.name,
          content,
          status: "UPLOADED",
        },
        select: {
          id: true,
          filename: true,
          status: true,
          createdAt: true,
        },
      });

      uploads.push(upload);
    }

    return NextResponse.json({ ok: true, uploads, count: uploads.length });
  } catch (error: any) {
    console.error("Error uploading BDD files:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/lab/uploads
 * @visibility internal
 * @scope lab:write
 * @auth session
 * @tags lab
 * @description Delete BDD uploads by their IDs
 * @body ids string[] - Array of upload IDs to delete
 * @response 200 { ok: true, deleted: number }
 * @response 400 { ok: false, error: "No IDs provided" }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No IDs provided" },
        { status: 400 }
      );
    }

    const result = await prisma.bDDUpload.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error: any) {
    console.error("Error deleting BDD uploads:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Delete failed" },
      { status: 500 }
    );
  }
}
