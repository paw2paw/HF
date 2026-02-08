import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";

function expandTilde(p: string): string {
  const t = (p || "").trim();
  if (!t) return "";
  if (t === "~") return os.homedir();
  if (t.startsWith("~/") || t.startsWith("~\\")) {
    return path.join(os.homedir(), t.slice(2));
  }
  return t;
}

function getKbRoot(): string {
  const envRaw = process.env.HF_KB_PATH || "";
  const env = expandTilde(envRaw);
  if (env && env.trim()) return path.resolve(env.trim());
  return path.resolve(path.join(os.homedir(), "hf_kb"));
}

/**
 * GET /api/transcripts/raw-files
 * Lists raw transcript files from the sources/transcripts/raw directory
 * Supports both .json (VAPI exports) and .txt (session transcripts) formats
 */
export async function GET() {
  try {
    const kbRoot = getKbRoot();
    const transcriptsDir = path.join(kbRoot, "sources", "transcripts", "raw");

    // Check if directory exists
    try {
      await fs.access(transcriptsDir);
    } catch {
      // Directory doesn't exist, return empty
      return NextResponse.json({
        ok: true,
        files: [],
        directory: transcriptsDir,
        kbRoot,
        message: "Transcripts directory does not exist",
      });
    }

    // Recursively find all JSON and TXT files
    type RawFile = {
      name: string;
      path: string;
      relativePath: string;
      size: number;
      modifiedAt: string;
      format: "json" | "txt";
    };
    const files: RawFile[] = [];

    async function scanDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          await scanDir(fullPath);
        } else if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase();
          if (lowerName.endsWith(".json") || lowerName.endsWith(".txt")) {
            const stats = await fs.stat(fullPath);
            const relPath = path.relative(transcriptsDir, fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              relativePath: relPath,
              size: stats.size,
              modifiedAt: stats.mtime.toISOString(),
              format: lowerName.endsWith(".json") ? "json" : "txt",
            });
          }
        }
      }
    }

    await scanDir(transcriptsDir);

    // Sort by modified date (newest first)
    files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return NextResponse.json({
      ok: true,
      files,
      directory: transcriptsDir,
      kbRoot,
      count: files.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error listing raw transcript files:", message);
    return NextResponse.json(
      { ok: false, error: message, files: [] },
      { status: 500 }
    );
  }
}
