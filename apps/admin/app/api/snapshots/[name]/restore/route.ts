import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { startSnapshotRestoreJob, isValidSnapshotName } from "@/lib/snapshots";

/**
 * @api POST /api/snapshots/:name/restore
 * @visibility internal
 * @scope snapshots:write
 * @auth session (SUPERADMIN only)
 * @tags snapshots
 * @description Start a snapshot restore job (async, returns taskId). DESTRUCTIVE: replaces data in affected layers.
 * @param name string - Snapshot name to restore
 * @response 200 { ok: true, taskId: string }
 * @response 400 { ok: false, error: "..." }
 * @response 404 { ok: false, error: "..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const authResult = await requireAuth("SUPERADMIN");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const { name } = await params;

    if (!isValidSnapshotName(name)) {
      return NextResponse.json(
        { ok: false, error: "Invalid snapshot name" },
        { status: 400 }
      );
    }

    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "User ID not found in session" },
        { status: 400 }
      );
    }

    const taskId = await startSnapshotRestoreJob(userId, name);

    return NextResponse.json({ ok: true, taskId });
  } catch (error: any) {
    // loadSnapshotFile throws if not found
    if (error?.message?.includes("not found")) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 404 }
      );
    }
    console.error("Error starting restore:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to start restore" },
      { status: 500 }
    );
  }
}
