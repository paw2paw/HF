import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { isDeepLoggingEnabled, setDeepLoggingEnabled } from "@/lib/deep-logging";

/**
 * @api GET /api/admin/deep-logging
 * @visibility internal
 * @scope admin:read
 * @auth ADMIN
 * @description Get deep logging status
 */
export async function GET() {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const enabled = await isDeepLoggingEnabled();
  return NextResponse.json({ enabled });
}

/**
 * @api POST /api/admin/deep-logging
 * @visibility internal
 * @scope admin:write
 * @auth ADMIN
 * @description Toggle deep logging on/off
 */
export async function POST(req: Request) {
  const auth = await requireAuth("ADMIN");
  if (isAuthError(auth)) return auth.error;

  const body = await req.json();
  const enabled = Boolean(body.enabled);
  await setDeepLoggingEnabled(enabled);
  return NextResponse.json({ enabled });
}
