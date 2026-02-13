/**
 * System Settings API
 *
 * Key-value store for application-wide settings (pipeline gates, feature flags, etc.).
 * Uses the SystemSetting table (JSON-encoded values).
 *
 * GET    - List all settings
 * POST   - Upsert a setting
 * DELETE - Remove a setting (reverts to code default)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSystemSettingsCache } from "@/lib/system-settings";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/system-settings
 * @visibility internal
 * @scope settings:read
 * @auth session
 * @tags settings
 * @description List all system settings as key-value pairs.
 * @response 200 { ok: true, settings: [...] }
 * @response 500 { ok: false, error: string }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const rows = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
    });

    const settings = rows.map((r) => ({
      id: r.id,
      key: r.key,
      value: safeJsonParse(r.value),
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({ ok: true, settings });
  } catch (error: any) {
    console.error("[system-settings] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch system settings" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/system-settings
 * @visibility internal
 * @scope settings:write
 * @auth session
 * @tags settings
 * @description Create or update a system setting. Value is auto-serialised to JSON.
 * @body key string - Dot-notation key (e.g. "pipeline.min_transcript_words")
 * @body value any - The setting value (number, string, boolean, object)
 * @response 200 { ok: true, setting: {...} }
 * @response 400 { ok: false, error: string }
 * @response 500 { ok: false, error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json();
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { ok: false, error: "key is required and must be a string" },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { ok: false, error: "value is required" },
        { status: 400 }
      );
    }

    const row = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });

    clearSystemSettingsCache();

    return NextResponse.json({
      ok: true,
      setting: { id: row.id, key: row.key, value: safeJsonParse(row.value), updatedAt: row.updatedAt },
    });
  } catch (error: any) {
    console.error("[system-settings] POST error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save system setting" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/system-settings
 * @visibility internal
 * @scope settings:write
 * @auth session
 * @tags settings
 * @description Delete a system setting by key, reverting to code default.
 * @query key string - The setting key to delete
 * @response 200 { ok: true }
 * @response 400 { ok: false, error: string }
 * @response 404 { ok: false, error: string }
 * @response 500 { ok: false, error: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const key = new URL(request.url).searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "key query parameter is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: `No setting found for key "${key}"` },
        { status: 404 }
      );
    }

    await prisma.systemSetting.delete({ where: { key } });
    clearSystemSettingsCache();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[system-settings] DELETE error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete system setting" },
      { status: 500 }
    );
  }
}

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
