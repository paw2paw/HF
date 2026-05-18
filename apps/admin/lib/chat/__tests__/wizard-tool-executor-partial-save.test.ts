/**
 * Partial-save semantics for update_setup. #468.
 *
 * Before: any invalid field in the payload (unknown key OR progressionMode)
 * triggered an early-return with is_error, dropping ALL sibling valid fields
 * from the AI's view of what was saved. Live IELTS wizard run 2026-05-18
 * showed 10 valid fields lost because of one bad sibling.
 *
 * After: valid fields are reported as saved; invalid fields are surfaced
 * in the response as rejections so the AI can act on partial success.
 *
 * The tests avoid institution/course/subject resolution paths (those hit
 * the DB). They use plain scalar fields the executor accepts without any
 * DB scaffolding.
 */

import { describe, it, expect } from "vitest";
import { executeWizardTool } from "@/lib/chat/wizard-tool-executor";

describe("update_setup partial-save (#468)", () => {
  it("saves valid sibling when one field is rejected as unknown", async () => {
    const result = await executeWizardTool(
      "update_setup",
      { fields: { audience: "higher-ed", constraints: "foo" } },
      "user-1",
      {},
    );
    expect(result.is_error).toBeFalsy();
    expect(result.content).toContain("Saved 1 field(s): audience");
    expect(result.content).toContain("ALSO REJECTED FROM THIS CALL");
    expect(result.content).toContain("constraints");
  });

  it("saves valid siblings when progressionMode is rejected", async () => {
    const result = await executeWizardTool(
      "update_setup",
      {
        fields: {
          audience: "higher-ed",
          interactionPattern: "socratic",
          progressionMode: "learner-picks",
        },
      },
      "user-1",
      {},
    );
    expect(result.is_error).toBeFalsy();
    expect(result.content).toMatch(/Saved 2 field\(s\):/);
    expect(result.content).toContain("audience");
    expect(result.content).toContain("interactionPattern");
    expect(result.content).not.toContain("progressionMode: learner-picks");
    expect(result.content).toContain("show_options with dataKey:\"progressionMode\"");
  });

  it("returns is_error only when NO valid fields are salvageable", async () => {
    const result = await executeWizardTool(
      "update_setup",
      { fields: { constraints: "foo", garbage: "bar" } },
      "user-1",
      {},
    );
    expect(result.is_error).toBe(true);
    const payload = JSON.parse(result.content);
    expect(payload.ok).toBe(false);
    expect(payload.saved).toEqual([]);
    expect(payload.rejected).toEqual({ constraints: "foo", garbage: "bar" });
  });

  it("clean valid payload has no rejection note", async () => {
    const result = await executeWizardTool(
      "update_setup",
      { fields: { audience: "higher-ed", interactionPattern: "socratic" } },
      "user-1",
      {},
    );
    expect(result.is_error).toBeFalsy();
    expect(result.content).not.toContain("REJECTED");
    expect(result.content).toContain("Saved 2 field(s)");
  });

  it("progressionMode is accepted when already set in setupData (idempotent)", async () => {
    const result = await executeWizardTool(
      "update_setup",
      { fields: { audience: "higher-ed", progressionMode: "learner-picks" } },
      "user-1",
      { progressionMode: "learner-picks" }, // already set
    );
    expect(result.is_error).toBeFalsy();
    expect(result.content).not.toContain("REJECTED");
    expect(result.content).toContain("Saved 2 field(s)");
  });
});
