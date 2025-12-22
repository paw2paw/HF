import { NextResponse } from "next/server";

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
