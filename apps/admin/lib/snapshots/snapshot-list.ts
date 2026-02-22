/**
 * Snapshot List / Get / Delete
 *
 * Filesystem operations for managing snapshot JSON files.
 */

import fs from "node:fs";
import path from "node:path";
import {
  SNAPSHOTS_DIR,
  isValidSnapshotName,
  type SnapshotMetadata,
  type SnapshotInfo,
  type SnapshotFile,
} from "./snapshot-config";

/**
 * List all saved snapshots, sorted by creation date (newest first).
 */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => f.endsWith(".json"));
  const snapshots: SnapshotInfo[] = [];

  for (const file of files) {
    const filePath = path.join(SNAPSHOTS_DIR, file);
    try {
      const metadata = readSnapshotMetadata(filePath);
      if (!metadata) continue;

      const stat = fs.statSync(filePath);
      snapshots.push({
        name: metadata.name,
        filePath,
        fileSize: stat.size,
        metadata,
      });
    } catch {
      // Skip malformed snapshot files
    }
  }

  // Sort newest first
  snapshots.sort(
    (a, b) =>
      new Date(b.metadata.createdAt).getTime() -
      new Date(a.metadata.createdAt).getTime()
  );

  return snapshots;
}

/**
 * Get details for a specific snapshot by name.
 */
export async function getSnapshot(name: string): Promise<SnapshotInfo | null> {
  if (!isValidSnapshotName(name)) return null;

  const filePath = path.join(SNAPSHOTS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const metadata = readSnapshotMetadata(filePath);
    if (!metadata) return null;

    const stat = fs.statSync(filePath);
    return {
      name: metadata.name,
      filePath,
      fileSize: stat.size,
      metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a snapshot file.
 * Returns true if deleted, false if not found.
 */
export async function deleteSnapshot(name: string): Promise<boolean> {
  if (!isValidSnapshotName(name)) return false;

  const filePath = path.join(SNAPSHOTS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return false;

  fs.unlinkSync(filePath);
  return true;
}

/**
 * Load the full snapshot file (metadata + data).
 * Used by the restore function.
 */
export function loadSnapshotFile(name: string): SnapshotFile {
  if (!isValidSnapshotName(name)) {
    throw new Error(`Invalid snapshot name: "${name}"`);
  }

  const filePath = path.join(SNAPSHOTS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Snapshot "${name}" not found`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as SnapshotFile;

  if (!parsed.metadata || !parsed.data) {
    throw new Error(`Snapshot "${name}" has invalid format`);
  }

  if (parsed.metadata.version !== "1.0") {
    throw new Error(
      `Snapshot "${name}" has unsupported version: ${parsed.metadata.version}`
    );
  }

  return parsed;
}

// ─── Internal helpers ───────────────────────────────────────────────

/**
 * Read only the metadata from a snapshot file.
 * Parses the entire file but only returns metadata.
 * For large files, a streaming approach could be added later.
 */
function readSnapshotMetadata(filePath: string): SnapshotMetadata | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as SnapshotFile;
    return parsed.metadata || null;
  } catch {
    return null;
  }
}
