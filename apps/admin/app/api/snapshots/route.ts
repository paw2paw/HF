import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { listSnapshots, startSnapshotTakeJob, isValidSnapshotName } from "@/lib/snapshots";

/**
 * @api GET /api/snapshots
 * @visibility internal
 * @scope snapshots:read
 * @auth session (ADMIN+)
 * @tags snapshots
 * @description List all saved database snapshots
 * @response 200 { ok: true, snapshots: SnapshotInfo[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const snapshots = await listSnapshots();

    return NextResponse.json({
      ok: true,
      snapshots: snapshots.map((s) => ({
        name: s.name,
        fileSize: s.fileSize,
        metadata: s.metadata,
      })),
    });
  } catch (error: any) {
    console.error("Error listing snapshots:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to list snapshots" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/snapshots
 * @visibility internal
 * @scope snapshots:write
 * @auth session (ADMIN+)
 * @tags snapshots
 * @description Start a snapshot take job (async, returns taskId)
 * @body name string - Snapshot name (alphanumeric, hyphens, underscores)
 * @body description string? - Optional description
 * @body withLearners boolean? - Include learner data (default: false)
 * @response 200 { ok: true, taskId: string }
 * @response 400 { ok: false, error: "..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;
    const { session } = authResult;

    const body = await request.json();
    const { name, description, withLearners } = body;

    if (!name || !isValidSnapshotName(name)) {
      return NextResponse.json(
        { ok: false, error: "Invalid snapshot name. Use alphanumeric characters, hyphens, and underscores." },
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

    const taskId = await startSnapshotTakeJob(userId, {
      name,
      description,
      withLearners: withLearners ?? false,
    });

    return NextResponse.json({ ok: true, taskId });
  } catch (error: any) {
    console.error("Error starting snapshot:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to start snapshot" },
      { status: 500 }
    );
  }
}
