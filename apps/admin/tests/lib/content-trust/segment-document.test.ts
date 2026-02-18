/**
 * Tests for segment-document.ts
 *
 * Verifies:
 * - Short documents skip segmentation (fallback to single section)
 * - AI segmentation is called for longer documents
 * - Section offset resolution from startText
 * - Non-composite fallback when AI returns single section
 * - Graceful error handling on AI failure
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfiguredMeteredAICompletion: vi.fn(),
  logAssistantCall: vi.fn(),
}));

vi.mock("@/lib/metering/instrumented-ai", () => ({
  getConfiguredMeteredAICompletion: mocks.getConfiguredMeteredAICompletion,
}));

vi.mock("@/lib/ai/assistant-wrapper", () => ({
  logAssistantCall: mocks.logAssistantCall,
}));

import { segmentDocument } from "@/lib/content-trust/segment-document";

describe("segmentDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips segmentation for short documents (< 500 chars)", async () => {
    const result = await segmentDocument("Short doc.", "test.pdf");

    expect(result.isComposite).toBe(false);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].startOffset).toBe(0);
    expect(result.sections[0].endOffset).toBe(10);
    expect(result.sections[0].sectionType).toBe("TEXTBOOK");
    expect(mocks.getConfiguredMeteredAICompletion).not.toHaveBeenCalled();
  });

  it("calls AI segmentation for longer documents", async () => {
    const longText = "x".repeat(1000);

    mocks.getConfiguredMeteredAICompletion.mockResolvedValue({
      content: JSON.stringify({
        isComposite: false,
        sections: [{
          title: "Main Content",
          startText: "xxxxxxxxxx",
          sectionType: "TEXTBOOK",
          pedagogicalRole: "INPUT",
          hasQuestions: false,
          hasAnswerKey: false,
        }],
      }),
    });

    const result = await segmentDocument(longText, "test.pdf");

    expect(mocks.getConfiguredMeteredAICompletion).toHaveBeenCalledTimes(1);
    expect(result.isComposite).toBe(false);
    expect(result.sections).toHaveLength(1);
  });

  it("detects composite documents with multiple sections", async () => {
    // Must be >= 500 chars to trigger AI segmentation
    const text = "Preparation task\nMatch the vocabulary with definitions.\n1. to clash\n2. to compromise\n3. collaboration\n\n" +
      "Negotiating\nWhether you are negotiating a multimillion dollar deal or simply persuading your colleagues to go for Chinese food for lunch, " +
      "effective negotiation skills can help you to motivate other people, get the best results and improve profitability. " +
      "There is often a misconception that negotiating is about insisting on our point of view. " +
      "Fisher and Ury argue that collaboration is the key to negotiating successfully.\n\n" +
      "Task 1\nMatch the situations with the type of negotiation.\n1. Joey takes the whole orange\n2. They split the orange in half\n\n" +
      "Answers\nPreparation task: 1. g, 2. d, 3. e\nTask 1: 1. b, 2. a, 3. c";

    mocks.getConfiguredMeteredAICompletion.mockResolvedValue({
      content: JSON.stringify({
        isComposite: true,
        sections: [
          {
            title: "Preparation task",
            startText: "Preparation task",
            sectionType: "WORKSHEET",
            pedagogicalRole: "ACTIVATE",
            hasQuestions: true,
            hasAnswerKey: false,
          },
          {
            title: "Negotiating",
            startText: "Negotiating",
            sectionType: "TEXTBOOK",
            pedagogicalRole: "INPUT",
            hasQuestions: false,
            hasAnswerKey: false,
          },
          {
            title: "Task 1",
            startText: "Task 1",
            sectionType: "ASSESSMENT",
            pedagogicalRole: "CHECK",
            hasQuestions: true,
            hasAnswerKey: false,
          },
          {
            title: "Answers",
            startText: "Answers",
            sectionType: "REFERENCE",
            pedagogicalRole: "REFERENCE",
            hasQuestions: false,
            hasAnswerKey: true,
          },
        ],
      }),
    });

    const result = await segmentDocument(text, "negotiating.pdf");

    expect(result.isComposite).toBe(true);
    expect(result.sections).toHaveLength(4);
    expect(result.sections[0].title).toBe("Preparation task");
    expect(result.sections[0].sectionType).toBe("WORKSHEET");
    expect(result.sections[0].pedagogicalRole).toBe("ACTIVATE");
    expect(result.sections[1].title).toBe("Negotiating");
    expect(result.sections[1].sectionType).toBe("TEXTBOOK");
    expect(result.sections[3].title).toBe("Answers");
    expect(result.sections[3].hasAnswerKey).toBe(true);

    // Section offsets should be resolved and non-overlapping
    for (let i = 0; i < result.sections.length - 1; i++) {
      expect(result.sections[i].endOffset).toBe(result.sections[i + 1].startOffset);
    }
  });

  it("falls back gracefully on AI error", async () => {
    const text = "x".repeat(1000);
    mocks.getConfiguredMeteredAICompletion.mockRejectedValue(new Error("API error"));

    const result = await segmentDocument(text, "test.pdf");

    expect(result.isComposite).toBe(false);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].sectionType).toBe("TEXTBOOK");
  });

  it("falls back when AI returns empty sections", async () => {
    const text = "x".repeat(1000);
    mocks.getConfiguredMeteredAICompletion.mockResolvedValue({
      content: JSON.stringify({ isComposite: false, sections: [] }),
    });

    const result = await segmentDocument(text, "test.pdf");

    expect(result.isComposite).toBe(false);
    expect(result.sections).toHaveLength(1);
  });

  it("falls back when AI returns invalid JSON", async () => {
    const text = "x".repeat(1000);
    mocks.getConfiguredMeteredAICompletion.mockResolvedValue({
      content: "not json at all",
    });

    const result = await segmentDocument(text, "test.pdf");

    expect(result.isComposite).toBe(false);
    expect(result.sections).toHaveLength(1);
  });
});
