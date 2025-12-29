import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type ParameterSnapshot = {
  snapshotId: string;
  createdAt: string;
  sourcePath: string;
  sha256: string;
  rowCount: number;
};

function nowIso() {
  return new Date().toISOString();
}

function defaultKbRoot() {
  const env = process.env.HF_KB_PATH;
  if (env && env.trim()) return path.resolve(env.trim());
  return path.resolve(process.cwd(), "../../knowledge");
}

function parametersRoot(kbRoot: string) {
  return path.join(kbRoot, "parameters");
}

function rawCsvPath(kbRoot: string) {
  return path.join(parametersRoot(kbRoot), "raw", "parameters.csv");
}

function snapshotsRoot(kbRoot: string) {
  return path.join(parametersRoot(kbRoot), "snapshots");
}

async function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function parseCsvRowCount(raw: string): number {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return 0; // header only
  return Math.max(0, lines.length - 1);
}

/**
 * Import raw parameters.csv and create an immutable snapshot.
 * Snapshots are content-addressed (sha-based) and never overwritten.
 */
export async function importParametersSnapshot(opts?: {
  kbRoot?: string;
  force?: boolean;
}): Promise<ParameterSnapshot> {
  const kbRoot = path.resolve(opts?.kbRoot || defaultKbRoot());
  const src = rawCsvPath(kbRoot);

  const buf = await fs.readFile(src);
  const raw = buf.toString("utf8");
  const hash = await sha256(buf);

  const createdAt = nowIso();
  const snapshotId = `params_${createdAt.replace(/[:.]/g, "-")}_${hash.slice(0, 8)}`;

  const snapDir = path.join(snapshotsRoot(kbRoot), snapshotId);

  // If snapshot already exists (same hash), short-circuit unless forced
  try {
    await fs.access(snapDir);
    if (!opts?.force) {
      const manifest = JSON.parse(
        await fs.readFile(path.join(snapDir, "manifest.json"), "utf8")
      ) as ParameterSnapshot;
      return manifest;
    }
  } catch {
    // continue
  }

  await fs.mkdir(snapDir, { recursive: true });

  await fs.writeFile(path.join(snapDir, "parameters.csv"), raw, "utf8");

  const manifest: ParameterSnapshot = {
    snapshotId,
    createdAt,
    sourcePath: "parameters/raw/parameters.csv",
    sha256: hash,
    rowCount: parseCsvRowCount(raw),
  };

  await fs.writeFile(
    path.join(snapDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  return manifest;
}

/**
 * List all parameter snapshots (most recent first).
 */
export async function listParameterSnapshots(opts?: { kbRoot?: string }) {
  const kbRoot = path.resolve(opts?.kbRoot || defaultKbRoot());
  const root = snapshotsRoot(kbRoot);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }

  const manifests = await Promise.all(
    entries.map(async (dir) => {
      try {
        const raw = await fs.readFile(path.join(root, dir, "manifest.json"), "utf8");
        return JSON.parse(raw) as ParameterSnapshot;
      } catch {
        return null;
      }
    })
  );

  return manifests
    .filter(Boolean)
    .sort((a, b) => (a!.createdAt < b!.createdAt ? 1 : -1)) as ParameterSnapshot[];
}
