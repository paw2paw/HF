/**
 * Storage Factory
 *
 * Returns the configured storage adapter based on STORAGE_BACKEND env var.
 * Default: "gcs" (production). Fallback: "local" (dev/test).
 */

import { config } from "@/lib/config";
import type { StorageAdapter } from "./adapter";

let cachedAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (cachedAdapter) return cachedAdapter;

  const backend = config.storage.backend;

  switch (backend) {
    case "local": {
      const { LocalStorageAdapter } = require("./local");
      cachedAdapter = new LocalStorageAdapter();
      break;
    }
    case "gcs":
    default: {
      const { GCSStorageAdapter } = require("./gcs");
      cachedAdapter = new GCSStorageAdapter();
      break;
    }
  }

  return cachedAdapter!;
}

export type { StorageAdapter, UploadOptions, UploadResult } from "./adapter";
export { computeContentHash, isAllowedMimeType, isAllowedFileSize } from "./utils";
