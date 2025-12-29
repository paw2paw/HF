import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Optional: you can return the list by duplicating the OPS keys here,
  // but simplest is to just confirm the endpoint exists.
  return NextResponse.json({ ok: true });
}