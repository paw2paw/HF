import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import {
  isLoggingEnabled,
  setLoggingEnabled,
  getEnabledTypes,
  setEnabledTypes,
  LogType,
} from "@/lib/logger";

const LOG_FILE = join(process.cwd(), "logs", "app.jsonl");

/**
 * GET /api/logs/ai-calls
 * Returns logs from the log file with optional type filtering
 *
 * Query params:
 *   - type: Filter by log type (ai, api, system, user). Can be comma-separated.
 */
export async function GET(request: NextRequest) {
  try {
    const loggingEnabled = isLoggingEnabled();
    const enabledTypes = getEnabledTypes();

    const typeFilter = request.nextUrl.searchParams.get("type");
    const filterTypes = typeFilter ? typeFilter.split(",") as LogType[] : null;

    if (!existsSync(LOG_FILE)) {
      return NextResponse.json({ logs: [], loggingEnabled, enabledTypes });
    }

    const content = readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Parse each line as JSON, newest first
    let logs = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();

    // Apply type filter if specified
    if (filterTypes) {
      logs = logs.filter((log) => filterTypes.includes(log.type));
    }

    // Limit to last 100
    logs = logs.slice(0, 100);

    return NextResponse.json({ logs, loggingEnabled, enabledTypes });
  } catch (error: any) {
    return NextResponse.json({
      logs: [],
      loggingEnabled: true,
      enabledTypes: ["ai", "api", "system", "user"],
      error: error.message,
    });
  }
}

/**
 * PATCH /api/logs/ai-calls
 * Toggle logging on/off and/or set enabled types
 *
 * Body:
 *   - enabled: boolean (optional)
 *   - enabledTypes: string[] (optional)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body.enabled === "boolean") {
      setLoggingEnabled(body.enabled);
    }

    if (Array.isArray(body.enabledTypes)) {
      setEnabledTypes(body.enabledTypes as LogType[]);
    }

    return NextResponse.json({
      ok: true,
      loggingEnabled: isLoggingEnabled(),
      enabledTypes: getEnabledTypes(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

/**
 * DELETE /api/logs/ai-calls
 * Clears the log file
 */
export async function DELETE() {
  try {
    if (existsSync(LOG_FILE)) {
      unlinkSync(LOG_FILE);
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
