#!/usr/bin/env npx tsx
/**
 * Slice 1 Chain Verification — V1.1 through V1.4
 *
 * Run on hf-dev VM (or via tunnel) to verify the complete chain:
 *   V1.1: Course creation + content ingestion
 *   V1.2: Playbook configuration (systemSpecToggles)
 *   V1.3: Prompt composition (8 active sections, 15 empty graceful)
 *   V1.4: Post-session pipeline (memories, artifacts, transcript)
 *
 * Usage:
 *   npx tsx scripts/verify-slice1.ts                    # auto-find latest playbook
 *   npx tsx scripts/verify-slice1.ts --playbook <id>    # specific playbook
 *   npx tsx scripts/verify-slice1.ts --step v1.3        # run single step
 *
 * Prerequisites: DB seeded, PIPELINE-001 exists.
 */

import { prisma } from "@/lib/prisma";
import {
  executeComposition,
  loadComposeConfig,
} from "@/lib/prompt/composition";
import { INSTRUCTION_CATEGORIES } from "@/lib/content-trust/resolve-config";

// ─── Colors ──────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function pass(msg: string) { console.log(`  ${c.green}✓${c.reset} ${msg}`); }
function fail(msg: string) { console.log(`  ${c.red}✗${c.reset} ${msg}`); }
function warn(msg: string) { console.log(`  ${c.yellow}⚠${c.reset} ${msg}`); }
function heading(msg: string) { console.log(`\n${c.bold}${c.cyan}── ${msg} ──${c.reset}`); }
function detail(msg: string) { console.log(`    ${c.dim}${msg}${c.reset}`); }

let passes = 0;
let fails = 0;
let warnings = 0;

function check(condition: boolean, passMsg: string, failMsg: string): boolean {
  if (condition) { pass(passMsg); passes++; }
  else { fail(failMsg); fails++; }
  return condition;
}

function advisory(condition: boolean, passMsg: string, warnMsg: string) {
  if (condition) { pass(passMsg); passes++; }
  else { warn(warnMsg); warnings++; }
}

// ─── Args ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const playbookArg = args.includes("--playbook")
  ? args[args.indexOf("--playbook") + 1]
  : null;
const stepArg = args.includes("--step")
  ? args[args.indexOf("--step") + 1]?.toLowerCase()
  : null;

function shouldRun(step: string): boolean {
  return !stepArg || stepArg === step;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`${c.bold}Slice 1 Chain Verification${c.reset}`);
  console.log(`${c.dim}Checks: V1.1 (content) → V1.2 (config) → V1.3 (composition) → V1.4 (pipeline)${c.reset}\n`);

  // Find playbook
  const playbook = playbookArg
    ? await prisma.playbook.findUnique({
        where: { id: playbookArg },
        include: { domain: true, items: true },
      })
    : await prisma.playbook.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        include: { domain: true, items: true },
      });

  if (!playbook) {
    fail("No playbook found. Create a course first, then re-run.");
    process.exit(1);
  }

  console.log(`Playbook: ${c.bold}${playbook.name}${c.reset} (${playbook.id})`);
  console.log(`Domain:   ${playbook.domain?.name ?? "MISSING"}`);

  // ─── V1.1: Course creation + content ingestion ───────────────
  if (shouldRun("v1.1")) {
    heading("V1.1 — Course Creation + Content Ingestion");

    // ContentSource exists
    const sources = await prisma.contentSource.findMany({
      where: {
        subjects: { some: { subject: { playbookSubjects: { some: { playbookId: playbook.id } } } } },
      },
      select: { id: true, name: true, status: true },
    });
    check(sources.length > 0, `ContentSource records found (${sources.length})`, "No ContentSource linked to this playbook");
    for (const s of sources) detail(`${s.name} — ${s.status}`);

    // ContentAssertions
    const sourceIds = sources.map((s) => s.id);
    const allAssertions = await prisma.contentAssertion.findMany({
      where: { sourceId: { in: sourceIds } },
      select: { id: true, category: true },
    });

    const instructionSet = new Set<string>(INSTRUCTION_CATEGORIES);
    const contentAssertions = allAssertions.filter((a) => !instructionSet.has(a.category));
    const instructionAssertions = allAssertions.filter((a) => instructionSet.has(a.category));

    check(contentAssertions.length > 0, `Content assertions: ${contentAssertions.length}`, "No content assertions extracted");
    advisory(instructionAssertions.length > 0, `Instruction assertions: ${instructionAssertions.length}`, "No instruction assertions (OK if source has no tutor instructions)");

    // Curriculum + lesson plan
    const curriculum = await prisma.curriculum.findFirst({
      where: { playbookId: playbook.id },
      select: { id: true, deliveryConfig: true },
    });
    check(!!curriculum, "Curriculum exists", "No curriculum for this playbook");

    if (curriculum) {
      const dc = curriculum.deliveryConfig as any;
      const lessonPlan = dc?.lessonPlan;
      check(Array.isArray(lessonPlan) && lessonPlan.length > 0, `Lesson plan: ${lessonPlan?.length ?? 0} sessions`, "No lesson plan sessions");

      if (lessonPlan?.length > 0) {
        const withRefs = lessonPlan.filter((s: any) => s.learningOutcomeRefs?.length > 0);
        check(withRefs.length === lessonPlan.length, `All sessions have learningOutcomeRefs`, `${lessonPlan.length - withRefs.length} sessions missing learningOutcomeRefs`);
      }
    }
  }

  // ─── V1.2: Playbook configuration ────────────────────────────
  if (shouldRun("v1.2")) {
    heading("V1.2 — Playbook Configuration");

    const config = playbook.items?.[0] || playbook;
    const pbConfig = (playbook as any).config as Record<string, any> | null;
    const toggles = pbConfig?.systemSpecToggles as Record<string, boolean> | undefined;

    check(!!toggles, "systemSpecToggles exists in playbook config", "systemSpecToggles missing — composition won't filter specs");

    if (toggles) {
      const activeSpecs = Object.entries(toggles).filter(([, v]) => v).map(([k]) => k);
      const inactiveSpecs = Object.entries(toggles).filter(([, v]) => !v).map(([k]) => k);

      detail(`Active:   ${activeSpecs.join(", ") || "(none)"}`);
      detail(`Inactive: ${inactiveSpecs.length} specs disabled`);

      // Check for the three required specs
      const hasTutor = activeSpecs.some((s) => s.includes("TUT-") || s.includes("COACH-") || s.includes("COMPANION-") || s.includes("ADVISOR-") || s.includes("FACILITATOR-") || s.includes("CONVGUIDE-") || s.includes("MENTOR-"));
      const hasVoice = activeSpecs.some((s) => s.toLowerCase().includes("voice"));
      advisory(hasTutor, "Base archetype spec active", "No archetype spec found in active toggles");
      advisory(hasVoice, "Voice spec active", "No voice spec in active toggles");
      advisory(activeSpecs.length <= 5, `${activeSpecs.length} specs active (lean config)`, `${activeSpecs.length} specs active — more than expected, check if intentional`);
    }
  }

  // ─── V1.3: Prompt composition ────────────────────────────────
  if (shouldRun("v1.3")) {
    heading("V1.3 — Prompt Composition");

    // Find a caller enrolled in this playbook
    const enrollment = await prisma.callerPlaybook.findFirst({
      where: { playbookId: playbook.id, status: "ACTIVE" },
      select: { callerId: true, caller: { select: { id: true, name: true } } },
    });

    if (!check(!!enrollment, `Enrolled caller: ${enrollment?.caller?.name ?? "?"} (${enrollment?.callerId})`, "No caller enrolled in this playbook — enroll one first")) {
      warn("Skipping composition checks (no caller)");
    } else {
      try {
        const composeConfig = await loadComposeConfig({ forceFirstCall: true });
        const result = await executeComposition(
          enrollment!.callerId,
          composeConfig.sections,
          { ...composeConfig.fullSpecConfig, forceFirstCall: true }
        );

        check(!!result.llmPrompt, "Composition produced llmPrompt", "Composition returned no llmPrompt");

        const activated = result.metadata.sectionsActivated;
        const skipped = result.metadata.sectionsSkipped;
        check(activated.length >= 5, `Sections activated: ${activated.length}`, `Only ${activated.length} sections activated — expected 5+`);
        detail(`Active:  ${activated.join(", ")}`);
        detail(`Skipped: ${skipped.length} sections`);

        // Check for key sections
        const hasIdentity = activated.includes("identity");
        const hasContent = activated.some((s) => s.includes("content") || s.includes("teaching"));
        advisory(hasIdentity, "Identity section active", "Identity section not activated");
        advisory(hasContent, "Content/teaching section active", "No content section activated — tutor won't reference course material");

        // Check caller context
        check(
          !!result.callerContext && result.callerContext.length > 0,
          "Caller context populated",
          "Caller context empty"
        );

        // Check prompt references real content (not just filler)
        const promptText = typeof result.llmPrompt === "string"
          ? result.llmPrompt
          : JSON.stringify(result.llmPrompt);
        advisory(
          promptText.length > 500,
          `Prompt length: ${promptText.length} chars (substantial)`,
          `Prompt only ${promptText.length} chars — may be missing content`
        );
      } catch (err: any) {
        fail(`Composition failed: ${err.message}`);
      }
    }
  }

  // ─── V1.4: Post-session pipeline ─────────────────────────────
  if (shouldRun("v1.4")) {
    heading("V1.4 — Post-Session Pipeline");

    // Find most recent call for this playbook
    const recentCall = await prisma.call.findFirst({
      where: {
        caller: { callerPlaybooks: { some: { playbookId: playbook.id } } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        source: true,
        endedAt: true,
        caller: { select: { name: true } },
      },
    });

    if (!check(!!recentCall, `Recent call found: ${recentCall?.source} on ${recentCall?.createdAt?.toISOString().slice(0, 16)}`, "No calls found for this playbook — run a Sim session first")) {
      warn("Skipping pipeline checks (no call)");
    } else {
      detail(`Call ID: ${recentCall!.id}`);
      detail(`Caller:  ${recentCall!.caller?.name}`);
      detail(`Ended:   ${recentCall!.endedAt?.toISOString() ?? "STILL ACTIVE"}`);

      // Transcript
      const messages = await prisma.callMessage.count({
        where: { callId: recentCall!.id },
      });
      check(messages > 0, `Transcript: ${messages} messages`, "No transcript messages — session may not have recorded");

      // CallerMemory (LEARN output)
      const memories = await prisma.callerMemory.findMany({
        where: { callId: recentCall!.id },
        select: { category: true, key: true, value: true, confidence: true },
      });
      advisory(memories.length > 0, `LEARN output: ${memories.length} memories extracted`, "No memories extracted from this call (pipeline may not have run yet)");
      for (const m of memories.slice(0, 5)) {
        detail(`${m.category}: ${m.key} = ${m.value} (${(m.confidence * 100).toFixed(0)}%)`);
      }
      if (memories.length > 5) detail(`... and ${memories.length - 5} more`);

      // ConversationArtifact (ARTIFACTS output)
      const artifacts = await prisma.conversationArtifact.findMany({
        where: { callId: recentCall!.id },
        select: { type: true, title: true },
      });
      advisory(artifacts.length > 0, `ARTIFACTS output: ${artifacts.length} artifacts`, "No artifacts from this call (pipeline may not have run yet)");
      for (const a of artifacts.slice(0, 5)) {
        detail(`${a.type}: ${a.title}`);
      }

      // CallerMemorySummary
      if (recentCall!.caller) {
        const callerId = (await prisma.call.findUnique({
          where: { id: recentCall!.id },
          select: { callerId: true },
        }))?.callerId;
        if (callerId) {
          const summary = await prisma.callerMemorySummary.findUnique({
            where: { callerId },
          });
          advisory(!!summary, "CallerMemorySummary aggregated", "No summary yet — AGGREGATE stage may not have run");
        }
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────
  heading("Summary");
  console.log(`  ${c.green}${passes} passed${c.reset}  ${c.red}${fails} failed${c.reset}  ${c.yellow}${warnings} warnings${c.reset}`);

  if (fails === 0) {
    console.log(`\n${c.green}${c.bold}All checks passed.${c.reset} Ready for V1.5 walkthrough.\n`);
  } else {
    console.log(`\n${c.red}${c.bold}${fails} check(s) failed.${c.reset} Fix issues above before proceeding.\n`);
  }

  await prisma.$disconnect();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(2);
});
