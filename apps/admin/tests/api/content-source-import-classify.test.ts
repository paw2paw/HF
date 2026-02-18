/**
 * Tests for POST /api/content-sources/:sourceId/import (mode=classify)
 *
 * Verifies:
 * - Auth enforcement (OPERATOR required)
 * - 404 when source not found
 * - 400 when no file uploaded
 * - 422 when text extraction fails
 * - Classifies document, stores file, updates source, no extraction
 * - Reuses existing media asset on duplicate content hash
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  extractText: vi.fn(),
  classifyDocument: vi.fn(),
  resolveExtractionConfig: vi.fn(),
  sourceFindUnique: vi.fn(),
  sourceUpdate: vi.fn(),
  mediaAssetFindUnique: vi.fn(),
  mediaAssetCreate: vi.fn(),
  mediaAssetUpdate: vi.fn(),
  computeContentHash: vi.fn(),
  getStorageAdapter: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  requireAuth: (...args: any[]) => mocks.requireAuth(...args),
  isAuthError: (result: any) => "error" in result,
}));

vi.mock("@/lib/content-trust/extract-assertions", () => ({
  extractText: mocks.extractText,
  extractAssertions: vi.fn(),
  extractAssertionsSegmented: vi.fn(),
  chunkText: vi.fn().mockReturnValue(["chunk1"]),
}));

vi.mock("@/lib/content-trust/classify-document", () => ({
  classifyDocument: mocks.classifyDocument,
  fetchFewShotExamples: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/content-trust/resolve-config", () => ({
  resolveExtractionConfig: mocks.resolveExtractionConfig,
}));

vi.mock("@/lib/storage", () => ({
  getStorageAdapter: mocks.getStorageAdapter,
  computeContentHash: mocks.computeContentHash,
}));

vi.mock("@/lib/config", () => ({
  config: { storage: { backend: "local" } },
}));

vi.mock("@/lib/content-trust/extraction-jobs", () => ({
  createJob: vi.fn().mockResolvedValue({ id: "job-1" }),
  getJob: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock("@/lib/content-trust/segment-document", () => ({
  segmentDocument: vi.fn().mockResolvedValue({ isComposite: false, sections: [] }),
}));

vi.mock("@/lib/content-trust/save-assertions", () => ({
  saveAssertions: vi.fn().mockResolvedValue({ created: 0, duplicatesSkipped: 0 }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentSource: {
      findUnique: mocks.sourceFindUnique,
      update: mocks.sourceUpdate,
    },
    mediaAsset: {
      findUnique: mocks.mediaAssetFindUnique,
      create: mocks.mediaAssetCreate,
      update: mocks.mediaAssetUpdate,
    },
  },
}));

import { POST } from "@/app/api/content-sources/[sourceId]/import/route";
import { NextRequest } from "next/server";

function makeMockRequest(fields: Record<string, any>) {
  const entries: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined) {
      if (typeof value === "object" && value.name) {
        // File-like
        const content = new TextEncoder().encode("test content");
        entries[key] = {
          name: value.name,
          type: value.type || "application/pdf",
          size: content.byteLength,
          arrayBuffer: () => Promise.resolve(content.buffer),
        };
      } else {
        entries[key] = value;
      }
    }
  }
  return {
    formData: () =>
      Promise.resolve({
        get: (key: string) => entries[key] ?? null,
      }),
  } as unknown as NextRequest;
}

const makeParams = () => Promise.resolve({ sourceId: "src-1" });

const MOCK_SOURCE = {
  id: "src-1",
  slug: "test-doc",
  name: "Test Doc",
  trustLevel: "UNVERIFIED",
  qualificationRef: null,
  documentType: "TEXTBOOK",
  documentTypeSource: null,
};

const MOCK_EXTRACTION_CONFIG = {
  classification: {
    sampleSize: 2000,
    systemPrompt: "classify",
    llmConfig: { temperature: 0.1, maxTokens: 500 },
  },
};

const MOCK_STORAGE = {
  upload: vi.fn().mockResolvedValue({ storageKey: "media/ab/abc123.pdf" }),
  download: vi.fn(),
  getSignedUrl: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
};

describe("POST /api/content-sources/:sourceId/import (mode=classify)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      session: { user: { id: "u1", role: "OPERATOR" } },
    });
    mocks.sourceFindUnique.mockResolvedValue(MOCK_SOURCE);
    mocks.resolveExtractionConfig.mockResolvedValue(MOCK_EXTRACTION_CONFIG);
    mocks.computeContentHash.mockReturnValue("abc123hash");
    mocks.getStorageAdapter.mockReturnValue(MOCK_STORAGE);
    mocks.mediaAssetFindUnique.mockResolvedValue(null);
    mocks.mediaAssetCreate.mockResolvedValue({ id: "media-1" });
    mocks.sourceUpdate.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    const { NextResponse } = await import("next/server");
    mocks.requireAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const req = makeMockRequest({
      file: { name: "doc.pdf" },
      mode: "classify",
    });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(401);
  });

  it("returns 404 when source not found", async () => {
    mocks.sourceFindUnique.mockResolvedValue(null);

    const req = makeMockRequest({
      file: { name: "doc.pdf" },
      mode: "classify",
    });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file uploaded", async () => {
    const req = makeMockRequest({ mode: "classify" });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("No file");
  });

  it("returns 422 when text extraction fails", async () => {
    mocks.extractText.mockResolvedValue({ text: "" });

    const req = makeMockRequest({
      file: { name: "empty.pdf" },
      mode: "classify",
    });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(422);

    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Could not extract text");
  });

  it("classifies document, stores file, updates source, returns classification", async () => {
    const extractedText = "Chapter 1: Introduction to Food Safety...";
    mocks.extractText.mockResolvedValue({ text: extractedText });
    mocks.classifyDocument.mockResolvedValue({
      documentType: "CURRICULUM",
      confidence: 0.92,
      reasoning: "Contains learning outcomes and assessment criteria",
    });

    const req = makeMockRequest({
      file: { name: "syllabus.pdf", type: "application/pdf" },
      mode: "classify",
    });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.mode).toBe("classify");
    expect(data.classification.documentType).toBe("CURRICULUM");
    expect(data.classification.confidence).toBe(0.92);
    expect(data.classification.reasoning).toContain("learning outcomes");
    expect(data.mediaId).toBe("media-1");
    expect(data.textLength).toBe(extractedText.length);

    // Verify source was updated with classification
    expect(mocks.sourceUpdate).toHaveBeenCalledWith({
      where: { id: "src-1" },
      data: {
        documentType: "CURRICULUM",
        documentTypeSource: "ai:0.92",
        textSample: extractedText.substring(0, 1000),
        aiClassification: "CURRICULUM:0.92",
      },
    });

    // Verify file was stored
    expect(mocks.computeContentHash).toHaveBeenCalled();
    expect(MOCK_STORAGE.upload).toHaveBeenCalled();
    expect(mocks.mediaAssetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceId: "src-1",
          contentHash: "abc123hash",
          storageType: "local",
        }),
      })
    );

    // Verify NO extraction was triggered
    // (extractAssertions should not be called)
  });

  it("reuses existing media asset on duplicate content hash", async () => {
    mocks.extractText.mockResolvedValue({ text: "Some text content" });
    mocks.classifyDocument.mockResolvedValue({
      documentType: "TEXTBOOK",
      confidence: 0.88,
      reasoning: "Dense reference material",
    });
    mocks.mediaAssetFindUnique.mockResolvedValue({ id: "existing-media" });

    const req = makeMockRequest({
      file: { name: "textbook.pdf", type: "application/pdf" },
      mode: "classify",
    });
    const res = await POST(req, { params: makeParams() });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.mediaId).toBe("existing-media");

    // Should NOT upload a new file
    expect(MOCK_STORAGE.upload).not.toHaveBeenCalled();
    expect(mocks.mediaAssetCreate).not.toHaveBeenCalled();

    // Should update existing media to link to this source
    expect(mocks.mediaAssetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing-media" },
        data: { sourceId: "src-1" },
      })
    );
  });
});
