/**
 * Tests for formatAssertion with media refs
 *
 * Verifies:
 * - formatAssertion includes [HAS FIGURE] markers when mediaRefs are present
 * - formatAssertion works normally without mediaRefs
 */
import { describe, it, expect } from "vitest";
import { formatAssertion } from "@/lib/knowledge/assertions";

describe("formatAssertion with mediaRefs", () => {
  const base = {
    assertion: "The water cycle involves evaporation, condensation, and precipitation.",
    category: "fact",
    chapter: "Chapter 3",
    sourceName: "Science Textbook",
    trustLevel: "VERIFIED" as const,
  };

  it("formats normally without mediaRefs", () => {
    const result = formatAssertion(base);
    expect(result).toContain("[FACT]");
    expect(result).toContain("(Chapter 3)");
    expect(result).toContain("water cycle");
    expect(result).toContain("[Trust: VERIFIED]");
    expect(result).not.toContain("[HAS FIGURE");
  });

  it("includes [HAS FIGURE] marker when mediaRefs present", () => {
    const result = formatAssertion({
      ...base,
      mediaRefs: [
        { mediaId: "abc123", figureRef: "Figure 3.1", captionText: "Water cycle diagram" },
      ],
    });
    expect(result).toContain('[HAS FIGURE: "Water cycle diagram", media_id: abc123]');
  });

  it("prefers captionText over figureRef for label", () => {
    const result = formatAssertion({
      ...base,
      mediaRefs: [
        { mediaId: "def456", figureRef: "Figure 1", captionText: "Detailed caption" },
      ],
    });
    expect(result).toContain('"Detailed caption"');
    expect(result).not.toContain('"Figure 1"');
  });

  it("falls back to figureRef when no captionText", () => {
    const result = formatAssertion({
      ...base,
      mediaRefs: [
        { mediaId: "ghi789", figureRef: "Figure 2.5", captionText: null },
      ],
    });
    expect(result).toContain('"Figure 2.5"');
  });

  it("falls back to mediaId when no captionText or figureRef", () => {
    const result = formatAssertion({
      ...base,
      mediaRefs: [
        { mediaId: "xyz999", figureRef: null, captionText: null },
      ],
    });
    expect(result).toContain('"xyz999"');
  });

  it("includes multiple figure markers", () => {
    const result = formatAssertion({
      ...base,
      mediaRefs: [
        { mediaId: "a1", figureRef: "Figure 1", captionText: "First figure" },
        { mediaId: "b2", figureRef: "Figure 2", captionText: "Second figure" },
      ],
    });
    expect(result).toContain('[HAS FIGURE: "First figure", media_id: a1]');
    expect(result).toContain('[HAS FIGURE: "Second figure", media_id: b2]');
  });

  it("handles empty mediaRefs array", () => {
    const result = formatAssertion({ ...base, mediaRefs: [] });
    expect(result).not.toContain("[HAS FIGURE");
  });

  it("includes teachMethod when present", () => {
    const result = formatAssertion({
      ...base,
      teachMethod: "recall_quiz",
      mediaRefs: [
        { mediaId: "m1", figureRef: "Fig 1", captionText: null },
      ],
    });
    expect(result).toContain("[recall_quiz]");
    expect(result).toContain("[HAS FIGURE");
  });
});
