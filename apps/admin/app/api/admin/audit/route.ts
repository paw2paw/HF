import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAuditEnabled, setAuditEnabled, getRecentAuditLogs, auditLog, AuditAction } from "@/lib/audit";

// GET /api/admin/audit - Get audit status and recent logs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

// POST /api/admin/audit - Toggle audit logging
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only ADMIN role can toggle audit logging
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

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
