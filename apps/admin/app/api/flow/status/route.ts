import { NextResponse } from "next/server";
import { IngestionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";
import path from "node:path";
import type { FlowStatus, NodeStats, RagStatus } from "@/lib/flow/status-manifest";

export const runtime = "nodejs";

function resolveKbRoot(): string | null {
  const fromEnv = (process.env.HF_KB_PATH || "").trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return null;
}

/**
 * Count files and directories in a path
 */
function countFilesAndDirs(dirPath: string): { files: number; directories: number } {
  let files = 0;
  let directories = 0;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // Skip hidden files
      if (entry.isDirectory()) {
        directories++;
        // Recursively count in subdirectories
        const subCounts = countFilesAndDirs(path.join(dirPath, entry.name));
        files += subCounts.files;
        directories += subCounts.directories;
      } else if (entry.isFile()) {
        files++;
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return { files, directories };
}

/**
 * Compute Knowledge Base status
 */
async function getKnowledgeBaseStatus(kbRoot: string | null): Promise<NodeStats & { resolvedPath?: string }> {
  // Count filesystem stats
  let fsFiles = 0;
  let fsDirs = 0;

  // Try multiple possible paths for knowledge base
  // Priority: HF_KB_PATH/knowledge > HF_KB_PATH/sources/knowledge > fallback
  const possiblePaths = kbRoot
    ? [
        path.join(kbRoot, "knowledge"),           // Primary: direct path
        path.join(kbRoot, "sources", "knowledge"), // Legacy: architecture doc path
      ]
    : [
        path.resolve(process.cwd(), "../../knowledge/knowledge"), // Fallback
      ];

  let knowledgePath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      knowledgePath = p;
      break;
    }
  }

  if (knowledgePath) {
    const counts = countFilesAndDirs(knowledgePath);
    fsFiles = counts.files;
    fsDirs = counts.directories;
  }

  // Count DB stats
  const [docCount, chunkCount, vectorCount, pendingDocs, ingestedDocs] = await Promise.all([
    prisma.knowledgeDoc.count(),
    prisma.knowledgeChunk.count(),
    prisma.vectorEmbedding.count(),
    prisma.knowledgeDoc.count({ where: { status: IngestionStatus.PENDING } }),
    prisma.knowledgeDoc.count({ where: { status: IngestionStatus.COMPLETED } }),
  ]);

  // Get last updated
  const lastDoc = await prisma.knowledgeDoc.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  // Determine RAG status
  let status: RagStatus = "red";
  let statusLabel = "No documents";

  if (docCount === 0) {
    status = "red";
    statusLabel = "No documents";
  } else if (pendingDocs > 0 || chunkCount === 0) {
    status = "amber";
    statusLabel = `${pendingDocs} pending`;
  } else if (vectorCount < chunkCount) {
    status = "amber";
    statusLabel = `${chunkCount - vectorCount} unembedded`;
  } else {
    status = "green";
    statusLabel = "Ready";
  }

  const percentComplete =
    docCount > 0 ? Math.round((ingestedDocs / docCount) * 100) : 0;

  return {
    status,
    statusLabel,
    directories: fsDirs,
    files: fsFiles,
    processed: ingestedDocs,
    pending: pendingDocs,
    total: docCount,
    percentComplete,
    derived: [
      { label: "Docs", count: docCount, link: "/knowledge-docs" },
      { label: "Chunks", count: chunkCount, link: "/knowledge-docs" },
      { label: "Vectors", count: vectorCount, link: "/vectors" },
    ],
    lastUpdated: lastDoc?.updatedAt?.toISOString(),
    resolvedPath: knowledgePath || undefined,
  };
}

/**
 * Compute Transcripts status
 */
async function getTranscriptsStatus(kbRoot: string | null): Promise<NodeStats & { resolvedPath?: string }> {
  // Count filesystem stats
  let fsFiles = 0;
  let fsDirs = 0;

  // Try multiple possible paths for transcripts (consistent with /api/transcripts route)
  // Priority: HF_KB_PATH/transcripts/raw > HF_KB_PATH/sources/transcripts > fallback ../../knowledge/transcripts/raw
  const possiblePaths = kbRoot
    ? [
        path.join(kbRoot, "transcripts", "raw"),       // Primary: same as /api/transcripts
        path.join(kbRoot, "sources", "transcripts"),   // Legacy: architecture doc path
      ]
    : [
        path.resolve(process.cwd(), "../../knowledge/transcripts/raw"), // Fallback
      ];

  let transcriptsPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      transcriptsPath = p;
      break;
    }
  }

  if (transcriptsPath) {
    const counts = countFilesAndDirs(transcriptsPath);
    fsFiles = counts.files;
    fsDirs = counts.directories;
  }

  // Count DB stats
  const [fileCount, callCount, userCount, batchCount] = await Promise.all([
    prisma.processedFile.count(),
    prisma.call.count(),
    prisma.user.count(),
    prisma.transcriptBatch.count(),
  ]);

  // Get last updated
  const lastCall = await prisma.call.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  // Determine RAG status
  let status: RagStatus = "red";
  let statusLabel = "No transcripts";

  if (fsFiles === 0 && fileCount === 0) {
    status = "red";
    statusLabel = "No transcripts";
  } else if (fileCount === 0 && fsFiles > 0) {
    status = "amber";
    statusLabel = `${fsFiles} files to process`;
  } else if (callCount === 0) {
    status = "amber";
    statusLabel = "No calls extracted";
  } else {
    status = "green";
    statusLabel = "Ready";
  }

  return {
    status,
    statusLabel,
    directories: fsDirs,
    files: fsFiles,
    processed: fileCount,
    total: fsFiles,
    percentComplete: fsFiles > 0 ? Math.round((fileCount / fsFiles) * 100) : 0,
    derived: [
      { label: "Files Processed", count: fileCount, link: "/transcripts" },
      { label: "Calls", count: callCount, link: "/calls" },
      { label: "Users", count: userCount, link: "/people" },
      { label: "Batches", count: batchCount, link: "/transcript-batches" },
    ],
    lastUpdated: lastCall?.createdAt?.toISOString(),
    resolvedPath: transcriptsPath || undefined,
  };
}

/**
 * Compute Parameters status
 */
async function getParametersStatus(): Promise<NodeStats> {
  const [paramCount, snapshotCount, activeCount] = await Promise.all([
    prisma.parameter.count(),
    prisma.analysisProfile.count(),
    prisma.parameterTag.count({
      where: { tag: { name: "Active" } },
    }),
  ]);

  // Get last updated
  const lastParam = await prisma.parameter.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  // Determine RAG status
  let status: RagStatus = "red";
  let statusLabel = "No parameters";

  if (paramCount === 0) {
    status = "red";
    statusLabel = "No parameters";
  } else if (snapshotCount === 0) {
    status = "amber";
    statusLabel = "No snapshots";
  } else {
    status = "green";
    statusLabel = "Ready";
  }

  return {
    status,
    statusLabel,
    total: paramCount,
    processed: activeCount,
    derived: [
      { label: "Parameters", count: paramCount, link: "/admin#/parameters" },
      { label: "Active", count: activeCount, link: "/admin#/parameters" },
      { label: "Snapshots", count: snapshotCount, link: "/parameter-sets" },
    ],
    lastUpdated: lastParam?.updatedAt?.toISOString(),
  };
}

/**
 * GET /api/flow/status
 *
 * Returns status for all source nodes in the pipeline flow.
 */
export async function GET() {
  try {
    const kbRoot = resolveKbRoot();

    const [knowledge, transcripts, parameters] = await Promise.all([
      getKnowledgeBaseStatus(kbRoot),
      getTranscriptsStatus(kbRoot),
      getParametersStatus(),
    ]);

    const flowStatus: FlowStatus = {
      nodes: {
        "data:knowledge": knowledge,
        "data:transcripts": transcripts,
        "data:parameters": parameters,
      },
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      ok: true,
      ...flowStatus,
      meta: {
        kbRoot,
      },
    });
  } catch (err: any) {
    console.error("[Flow Status Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch flow status" },
      { status: 500 }
    );
  }
}
