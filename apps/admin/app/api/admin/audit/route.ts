import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { isAuditEnabled, setAuditEnabled, getRecentAuditLogs, auditLog, AuditAction } from "@/lib/audit";

/**
 * @api GET /api/admin/audit
 * @visibility internal
 * @scope admin:read
 * @auth bearer
 * @tags admin
 * @description Get audit logging status and recent audit log entries
 * @response 200 { enabled: boolean, logs: AuditLog[] }
 * @response 401 { error: "Unauthorized" }
 * @response 500 { error: "Failed to get audit status" }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const [enabled, logs] = await Promise.all([
      isAuditEnabled(),
      getRecentAuditLogs(100),
    ]);

    return NextResponse.json({ enabled, logs });
  } catch (error) {
    console.error("[API] GET /api/admin/audit error:", error);
    return NextResponse.json({ error: "Failed to get audit status" }, { status: 500 });
  }
}

/**
 * @api POST /api/admin/audit
 * @visibility internal
 * @scope admin:write
 * @auth bearer
 * @tags admin
 * @description Toggle audit logging on or off (ADMIN role required)
 * @body enabled boolean - Whether audit logging should be enabled
 * @response 200 { enabled: boolean }
 * @response 400 { error: "enabled must be a boolean" }
 * @response 401 { error: "Unauthorized" }
 * @response 403 { error: "Forbidden - Admin only" }
 * @response 500 { error: "Failed to update audit setting" }
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }

    await setAuditEnabled(enabled);

    // Log this action (will only log if we just enabled it, or was already enabled)
    await auditLog({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditAction.TOGGLED_AUDIT,
      metadata: { enabled },
    });

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error("[API] POST /api/admin/audit error:", error);
    return NextResponse.json({ error: "Failed to update audit setting" }, { status: 500 });
  }
}
