import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const status = url.searchParams.get("status");

    const files = await prisma.processedFile.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Convert BigInt to string for JSON serialization
    const serializedFiles = files.map((f) => ({
      ...f,
      sizeBytes: f.sizeBytes.toString(),
    }));

    return NextResponse.json({ ok: true, files: serializedFiles, count: files.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch processed files" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/processed-files
 * Reset all processed files to allow reprocessing
 * Query params:
 * - all=true: Delete all processed files
 * - id=<id>: Delete specific file by ID
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const deleteAll = url.searchParams.get("all") === "true";
    const id = url.searchParams.get("id");

    if (!deleteAll && !id) {
      return NextResponse.json(
        { ok: false, error: "Must specify ?all=true or ?id=<id>" },
        { status: 400 }
      );
    }

    if (id) {
      // Delete specific file
      await prisma.processedFile.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: 1, message: `Deleted file ${id}` });
    }

    // Delete all
    const result = await prisma.processedFile.deleteMany();
    return NextResponse.json({
      ok: true,
      deleted: result.count,
      message: `Deleted ${result.count} processed file records. Run transcript processor to reprocess.`
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
