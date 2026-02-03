import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { prisma } from "@/lib/prisma";

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

function getTranscriptsRawDir(): string {
  return path.join(getKbRoot(), "sources", "transcripts", "raw");
}

interface VAPICall {
  id: string;
  transcript: string;
  summary?: string;
  customer: { name?: string; number?: string } | null | string;
  startedAt: string | null;
  endedAt: string | null;
  status?: string;
  endedReason?: string;
  messages?: any[];
  createdAt: string;
}

/**
 * Extract caller name from transcript content
 * Looks for patterns like "Hi, NAME" or "Hello NAME" at the start
 */
function extractNameFromTranscript(transcript: string): string | null {
  if (!transcript) return null;

  // Blacklist of common words that aren't names
  const blacklist = new Set([
    'there', 'here', 'this', 'that', 'these', 'those',
    'thinking', 'doing', 'reading', 'writing', 'speaking',
    'first name', 'last name', 'name', 'user', 'caller',
    'yes', 'no', 'not', 'just', 'really', 'very', 'quite'
  ]);

  // Only look at first 200 chars (first AI message)
  const firstPart = transcript.slice(0, 200);

  // Pattern: "AI: Hi, NAME" or "AI: Hello NAME" - must be at start of transcript
  // Name must start with capital letter and be at least 2 chars
  const hiMatch = firstPart.match(/^AI:\s*(?:Hi|Hello|Hey),?\s+([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]+)?)\b/);
  if (hiMatch) {
    const name = hiMatch[1].trim();
    const nameLower = name.toLowerCase();

    // Reject if in blacklist or too short
    if (!blacklist.has(nameLower) && name.length >= 2) {
      return name;
    }
  }

  return null;
}

/**
 * Parse a plain text transcript file into a call object
 *
 * Format expected:
 * ```
 * Phone Number: +07768 484848
 * Caller: WNF_STUDENT
 * Call: 1
 *
 * Transcript
 * [first message - implicitly AI]
 * [timestamp]
 * Assistant
 * [message text]
 * [timestamp]
 * User
 * [message text]
 * ...
 * ```
 */
function parseTextTranscript(content: string, filename: string): VAPICall | null {
  try {
    // Extract log ID from filename (e.g., "Session 1 - Log ID 019bf58d-d83d-744f-abf0-6b514299d5f3.txt")
    const logIdMatch = filename.match(/Log ID ([0-9a-f-]+)/i);
    const logId = logIdMatch ? logIdMatch[1] : `txt-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Extract phone number
    const phoneMatch = content.match(/Phone Number:\s*\+?\s*([0-9\s]+)/i);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, "") : null;

    // Extract caller name
    const callerMatch = content.match(/Caller:\s*(.+)/i);
    const callerName = callerMatch ? callerMatch[1].trim() : null;

    // Find where transcript starts
    const transcriptStart = content.indexOf("Transcript");
    if (transcriptStart === -1) return null;

    const transcriptContent = content.slice(transcriptStart + "Transcript".length).trim();

    // Parse the transcript by finding speaker labels and extracting text between them
    // The format is: [text][timestamp][SpeakerLabel][text][timestamp][SpeakerLabel]...
    // Where the first text block has no preceding label (implicitly AI)

    const lines: string[] = [];

    // Regex to match timestamps like "2:28:17 PM(+00:24.82)"
    const timestampRegex = /\d+:\d+:\d+\s*(AM|PM)\s*\(\+[\d.:]+\)/gi;

    // Split by speaker labels, keeping the labels
    const parts = transcriptContent.split(/\n(Assistant|User)\n/);

    // First part is the initial AI message (before any label)
    if (parts.length > 0 && parts[0].trim()) {
      const firstText = parts[0].replace(timestampRegex, "").trim();
      if (firstText) {
        lines.push(`AI: ${firstText}`);
      }
    }

    // Process remaining parts: [label, text, label, text, ...]
    for (let i = 1; i < parts.length; i += 2) {
      const label = parts[i];
      const text = parts[i + 1];

      if (!text) continue;

      const cleanText = text.replace(timestampRegex, "").trim();
      if (!cleanText) continue;

      if (label === "Assistant") {
        lines.push(`AI: ${cleanText}`);
      } else if (label === "User") {
        lines.push(`User: ${cleanText}`);
      }
    }

    if (lines.length === 0) return null;

    const transcript = lines.join("\n");

    return {
      id: logId,
      transcript,
      summary: "",
      customer: phone
        ? {
            number: `+${phone.startsWith("0") ? "44" + phone.slice(1) : phone}`,
            name: callerName || undefined,
          }
        : callerName
        ? { name: callerName }
        : null,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: "ended",
      endedReason: "completed",
      messages: [],
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`Failed to parse text file: ${filename}`, e);
    return null;
  }
}

/**
 * Scan a directory recursively for transcript files (.json, .txt)
 */
async function scanTranscriptsDir(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subFiles = await scanTranscriptsDir(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase();
        if (lowerName.endsWith(".json") || lowerName.endsWith(".txt")) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }

  return files;
}

/**
 * POST /api/transcripts/import
 * Import transcript files into the database
 *
 * Supports three modes:
 * 1. JSON body with { filePaths: string[] } - specific server-side file paths
 * 2. JSON body with { fromKbPath: true } - auto-discover from HF_KB_PATH/sources/transcripts/raw
 * 3. FormData with files - browser uploads
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let filesToProcess: Array<{ content: string; filename: string }> = [];
    let domainSlug = "mabel";
    let duplicateHandling: "skip" | "overwrite" | "create_new" = "skip";
    let sourceDir: string | null = null;

    // Handle FormData (browser upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData.getAll("files") as File[];
      duplicateHandling = (formData.get("duplicateHandling") as string || "skip") as any;
      domainSlug = formData.get("domainSlug") as string || "mabel";

      if (!files || files.length === 0) {
        return NextResponse.json(
          { ok: false, error: "No files uploaded" },
          { status: 400 }
        );
      }

      for (const file of files) {
        const content = await file.text();
        filesToProcess.push({ content, filename: file.name });
      }
    }
    // Handle JSON body (server-side paths or auto-discovery)
    else {
      const body = await request.json();
      const { filePaths, fromKbPath = false, domainSlug: ds = "mabel", duplicateHandling: dh = "skip" } = body;
      domainSlug = ds;
      duplicateHandling = dh;

      // Mode: Auto-discover from KB path
      if (fromKbPath) {
        sourceDir = getTranscriptsRawDir();
        const discoveredPaths = await scanTranscriptsDir(sourceDir);

        if (discoveredPaths.length === 0) {
          return NextResponse.json({
            ok: true,
            message: `No transcript files found in ${sourceDir}`,
            sourceDir,
            filesProcessed: 0,
            callsImported: 0,
            callersCreated: 0,
          });
        }

        for (const filePath of discoveredPaths) {
          const content = await fs.readFile(filePath, "utf-8");
          const filename = path.basename(filePath);
          filesToProcess.push({ content, filename });
        }
      }
      // Mode: Specific file paths
      else if (filePaths && Array.isArray(filePaths) && filePaths.length > 0) {
        for (const filePath of filePaths) {
          const content = await fs.readFile(filePath, "utf-8");
          const filename = filePath.split("/").pop() || filePath;
          filesToProcess.push({ content, filename });
        }
      }
      // No files specified
      else {
        return NextResponse.json(
          { ok: false, error: "No files specified. Use { filePaths: [...] } or { fromKbPath: true }" },
          { status: 400 }
        );
      }
    }

    // Get domain for callers
    const domain = await prisma.domain.findUnique({ where: { slug: domainSlug } });

    const results = {
      filesProcessed: 0,
      callsImported: 0,
      callersCreated: 0,
      skipped: 0,
      updated: 0,
      errors: [] as string[],
    };

    // Track created/updated callers for response
    const importedCallers: Array<{ id: string; name: string | null; email: string | null; isNew: boolean }> = [];

    // Process each file
    for (const { content, filename } of filesToProcess) {
      try {
        const isJson = filename.toLowerCase().endsWith(".json");

        let calls: VAPICall[] = [];

        if (isJson) {
          const json = JSON.parse(content);
          calls = Array.isArray(json) ? json : (json.calls || [json]);
        } else {
          const call = parseTextTranscript(content, filename);
          if (call) calls = [call];
        }

        // Filter to calls with actual transcripts
        const validCalls = calls.filter(
          (c) => c.transcript && c.transcript.trim().length > 0
        );

        // Group calls by caller phone number
        const callsByPhone = new Map<string, VAPICall[]>();
        for (const call of validCalls) {
          const phone = typeof call.customer === "object" ? call.customer?.number : null;
          const key = phone || `unknown-${call.id}`;
          const existing = callsByPhone.get(key) || [];
          existing.push(call);
          callsByPhone.set(key, existing);
        }

        // Sort each caller's calls by date
        for (const [, phoneCalls] of callsByPhone) {
          phoneCalls.sort((a, b) => {
            const dateA = new Date(a.startedAt || a.createdAt).getTime();
            const dateB = new Date(b.startedAt || b.createdAt).getTime();
            return dateA - dateB;
          });
        }

        // Create callers and their calls
        for (const [phone, phoneCalls] of callsByPhone) {
          const customerInfo = phoneCalls[0].customer as { name?: string; number?: string } | null;

          // Try to get name from: 1) customer data, 2) transcript, 3) default
          let callerName = customerInfo?.name?.trim();
          if (!callerName) {
            callerName = extractNameFromTranscript(phoneCalls[0].transcript);
          }
          if (!callerName) {
            callerName = `Caller ${phone.slice(-4)}`;
          }

          // Find or create caller
          let caller = phone.startsWith("unknown-")
            ? null
            : await prisma.caller.findFirst({ where: { phone } });

          const isNewCaller = !caller;
          if (!caller) {
            caller = await prisma.caller.create({
              data: {
                name: callerName,
                phone: phone.startsWith("unknown-") ? null : phone,
                domainId: domain?.id,
                externalId: `import-${phone}`,
              },
            });
            results.callersCreated++;
          }

          // Track for response
          if (!importedCallers.find(c => c.id === caller!.id)) {
            importedCallers.push({
              id: caller.id,
              name: caller.name,
              email: caller.email,
              isNew: isNewCaller,
            });
          }

          // Get current call sequence for this caller
          let callSequence = 1;
          let previousCallId: string | null = null;

          const existingCalls = await prisma.call.findMany({
            where: { callerId: caller.id },
            orderBy: { callSequence: "desc" },
            take: 1,
          });

          if (existingCalls.length > 0 && existingCalls[0].callSequence) {
            callSequence = existingCalls[0].callSequence + 1;
            previousCallId = existingCalls[0].id;
          }

          // Create each call
          for (const vapiCall of phoneCalls) {
            // Check if this call already exists (by externalId)
            const existingCall = await prisma.call.findFirst({
              where: { externalId: vapiCall.id },
            });

            if (existingCall) {
              if (duplicateHandling === "skip") {
                // Skip - keep existing, just update sequence tracking
                previousCallId = existingCall.id;
                if (existingCall.callSequence) callSequence = existingCall.callSequence + 1;
                results.skipped++;
                continue;
              } else if (duplicateHandling === "overwrite") {
                // Overwrite - update existing call
                await prisma.call.update({
                  where: { id: existingCall.id },
                  data: {
                    transcript: vapiCall.transcript,
                  },
                });
                results.updated++;
                previousCallId = existingCall.id;
                if (existingCall.callSequence) callSequence = existingCall.callSequence + 1;
                continue;
              }
              // create_new - fall through to create a new call with different externalId
            }

            const createdCall = await prisma.call.create({
              data: {
                source: "import",
                externalId: duplicateHandling === "create_new" && existingCall
                  ? `${vapiCall.id}-${Date.now()}`
                  : vapiCall.id,
                callerId: caller.id,
                transcript: vapiCall.transcript,
                callSequence,
                previousCallId,
                createdAt: new Date(vapiCall.startedAt || vapiCall.createdAt),
              },
            });

            results.callsImported++;
            previousCallId = createdCall.id;
            callSequence++;
          }
        }

        results.filesProcessed++;
      } catch (e: any) {
        results.errors.push(`${filename}: ${e.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      created: results.callersCreated,
      updated: results.updated,
      skipped: results.skipped,
      callers: importedCallers,
      filesProcessed: results.filesProcessed,
      callsImported: results.callsImported,
      errors: results.errors,
      ...(sourceDir && { sourceDir }),
    });
  } catch (error: any) {
    console.error("POST /api/transcripts/import error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to import transcripts" },
      { status: 500 }
    );
  }
}
