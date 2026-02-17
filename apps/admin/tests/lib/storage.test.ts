import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeContentHash, isAllowedMimeType, isAllowedFileSize } from "@/lib/storage/utils";
import { storageKeyFromHash, extensionFromMime } from "@/lib/storage/utils";

vi.mock("@/lib/config", () => ({
  config: {
    storage: {
      backend: "local",
      gcsBucket: "test-bucket",
      localPath: "/tmp/test-media",
      maxFileSize: 20971520,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
      ],
    },
  },
}));

describe("storage utils", () => {
  describe("computeContentHash", () => {
    it("returns consistent SHA-256 hash for same content", () => {
      const buf = Buffer.from("hello world");
      const hash1 = computeContentHash(buf);
      const hash2 = computeContentHash(buf);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it("returns different hash for different content", () => {
      const hash1 = computeContentHash(Buffer.from("hello"));
      const hash2 = computeContentHash(Buffer.from("world"));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("isAllowedMimeType", () => {
    it("allows configured MIME types", () => {
      expect(isAllowedMimeType("image/jpeg")).toBe(true);
      expect(isAllowedMimeType("image/png")).toBe(true);
      expect(isAllowedMimeType("application/pdf")).toBe(true);
      expect(isAllowedMimeType("audio/mpeg")).toBe(true);
    });

    it("rejects unconfigured MIME types", () => {
      expect(isAllowedMimeType("application/x-msdownload")).toBe(false);
      expect(isAllowedMimeType("text/html")).toBe(false);
      expect(isAllowedMimeType("application/zip")).toBe(false);
    });
  });

  describe("isAllowedFileSize", () => {
    it("allows files under max size", () => {
      expect(isAllowedFileSize(1024)).toBe(true);
      expect(isAllowedFileSize(20971520)).toBe(true); // exactly max
    });

    it("rejects files over max size", () => {
      expect(isAllowedFileSize(20971521)).toBe(false);
      expect(isAllowedFileSize(100000000)).toBe(false);
    });
  });

  describe("extensionFromMime", () => {
    it("maps common MIME types to extensions", () => {
      expect(extensionFromMime("image/jpeg")).toBe("jpg");
      expect(extensionFromMime("image/png")).toBe("png");
      expect(extensionFromMime("application/pdf")).toBe("pdf");
      expect(extensionFromMime("audio/mpeg")).toBe("mp3");
    });

    it("falls back to bin for unknown types", () => {
      expect(extensionFromMime("application/octet-stream")).toBe("bin");
    });
  });

  describe("storageKeyFromHash", () => {
    it("generates content-addressed path", () => {
      const path = storageKeyFromHash("abcdef1234567890", "image/jpeg");
      expect(path).toBe("media/ab/abcdef1234567890.jpg");
    });

    it("handles PDF extension", () => {
      const path = storageKeyFromHash("hash123", "application/pdf");
      expect(path).toBe("media/ha/hash123.pdf");
    });

    it("handles audio extension", () => {
      const path = storageKeyFromHash("hash456", "audio/mpeg");
      expect(path).toBe("media/ha/hash456.mp3");
    });

    it("falls back to bin for unknown types", () => {
      const path = storageKeyFromHash("hash789", "application/octet-stream");
      expect(path).toBe("media/ha/hash789.bin");
    });
  });
});
