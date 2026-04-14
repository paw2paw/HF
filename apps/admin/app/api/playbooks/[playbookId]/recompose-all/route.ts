import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPlaybookRoster } from "@/lib/enrollment";
import {
  executeComposition,
  loadComposeConfig,
  persistComposedPrompt,
} from "@/lib/prompt/composition";
import { renderPromptSummary } from "@/lib/prompt/composition/renderPromptSummary";

export const runtime = "nodejs";

const CONCURRENCY = 5;

/**
 * @api POST /api/playbooks/:playbookId/recompose-all
 * @visibility internal
 * @scope playbooks:compose
 * @auth session
 * @tags playbooks, composition
 * @description Fan-out prompt recomposition across every ACTIVE caller enrolled in a
 *   playbook. Used after a course-scoped tuner save so the next composition for each
 *   caller picks up the new targets/config. Skips callers without a domain. History and
 *   in-flight calls are NOT affected — only the next ComposedPrompt.
 * @pathParam playbookId string - Playbook UUID
 * @body triggerType string - Default "TUNER_FANOUT"
 * @response 200 { ok: true, total, succeeded, failed, errors: [...] }
 * @response 404 { ok: false, error: "Playbook not found" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playbookId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { playbookId } = await params;
    const body = await request.json().catch(() => ({}));
    const triggerType: string = body?.triggerType || "TUNER_FANOUT";

    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      select: { id: true },
    });
    if (!playbook) {
      return NextResponse.json(
        { ok: false, error: "Playbook not found" },
        { status: 404 },
      );
    }

    const roster = await getPlaybookRoster(playbookId, "ACTIVE");
    const callerIds = roster
      .map((r) => r.caller?.id)
      .filter((id): id is string => !!id);

    if (callerIds.length === 0) {
      return NextResponse.json({
        ok: true,
        total: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      });
    }

    // Load compose config once — reused across all callers
    const { fullSpecConfig, sections, specSlug } = await loadComposeConfig({});

    const limit = pLimit(CONCURRENCY);
    const errors: Array<{ callerId: string; error: string }> = [];
    let succeeded = 0;

    await Promise.all(
      callerIds.map((callerId) =>
        limit(async () => {
          try {
            const caller = await prisma.caller.findUnique({
              where: { id: callerId },
              select: { id: true, domainId: true },
            });
            if (!caller?.domainId) {
              errors.push({ callerId, error: "No domain assigned" });
              return;
            }

            const composition = await executeComposition(
              callerId,
              sections,
              fullSpecConfig,
              triggerType,
            );
            const promptSummary = renderPromptSummary(composition.llmPrompt);

            await persistComposedPrompt(composition, promptSummary, {
              callerId,
              playbookId,
              triggerType,
              composeSpecSlug: specSlug,
              specConfig: fullSpecConfig,
            });

            succeeded += 1;
          } catch (err: any) {
            errors.push({
              callerId,
              error: err?.message || "composition failed",
            });
          }
        }),
      ),
    );

    return NextResponse.json({
      ok: true,
      total: callerIds.length,
      succeeded,
      failed: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error("Error in recompose-all:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fan out recomposition" },
      { status: 500 },
    );
  }
}
