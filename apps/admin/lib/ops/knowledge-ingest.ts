/**
 * knowledge-ingest.ts
 *
 * Ingests knowledge documents (PDFs, markdown, text) from sources directory.
 * Similar to transcript processor: hash-based deduplication, chunking, resumable tracking.
 *
 * Flow:
 * 1. Scan ~/hf_kb/sources/knowledge for documents
 * 2. Extract text from PDFs, read markdown/text files
 * 3. Hash content for deduplication
 * 4. Check status (skip COMPLETED, resume IN_PROGRESS, reprocess if --force)
 * 5. Create/update KnowledgeDoc records with status tracking
 * 6. Chunk documents with overlap for retrieval
 * 7. Create KnowledgeChunk records
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// pdf-parse v2 uses class-based API - need createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const prisma = new PrismaClient();

export interface KnowledgeIngestOptions {
  verbose?: boolean;
  quiet?: boolean; // Minimal output for background runs
  plan?: boolean;
  sourcePath?: string; // Specific file or directory
  maxDocuments?: number; // Limit for testing
  maxCharsPerChunk?: number;
  overlapChars?: number;
  forceReprocess?: boolean; // Reprocess even if hash exists
  resumePartial?: boolean; // Resume IN_PROGRESS documents
  skipPdfs?: boolean; // Skip PDF files (for testing with just markdown)
  maxPdfSizeMB?: number; // Skip PDFs larger than this (default 100MB)
  onProgress?: (progress: IngestProgress) => void; // Callback for progress updates
}

export interface IngestProgress {
  phase: "scanning" | "processing" | "complete";
  currentFile?: string;
  currentFileIndex?: number;
  totalFiles?: number;
  docsProcessed: number;
  chunksCreated: number;
  errors: number;
}

export interface IngestResult {
  filesScanned: number;
  filesProcessed: number;
  filesSkipped: number;
  filesResumed: number;
  docsCreated: number;
  docsUpdated: number;
  chunksCreated: number;
  errors: string[];
}

export async function ingestKnowledge(
  options: KnowledgeIngestOptions = {}
): Promise<IngestResult> {
  const {
    verbose = false,
    quiet = false,
    plan = false,
    sourcePath,
    maxDocuments = 0,
    maxCharsPerChunk = 1500,
    overlapChars = 200,
    forceReprocess = false,
    resumePartial = true,
    skipPdfs = false,
    maxPdfSizeMB = 100,
    onProgress,
  } = options;

  // Helper for conditional logging (respects quiet mode)
  const log = (msg: string) => {
    if (!quiet) console.log(msg);
  };
  const logVerbose = (msg: string) => {
    if (verbose && !quiet) console.log(msg);
  };

  // Helper to emit progress
  const emitProgress = (progress: Partial<IngestProgress>) => {
    if (onProgress) {
      onProgress({
        phase: "processing",
        docsProcessed: result.filesProcessed,
        chunksCreated: result.chunksCreated,
        errors: result.errors.length,
        ...progress,
      });
    }
  };

  const result: IngestResult = {
    filesScanned: 0,
    filesProcessed: 0,
    filesSkipped: 0,
    filesResumed: 0,
    docsCreated: 0,
    docsUpdated: 0,
    chunksCreated: 0,
    errors: [],
  };

  if (plan) {
    console.log("\n📋 KNOWLEDGE INGESTION PLAN\n");
    console.log("Steps:");
    console.log("1. Scan knowledge sources directory for documents");
    const rootPath = sourcePath || path.join(process.env.HF_KB_PATH || "", "sources/knowledge");
    console.log("   - Source:", rootPath);
    if (maxDocuments > 0) {
      console.log("   - LIMIT: Process max", maxDocuments, "documents");
    }
    console.log("2. For each document:");
    console.log("   - Extract text (PDF, markdown, txt)");
    if (skipPdfs) {
      console.log("   - SKIP PDFs: --skip-pdfs enabled");
    } else {
      console.log("   - PDF max size:", maxPdfSizeMB, "MB (larger files skipped)");
    }
    console.log("   - Calculate content hash (SHA256)");
    console.log("   - Check ingestion status:");
    console.log("     * COMPLETED → skip");
    console.log("     * IN_PROGRESS →", resumePartial ? "resume chunking" : "skip");
    console.log("     * FAILED →", forceReprocess ? "delete and restart" : "skip");
    console.log("     * Not exists → create new");
    if (forceReprocess) {
      console.log("   - FORCE MODE: Delete existing and reprocess all");
    }
    console.log("   - Create/update KnowledgeDoc with status=IN_PROGRESS");
    console.log("   - Chunk document (", maxCharsPerChunk, "chars,", overlapChars, "overlap)");
    console.log("   - Create KnowledgeChunk records");
    console.log("   - Update status=COMPLETED");
    console.log("\nEffects:");
    console.log("- Reads: HF_KB_PATH/sources/knowledge");
    console.log("- Writes: KnowledgeDoc, KnowledgeChunk");
    console.log("\nRun without --plan to execute.\n");
    return result;
  }

  try {
    // Step 1: Scan for files
    const rootPath = sourcePath || path.join(process.env.HF_KB_PATH || "", "sources/knowledge");

    logVerbose(`\n🔍 Scanning knowledge sources: ${rootPath}`);
    emitProgress({ phase: "scanning" });

    // Pass maxDocuments to scan to stop early (optimization for large directories)
    const files = await scanDirectory(rootPath, maxDocuments, !skipPdfs);
    result.filesScanned = files.length;

    logVerbose(`✅ Found ${files.length} document(s)`);
    if (maxDocuments > 0) {
      logVerbose(`⚠️  LIMIT: Processing max ${maxDocuments} documents`);
    }

    if (files.length === 0) {
      log(`⚠️  No documents found in ${rootPath}`);
      emitProgress({ phase: "complete", totalFiles: 0 });
      return result;
    }

    // Step 2: Process each file (up to maxDocuments)
    let processedCount = 0;
    let fileIndex = 0;

    for (const filePath of files) {
      fileIndex++;

      // Check limit
      if (maxDocuments > 0 && processedCount >= maxDocuments) {
        logVerbose(`\n⏹️  Reached limit of ${maxDocuments} documents, stopping`);
        break;
      }

      try {
        const relativePath = filePath.replace(rootPath, "").replace(/^\//, "");

        // Emit progress for each file
        emitProgress({
          phase: "processing",
          currentFile: relativePath,
          currentFileIndex: fileIndex,
          totalFiles: files.length,
        });

        logVerbose(`\n📄 Processing: ${relativePath}`);

        // Extract text from document
        const text = await extractText(filePath, verbose && !quiet, maxPdfSizeMB);

        if (!text || text.length < 100) {
          logVerbose(`   ⏭️  Skipping (too short or empty)`);
          result.filesSkipped++;
          continue;
        }

        // Calculate content hash
        const contentHash = crypto.createHash("sha256").update(text).digest("hex");

        // Check if already processed (by hash)
        const existing = await prisma.knowledgeDoc.findFirst({
          where: { contentSha: contentHash },
          include: { chunks: { orderBy: { chunkIndex: "desc" }, take: 1 } },
        });

        let doc: any = null;
        let startChunkIndex = 0;

        if (existing) {
          // Document hash exists - check status
          logVerbose(`   🔍 Found existing doc (status: ${existing.status})`);

          if (existing.status === "COMPLETED" && !forceReprocess) {
            logVerbose(`   ⏭️  Skipping (already completed)`);
            result.filesSkipped++;
            continue;
          }

          if (existing.status === "IN_PROGRESS" && resumePartial) {
            // Resume from last chunk
            const lastChunk = existing.chunks[0];
            startChunkIndex = lastChunk ? lastChunk.chunkIndex + 1 : 0;

            logVerbose(`   ▶️  Resuming from chunk ${startChunkIndex}`);

            doc = existing;
            result.filesResumed++;
          } else if (existing.status === "FAILED" && forceReprocess) {
            // Delete failed doc and restart
            logVerbose(`   🗑️  Deleting failed doc, restarting`);

            await prisma.knowledgeChunk.deleteMany({ where: { docId: existing.id } });
            await prisma.knowledgeDoc.delete({ where: { id: existing.id } });

            doc = null; // Will create new below
          } else if (forceReprocess) {
            // Force mode: delete and restart
            logVerbose(`   🗑️  Force mode: deleting existing doc`);

            await prisma.knowledgeChunk.deleteMany({ where: { docId: existing.id } });
            await prisma.knowledgeDoc.delete({ where: { id: existing.id } });

            doc = null; // Will create new below
          } else {
            // Skip (status = IN_PROGRESS but resumePartial=false, or status = FAILED)
            logVerbose(`   ⏭️  Skipping (status=${existing.status}, not resuming)`);
            result.filesSkipped++;
            continue;
          }
        }

        // Create new doc if needed
        if (!doc) {
          const filename = path.basename(filePath);
          const title = extractTitle(text, filename);

          doc = await prisma.knowledgeDoc.create({
            data: {
              sourcePath: filePath,
              title,
              content: text,
              contentSha: contentHash,
              status: "IN_PROGRESS",
              meta: {
                filename,
                size: text.length,
                extension: path.extname(filePath),
              },
            },
          });

          result.docsCreated++;

          logVerbose(`   ✅ Created KnowledgeDoc (${doc.id})`);
          logVerbose(`      Title: ${title}`);
          logVerbose(`      Size: ${text.length} chars`);
        }

        processedCount++;
        result.filesProcessed++;

        // Step 3: Chunk document
        const allChunks = chunkText(text, maxCharsPerChunk, overlapChars);
        const chunksToCreate = allChunks.slice(startChunkIndex); // Skip already created chunks

        doc.chunksExpected = allChunks.length;

        if (startChunkIndex > 0) {
          logVerbose(`   📦 Chunking: ${chunksToCreate.length} new chunks (${startChunkIndex} already exist)`);
        } else {
          logVerbose(`   📦 Chunking: ${chunksToCreate.length} chunks`);
        }

        for (let i = 0; i < chunksToCreate.length; i++) {
          const chunk = chunksToCreate[i];
          const actualIndex = startChunkIndex + i;

          await prisma.knowledgeChunk.create({
            data: {
              docId: doc.id,
              chunkIndex: actualIndex,
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              content: chunk.text,
              tokens: estimateTokens(chunk.text),
            },
          });

          result.chunksCreated++;
        }

        // Step 4: Mark as completed
        await prisma.knowledgeDoc.update({
          where: { id: doc.id },
          data: {
            status: "COMPLETED",
            ingestedAt: new Date(),
            chunksExpected: allChunks.length,
            chunksCreated: allChunks.length,
          },
        });

        result.docsUpdated++;

        logVerbose(`   ✅ Completed (${allChunks.length} total chunks)`);

        // Emit progress after each completed doc
        emitProgress({
          phase: "processing",
          currentFile: relativePath,
          currentFileIndex: fileIndex,
          totalFiles: files.length,
        });
      } catch (error) {
        const errorMsg = `Error processing ${filePath}: ${error}`;
        if (!quiet) console.error(`   ❌ ${errorMsg}`);
        result.errors.push(errorMsg);

        // Mark doc as FAILED if it exists
        try {
          const contentHash = crypto.createHash("sha256").update(await extractText(filePath, false, maxPdfSizeMB)).digest("hex");
          await prisma.knowledgeDoc.updateMany({
            where: { contentSha: contentHash },
            data: { status: "FAILED", errorMessage: String(error) },
          });
        } catch {
          // Ignore error during error handling
        }
      }
    }

    // Emit final progress
    emitProgress({ phase: "complete", totalFiles: files.length });

    // Summary (only if not quiet)
    log("\n✅ KNOWLEDGE INGESTION COMPLETE\n");
    log(`Files scanned: ${result.filesScanned}`);
    log(`Files processed: ${result.filesProcessed}`);
    log(`Files resumed: ${result.filesResumed}`);
    log(`Files skipped: ${result.filesSkipped}`);
    log(`Docs created: ${result.docsCreated}`);
    log(`Docs updated: ${result.docsUpdated}`);
    log(`Chunks created: ${result.chunksCreated}`);
    if (result.errors.length > 0) {
      log(`\n⚠️  Errors: ${result.errors.length}`);
      result.errors.slice(0, 5).forEach((err) => log(`   - ${err}`));
      if (result.errors.length > 5) {
        log(`   ... and ${result.errors.length - 5} more`);
      }
    }

    return result;
  } catch (error) {
    if (!quiet) console.error("❌ Fatal error during knowledge ingestion:", error);
    result.errors.push(String(error));
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Recursively scan directory for supported document files
 */
async function scanDirectory(dir: string, maxFiles: number = 0, includePdfs: boolean = true): Promise<string[]> {
  const files: string[] = [];
  const supportedExtensions = [".md", ".txt", ".markdown"];
  if (includePdfs) {
    supportedExtensions.push(".pdf");
  }
  let stopped = false;

  async function scan(currentDir: string) {
    if (stopped) return;
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (stopped) return;
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (supportedExtensions.includes(ext)) {
            files.push(fullPath);
            // Stop early if we've found enough files
            if (maxFiles > 0 && files.length >= maxFiles) {
              stopped = true;
              return;
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await scan(dir);
  return files;
}

/**
 * Extract text from various file formats
 */
async function extractText(
  filePath: string,
  verbose: boolean,
  maxPdfSizeMB: number = 100
): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    // Check file size before loading
    const stats = fsSync.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB > maxPdfSizeMB) {
      if (verbose) {
        console.log(`   ⏭️  PDF too large (${sizeMB.toFixed(1)}MB > ${maxPdfSizeMB}MB limit)`);
      }
      return "";
    }

    if (verbose) {
      console.log(`   📄 Extracting PDF (${sizeMB.toFixed(1)}MB)...`);
    }

    try {
      // pdf-parse v2 uses class-based API
      const dataBuffer = fsSync.readFileSync(filePath);
      const parser = new PDFParse({ data: new Uint8Array(dataBuffer) });
      const result = await parser.getText();
      await parser.destroy();

      if (verbose) {
        console.log(`   ✅ Extracted ${result.pages.length} pages, ${result.text.length} chars`);
      }

      return result.text;
    } catch (error) {
      if (verbose) {
        console.log(`   ❌ PDF extraction failed: ${error}`);
      }
      return "";
    }
  } else if (ext === ".md" || ext === ".markdown" || ext === ".txt") {
    return await fs.readFile(filePath, "utf-8");
  }

  return "";
}

/**
 * Extract title from text or filename
 */
function extractTitle(text: string, filename: string): string {
  // Try to find first heading or use first line
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Remove markdown heading markers
    const title = firstLine.replace(/^#+\s*/, "").substring(0, 100);
    if (title.length > 0) {
      return title;
    }
  }

  // Fall back to filename without extension
  return path.basename(filename, path.extname(filename));
}

/**
 * Chunk text with overlap for better retrieval
 */
function chunkText(
  text: string,
  maxCharsPerChunk: number,
  overlapChars: number
): Array<{ text: string; startChar: number; endChar: number }> {
  const chunks: Array<{ text: string; startChar: number; endChar: number }> = [];

  let startChar = 0;

  while (startChar < text.length) {
    const endChar = Math.min(startChar + maxCharsPerChunk, text.length);
    const chunkText = text.substring(startChar, endChar);

    chunks.push({
      text: chunkText,
      startChar,
      endChar,
    });

    // Move forward by (chunkSize - overlap) to create overlap
    const nextStart = endChar - overlapChars;

    // Prevent infinite loop: ensure we always make progress
    // If we're at the end of the text, break out
    if (endChar >= text.length) {
      break;
    }

    // Ensure we make forward progress (at least 1 character)
    startChar = Math.max(nextStart, startChar + 1);
  }

  return chunks;
}

/**
 * Rough estimate of token count (1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: KnowledgeIngestOptions = {
    verbose: args.includes("--verbose") || args.includes("-v"),
    quiet: args.includes("--quiet") || args.includes("-q"),
    plan: args.includes("--plan"),
    sourcePath: args.find((a) => a.startsWith("--path="))?.split("=")[1],
    maxDocuments: parseInt(args.find((a) => a.startsWith("--max-documents="))?.split("=")[1] || "0"),
    maxCharsPerChunk: parseInt(args.find((a) => a.startsWith("--chunk-size="))?.split("=")[1] || "1500"),
    overlapChars: parseInt(args.find((a) => a.startsWith("--overlap="))?.split("=")[1] || "200"),
    forceReprocess: args.includes("--force"),
    resumePartial: !args.includes("--no-resume"),
    skipPdfs: args.includes("--skip-pdfs"),
    maxPdfSizeMB: parseInt(args.find((a) => a.startsWith("--max-pdf-size="))?.split("=")[1] || "100"),
  };

  ingestKnowledge(options)
    .then((result) => {
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}
