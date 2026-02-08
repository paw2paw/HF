import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { resolveKbPaths } from "./loader";

export type ParameterSnapshot = {
  snapshotId: string;
  createdAt: string;
  sourcePath: string;
  sha256: string;
  rowCount: number;
};

type ImportOpts = {
  kbRoot?: string;
  force?: boolean;
};

type ListOpts = {
  kbRoot?: string;
};

function norm(p: string) {
  return p.replace(/\\/g, "/");
}

function sha256Hex(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function isoForPath(d: Date) {
  // 2026-01-03T15-02-47-123Z (safe for folder names)
  return d.toISOString().replace(/:/g, "-").replace(/\./g, "-");
}

async function existsFile(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function existsDir(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function countRowsCsv(buf: Buffer) {
  const s = buf.toString("utf8");
  const lines = s.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return 0;
  // naive: header + rows
  return Math.max(0, lines.length - 1);
}

async function resolveParameterPaths(kbRoot?: string) {
  const resolved = await resolveKbPaths(kbRoot);

  // Your actual layout:
  // <kbRoot>/sources/parameters/raw/parameters.csv
  // <kbRoot>/sources/parameters/snapshots/<snapshotId>/*
  const parametersRawCsv = path.join(resolved.paths.sourcesDir, "parameters", "raw", "parameters.csv");
  const snapshotsDir = path.join(resolved.paths.sourcesDir, "parameters", "snapshots");

  return {
    root: resolved.root,
    sourcesDir: resolved.paths.sourcesDir,
    derivedDir: resolved.paths.derivedDir,
    parametersRawCsv,
    snapshotsDir,
  };
}

export async function importParametersSnapshot(opts: ImportOpts = {}): Promise<ParameterSnapshot> {
  const { parametersRawCsv, snapshotsDir } = await resolveParameterPaths(opts.kbRoot);

  if (!(await existsFile(parametersRawCsv))) {
    throw new Error(`parameters CSV not found: ${parametersRawCsv}`);
  }

  const csvBuf = await fs.readFile(parametersRawCsv);
  const sha256 = sha256Hex(csvBuf);
  const createdAt = new Date();
  const snapshotId = `params_${isoForPath(createdAt)}_${sha256.slice(0, 8)}`;

  const outDir = path.join(snapshotsDir, snapshotId);
  const outCsv = path.join(outDir, "parameters.csv");
  const outManifest = path.join(outDir, "manifest.json");

  if (await existsDir(outDir)) {
    if (!opts.force) {
      const rowCount = await countRowsCsv(csvBuf);
      return {
        snapshotId,
        createdAt: createdAt.toISOString(),
        sourcePath: norm(path.relative(path.dirname(parametersRawCsv), parametersRawCsv)),
        sha256,
        rowCount,
      };
    }
    await fs.rm(outDir, { recursive: true, force: true });
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outCsv, csvBuf);

  const rowCount = await countRowsCsv(csvBuf);

  const manifest: ParameterSnapshot & {
    schemaVersion: 1;
    inputCsvAbsPath: string;
    outputCsvAbsPath: string;
  } = {
    schemaVersion: 1,
    snapshotId,
    createdAt: createdAt.toISOString(),
    sourcePath: norm(path.relative(path.dirname(parametersRawCsv), parametersRawCsv)),
    sha256,
    rowCount,
    inputCsvAbsPath: parametersRawCsv,
    outputCsvAbsPath: outCsv,
  };

  await fs.writeFile(outManifest, JSON.stringify(manifest, null, 2), "utf8");

  return {
    snapshotId: manifest.snapshotId,
    createdAt: manifest.createdAt,
    sourcePath: manifest.sourcePath,
    sha256: manifest.sha256,
    rowCount: manifest.rowCount,
  };
}

export async function listParameterSnapshots(opts: ListOpts = {}): Promise<ParameterSnapshot[]> {
  const { snapshotsDir } = await resolveParameterPaths(opts.kbRoot);

  if (!(await existsDir(snapshotsDir))) return [];

  const entries = await fs.readdir(snapshotsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();

  const out: ParameterSnapshot[] = [];
  for (const d of dirs) {
    const manifestPath = path.join(snapshotsDir, d, "manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const j = JSON.parse(raw);
      if (j && typeof j.snapshotId === "string") {
        out.push({
          snapshotId: String(j.snapshotId),
          createdAt: typeof j.createdAt === "string" ? j.createdAt : "",
          sourcePath: typeof j.sourcePath === "string" ? j.sourcePath : "",
          sha256: typeof j.sha256 === "string" ? j.sha256 : "",
          rowCount: typeof j.rowCount === "number" ? j.rowCount : 0,
        });
      }
    } catch {
      // ignore malformed
    }
  }

  return out;
}

// Default export shape expected by Ops runner.
export default {
  importParametersSnapshot,
  listParameterSnapshots,
};