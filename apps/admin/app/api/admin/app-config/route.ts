import { NextResponse } from "next/server";
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

  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const nextAuthUrl = process.env.NEXTAUTH_URL;

  let baseUrl: string;
  let source: string;

  if (nextPublicAppUrl) {
    baseUrl = nextPublicAppUrl;
    source = "NEXT_PUBLIC_APP_URL";
  } else if (nextAuthUrl) {
    baseUrl = nextAuthUrl;
    source = "NEXTAUTH_URL";
  } else {
    baseUrl = "http://localhost:3000";
    source = "default";
  }

  return NextResponse.json({ baseUrl, source });
}
