import { describe, it, expect } from "vitest";
import { renderPromptSummary } from "@/lib/prompt/composition/renderPromptSummary";

describe("renderPromptSummary", () => {
  it("renders a complete prompt with all sections", () => {
    const result = renderPromptSummary({
      _quickStart: {
        this_caller: "Alice",
        this_session: "Call #3",
        voice_style: "warm and empathetic",
      },
      memories: {
        totalCount: 5,
        byCategory: {
          FACT: [
            { key: "location", value: "London", confidence: 0.9 },
          ],
          PREFERENCE: [
            { key: "contact", value: "email", confidence: 0.8 },
          ],
        },
      },
    });

    expect(result).toContain("# SESSION PROMPT");
    expect(result).toContain("Alice");
    expect(result).toContain("Call #3");
    expect(result).toContain("Memories");
    expect(result).toContain("FACT");
    expect(result).toContain("location: London");
    expect(result).toContain("PREFERENCE");
  });

  it("renders minimal prompt with no data", () => {
    const result = renderPromptSummary({});
    expect(result).toContain("# SESSION PROMPT");
    expect(result).not.toContain("Memories");
  });

  it("renders all memory categories dynamically (not just hardcoded 4)", () => {
    const result = renderPromptSummary({
      memories: {
        totalCount: 4,
        byCategory: {
          FACT: [{ key: "name", value: "Bob", confidence: 0.9 }],
          EVENT: [{ key: "meeting", value: "scheduled for Tuesday", confidence: 0.7 }],
          CONTEXT: [{ key: "mood", value: "upbeat", confidence: 0.6 }],
          CUSTOM_CAT: [{ key: "custom", value: "test", confidence: 0.5 }],
        },
      },
    });

    // All categories should be rendered — not just the old hardcoded 4
    expect(result).toContain("FACT");
    expect(result).toContain("EVENT");
    expect(result).toContain("CONTEXT");
    expect(result).toContain("CUSTOM_CAT");
    expect(result).toContain("name: Bob");
    expect(result).toContain("meeting: scheduled for Tuesday");
    expect(result).toContain("mood: upbeat");
    expect(result).toContain("custom: test");
  });

  it("renders critical rules from preamble", () => {
    const result = renderPromptSummary({
      _preamble: {
        criticalRules: ["Never share personal data", "Always be respectful"],
      },
    });

    expect(result).toContain("Critical Rules");
    expect(result).toContain("Never share personal data");
    expect(result).toContain("Always be respectful");
  });

  it("handles empty byCategory gracefully", () => {
    const result = renderPromptSummary({
      memories: {
        totalCount: 0,
        byCategory: {},
      },
    });

    // Should still show the memories header with count
    expect(result).not.toContain("FACT");
  });
});
