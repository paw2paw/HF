import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtractionConfig } from "@/lib/content-trust/resolve-config";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal extraction config with just the classification section used by classifyDocument */
function makeConfig(overrides: Partial<ExtractionConfig["classification"]> = {}): ExtractionConfig {
  return {
    classification: {
      systemPrompt: "test prompt",
      llmConfig: { temperature: 0.1, maxTokens: 500 },
      sampleSize: 2000,
      ...overrides,
    },
  } as ExtractionConfig;
}

/** Shorthand to make the AI mock resolve with a given JSON object (raw string) */
function mockAIReturn(json: Record<string, unknown>) {
  mocks.getConfiguredMeteredAICompletion.mockResolvedValueOnce({
    content: JSON.stringify(json),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("classifyDocument", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // We dynamically import so the vi.mock calls above are hoisted before the module loads
  async function classify(text: string, fileName: string, cfg: ExtractionConfig) {
    const { classifyDocument } = await import("@/lib/content-trust/classify-document");
    return classifyDocument(text, fileName, cfg);
  }

  it("classifies CURRICULUM document correctly", async () => {
    mockAIReturn({
      documentType: "CURRICULUM",
      confidence: 0.92,
      reasoning: "has LOs and ACs",
    });

    const result = await classify("Some curriculum text", "syllabus.pdf", makeConfig());

    expect(result).toEqual({
      documentType: "CURRICULUM",
      confidence: 0.92,
      reasoning: "has LOs and ACs",
    });

    expect(mocks.getConfiguredMeteredAICompletion).toHaveBeenCalledOnce();
    expect(mocks.logAssistantCall).toHaveBeenCalledOnce();
  });

  it("classifies WORKSHEET with markdown fences", async () => {
    mocks.getConfiguredMeteredAICompletion.mockResolvedValueOnce({
      content: '```json\n{"documentType":"WORKSHEET","confidence":0.87,"reasoning":"has questions"}\n```',
    });

    const result = await classify("Worksheet content", "activity.docx", makeConfig());

    expect(result).toEqual({
      documentType: "WORKSHEET",
      confidence: 0.87,
      reasoning: "has questions",
    });
  });

  it("falls back to TEXTBOOK on invalid type", async () => {
    mockAIReturn({
      documentType: "INVALID_TYPE",
      confidence: 0.8,
      reasoning: "test",
    });

    const result = await classify("Some text", "unknown.pdf", makeConfig());

    expect(result.documentType).toBe("TEXTBOOK");
    expect(result.confidence).toBe(0.8);
    expect(result.reasoning).toBe("test");
  });

  it("falls back to TEXTBOOK on AI error", async () => {
    mocks.getConfiguredMeteredAICompletion.mockRejectedValueOnce(new Error("API timeout"));

    const result = await classify("Some text", "broken.pdf", makeConfig());

    expect(result).toEqual({
      documentType: "TEXTBOOK",
      confidence: 0.0,
      reasoning: "Classification failed: API timeout",
    });

    // logAssistantCall should NOT have been called since the error happened before it
    expect(mocks.logAssistantCall).not.toHaveBeenCalled();
  });

  it("clamps confidence to 0-1", async () => {
    mockAIReturn({
      documentType: "TEXTBOOK",
      confidence: 1.5,
      reasoning: "very confident",
    });

    const result = await classify("Some text", "textbook.pdf", makeConfig());

    expect(result.confidence).toBe(1.0);
  });

  it("uses default confidence when not a number", async () => {
    mockAIReturn({
      documentType: "ASSESSMENT",
      confidence: "high" as any,
      reasoning: "has exam questions",
    });

    const result = await classify("Some text", "exam.pdf", makeConfig());

    expect(result.confidence).toBe(0.5);
    expect(result.documentType).toBe("ASSESSMENT");
  });

  it("respects sampleSize config", async () => {
    const longText = "A".repeat(5000);
    const sampleSize = 100;

    mockAIReturn({
      documentType: "TEXTBOOK",
      confidence: 0.7,
      reasoning: "short sample",
    });

    await classify(longText, "long.pdf", makeConfig({ sampleSize }));

    // The user prompt passed to the AI should contain only sampleSize characters of the text
    const callArgs = mocks.getConfiguredMeteredAICompletion.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage).toBeDefined();

    // The sample in the prompt should be exactly sampleSize characters
    const sampleInPrompt = userMessage.content.split("--- TEXT SAMPLE ---\n")[1].split("\n--- END SAMPLE ---")[0];
    expect(sampleInPrompt.length).toBe(sampleSize);
  });

  it("provides default reasoning when missing", async () => {
    mockAIReturn({
      documentType: "REFERENCE",
      confidence: 0.6,
    });

    const result = await classify("Some text", "glossary.pdf", makeConfig());

    expect(result.reasoning).toBe("No reasoning provided");
    expect(result.documentType).toBe("REFERENCE");
  });
});
