/**
 * System Initialization Check
 *
 * @api GET /api/system/ini
 * @auth SUPERADMIN
 * @desc Runs 10 parallel checks to verify system configuration.
 *       Returns RAG (red/amber/green) status with per-check detail.
 */

import { requireAuth, isAuthError } from "@/lib/permissions";
import { runIniChecks } from "@/lib/system-ini";

export async function GET() {
  const auth = await requireAuth("SUPERADMIN");
  if (isAuthError(auth)) return auth.error;

  const result = await runIniChecks();

  return Response.json(result);
}
