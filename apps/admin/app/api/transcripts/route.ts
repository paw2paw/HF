import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { resolveDataNodePath, getKbRoot } from "@/lib/data-paths";

const prisma = new PrismaClient();

// Multiple possible transcript locations
const TRANSCRIPT_PATHS = [
  process.env.HF_TRANSCRIPTS_PATH,
  "/Volumes/PAWSTAW/Projects/hf_kb/sources/transcripts",
].filter(Boolean) as string[];

/**
 * @api GET /api/transcripts
 * @visibility public
 * @scope transcripts:list
 * @auth none
 * @tags transcripts
 * @description React-Admin compatible endpoint for listing transcript files from configured sources directory. Supports JSON and TXT formats, pagination via Content-Range header, sorting, and search filtering.
 * @query sort string - JSON array [field, order] e.g. ["modifiedAt", "DESC"]
 * @query range string - JSON array [start, end] e.g. [0, 24]
 * @query filter string - JSON object e.g. {"q": "search term"}
 * @response 200 [{ id, filename, relativePath, path, sizeBytes, sizeMB, modifiedAt, callCount, date, type, status, fileHash, fileExt }]
 * @response 400 { error: "Path is not a directory: ..." }
 * @response 500 { error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { searchParams } = request.url ? new URL(request.url) : { searchParams: new URLSearchParams() };

    // Parse React-Admin query params
    const sortParam = searchParams.get("sort");
    const rangeParam = searchParams.get("range");
    const filterParam = searchParams.get("filter");

    const sort = sortParam ? JSON.parse(sortParam) : ["modifiedAt", "DESC"];
    const range = rangeParam ? JSON.parse(rangeParam) : [0, 49];
    const filter = filterParam ? JSON.parse(filterParam) : {};

    const [sortField, sortOrder] = sort;
    const [start, end] = range;

    // Use unified data-paths system first, then fallback to configured paths
    let transcriptsDir = resolveDataNodePath("data:transcripts") || path.join(getKbRoot(), "sources/transcripts");

    // Check if primary directory exists, if not try alternatives
    let stat;
    try {
      stat = await fs.stat(transcriptsDir);
    } catch {
      // Try alternative paths
      for (const altPath of TRANSCRIPT_PATHS) {
        try {
          stat = await fs.stat(altPath);
          transcriptsDir = altPath;
          break;
        } catch {
          // Continue to next path
        }
      }
    }

    if (!stat) {
      // Return empty list instead of error - allows UI to show import button
      const response = NextResponse.json([]);
      response.headers.set('Content-Range', 'transcripts 0-0/0');
      response.headers.set('Access-Control-Expose-Headers', 'Content-Range');
      response.headers.set('X-Transcripts-Path', transcriptsDir);
      response.headers.set('X-Transcripts-Status', 'no-directory');
      return response;
    }

    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: `Path is not a directory: ${transcriptsDir}` },
        { status: 400 }
      );
    }

    // Recursively find all transcript files (JSON and TXT) in directory and subdirectories
    async function findTranscriptFiles(dir: string, baseDir: string): Promise<{ filename: string; filePath: string; relativePath: string; fileExt: string }[]> {
      const results: { filename: string; filePath: string; relativePath: string; fileExt: string }[] = [];

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            // Recurse into subdirectories
            const subResults = await findTranscriptFiles(fullPath, baseDir);
            results.push(...subResults);
          } else if (entry.isFile()) {
            const lowerName = entry.name.toLowerCase();
            if (lowerName.endsWith(".json") || lowerName.endsWith(".txt")) {
              const relativePath = path.relative(baseDir, fullPath);
              results.push({
                filename: entry.name,
                filePath: fullPath,
                relativePath,
                fileExt: lowerName.endsWith(".json") ? "json" : "txt",
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error reading directory ${dir}:`, e);
      }
      return results;
    }

    const transcriptFiles = await findTranscriptFiles(transcriptsDir, transcriptsDir);

    // Get file stats for each file
    const fileDetails = await Promise.all(
      transcriptFiles.map(async ({ filename, filePath, relativePath, fileExt }) => {
        const stats = await fs.stat(filePath);

        // Try to read basic info from the file
        let callCount = 0;
        let dateInfo = null;
        let fileType = "Unknown";
        let status = "Unprocessed";
        let fileHash = "";

        try {
          const content = await fs.readFile(filePath, "utf8");

          // Calculate file hash
          fileHash = crypto.createHash("sha256").update(content).digest("hex");

          if (fileExt === "json") {
            const json = JSON.parse(content);

            // Count calls and detect type
            if (Array.isArray(json)) {
              callCount = json.length;
              fileType = callCount > 1 ? "Batch" : "Single";
            } else if (json.calls && Array.isArray(json.calls)) {
              callCount = json.calls.length;
              fileType = "Batch";
            } else {
              fileType = "Single";
              callCount = 1;
            }
          } else {
            // TXT file - single call
            fileType = "Text";
            callCount = 1;
          }

          // Check if file has been processed
          try {
            const processedFile = await prisma.processedFile.findUnique({
              where: { fileHash },
              select: { status: true }
            });

            if (processedFile) {
              status = processedFile.status;
            }
          } catch {
            // ProcessedFile table may not exist yet
          }

          // Extract date from filename (e.g., "2025-12-24")
          const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            dateInfo = dateMatch[1];
          }
        } catch (e) {
          console.error(`Error reading ${filename}:`, e);
        }

        return {
          id: relativePath, // Use relative path as unique ID for files in subdirs
          filename,
          relativePath,
          path: filePath,
          sizeBytes: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          modifiedAt: stats.mtime.toISOString(),
          modifiedAtMs: stats.mtime.getTime(),
          callCount,
          date: dateInfo,
          type: fileType,
          status,
          fileHash,
          fileExt
        };
      })
    );

    // Apply sorting
    fileDetails.sort((a: any, b: any) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      let comparison = 0;
      if (aVal == null && bVal == null) comparison = 0;
      else if (aVal == null) comparison = 1;
      else if (bVal == null) comparison = -1;
      else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortOrder.toUpperCase() === 'DESC' ? -comparison : comparison;
    });

    // Apply filtering (simple search across filename)
    let filtered = fileDetails;
    if (filter.q) {
      const searchTerm = filter.q.toLowerCase();
      filtered = fileDetails.filter(file =>
        file.filename.toLowerCase().includes(searchTerm)
      );
    }

    const total = filtered.length;
    const paginatedData = filtered.slice(start, Math.min(end + 1, total));

    // React-Admin expects Content-Range header for pagination
    const response = NextResponse.json(paginatedData);
    response.headers.set('Content-Range', `transcripts ${start}-${Math.min(end, total - 1)}/${total}`);
    response.headers.set('Access-Control-Expose-Headers', 'Content-Range');
    response.headers.set('X-Transcripts-Path', transcriptsDir);

    return response;
  } catch (error: any) {
    console.error("GET /api/transcripts error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list transcripts" },
      { status: 500 }
    );
  }
}
