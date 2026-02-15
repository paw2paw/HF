/**
 * Storage utilities — hashing, MIME validation, path generation
 */

import { createHash } from "crypto";
import { config } from "@/lib/config";

/** Compute SHA-256 content hash of a buffer */
export function computeContentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Validate MIME type against the configured allowlist */
export function isAllowedMimeType(mimeType: string): boolean {
  return config.storage.allowedMimeTypes.includes(mimeType);
}

/** Validate file size against the configured maximum */
export function isAllowedFileSize(size: number): boolean {
  return size > 0 && size <= config.storage.maxFileSize;
}

/** Get file extension from MIME type */
export function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };
  return map[mimeType] || "bin";
}

/**
 * Generate a content-addressed storage key.
 * Format: media/{first-2-chars-of-hash}/{full-hash}.{ext}
 */
export function storageKeyFromHash(contentHash: string, mimeType: string): string {
  const ext = extensionFromMime(mimeType);
  const prefix = contentHash.slice(0, 2);
  return `media/${prefix}/${contentHash}.${ext}`;
}
