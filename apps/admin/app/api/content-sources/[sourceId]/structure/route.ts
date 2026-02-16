/**
 * @api POST /api/content-sources/:sourceId/structure
 * @auth OPERATOR
 * @desc Organize flat assertions into a pedagogical pyramid hierarchy
 * @body { mode: "preview" | "apply" }
 * @returns Preview: proposed tree. Apply: created/updated hierarchy stats.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { previewStructure, applyStructure } from "@/lib/content-trust/structure-assertions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const { sourceId } = await params;

  // Verify source exists
  const source = await prisma.contentSource.findUnique({
    where: { id: sourceId },
    select: { id: true, name: true, _count: { select: { assertions: true } } },
  });

  if (!source) {
    return NextResponse.json({ ok: false, error: "Content source not found" }, { status: 404 });
  }

  if (source._count.assertions === 0) {
    return NextResponse.json(
      { ok: false, error: "No assertions found. Import a document first." },
      { status: 400 },
    );
  }

  // Parse mode from body
  let mode = "preview";
  try {
    const body = await request.json();
    mode = body.mode || "preview";
  } catch {
    // Default to preview if no body
  }

  if (mode !== "preview" && mode !== "apply") {
    return NextResponse.json(
      { ok: false, error: `Invalid mode: "${mode}". Use "preview" or "apply".` },
      { status: 400 },
    );
  }

  if (mode === "preview") {
    const result = await previewStructure(sourceId);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  // Apply mode
  const result = await applyStructure(sourceId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
