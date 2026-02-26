/**
 * Tests for extract-images.ts
 *
 * Verifies:
 * - normalizeFigureRef normalizes various figure reference formats
 * - extractCaptionsFromText parses figure captions from document text
 */
import { describe, it, expect } from "vitest";
import { normalizeFigureRef, extractCaptionsFromText } from "@/lib/content-trust/extract-images";

describe("normalizeFigureRef", () => {
  it("normalizes 'Fig. 1.2' to 'figure 1.2'", () => {
    expect(normalizeFigureRef("Fig. 1.2")).toBe("figure 1.2");
  });

  it("normalizes 'FIGURE 1' to 'figure 1'", () => {
    expect(normalizeFigureRef("FIGURE 1")).toBe("figure 1");
  });

  it("normalizes 'Fig 3' to 'figure 3'", () => {
    expect(normalizeFigureRef("Fig 3")).toBe("figure 3");
  });

  it("normalizes 'Figure 2.3a' to 'figure 2.3a'", () => {
    expect(normalizeFigureRef("Figure 2.3a")).toBe("figure 2.3a");
  });

  it("trims whitespace", () => {
    expect(normalizeFigureRef("  Figure 1  ")).toBe("figure 1");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeFigureRef("Figure   5")).toBe("figure 5");
  });

  it("passes through non-figure refs as lowercase", () => {
    expect(normalizeFigureRef("Diagram A")).toBe("diagram a");
  });
});

describe("extractCaptionsFromText", () => {
  it("extracts 'Figure X.Y: caption' format", () => {
    const text = "Some text.\nFigure 1.2: The water cycle showing evaporation\nMore text.";
    const captions = extractCaptionsFromText(text);
    expect(captions.size).toBe(1);
    expect(captions.get("figure 1.2")).toBe("The water cycle showing evaporation");
  });

  it("extracts multiple captions", () => {
    const text = [
      "Figure 1: Overview of photosynthesis",
      "Some content here",
      "Figure 2.1: Detailed chloroplast structure",
    ].join("\n");
    const captions = extractCaptionsFromText(text);
    expect(captions.size).toBe(2);
    expect(captions.has("figure 1")).toBe(true);
    expect(captions.has("figure 2.1")).toBe(true);
  });

  it("handles em-dash separator", () => {
    const text = "Figure 3 — Cross-section of a leaf";
    const captions = extractCaptionsFromText(text);
    expect(captions.size).toBe(1);
  });

  it("handles Diagram references", () => {
    const text = "Diagram 1: Network topology overview";
    const captions = extractCaptionsFromText(text);
    expect(captions.size).toBe(1);
    // The normalized key should be the full "Diagram 1" lowered
    const keys = Array.from(captions.keys());
    expect(keys[0]).toBe("diagram 1");
  });

  it("skips very short captions (<=3 chars)", () => {
    const text = "Figure 1: OK";
    const captions = extractCaptionsFromText(text);
    // "OK" is only 2 chars, should be skipped
    expect(captions.size).toBe(0);
  });

  it("returns empty map for text with no figures", () => {
    const text = "This is plain text with no figure references at all.";
    const captions = extractCaptionsFromText(text);
    expect(captions.size).toBe(0);
  });
});
