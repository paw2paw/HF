import { NextRequest } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { quickLaunch, type ProgressEvent } from "@/lib/domain/quick-launch";

/**
 * @api POST /api/domains/quick-launch
 * @visibility internal
 * @auth OPERATOR
 * @tags domains, quick-launch
 * @description Runs the Quick Launch flow: upload content → create domain → scaffold tutor → ready.
 *   Returns SSE stream with progress events for each step.
 *
 * @request multipart/form-data
 *   subjectName: string (required) — e.g. "Food Safety Level 2"
 *   persona: string (required) — e.g. "tutor", "companion", "coach"
 *   file: File (required) — PDF, TXT, MD
 *   learningGoals: string (optional) — JSON-encoded string[] e.g. '["Pass Level 2 exam"]'
 *   qualificationRef: string (optional) — e.g. "Highfield L2 Food Safety"
 *
 * @response 200 text/event-stream — progress events then final result
 */

export const maxDuration = 300; // 5 min for large PDFs

export async function POST(req: NextRequest) {
  // Auth
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;

  // Parse form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Expected multipart/form-data" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const subjectName = formData.get("subjectName") as string | null;
  const brief = formData.get("brief") as string | null;
  const persona = formData.get("persona") as string | null;
  const file = formData.get("file") as File | null;
  const goalsRaw = formData.get("learningGoals") as string | null;
  const qualificationRef = formData.get("qualificationRef") as string | null;

  // Validate required fields
  if (!subjectName?.trim()) {
    return new Response(
      JSON.stringify({ ok: false, error: "subjectName is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!persona?.trim()) {
    return new Response(
      JSON.stringify({ ok: false, error: "persona is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!file) {
    return new Response(
      JSON.stringify({ ok: false, error: "file is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate file type
  const fileName = file.name.toLowerCase();
  const validExtensions = [".pdf", ".txt", ".md", ".markdown", ".json"];
  if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Unsupported file type. Supported: ${validExtensions.join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse learning goals
  let learningGoals: string[] = [];
  if (goalsRaw) {
    try {
      const parsed = JSON.parse(goalsRaw);
      if (Array.isArray(parsed)) {
        learningGoals = parsed.filter((g: any) => typeof g === "string" && g.trim());
      }
    } catch {
      // Treat as single goal if not JSON
      if (goalsRaw.trim()) {
        learningGoals = [goalsRaw.trim()];
      }
    }
  }

  // SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        const result = await quickLaunch(
          {
            subjectName: subjectName.trim(),
            brief: brief?.trim() || undefined,
            persona: persona.trim(),
            learningGoals,
            file,
            qualificationRef: qualificationRef?.trim() || undefined,
          },
          sendEvent,
        );

        // Final result event
        sendEvent({
          phase: "complete",
          message: "Quick Launch complete!",
          detail: result as any,
        });
      } catch (err: any) {
        console.error("[quick-launch] Failed:", err);
        sendEvent({
          phase: "error",
          message: err.message || "Quick Launch failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
