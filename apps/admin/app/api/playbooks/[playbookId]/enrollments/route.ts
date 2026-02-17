import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { getPlaybookRoster } from "@/lib/enrollment";

/**
 * @api GET /api/playbooks/:playbookId/enrollments
 * @visibility public
 * @scope playbooks:read
 * @auth session
 * @tags playbooks, enrollments
 * @description List enrolled callers for a playbook (class roster).
 * @pathParam playbookId string - The playbook ID
 * @query status string - Filter by enrollment status (ACTIVE, COMPLETED, PAUSED, DROPPED)
 * @response 200 { ok: true, enrollments: CallerPlaybook[] }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  const authResult = await requireAuth("VIEWER");
  if (isAuthError(authResult)) return authResult.error;

  const { playbookId } = await params;
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") as "ACTIVE" | "COMPLETED" | "PAUSED" | "DROPPED" | null;

  const enrollments = await getPlaybookRoster(
    playbookId,
    statusFilter || undefined
  );

  return NextResponse.json({ ok: true, enrollments });
}
