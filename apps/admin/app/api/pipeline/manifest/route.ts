/**
 * Pipeline Manifest API
 *
 * GET /api/pipeline/manifest - Get the pipeline blueprint/manifest
 */

import { NextResponse } from "next/server";
import { PIPELINE_MANIFEST } from "@/lib/ops/pipeline-manifest";

export async function GET() {
  return NextResponse.json({
    ok: true,
    manifest: PIPELINE_MANIFEST,
  });
}
