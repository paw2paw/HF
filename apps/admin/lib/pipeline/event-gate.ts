import { config } from "@/lib/config";
import { readSchedulerDecision, type SchedulerMode } from "./scheduler-decision";

/**
 * Slice 1 — Micro-MVP event-gate for EXTRACT scoring (#154).
 *
 * Fixes Boaz S1–S4: skills were being scored even when no evidence existed
 * that the student had been assessed (e.g. COMP_VOCABULARY scored 0.85 in a
 * teach-only session). The gate reads the previous call's SchedulerDecision
 * and only allows caller-skill scoring when the prior mode was "assess" or
 * "practice".
 *
 * Default-allow semantics:
 *   - No decision on file (first call, structured mode, legacy caller) → allow.
 *     Structured-mode lessons plans have always scored every call; preserving
 *     that avoids a silent behaviour change outside continuous mode.
 *   - Decision on file with mode "teach" or "review" → deny.
 *   - Decision on file with mode "assess" or "practice" → allow.
 *
 * Slices 2 and 3 replace the per-mode allow/deny with per-paramId gating once
 * the real scheduler can emit a working set tagged with assessment coverage.
 */

export interface EventGateResult {
  allow: boolean;
  mode: SchedulerMode | "unknown";
  reason: string;
}

export async function shouldRunCallerAnalysis(
  callerId: string,
): Promise<EventGateResult> {
  const prior = await readSchedulerDecision(callerId);

  if (!prior) {
    return {
      allow: true,
      mode: "unknown",
      reason: "no prior SchedulerDecision (first call, structured mode, or legacy caller)",
    };
  }

  const allowedModes = config.scheduler.assessmentModes;
  if (allowedModes.includes(prior.mode)) {
    return {
      allow: true,
      mode: prior.mode,
      reason: `prior decision mode=${prior.mode} — assessment evidence expected`,
    };
  }

  return {
    allow: false,
    mode: prior.mode,
    reason: `prior decision mode=${prior.mode} — no assessment evidence (allowed: ${allowedModes.join(",")}), skipping caller scoring`,
  };
}
