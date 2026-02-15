import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/admin/app-config
 * @visibility internal
 * @scope admin:read
 * @auth session
 * @tags admin, config
 * @description Returns the active base URL and its source env var.
 *   Used by the invite form to preview link URLs before creating invites.
 * @response 200 { baseUrl: string, source: "NEXT_PUBLIC_APP_URL" | "NEXTAUTH_URL" | "default" }
 */
export async function GET() {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  const baseUrl = config.app.url;
  const source = process.env.NEXT_PUBLIC_APP_URL ? "NEXT_PUBLIC_APP_URL" : "default";

  return NextResponse.json({ baseUrl, source });
}
