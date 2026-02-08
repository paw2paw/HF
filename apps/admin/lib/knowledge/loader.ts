// -------------------------
// Canonical KB path resolver
// -------------------------

export type KbPathKey =
  | "sourcesDir"
  | "derivedDir"
  | "vectorsDir"
  | "pagesDir"
  | "transcriptsRawDir"
  | "parametersRawCsv";

export type KbRuntimeConfig = {
  version: 1;
  updatedAt: string;
  /**
   * Overrides are either:
   * - a relative suffix (resolved against kbRoot)
   * - an absolute path
   */
  overrides: Partial<Record<KbPathKey, string>>;
};

export type ResolvedKbPaths = {
  root: string;
  configPath: string;
  config: KbRuntimeConfig;
  paths: Record<KbPathKey, string>;
};

const DEFAULT_KB_PATHS: Record<KbPathKey, string> = {
  sourcesDir: "sources",
  derivedDir: "derived",
  vectorsDir: "vectors",
  // default pagesDir is derivedDir + "/pages" unless overridden
  pagesDir: "derived/pages",
  transcriptsRawDir: "transcripts/raw",
  parametersRawCsv: "parameters/raw/parameters.csv",
};

function expandHome(p: string): string {
  const s = String(p || "").trim();
  if (!s) return s;
  if (s === "~") return process.env.HOME || s;
  if (s.startsWith("~/")) return path.join(process.env.HOME || "~", s.slice(2));
  return s;
}

function isAbs(p: string): boolean {
  try {
    return path.isAbsolute(p);
  } catch {
    return false;
  }
}

function resolveAgainstRoot(kbRoot: string, maybeRelativeOrAbs: string): string {
  const s = expandHome(String(maybeRelativeOrAbs || "").trim());
  if (!s) return kbRoot;
  return isAbs(s) ? path.resolve(s) : path.resolve(kbRoot, s);
}

function defaultRuntimeConfig(): KbRuntimeConfig {
  return { version: 1, updatedAt: new Date().toISOString(), overrides: {} };
}

export function resolveKbRoot(kbRoot?: string): string {
  // Canonical env var: HF_KB_PATH (absolute or relative path to KB root).
  const env = typeof process.env.HF_KB_PATH === "string" ? process.env.HF_KB_PATH : "";
  const base = (kbRoot && String(kbRoot).trim()) || (env && env.trim()) || "";
  if (base) return path.resolve(expandHome(base));
  // Default is a repo-level knowledge folder; safe for local-only.
  return path.resolve(process.cwd(), "../../knowledge");
}

export function kbRuntimeConfigPath(kbRoot?: string): string {
  const root = resolveKbRoot(kbRoot);
  // Persist under derived so it's near other generated artifacts.
  return path.join(root, "derived", "runtime-config.json");
}

export async function readKbRuntimeConfig(kbRoot?: string): Promise<KbRuntimeConfig> {
  const p = kbRuntimeConfigPath(kbRoot);
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && typeof parsed.updatedAt === "string" && parsed.overrides && typeof parsed.overrides === "object") {
      return parsed as KbRuntimeConfig;
    }
    return defaultRuntimeConfig();
  } catch {
    return defaultRuntimeConfig();
  }
}

export async function writeKbRuntimeConfig(kbRoot: string, next: KbRuntimeConfig): Promise<void> {
  const root = resolveKbRoot(kbRoot);
  const p = kbRuntimeConfigPath(root);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const payload: KbRuntimeConfig = {
    version: 1,
    updatedAt: new Date().toISOString(),
    overrides: next?.overrides || {},
  };
  await fs.writeFile(p, JSON.stringify(payload, null, 2), "utf8");
}

export async function updateKbRuntimeConfig(kbRoot: string, patch: Partial<Record<KbPathKey, string>>): Promise<KbRuntimeConfig> {
  const cur = await readKbRuntimeConfig(kbRoot);
  const overrides = { ...(cur.overrides || {}) };

  for (const [k, v] of Object.entries(patch || {})) {
    const key = k as KbPathKey;
    const val = typeof v === "string" ? v.trim() : "";
    if (!val) delete overrides[key];
    else overrides[key] = val;
  }

  const next: KbRuntimeConfig = { version: 1, updatedAt: new Date().toISOString(), overrides };
  await writeKbRuntimeConfig(kbRoot, next);
  return next;
}

export async function resolveKbPaths(kbRoot?: string): Promise<ResolvedKbPaths> {
  const root = resolveKbRoot(kbRoot);
  const config = await readKbRuntimeConfig(root);

  // If derivedDir is overridden, pagesDir should default to `${derivedDir}/pages` unless explicitly overridden.
  const derivedSuffix = (config.overrides?.derivedDir || DEFAULT_KB_PATHS.derivedDir).trim();
  const defaultPages = norm(path.join(derivedSuffix, "pages"));

  const merged: Record<KbPathKey, string> = {
    ...DEFAULT_KB_PATHS,
    pagesDir: defaultPages,
    ...(config.overrides || {}),
  } as any;

  const resolved = Object.fromEntries(
    (Object.keys(DEFAULT_KB_PATHS) as KbPathKey[]).map((k) => [k, resolveAgainstRoot(root, merged[k])])
  ) as Record<KbPathKey, string>;

  return {
    root,
    configPath: kbRuntimeConfigPath(root),
    config,
    paths: resolved,
  };
}
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type KnowledgeDoc = {
  id: string;
  sourcePath: string;
  ext: string;
  title: string;
  updatedAtMs: number;
  bytes: number;
  raw: string;
  meta: Record<string, any>;
};

export type KnowledgeChunk = {
  id: string;
  docId: string;
  sourcePath: string;
  title: string;
  index: number;
  text: string;
  meta: Record<string, any>;
};

export type LoadKnowledgeOptions = {
  /**
   * KB root. If it contains a `sources/` folder, that will be used; otherwise this path is treated as the sources root.
   */
  kbRoot?: string;
  includeExts?: string[];
  excludeGlobs?: string[];
  maxCharsPerChunk?: number;
  overlapChars?: number;
};

export type KbLayout = {
  root: string;
  sourcesDir: string;
  derivedDir: string;
  vectorsDir: string;
  pagesDir: string;
};

export type LinkExtraction = {
  ok: boolean;
  root: string;
  sourcesDir: string;
  derivedDir: string;
  totalLinks: number;
  linksByFile: Record<string, string[]>;
  outPath: string;
};

export type ScrapeSummary = {
  ok: boolean;
  root: string;
  pagesDir: string;
  total: number;
  fetched: number;
  skipped: number;
  failed: number;
  outputFiles: string[];
};

export type BuildKbSummary = {
  ok: boolean;
  root: string;
  sourcesDir: string;
  derivedDir: string;
  kbJsonlPath: string;
  docCount: number;
  chunkCount: number;
  fileCount: number;
};

export type VectorBuildSummary = {
  ok: boolean;
  root: string;
  vectorsDir: string;
  inputKbJsonlPath: string;
  outJsonlPath: string;
  model: string;
  dimension: number | null;
  embedded: number;
  skipped: number;
  note?: string;
};

function stableId(input: string) {
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function norm(p: string) {
  return p.replace(/\\/g, "/");
}

function isSubpath(child: string, parent: string) {
  const c = norm(path.resolve(child));
  const p = norm(path.resolve(parent));
  return c === p || c.startsWith(p + "/");
}


function defaultIncludeExts() {
  return [".md", ".mdx", ".txt", ".csv", ".json"];
}

function safeStatMs(st: { mtimeMs?: number; mtime?: Date }) {
  if (typeof st.mtimeMs === "number") return st.mtimeMs;
  if (st.mtime instanceof Date) return st.mtime.getTime();
  return Date.now();
}

function splitFrontmatter(raw: string): { fm: Record<string, any>; body: string } {
  const s = raw.replace(/^\uFEFF/, "");
  if (!s.startsWith("---\n") && !s.startsWith("---\r\n")) return { fm: {}, body: raw };

  const end = s.indexOf("\n---", 4);
  if (end === -1) return { fm: {}, body: raw };

  const fmBlock = s.slice(4, end).trim();
  const rest = s.slice(end + 4);
  const fm: Record<string, any> = {};

  for (const line of fmBlock.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v: any = m[2].trim();
    if (/^(true|false)$/i.test(v)) v = /^true$/i.test(v);
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    else v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    fm[k] = v;
  }

  return { fm, body: rest.replace(/^\r?\n/, "") };
}

function inferTitle(sourcePath: string, raw: string) {
  const base = path.basename(sourcePath);
  const { fm, body } = splitFrontmatter(raw);
  if (typeof fm.title === "string" && fm.title.trim()) return fm.title.trim();

  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h && h[1].trim()) return h[1].trim();
    break;
  }
  return base;
}

function parseCsvToText(raw: string) {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return "";
  const rows = lines.map(parseCsvLine);
  const header = rows[0] || [];
  const body = rows.slice(1);

  const out: string[] = [];
  out.push(`CSV: ${header.join(" | ")}`);
  for (const r of body) {
    const pairs = header.map((h, i) => `${h}: ${r[i] ?? ""}`).join(" | ");
    out.push(pairs);
  }
  return out.join("\n");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function chunkText(text: string, maxChars: number, overlap: number) {
  const t = text.trim();
  if (!t) return [];
  if (maxChars <= 0) return [t];

  const chunks: string[] = [];
  let i = 0;

  while (i < t.length) {
    const end = Math.min(t.length, i + maxChars);
    let slice = t.slice(i, end);

    if (end < t.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" ")
      );
      if (lastBreak > Math.floor(maxChars * 0.6)) {
        slice = slice.slice(0, lastBreak + 1).trimEnd();
      }
    }

    chunks.push(slice.trim());
    if (end >= t.length) break;

    const advance = Math.max(1, slice.length - Math.max(0, overlap));
    i += advance;
  }

  return chunks.filter(Boolean);
}

function shouldSkip(rel: string, excludeGlobs: string[]) {
  const r = norm(rel);
  for (const g of excludeGlobs) {
    const gg = norm(g).trim();
    if (!gg) continue;
    if (gg.endsWith("/**")) {
      const p = gg.slice(0, -3);
      if (r.startsWith(p.endsWith("/") ? p : p + "/")) return true;
    } else if (gg.includes("*")) {
      const re = new RegExp(
        "^" +
          gg
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*") +
          "$",
        "i"
      );
      if (re.test(r)) return true;
    } else {
      if (r === gg) return true;
      if (r.startsWith(gg.endsWith("/") ? gg : gg + "/")) return true;
    }
  }
  return false;
}

async function existsDir(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function existsFile(p: string) {
  try {
    const st = await fs.stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

export async function resolveKbLayout(opts: LoadKnowledgeOptions = {}): Promise<KbLayout> {
  const root = resolveKbRoot(opts.kbRoot);
  const resolved = await resolveKbPaths(root);

  // Backward compatible behavior:
  // - If `<root>/<sourcesDirSuffix>` exists (typical KB root), use it.
  // - Otherwise treat `root` as the sources directory.
  const sourcesCandidate = resolved.paths.sourcesDir;
  const isKbRoot = await existsDir(sourcesCandidate);

  const sourcesDir = isKbRoot ? sourcesCandidate : root;
  const kbRoot = isKbRoot ? root : path.dirname(root);

  // If we treated `root` as sourcesDir, keep derived/vectors/pages alongside that sources folder.
  // This preserves previous behavior for callers that passed a sources directory.
  const derivedDir = isKbRoot ? resolved.paths.derivedDir : path.join(kbRoot, "derived");
  const vectorsDir = isKbRoot ? resolved.paths.vectorsDir : path.join(kbRoot, "vectors");
  const pagesDir = isKbRoot ? resolved.paths.pagesDir : path.join(derivedDir, "pages");

  return { root: kbRoot, sourcesDir, derivedDir, vectorsDir, pagesDir };
}

export async function listKnowledgeFiles(opts: LoadKnowledgeOptions = {}) {
  const layout = await resolveKbLayout(opts);
  const sourcesDir = layout.sourcesDir;

  const includeExts = (opts.includeExts || defaultIncludeExts()).map((e) => e.toLowerCase());
  const excludeGlobs = opts.excludeGlobs || ["node_modules/**", ".git/**", ".next/**"];

  const out: string[] = [];

  async function walk(dirAbs: string) {
    const entries = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dirAbs, ent.name);
      const rel = norm(path.relative(sourcesDir, abs));
      if (rel.startsWith("..") || rel === "") continue;
      if (shouldSkip(rel, excludeGlobs)) continue;

      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;

      const ext = path.extname(ent.name).toLowerCase();
      if (!includeExts.includes(ext)) continue;
      out.push(abs);
    }
  }

  try {
    const st = await fs.stat(sourcesDir);
    if (!st.isDirectory()) return [];
  } catch {
    return [];
  }

  await walk(sourcesDir);
  return out.sort((a, b) => a.localeCompare(b));
}

export async function loadKnowledgeDoc(filePathAbs: string, sourcesRootAbs?: string): Promise<KnowledgeDoc> {
  const abs = path.resolve(filePathAbs);
  const sourcesRoot = sourcesRootAbs ? path.resolve(sourcesRootAbs) : (await resolveKbLayout({})).sourcesDir;

  if (!isSubpath(abs, sourcesRoot)) {
    throw new Error(`Refusing to load doc outside sources root: ${abs}`);
  }

  const ext = path.extname(abs).toLowerCase();
  const buf = await fs.readFile(abs);
  const raw = buf.toString("utf8");
  const st = await fs.stat(abs);

  const title = inferTitle(abs, raw);
  const { fm, body } = splitFrontmatter(raw);

  let normalized = body;
  if (ext === ".csv") normalized = parseCsvToText(body);
  else if (ext === ".json") {
    try {
      const obj = JSON.parse(body);
      normalized = JSON.stringify(obj, null, 2);
    } catch {
      normalized = body;
    }
  }

  const rel = norm(path.relative(sourcesRoot, abs));
  const id = `kbdoc_${stableId(rel)}`;

  return {
    id,
    sourcePath: rel,
    ext,
    title,
    updatedAtMs: safeStatMs(st as any),
    bytes: buf.byteLength,
    raw: normalized,
    meta: { ...fm, relPath: rel },
  };
}

export async function loadKnowledge(opts: LoadKnowledgeOptions = {}) {
  const layout = await resolveKbLayout(opts);
  const sourcesDir = layout.sourcesDir;
  const files = await listKnowledgeFiles({ ...opts, kbRoot: sourcesDir });

  const maxChars = typeof opts.maxCharsPerChunk === "number" ? opts.maxCharsPerChunk : 1800;
  const overlap = typeof opts.overlapChars === "number" ? opts.overlapChars : 200;

  const docs: KnowledgeDoc[] = [];
  const chunks: KnowledgeChunk[] = [];

  for (const abs of files) {
    const doc = await loadKnowledgeDoc(abs, sourcesDir);
    docs.push(doc);

    const pieces = chunkText(doc.raw, maxChars, overlap);
    for (let i = 0; i < pieces.length; i++) {
      const id = `kbchunk_${stableId(`${doc.id}:${i}`)}`;
      chunks.push({
        id,
        docId: doc.id,
        sourcePath: doc.sourcePath,
        title: doc.title,
        index: i,
        text: pieces[i],
        meta: { ...doc.meta, chunkIndex: i, totalChunks: pieces.length },
      });
    }
  }

  return { kbRoot: layout.root, sourcesDir, docs, chunks, fileCount: files.length };
}

// -------------------------
// Link extraction + scraping
// -------------------------

const URL_RE = /https?:\/\/[^\s)\]"'>]+/g;

export async function extractLinksFromSources(opts: LoadKnowledgeOptions = {}): Promise<LinkExtraction> {
  const layout = await resolveKbLayout(opts);
  const sourcesDir = layout.sourcesDir;
  const derivedDir = layout.derivedDir;

  await fs.mkdir(derivedDir, { recursive: true });

  const files = await listKnowledgeFiles({ ...opts, kbRoot: sourcesDir });

  const linksByFile: Record<string, string[]> = {};
  let total = 0;

  for (const abs of files) {
    let s = "";
    try {
      s = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const matches = s.match(URL_RE) || [];
    if (!matches.length) continue;

    const uniq = Array.from(new Set(matches.map((u) => u.trim()).filter(Boolean)));
    if (!uniq.length) continue;

    const rel = norm(path.relative(sourcesDir, abs));
    linksByFile[rel] = uniq;
    total += uniq.length;
  }

  const payload: LinkExtraction = {
    ok: true,
    root: layout.root,
    sourcesDir,
    derivedDir,
    totalLinks: total,
    linksByFile,
    outPath: path.join(derivedDir, "links.json"),
  };

  await fs.writeFile(payload.outPath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function htmlToText(html: string) {
  // Minimal, dependency-free readability: remove scripts/styles, strip tags, decode a few entities.
  let s = html;
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<!--([\s\S]*?)-->/g, " ");
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/?p\b[^>]*>/gi, "\n");
  s = s.replace(/<\/?li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<\/?h[1-6]\b[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");

  // Basic entity decoding
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Collapse whitespace
  s = s.replace(/\r/g, "");
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function extractHtmlTitle(html: string) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const t = String(m[1] || "").replace(/\s+/g, " ").trim();
  return t || null;
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function scrapeLinksOnce(opts: LoadKnowledgeOptions = {}): Promise<ScrapeSummary> {
  const layout = await resolveKbLayout(opts);
  const linksPath = path.join(layout.derivedDir, "links.json");

  const linksPayload = await readJsonIfExists<LinkExtraction>(linksPath);
  if (!linksPayload || !linksPayload.ok) {
    return {
      ok: false,
      root: layout.root,
      pagesDir: layout.pagesDir,
      total: 0,
      fetched: 0,
      skipped: 0,
      failed: 0,
      outputFiles: [],
    };
  }

  await fs.mkdir(layout.pagesDir, { recursive: true });

  const allLinks = Object.values(linksPayload.linksByFile || {}).flat();
  const uniqLinks = Array.from(new Set(allLinks.map((u) => u.trim()).filter(Boolean)));

  let fetched = 0;
  let skipped = 0;
  let failed = 0;
  const outputFiles: string[] = [];

  for (const url of uniqLinks) {
    const id = `page_${stableId(url)}`;
    const outFile = path.join(layout.pagesDir, `${id}.json`);

    if (await existsFile(outFile)) {
      skipped++;
      continue;
    }

    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          // Avoid some servers rejecting default UA.
          "user-agent": "HF-KB-Scraper/0.1 (local)",
          accept: "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      const contentType = res.headers.get("content-type") || "";
      const status = res.status;
      const fetchedAt = new Date().toISOString();

      const body = await res.text();
      const title = extractHtmlTitle(body);
      const text = contentType.toLowerCase().includes("html") ? htmlToText(body) : body.trim();

      const payload = {
        ok: res.ok,
        id,
        url,
        status,
        contentType,
        fetchedAt,
        title,
        bytes: Buffer.byteLength(body, "utf8"),
        sha256: sha256Hex(body),
        text,
      };

      await fs.writeFile(outFile, JSON.stringify(payload, null, 2), "utf8");
      outputFiles.push(norm(path.relative(layout.root, outFile)));
      fetched++;
    } catch {
      failed++;
    }
  }

  return {
    ok: true,
    root: layout.root,
    pagesDir: layout.pagesDir,
    total: uniqLinks.length,
    fetched,
    skipped,
    failed,
    outputFiles,
  };
}

// -------------------------
// KB build (sources + pages)
// -------------------------

type PageDoc = {
  id: string;
  url: string;
  title?: string | null;
  fetchedAt?: string;
  text?: string;
  sha256?: string;
};

async function listPageDocs(pagesDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(pagesDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"))
      .map((e) => path.join(pagesDir, e.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function buildKbJsonl(opts: LoadKnowledgeOptions = {}): Promise<BuildKbSummary> {
  const layout = await resolveKbLayout(opts);
  await fs.mkdir(layout.derivedDir, { recursive: true });

  const maxChars = typeof opts.maxCharsPerChunk === "number" ? opts.maxCharsPerChunk : 1800;
  const overlap = typeof opts.overlapChars === "number" ? opts.overlapChars : 200;

  // 1) Load source docs
  const sources = await loadKnowledge({ ...opts, kbRoot: layout.sourcesDir, maxCharsPerChunk: maxChars, overlapChars: overlap });

  // 2) Load scraped pages (if any)
  const pageFiles = await listPageDocs(layout.pagesDir);
  const pageDocs: { doc: KnowledgeDoc; chunks: KnowledgeChunk[] }[] = [];

  for (const abs of pageFiles) {
    const p = await readJsonIfExists<PageDoc>(abs);
    if (!p || !p.url) continue;

    const text = String(p.text || "").trim();
    if (!text) continue;

    const rel = norm(path.relative(layout.root, abs));
    const title = (p.title && String(p.title).trim()) || p.url;

    const docId = `kbpage_${stableId(p.url)}`;
    const doc: KnowledgeDoc = {
      id: docId,
      sourcePath: rel,
      ext: ".url",
      title,
      updatedAtMs: p.fetchedAt ? new Date(p.fetchedAt).getTime() : Date.now(),
      bytes: Buffer.byteLength(text, "utf8"),
      raw: text,
      meta: { url: p.url, fetchedAt: p.fetchedAt, sha256: p.sha256, relPath: rel },
    };

    const pieces = chunkText(doc.raw, maxChars, overlap);
    const chunks: KnowledgeChunk[] = pieces.map((t, i) => ({
      id: `kbchunk_${stableId(`${doc.id}:${i}`)}`,
      docId: doc.id,
      sourcePath: doc.sourcePath,
      title: doc.title,
      index: i,
      text: t,
      meta: { ...doc.meta, chunkIndex: i, totalChunks: pieces.length },
    }));

    pageDocs.push({ doc, chunks });
  }

  const allDocs = [...sources.docs, ...pageDocs.map((p) => p.doc)];
  const allChunks = [...sources.chunks, ...pageDocs.flatMap((p) => p.chunks)];

  // 3) Write kb.jsonl (stable ids + hashes for diff/revert)
  const kbJsonlPath = path.join(layout.derivedDir, "kb.jsonl");

  const lines: string[] = [];
  for (const ch of allChunks) {
    const text = ch.text.trim();
    if (!text) continue;

    // Stable content hash so updates are visible in diffs
    const textHash = sha256Hex(text);

    lines.push(
      JSON.stringify({
        id: ch.id,
        docId: ch.docId,
        sourcePath: ch.sourcePath,
        title: ch.title,
        index: ch.index,
        text,
        textHash,
        meta: ch.meta,
      })
    );
  }

  await fs.writeFile(kbJsonlPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");

  return {
    ok: true,
    root: layout.root,
    sourcesDir: layout.sourcesDir,
    derivedDir: layout.derivedDir,
    kbJsonlPath,
    docCount: allDocs.length,
    chunkCount: lines.length,
    fileCount: sources.fileCount,
  };
}

// -------------------------
// Vectors (optional OpenAI)
// -------------------------

type KbJsonlRow = {
  id: string;
  text: string;
  textHash?: string;
  [k: string]: any;
};

async function readJsonl(p: string): Promise<KbJsonlRow[]> {
  const raw = await fs.readFile(p, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: KbJsonlRow[] = [];
  for (const l of lines) {
    try {
      out.push(JSON.parse(l));
    } catch {
      // ignore
    }
  }
  return out;
}

async function openAiEmbed(texts: string[], model: string): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`OpenAI embeddings failed: ${res.status} ${msg}`);
  }

  const json = (await res.json()) as any;
  const data = Array.isArray(json?.data) ? json.data : [];
  return data.map((d: any) => d.embedding as number[]);
}

export async function buildVectors(opts: LoadKnowledgeOptions & { model?: string; batchSize?: number } = {}): Promise<VectorBuildSummary> {
  const layout = await resolveKbLayout(opts);
  await fs.mkdir(layout.vectorsDir, { recursive: true });

  const inputKbJsonlPath = path.join(layout.derivedDir, "kb.jsonl");
  if (!(await existsFile(inputKbJsonlPath))) {
    return {
      ok: false,
      root: layout.root,
      vectorsDir: layout.vectorsDir,
      inputKbJsonlPath,
      outJsonlPath: path.join(layout.vectorsDir, "embeddings.jsonl"),
      model: opts.model || "text-embedding-3-small",
      dimension: null,
      embedded: 0,
      skipped: 0,
      note: "kb.jsonl not found. Run buildKbJsonl() first.",
    };
  }

  const rows = await readJsonl(inputKbJsonlPath);
  const model = opts.model || "text-embedding-3-small";
  const batchSize = typeof opts.batchSize === "number" ? Math.max(1, Math.floor(opts.batchSize)) : 32;

  const outJsonlPath = path.join(layout.vectorsDir, "embeddings.jsonl");

  const hasKey = !!process.env.OPENAI_API_KEY;
  const outputLines: string[] = [];

  let embedded = 0;
  let skipped = 0;
  let dimension: number | null = null;

  if (!hasKey) {
    // Still write a placeholder file so the pipeline is testable without a key.
    for (const r of rows) {
      if (!r?.id || !r?.text) {
        skipped++;
        continue;
      }
      outputLines.push(JSON.stringify({ id: r.id, textHash: r.textHash || sha256Hex(String(r.text || "")), embedding: null }));
    }
    await fs.writeFile(outJsonlPath, outputLines.join("\n") + (outputLines.length ? "\n" : ""), "utf8");

    return {
      ok: true,
      root: layout.root,
      vectorsDir: layout.vectorsDir,
      inputKbJsonlPath,
      outJsonlPath,
      model,
      dimension: null,
      embedded: 0,
      skipped,
      note: "OPENAI_API_KEY not set; wrote placeholder embeddings (null).",
    };
  }

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).filter((r) => r?.id && typeof r.text === "string" && r.text.trim().length > 0);
    if (!batch.length) {
      skipped += rows.slice(i, i + batchSize).length;
      continue;
    }

    const texts = batch.map((b) => String(b.text));
    const embs = await openAiEmbed(texts, model);

    for (let j = 0; j < batch.length; j++) {
      const r = batch[j];
      const emb = embs[j];
      if (Array.isArray(emb) && emb.length) {
        if (dimension == null) dimension = emb.length;
        embedded++;
        outputLines.push(JSON.stringify({ id: r.id, textHash: r.textHash || sha256Hex(String(r.text || "")), embedding: emb }));
      } else {
        skipped++;
      }
    }
  }

  await fs.writeFile(outJsonlPath, outputLines.join("\n") + (outputLines.length ? "\n" : ""), "utf8");

  return {
    ok: true,
    root: layout.root,
    vectorsDir: layout.vectorsDir,
    inputKbJsonlPath,
    outJsonlPath,
    model,
    dimension,
    embedded,
    skipped,
  };
}