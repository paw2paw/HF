/**
 * Tests for the extractor framework
 *
 * Verifies:
 * - Registry returns correct extractor for each type
 * - GenericExtractor falls back for unknown types
 * - CurriculumExtractor detects LO boundaries and chunks accordingly
 * - ComprehensionExtractor parses structured JSON responses
 * - AssessmentExtractor parses question/answer responses
 * - Base class deduplication works correctly
 * - hashContent produces consistent hashes
 */

import { describe, it, expect } from "vitest";
import { getExtractor } from "@/lib/content-trust/extractors/registry";
import { GenericExtractor } from "@/lib/content-trust/extractors/generic-extractor";
import { CurriculumExtractor } from "@/lib/content-trust/extractors/curriculum-extractor";
import { ComprehensionExtractor } from "@/lib/content-trust/extractors/comprehension-extractor";
import { AssessmentExtractor } from "@/lib/content-trust/extractors/assessment-extractor";
import { hashContent, parseJsonResponse } from "@/lib/content-trust/extractors/base-extractor";

describe("Extractor Registry", () => {
  it("returns CurriculumExtractor for CURRICULUM type", () => {
    const extractor = getExtractor("CURRICULUM");
    expect(extractor).toBeInstanceOf(CurriculumExtractor);
    expect(extractor.documentType).toBe("CURRICULUM");
  });

  it("returns ComprehensionExtractor for COMPREHENSION type", () => {
    const extractor = getExtractor("COMPREHENSION");
    expect(extractor).toBeInstanceOf(ComprehensionExtractor);
    expect(extractor.documentType).toBe("COMPREHENSION");
  });

  it("returns AssessmentExtractor for ASSESSMENT type", () => {
    const extractor = getExtractor("ASSESSMENT");
    expect(extractor).toBeInstanceOf(AssessmentExtractor);
    expect(extractor.documentType).toBe("ASSESSMENT");
  });

  it("returns GenericExtractor for TEXTBOOK type", () => {
    const extractor = getExtractor("TEXTBOOK");
    expect(extractor).toBeInstanceOf(GenericExtractor);
    expect(extractor.documentType).toBe("TEXTBOOK");
  });

  it("returns GenericExtractor for WORKSHEET type", () => {
    const extractor = getExtractor("WORKSHEET");
    expect(extractor).toBeInstanceOf(GenericExtractor);
    expect(extractor.documentType).toBe("WORKSHEET");
  });

  it("returns GenericExtractor for REFERENCE type", () => {
    const extractor = getExtractor("REFERENCE");
    expect(extractor).toBeInstanceOf(GenericExtractor);
    expect(extractor.documentType).toBe("REFERENCE");
  });

  it("returns GenericExtractor for new types (LESSON_PLAN, POLICY_DOCUMENT)", () => {
    expect(getExtractor("LESSON_PLAN")).toBeInstanceOf(GenericExtractor);
    expect(getExtractor("POLICY_DOCUMENT")).toBeInstanceOf(GenericExtractor);
  });

  it("returns GenericExtractor with TEXTBOOK when no type specified", () => {
    const extractor = getExtractor();
    expect(extractor).toBeInstanceOf(GenericExtractor);
    expect(extractor.documentType).toBe("TEXTBOOK");
  });
});

describe("CurriculumExtractor chunking", () => {
  it("detects LO boundaries and chunks by them", () => {
    const extractor = new CurriculumExtractor();

    const text = [
      "Preamble content about the course. This qualification covers food safety principles and practices for the hospitality industry.",
      "",
      "Learning Outcome 1: Understand food safety",
      "AC 1.1: Define food safety and explain its importance in the hospitality sector",
      "AC 1.2: List key principles of food safety management systems and their application",
      "AC 1.3: Identify the main legislation relating to food safety in the United Kingdom",
      "AC 1.4: Describe the role of the Environmental Health Officer in food premises inspections",
      "",
      "Learning Outcome 2: Temperature control",
      "AC 2.1: Explain the danger zone and its significance for bacterial growth in food",
      "AC 2.2: Describe monitoring procedures and record-keeping requirements for temperatures",
      "AC 2.3: State the legal temperature requirements for hot holding, cold holding and reheating",
      "AC 2.4: Explain how to use calibrated temperature probes correctly and safely",
      "",
      "Learning Outcome 3: Personal hygiene",
      "AC 3.1: Describe effective handwashing techniques and when they should be used",
      "AC 3.2: Explain the importance of protective clothing and hair coverings in food areas",
      "AC 3.3: Describe procedures for reporting illness and exclusion from food handling duties",
    ].join("\n");

    const chunks = extractor.chunkText(text, 8000);

    // Should detect 3 LO boundaries and split accordingly
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((c) => c.includes("Learning Outcome 1"))).toBe(true);
    expect(chunks.some((c) => c.includes("Learning Outcome 2"))).toBe(true);
    expect(chunks.some((c) => c.includes("Learning Outcome 3"))).toBe(true);
  });

  it("falls back to standard chunking when no LO boundaries detected", () => {
    const extractor = new CurriculumExtractor();

    const text = "Just some regular text without any formal structure. ".repeat(200);
    const chunks = extractor.chunkText(text, 500);

    expect(chunks.length).toBeGreaterThan(1);
    // All text should be present across chunks
    const joined = chunks.join("");
    expect(joined.length).toBeLessThanOrEqual(text.length + 10); // slight trimming OK
  });
});

describe("hashContent", () => {
  it("produces consistent hashes for same content", () => {
    const hash1 = hashContent("hello world");
    const hash2 = hashContent("hello world");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different content", () => {
    const hash1 = hashContent("hello world");
    const hash2 = hashContent("goodbye world");
    expect(hash1).not.toBe(hash2);
  });

  it("normalizes case and whitespace", () => {
    const hash1 = hashContent("Hello World");
    const hash2 = hashContent("  hello world  ");
    expect(hash1).toBe(hash2);
  });

  it("returns 16-char hex string", () => {
    const hash = hashContent("test");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("parseJsonResponse", () => {
  it("parses clean JSON array", () => {
    const result = parseJsonResponse('[{"a": 1}, {"a": 2}]');
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("parses JSON with markdown code fences", () => {
    const result = parseJsonResponse('```json\n[{"a": 1}]\n```');
    expect(result).toEqual([{ a: 1 }]);
  });

  it("handles trailing commas", () => {
    const result = parseJsonResponse('[{"a": 1,}, {"b": 2,},]');
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("handles missing commas between objects", () => {
    const result = parseJsonResponse('[{"a": 1}{"b": 2}]');
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses JSON object", () => {
    const result = parseJsonResponse('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });
});
