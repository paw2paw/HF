import { NextRequest } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api POST /api/test-harness/generate-callers
 * @visibility internal
 * @auth ADMIN
 * @tags test-harness
 * @description Batch-create N test callers in a domain. Returns SSE progress stream.
 * @body domainId string - Target domain ID (required)
 * @body count number - Number of callers to create (1-50, required)
 * @body namePrefix string - Name prefix for callers (default "Test Caller")
 * @response 200 text/event-stream
 * @response 400 { ok: false, error: "..." }
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth("ADMIN");
  if (isAuthError(authResult)) return authResult.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { domainId, count, namePrefix = "Test Caller" } = body;

  if (!domainId) {
    return new Response(
      JSON.stringify({ ok: false, error: "domainId is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const numCount = Math.max(1, Math.min(50, Number(count) || 5));

  // Verify domain exists
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) {
    return new Response(
      JSON.stringify({ ok: false, error: "Domain not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: Record<string, any>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const callerIds: string[] = [];
      const timestamp = Date.now();

      try {
        for (let i = 0; i < numCount; i++) {
          const callerName = `${namePrefix} ${i + 1}`;
          const caller = await prisma.caller.create({
            data: {
              name: callerName,
              email: `test-${i + 1}-${timestamp}@test.local`,
              domainId,
              externalId: `test-harness-${timestamp}-${i + 1}`,
            },
          });
          callerIds.push(caller.id);
          sendEvent({
            phase: "progress",
            message: `Created "${callerName}" (${i + 1}/${numCount})`,
            detail: { callerId: caller.id, index: i + 1, total: numCount },
          });
        }

        sendEvent({
          phase: "complete",
          message: `Created ${callerIds.length} callers in ${domain.name}`,
          detail: { created: callerIds.length, domainId, domainName: domain.name, callerIds },
        });
      } catch (err: any) {
        console.error("[test-harness/generate-callers] Error:", err);
        sendEvent({
          phase: "error",
          message: err.message || "Failed to create callers",
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
