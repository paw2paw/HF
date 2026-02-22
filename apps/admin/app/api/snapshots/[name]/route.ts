import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getSnapshot, deleteSnapshot, isValidSnapshotName } from "@/lib/snapshots";

/**
 * @api GET /api/snapshots/:name
 * @visibility internal
 * @scope snapshots:read
 * @auth session (ADMIN+)
 * @tags snapshots
 * @description Get details for a specific snapshot
 * @param name string - Snapshot name
 * @response 200 { ok: true, snapshot: SnapshotInfo }
 * @response 404 { ok: false, error: "..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const { name } = await params;

    if (!isValidSnapshotName(name)) {
      return NextResponse.json(
        { ok: false, error: "Invalid snapshot name" },
        { status: 400 }
      );
    }

    const snapshot = await getSnapshot(name);
    if (!snapshot) {
      return NextResponse.json(
        { ok: false, error: `Snapshot "${name}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      snapshot: {
        name: snapshot.name,
        fileSize: snapshot.fileSize,
        metadata: snapshot.metadata,
      },
    });
  } catch (error: any) {
    console.error("Error getting snapshot:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get snapshot" },
      { status: 500 }
    );
  }
}

/**
 * @api DELETE /api/snapshots/:name
 * @visibility internal
 * @scope snapshots:write
 * @auth session (ADMIN+)
 * @tags snapshots
 * @description Delete a saved snapshot
 * @param name string - Snapshot name
 * @response 200 { ok: true }
 * @response 404 { ok: false, error: "..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const { name } = await params;

    if (!isValidSnapshotName(name)) {
      return NextResponse.json(
        { ok: false, error: "Invalid snapshot name" },
        { status: 400 }
      );
    }

    const deleted = await deleteSnapshot(name);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: `Snapshot "${name}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting snapshot:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}
