import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { enrollCaller } from "@/lib/enrollment";

/**
 * @api POST /api/playbooks/:playbookId/enrollments/bulk
 * @visibility internal
 * @auth session
 * @tags playbooks, enrollments
 * @description Bulk enroll callers in a playbook.
 * @pathParam playbookId string - The playbook ID
 * @body callerIds string[] - Array of caller IDs to enroll
 * @response 200 { ok: true, enrolled: number, errors: string[] }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ playbookId: string }> }
) {
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  const { playbookId } = await params;
  const body = await req.json();
  const { callerIds } = body;

  if (!Array.isArray(callerIds) || callerIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "callerIds must be a non-empty array" },
      { status: 400 }
    );
  }

  let enrolled = 0;
  const errors: string[] = [];

  for (const callerId of callerIds) {
    try {
      await enrollCaller(callerId, playbookId, "manual");
      enrolled++;
    } catch (err: any) {
      errors.push(`${callerId}: ${err.message}`);
    }
  }

  return NextResponse.json({ ok: true, enrolled, errors });
}
