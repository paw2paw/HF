/**
 * Pipeline Manifest API
 */

import { NextResponse } from "next/server";
import { PIPELINE_MANIFEST } from "@/lib/ops/pipeline-manifest";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/pipeline/manifest
 * @visibility public
 * @scope pipeline:read
 * @auth session
 * @tags pipeline
 * @description Get the pipeline blueprint/manifest defining all pipeline stages and operations
 * @response 200 { ok: true, manifest: PipelineManifest }
 */
export async function GET() {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  return NextResponse.json({
    ok: true,
    manifest: PIPELINE_MANIFEST,
  });
}
