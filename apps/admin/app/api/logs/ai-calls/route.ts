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
import { requireAuth, isAuthError } from "@/lib/permissions";

const LOG_FILE = join(process.cwd(), "logs", "app.jsonl");

/**
 * @api GET /api/logs/ai-calls
 * @visibility internal
 * @scope logs:read
 * @auth session
 * @tags logs
 * @description Returns parsed log entries from the JSONL log file, newest first (max 100). Includes current logging status and enabled log types. Supports filtering by log type.
 * @query type string - Filter by log type(s), comma-separated: "ai", "api", "system", "user" (optional)
 * @response 200 { logs: [...], loggingEnabled: boolean, enabledTypes: [...] }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api PATCH /api/logs/ai-calls
 * @visibility internal
 * @scope logs:write
 * @auth session
 * @tags logs
 * @description Toggle logging on/off and/or set which log types are enabled. Both fields are optional and can be set independently.
 * @body enabled boolean - Enable or disable logging (optional)
 * @body enabledTypes string[] - Array of log types to enable: "ai", "api", "system", "user" (optional)
 * @response 200 { ok: true, loggingEnabled: boolean, enabledTypes: [...] }
 * @response 400 { ok: false, error: "..." }
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api DELETE /api/logs/ai-calls
 * @visibility internal
 * @scope logs:write
 * @auth session
 * @tags logs
 * @description Clears the entire log file by deleting it from disk.
 * @response 200 { ok: true }
 */
export async function DELETE() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    if (existsSync(LOG_FILE)) {
      unlinkSync(LOG_FILE);
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message });
  }
}
