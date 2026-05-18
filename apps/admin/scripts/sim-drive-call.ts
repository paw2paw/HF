/**
 * Programmatic SIM call driver — runs a multi-turn IELTS practice session
 * end-to-end without the browser UI.
 *
 *   npx tsx scripts/sim-drive-call.ts <callerId> "<label>" "<msg1>" "<msg2>" ...
 *
 * Optional first arg `--module=<slug>` sets Call.requestedModuleId (the
 * pre-call module picker mechanism, #242 Slice 2).
 *
 *   npx tsx scripts/sim-drive-call.ts --module=part2 <callerId> "Call 2" "msg1" "msg2"
 *
 * Steps:
 *   1. Fetch latest ComposedPrompt for caller (or compose if stale)
 *   2. Create Call row (with requestedModuleId if --module given)
 *   3. For each user message:
 *        - Insert CallMessage(role=user)
 *        - Call AI with prompt as system + history → tutor reply
 *        - Insert CallMessage(role=assistant)
 *   4. Mark Call ended (set transcript = full text)
 *   5. Fire POST /api/calls/{id}/pipeline with x-internal-secret in mode=prompt
 *      so the post-call MEASURE → AGGREGATE → REWARD → ADAPT → SUPERVISE →
 *      COMPOSE pipeline runs (this is what generates the next call's prompt
 *      with personalised targets / Uplift).
 */

import { prisma } from "@/lib/prisma";
import { getConfiguredMeteredAICompletion } from "@/lib/metering";
import { config } from "@/lib/config";

interface Args {
  callerId: string;
  label: string;
  moduleSlug?: string;
  messages: string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let moduleSlug: string | undefined;
  const positional: string[] = [];
  for (const a of argv) {
    if (a.startsWith("--module=")) moduleSlug = a.slice("--module=".length);
    else positional.push(a);
  }
  if (positional.length < 3) {
    console.error("Usage: sim-drive-call.ts [--module=<slug>] <callerId> <label> <msg1> [msg2 ...]");
    process.exit(1);
  }
  const [callerId, label, ...messages] = positional;
  return { callerId, label, moduleSlug, messages };
}

function extractPromptText(p: unknown): string {
  if (typeof p === "string") return p;
  if (p && typeof p === "object") {
    const obj = p as Record<string, unknown>;
    if (typeof obj.fullText === "string") return obj.fullText;
    if (typeof obj.text === "string") return obj.text;
    return JSON.stringify(p);
  }
  return String(p);
}

async function main() {
  const { callerId, label, moduleSlug, messages } = parseArgs();
  const startedAt = new Date();

  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: { id: true, name: true },
  });
  if (!caller) {
    console.error(`No caller ${callerId}`);
    process.exit(1);
  }
  const cp = await prisma.callerPlaybook.findFirst({
    where: { callerId },
    select: { playbookId: true },
  });
  if (!cp) {
    console.error(`No playbook linked to caller ${callerId}`);
    process.exit(1);
  }
  const playbookId = cp.playbookId;

  console.log(`\n=== SIM: ${label} → ${caller.name} (${caller.id.slice(0, 8)}) ===`);
  if (moduleSlug) console.log(`Pre-call module pick: ${moduleSlug}`);

  // 1. Fetch latest composed prompt
  const composed = await prisma.composedPrompt.findFirst({
    where: { callerId },
    orderBy: { composedAt: "desc" },
    select: { id: true, llmPrompt: true, composedAt: true, status: true },
  });
  if (!composed) {
    console.error("No composed prompt yet — start a call from the UI first to seed one.");
    process.exit(1);
  }
  const promptText = extractPromptText(composed.llmPrompt);
  console.log(`Using prompt ${composed.id.slice(0, 8)} (${promptText.length} chars, ${composed.status})`);

  // 2. Create Call row
  const call = await prisma.call.create({
    data: {
      source: "sim",
      transcript: "",
      caller: { connect: { id: callerId } },
      playbook: { connect: { id: playbookId } },
      usedPrompt: { connect: { id: composed.id } },
      ...(moduleSlug ? { requestedModuleId: moduleSlug } : {}),
    },
    select: { id: true },
  });
  console.log(`Created call ${call.id.slice(0, 8)}`);

  // Conversation accumulator for the AI history
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  // 3. Drive each turn
  for (const userMsg of messages) {
    console.log(`\n--- User → ${userMsg.slice(0, 80)}${userMsg.length > 80 ? "..." : ""}`);

    // Insert user message
    await prisma.callMessage.create({
      data: { callId: call.id, role: "user", content: userMsg },
    });
    history.push({ role: "user", content: userMsg });

    // Tutor reply
    const aiMessages = [
      { role: "system" as const, content: promptText },
      ...history.map((h) => ({ role: h.role, content: h.content })),
    ];
    const result = await getConfiguredMeteredAICompletion(
      {
        callPoint: "test-harness.system",
        messages: aiMessages,
        maxRetries: 1,
      },
      { sourceOp: "sim-drive", callerId, callId: call.id }
    );
    const tutorReply = result.content.trim();
    console.log(`Tutor → ${tutorReply.slice(0, 200)}${tutorReply.length > 200 ? "..." : ""}`);

    // Insert assistant message
    await prisma.callMessage.create({
      data: { callId: call.id, role: "assistant", content: tutorReply },
    });
    history.push({ role: "assistant", content: tutorReply });
  }

  // 4. Update Call with full transcript text
  // Use "User:" / "Assistant:" prefixes — CallsPromptsTab's parseTranscript()
  // splits on these exact strings to render the transcript card.
  const fullTranscript = history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  await prisma.call.update({
    where: { id: call.id },
    data: { transcript: fullTranscript, endedAt: new Date() },
  });
  console.log(`\nCall transcript written (${fullTranscript.length} chars).`);

  // 5. Fire pipeline
  console.log(`\nFiring pipeline (mode=prompt) ...`);
  const pipelineRes = await fetch(`http://localhost:3000/api/calls/${call.id}/pipeline`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": config.security.internalApiSecret,
    },
    body: JSON.stringify({ callerId, mode: "prompt" }),
  });
  const pipelineBody = await pipelineRes.text();
  if (!pipelineRes.ok) {
    console.error(`Pipeline failed (${pipelineRes.status}): ${pipelineBody.slice(0, 500)}`);
  } else {
    try {
      const j = JSON.parse(pipelineBody);
      console.log(`Pipeline OK in ${j.duration}ms. data=${JSON.stringify(j.data || {}).slice(0, 300)}`);
    } catch {
      console.log(`Pipeline OK (non-JSON): ${pipelineBody.slice(0, 200)}`);
    }
  }

  const endedAt = new Date();
  console.log(`\n=== Done in ${Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)}s ===`);
  console.log(`callId: ${call.id}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[sim-drive] crash:", err);
  process.exit(1);
});
