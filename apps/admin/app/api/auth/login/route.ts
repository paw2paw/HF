import { NextResponse } from "next/server";

/**
 * @api POST /api/auth/login
 * @visibility internal
 * @scope auth:login
 * @auth none
 * @tags auth
 * @description Validates a superadmin bearer token and returns access credentials. Used for programmatic/API access.
 * @body token string - The HF_SUPERADMIN_TOKEN to validate
 * @response 200 { accessToken: "...", permissions: "SUPERADMIN" }
 * @response 401 { error: "Invalid token" }
 * @response 500 { error: "Server misconfigured" }
 */
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));

  const expected = process.env.HF_SUPERADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  if (token && token === expected) {
    return NextResponse.json({
      accessToken: token,
      permissions: "SUPERADMIN",
    });
  }

  return NextResponse.json({ error: "Invalid token" }, { status: 401 });
}
