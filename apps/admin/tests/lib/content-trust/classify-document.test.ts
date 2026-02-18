/**
 * Tests for classify-document.ts
 *
 * Verifies:
 * - buildMultiPointSample() samples from start, middle, and end
 * - Short texts are returned as-is
 * - Labels are correctly inserted
 */
import { describe, it, expect } from "vitest";
import { buildMultiPointSample } from "@/lib/content-trust/classify-document";

describe("buildMultiPointSample", () => {
  it("returns full text when shorter than totalSize", () => {
    const text = "Short document content";
    const result = buildMultiPointSample(text, 2000);
    expect(result).toBe(text);
  });

  it("samples from start, middle, and end with labels", () => {
    // Build a 3000 char document
    const start = "A".repeat(1000);
    const middle = "B".repeat(1000);
    const end = "C".repeat(1000);
    const fullText = start + middle + end;

    const result = buildMultiPointSample(fullText, 600);

    // Should contain all three labels
    expect(result).toContain("[START OF DOCUMENT]");
    expect(result).toContain("[MIDDLE OF DOCUMENT]");
    expect(result).toContain("[END OF DOCUMENT]");

    // Start section should have A characters
    const startSection = result.split("[MIDDLE OF DOCUMENT]")[0];
    expect(startSection).toContain("A");

    // End section should have C characters
    const endSection = result.split("[END OF DOCUMENT]")[1];
    expect(endSection).toContain("C");
  });

  it("distributes sample sizes roughly 40/30/30", () => {
    const fullText = "x".repeat(5000);
    const totalSize = 1000;

    const result = buildMultiPointSample(fullText, totalSize);

    // The result should be around totalSize + label overhead
    // Labels: "[START OF DOCUMENT]\n" + "\n[MIDDLE OF DOCUMENT]\n" + "\n[END OF DOCUMENT]\n"
    const labelOverhead = "[START OF DOCUMENT]".length + "[MIDDLE OF DOCUMENT]".length + "[END OF DOCUMENT]".length + 6; // newlines
    expect(result.length).toBeLessThanOrEqual(totalSize + labelOverhead + 10);
  });

  it("handles text exactly equal to totalSize", () => {
    const text = "x".repeat(2000);
    const result = buildMultiPointSample(text, 2000);
    expect(result).toBe(text);
  });
});
