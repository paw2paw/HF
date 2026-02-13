import { NextRequest } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import {
  quickLaunchAnalyze,
  type ProgressEvent,
} from "@/lib/domain/quick-launch";
import { startTaskTracking, updateTaskProgress } from "@/lib/ai/task-guidance";

/**
 * @api POST /api/domains/quick-launch/analyze
 * @visibility internal
 * @auth OPERATOR
 * @tags domains, quick-launch
 * @description Runs the analysis phase of Quick Launch (Steps 1-4):
 *   create domain, extract content, save assertions, generate identity.
 *   Creates a UserTask for tracking and autosave.
 *   Returns SSE stream with progressive data events for the review UI.
 *
 * @request multipart/form-data
 *   subjectName: string (required)
 *   persona: string (required)
 *   file: File (required) — PDF, TXT, MD
 *   learningGoals: string (optional) — JSON-encoded string[]
 *   qualificationRef: string (optional)
 *
 * @response 200 text/event-stream — progressive data events then final AnalysisPreview
 */

export const maxDuration = 300; // 5 min for large PDFs

export async function POST(req: NextRequest) {
  // Auth
  const authResult = await requireAuth("OPERATOR");
  if (isAuthError(authResult)) return authResult.error;
  const { session } = authResult;

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
      if (goalsRaw.trim()) {
        learningGoals = [goalsRaw.trim()];
      }
    }
  }

  // Create a UserTask for tracking
  let taskId: string | null = null;
  try {
    taskId = await startTaskTracking(session.user.id, "quick_launch", {
      phase: "building",
      input: {
        subjectName: subjectName.trim(),
        persona: persona.trim(),
        learningGoals,
        qualificationRef: qualificationRef?.trim() || undefined,
      },
      fileInfo: { name: file.name, size: file.size },
    });
  } catch (err) {
    console.warn("[quick-launch:analyze] Failed to create task:", err);
  }

  // SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ProgressEvent) => {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Send taskId to frontend immediately
      if (taskId) {
        sendEvent({ phase: "task_created", message: "Task created", data: { taskId } });
      }

      try {
        const preview = await quickLaunchAnalyze(
          {
            subjectName: subjectName.trim(),
            persona: persona.trim(),
            learningGoals,
            file,
            qualificationRef: qualificationRef?.trim() || undefined,
          },
          (event) => {
            sendEvent(event);

            // Autosave progress to task context
            if (taskId && event.data) {
              updateTaskProgress(taskId, {
                currentStep: (event.stepIndex ?? 0) + 1,
                completedSteps: [event.phase],
                context: {
                  phase: "building",
                  preview: event.data,
                },
              }).catch(() => {}); // Fire-and-forget autosave
            }
          },
        );

        // Save final preview to task
        if (taskId) {
          updateTaskProgress(taskId, {
            currentStep: 3, // Review step
            context: {
              phase: "review",
              input: {
                subjectName: subjectName.trim(),
                persona: persona.trim(),
                learningGoals,
                qualificationRef: qualificationRef?.trim() || undefined,
              },
              fileInfo: { name: file.name, size: file.size },
              preview,
            },
          }).catch(() => {});
        }
      } catch (err: any) {
        console.error("[quick-launch:analyze] Failed:", err);
        sendEvent({
          phase: "error",
          message: err.message || "Analysis failed",
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
