/**
 * Tests for classify-document.ts
 *
 * Verifies:
 * - buildMultiPointSample() samples from start, middle, and end
 * - Short texts are returned as-is
 * - Labels are correctly inserted
 */
import { describe, it, expect } from "vitest";
import { buildMultiPointSample, filenameTypeHint } from "@/lib/content-trust/classify-document";

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

describe("filenameTypeHint", () => {
  it("detects course-reference in filename", () => {
    const hint = filenameTypeHint("11plus-english-course-reference.md");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects course_reference with underscore", () => {
    const hint = filenameTypeHint("biology_course_reference.pdf");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects course-ref shorthand", () => {
    const hint = filenameTypeHint("maths-course-ref.docx");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects tutor-guide", () => {
    const hint = filenameTypeHint("english-tutor-guide.pdf");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects tutor_handbook", () => {
    const hint = filenameTypeHint("science_tutor_handbook.md");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects teaching-guide", () => {
    const hint = filenameTypeHint("Teaching-Guide-Year5.pdf");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects teaching-methodology", () => {
    const hint = filenameTypeHint("reading-teaching-methodology.docx");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects delivery-guide", () => {
    const hint = filenameTypeHint("11plus-delivery-guide.pdf");
    expect(hint).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
  });

  it("detects question-bank", () => {
    const hint = filenameTypeHint("P1_SecretGarden_QuestionBank.docx");
    expect(hint).toEqual({ type: "QUESTION_BANK", role: "questions" });
  });

  it("detects question_bank with underscore", () => {
    const hint = filenameTypeHint("chapter1_question_bank.pdf");
    expect(hint).toEqual({ type: "QUESTION_BANK", role: "questions" });
  });

  it("detects reading-passage", () => {
    const hint = filenameTypeHint("black-death-reading-passage.pdf");
    expect(hint).toEqual({ type: "READING_PASSAGE", role: "passage" });
  });

  it("detects lesson-plan", () => {
    const hint = filenameTypeHint("week3-lesson-plan.docx");
    expect(hint).toEqual({ type: "LESSON_PLAN", role: "pedagogy" });
  });

  it("detects mark-scheme", () => {
    const hint = filenameTypeHint("SATs-mark-scheme-2024.pdf");
    expect(hint).toEqual({ type: "ASSESSMENT", role: "questions" });
  });

  it("detects past-paper", () => {
    const hint = filenameTypeHint("GCSE-biology-past-paper.pdf");
    expect(hint).toEqual({ type: "ASSESSMENT", role: "questions" });
  });

  it("returns null for generic filenames", () => {
    expect(filenameTypeHint("chapter1.pdf")).toBeNull();
    expect(filenameTypeHint("biology-notes.docx")).toBeNull();
    expect(filenameTypeHint("textbook.pdf")).toBeNull();
    expect(filenameTypeHint("P1_secret_garden_Chapter-1.docx")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(filenameTypeHint("COURSE-REFERENCE.PDF")).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
    expect(filenameTypeHint("Tutor-Guide.docx")).toEqual({ type: "COURSE_REFERENCE", role: "pedagogy" });
    expect(filenameTypeHint("QUESTION_BANK.pdf")).toEqual({ type: "QUESTION_BANK", role: "questions" });
  });
});
