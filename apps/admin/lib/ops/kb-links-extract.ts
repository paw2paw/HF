/**
 * KB Links Extract
 *
 * Scans knowledge source files and extracts all URLs found.
 * Supports text files (md, txt, html, json, yaml) AND PDFs.
 * Outputs a JSON file with links grouped by source file.
 *
 * Paths are resolved from agents.json data nodes:
 *   - Input: data:knowledge (sources/knowledge)
 *   - Output: data:knowledge_derived (derived/knowledge)
 *
 * Usage:
 *   npx tsx lib/ops/kb-links-extract.ts [--dry-run]
 *
 * Environment:
 *   HF_KB_PATH - Path to knowledge base root (defaults to ~/hf_kb)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import glob from "glob";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

// ============================================================================
// Path Resolution (uses agents.json data nodes as source of truth)
// ============================================================================

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
  const envRaw = (process.env.HF_KB_PATH || "").trim();
  const env = expandTilde(envRaw);
  if (env) return path.resolve(env);
  return path.resolve(path.join(os.homedir(), "hf_kb"));
}

type DataNode = {
  id: string;
  path?: string;
  storageType: string;
};

type AgentManifest = {
  data?: DataNode[];
};

function loadManifest(): AgentManifest | null {
  const candidates: string[] = [];

  // Walk up from current file to find lib/agents.json
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    candidates.push(path.join(dir, "..", "..", "..", "..", "lib", "agents.json"));
    candidates.push(path.join(dir, "..", "..", "..", "lib", "agents.json"));
    candidates.push(path.join(dir, "..", "..", "lib", "agents.json"));
    candidates.push(path.join(dir, "..", "lib", "agents.json"));
    candidates.push(path.join(dir, "lib", "agents.json"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // CWD-based paths
  candidates.push(path.resolve(process.cwd(), "lib", "agents.json"));
  candidates.push(path.resolve(process.cwd(), "..", "lib", "agents.json"));
  candidates.push(path.resolve(process.cwd(), "..", "..", "lib", "agents.json"));
  candidates.push(path.resolve(process.cwd(), "..", "..", "..", "lib", "agents.json"));

  // Dedupe
  const seen = new Set<string>();
  const uniq = candidates.map(p => path.resolve(p)).filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  for (const p of uniq) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        return JSON.parse(raw) as AgentManifest;
      }
    } catch {
      // Continue
    }
  }
  return null;
}

function resolveDataNodePath(nodeId: string, kbRoot: string): string | null {
  const manifest = loadManifest();
  if (!manifest?.data) return null;

  const node = manifest.data.find(d => d.id === nodeId);
  if (!node || node.storageType !== "path" || !node.path) return null;

  return path.join(kbRoot, node.path);
}

// URL regex - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

// File extensions to scan (text files)
const TEXT_EXTENSIONS = ["md", "txt", "html", "json", "yaml", "yml"];

// PDF extensions (handled separately with pdf-parse)
const PDF_EXTENSIONS = ["pdf"];

export interface ExtractLinksResult {
  ok: boolean;
  root: string;
  sourceDir: string;
  derivedDir: string;
  filesScanned: number;
  textFilesScanned: number;
  pdfFilesScanned: number;
  filesWithLinks: number;
  totalLinks: number;
  linksByFile: Record<string, string[]>;
  skippedFiles: string[];
  dryRun: boolean;
}

export interface ExtractKbLinksOptions {
  verbose?: boolean;
  plan?: boolean;
  force?: boolean;
}

/**
 * Extract links from knowledge base documents
 * Exportable function for use via API
 */
export async function extractKbLinks(options: ExtractKbLinksOptions = {}): Promise<ExtractLinksResult> {
  const { verbose = false, plan: dryRun = false } = options;
  return extractLinksInternal(dryRun, verbose);
}

async function extractLinksInternal(dryRun: boolean, verbose = false): Promise<ExtractLinksResult> {
  const root = getKbRoot();

  // Resolve paths from data nodes (single source of truth)
  const sourceDir = resolveDataNodePath("data:knowledge", root) || path.join(root, "sources", "knowledge");
  const derivedDir = resolveDataNodePath("data:knowledge_derived", root) || path.join(root, "derived", "knowledge");

  console.log(`[kb:links:extract] Scanning: ${sourceDir}`);

  // Ensure derived dir exists
  if (!dryRun) {
    fs.mkdirSync(derivedDir, { recursive: true });
  }

  // Find text files
  const textPattern = `**/*.{${TEXT_EXTENSIONS.join(",")}}`;
  const textFiles = glob.sync(textPattern, {
    cwd: sourceDir,
    absolute: true,
    nodir: true,
  });

  // Find PDF files (case-insensitive)
  const pdfPattern = `**/*.{pdf,PDF}`;
  const pdfFiles = glob.sync(pdfPattern, {
    cwd: sourceDir,
    absolute: true,
    nodir: true,
  });

  const totalFiles = textFiles.length + pdfFiles.length;
  console.log(`[kb:links:extract] Found ${totalFiles} files (${textFiles.length} text, ${pdfFiles.length} PDF)`);

  const linksByFile: Record<string, string[]> = {};
  const skippedFiles: string[] = [];
  let totalLinks = 0;
  let filesWithLinks = 0;

  // Process text files
  for (const absPath of textFiles) {
    try {
      const content = fs.readFileSync(absPath, "utf8");
      const matches = content.match(URL_REGEX) || [];

      if (matches.length > 0) {
        const relPath = path.relative(sourceDir, absPath).replace(/\\/g, "/");
        const uniqueUrls = Array.from(new Set(matches));
        linksByFile[relPath] = uniqueUrls;
        totalLinks += uniqueUrls.length;
        filesWithLinks++;
        console.log(`  [text] ${relPath}: ${uniqueUrls.length} URLs`);
      }
    } catch (err) {
      const relPath = path.relative(sourceDir, absPath).replace(/\\/g, "/");
      skippedFiles.push(relPath);
    }
  }

  // Process PDF files
  let pdfProcessed = 0;
  for (const absPath of pdfFiles) {
    const relPath = path.relative(sourceDir, absPath).replace(/\\/g, "/");
    try {
      const buffer = fs.readFileSync(absPath);

      // Parse PDF (v1 API - simple function call)
      const data = await pdfParse(buffer);
      const content = data.text || "";
      const matches = content.match(URL_REGEX) || [];

      pdfProcessed++;
      if (pdfProcessed % 50 === 0 || pdfProcessed === pdfFiles.length) {
        console.log(`  [pdf] Processed ${pdfProcessed}/${pdfFiles.length} PDFs...`);
      }

      if (matches.length > 0) {
        const uniqueUrls: string[] = Array.from(new Set(matches));
        linksByFile[relPath] = uniqueUrls;
        totalLinks += uniqueUrls.length;
        filesWithLinks++;
        console.log(`  [pdf] ${relPath}: ${uniqueUrls.length} URLs`);
      }
    } catch (err) {
      skippedFiles.push(relPath);
      // Log error but continue
      console.log(`  [pdf] SKIP ${relPath}: ${(err as Error).message || "parse error"}`);
    }
  }

  const result: ExtractLinksResult = {
    ok: true,
    root,
    sourceDir,
    derivedDir,
    filesScanned: totalFiles,
    textFilesScanned: textFiles.length,
    pdfFilesScanned: pdfFiles.length,
    filesWithLinks,
    totalLinks,
    linksByFile,
    skippedFiles,
    dryRun,
  };

  // Write output file
  if (!dryRun) {
    const outputPath = path.join(derivedDir, "links.json");
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`[kb:links:extract] Output written to: ${outputPath}`);
  }

  return result;
}

// Main - only runs when executed directly (not imported)
if (require.main === module) {
(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("[kb:links:extract] DRY RUN - no files will be written");
  }

  const result = await extractLinksInternal(dryRun);

  console.log("\n[kb:links:extract] Summary:");
  console.log(`  Files scanned: ${result.filesScanned} (${result.textFilesScanned} text, ${result.pdfFilesScanned} PDF)`);
  console.log(`  Files with links: ${result.filesWithLinks}`);
  console.log(`  Total unique links: ${result.totalLinks}`);
  if (result.skippedFiles.length > 0) {
    console.log(`  Skipped files: ${result.skippedFiles.length}`);
  }

  // Output JSON for API consumption
  console.log("\n" + JSON.stringify(result, null, 2));
})().catch((err) => {
  console.error("[kb:links:extract] Error:", err.message || err);
  process.exitCode = 1;
});
}
