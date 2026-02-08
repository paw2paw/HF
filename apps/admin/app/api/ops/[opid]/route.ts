import { NextResponse } from "next/server";
import { execFile as _execFile } from "child_process";
import { promisify } from "util";

const execFile = promisify(_execFile);

export const runtime = "nodejs";

/**
 * HARD RULES
 * - LOCAL ONLY (never production)
 * - ALLOW‑LISTED OPERATIONS ONLY
 * - NO ARBITRARY COMMANDS
 * - SAFE ARGUMENTS ONLY (no shell injection)
 */

type OpRisk = "safe" | "mutates" | "destructive";

type OpEffects = {
  reads?: string[];
  writes?: string[];
  creates?: string[];
  deletes?: string[];
};

type OpEvent = {
  ts: string;
  level: "info" | "warn" | "error";
  phase: "plan" | "exec" | "cleanup";
  message: string;
};

type OpPlan = {
  title: string;
  description: string;
  cmd: string;
  cwd: string;
  dryRun: boolean;
  risk: OpRisk;
  effects: OpEffects;
  args?: Record<string, unknown>;
};

type OpResult = {
  ok: boolean;
  /** UI-compat alias */
  op?: string;
  opid: string;
  dryRun: boolean;
  /** UI-compat alias */
  at?: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number | null;
  /** UI-compat alias (combined stdout/stderr) */
  output?: string;
  stdout: string;
  stderr: string;
  plan?: OpPlan;
  events?: OpEvent[];
  meta?: {
    cwd?: string;
    nodeEnv?: string;
    gitSha?: string;
    durationMs?: number;
  };
};

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Ops API is disabled in production");
  }
  if (process.env.HF_OPS_ENABLED !== "true") {
    throw new Error("Ops API is disabled (set HF_OPS_ENABLED=true in .env.local)");
  }
}

function projectCwd() {
  return process.cwd();
}



function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "true" || t === "1" || t === "yes" || t === "y") return true;
    if (t === "false" || t === "0" || t === "no" || t === "n") return false;
  }
  if (typeof v === "number") return v !== 0;
  return fallback;
}

function safeRecord(v: unknown): Record<string, unknown> {
  return isPlainObject(v) ? v : {};
}

function safeName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

function safeId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  // allow cuid/uuid-ish ids
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return null;
  return t;
}

function safeInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function parseCommandLine(cmd: string): { file: string; args: string[] } {
  const s = String(cmd || "").trim();
  if (!s) throw new Error("Empty command");

  const args: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  const pushCur = () => {
    if (cur.length) args.push(cur);
    cur = "";
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }

    if (quote) {
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }

    // not in quotes
    if (ch === '"' || ch === "'") {
      quote = ch as any;
      continue;
    }

    // reject common shell metacharacters outside quotes
    if (ch === ";" || ch === "|" || ch === "&" || ch === ">" || ch === "<" || ch === "`" || ch === "$") {
      throw new Error("Unsafe command (shell metacharacter detected)");
    }

    if (ch === " " || ch === "\t" || ch === "\n") {
      pushCur();
      continue;
    }

    cur += ch;
  }

  if (escaped) throw new Error("Invalid command (dangling escape)");
  if (quote) throw new Error("Invalid command (unterminated quote)");
  pushCur();

  const file = args.shift();
  if (!file) throw new Error("Invalid command");

  return { file, args };
}

async function tryGitSha(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFile("git", ["rev-parse", "--short", "HEAD"], { cwd });
    return String(stdout || "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function runCommand(
  opid: string,
  opSpec: OpSpec,
  spec: { cmd: string; cwd?: string },
  body: Record<string, unknown>,
  dryRun: boolean,
  includePlan: boolean,
  verbose: boolean
): Promise<OpResult> {
  const startedAt = new Date().toISOString();
  const cwd = spec.cwd ?? projectCwd();
  const startedMs = Date.now();

  const events: OpEvent[] = [];
  const push = (level: OpEvent["level"], phase: OpEvent["phase"], message: string) => {
    if (!verbose) return;
    events.push({ ts: new Date().toISOString(), level, phase, message });
  };

  const plan: OpPlan = {
    title: opSpec.title,
    description: opSpec.description,
    cmd: spec.cmd,
    cwd,
    dryRun,
    risk: opSpec.risk ?? "safe",
    effects: opSpec.effects ?? {},
    args: body,
  };

  if (dryRun) {
    push("info", "plan", `Prepared dry-run plan for ${opid}`);
    push("info", "plan", `Command: ${spec.cmd}`);

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedMs;

    return {
      ok: true,
      op: opid,
      opid,
      dryRun: true,
      startedAt,
      finishedAt,
      at: finishedAt,
      exitCode: null,
      stdout: `[dry-run] ${spec.cmd}`,
      stderr: "",
      output: `[dry-run] ${spec.cmd}`,
      plan: includePlan ? plan : undefined,
      events: verbose ? events : undefined,
      meta: {
        cwd,
        nodeEnv: process.env.NODE_ENV,
        gitSha: await tryGitSha(cwd),
        durationMs: verbose ? durationMs : undefined,
      },
    };
  }

  try {
    const parsed = parseCommandLine(spec.cmd);
    push("info", "exec", `Executing: ${spec.cmd}`);

    const { stdout, stderr } = await execFile(parsed.file, parsed.args, {
      cwd,
      timeout: 1000 * 60 * 10,
      env: { ...process.env, FORCE_COLOR: "0" },
      maxBuffer: 1024 * 1024 * 20,
    });

    push("info", "exec", `Completed with exitCode 0`);

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedMs;

    return {
      ok: true,
      op: opid,
      opid,
      dryRun: false,
      startedAt,
      finishedAt,
      at: finishedAt,
      exitCode: 0,
      stdout: stdout || "",
      stderr: stderr || "",
      output: (stdout || "") + (stderr ? `\n${stderr}` : ""),
      plan: includePlan ? plan : undefined,
      events: verbose ? events : undefined,
      meta: {
        cwd: verbose ? cwd : undefined,
        nodeEnv: verbose ? process.env.NODE_ENV : undefined,
        gitSha: verbose ? await tryGitSha(cwd) : undefined,
        durationMs: verbose ? durationMs : undefined,
      },
    };
  } catch (err: any) {
    push("error", "exec", `Failed with exitCode ${err?.code ?? 1}`);

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startedMs;

    return {
      ok: false,
      op: opid,
      opid,
      dryRun: false,
      startedAt,
      finishedAt,
      at: finishedAt,
      exitCode: err?.code ?? 1,
      stdout: err?.stdout ?? "",
      stderr: err?.stderr ?? err?.message ?? "Command failed",
      output: String((err?.stdout ?? "") || "") + (err?.stderr ? `\n${err.stderr}` : (err?.message ? `\n${err.message}` : "")),
      plan: includePlan ? plan : undefined,
      events: verbose ? events : undefined,
      meta: {
        cwd: verbose ? cwd : undefined,
        nodeEnv: verbose ? process.env.NODE_ENV : undefined,
        gitSha: verbose ? await tryGitSha(cwd) : undefined,
        durationMs: verbose ? durationMs : undefined,
      },
    };
  }
}

type OpSpec = {
  title: string;
  description: string;
  /**
   * Whether the server may include a `plan` block (title/description/command/etc.) when requested.
   */
  supportsPlan?: boolean;
  /**
   * Whether the server may include extra metadata/events when `verbose=true`.
   */
  supportsVerbose?: boolean;
  /**
   * Risk classification for UI warnings / confirmation flows.
   */
  risk?: OpRisk;
  /**
   * Human-readable data effects to show in the Ops "More" panel.
   */
  effects?: OpEffects;
  buildCommand: (body: Record<string, unknown>) => { cmd: string; cwd?: string };
};

const OPS: Record<string, OpSpec> = {
  "prisma:migrate:status": {
    title: "Migration status",
    description: "Show applied/pending migrations",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["_prisma_migrations"], writes: [] },
    buildCommand: () => ({ cmd: "npx prisma migrate status" }),
  },
  "prisma:migrate:dev": {
    title: "Create & apply migration",
    description: "Runs prisma migrate dev (optionally with a safe --name)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["prisma/schema.prisma", "_prisma_migrations"], writes: ["database"], creates: ["prisma/migrations/<new>" ] },
    buildCommand: (body) => {
      const name = safeName(body.name);
      return name
        ? { cmd: `npx prisma migrate dev --name ${name}` }
        : { cmd: "npx prisma migrate dev" };
    },
  },
  "prisma:generate": {
    title: "Generate client",
    description: "Runs prisma generate",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["prisma/schema.prisma"], writes: ["node_modules/@prisma/client"] },
    buildCommand: () => ({ cmd: "npx prisma generate" }),
  },
  "prisma:seed": {
    title: "Seed database",
    description: "Runs prisma db seed",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["prisma/seed.ts", "HF_PARAMETERS_CSV"], writes: ["database"] },
    buildCommand: () => ({ cmd: "npx prisma db seed" }),
  },

  "prisma:migrate:deploy": {
    title: "Deploy migrations (CI)",
    description: "Apply pending migrations without creating new ones (safe for CI/production)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["prisma/migrations"], writes: ["database", "_prisma_migrations"] },
    buildCommand: () => ({ cmd: "npx prisma migrate deploy" }),
  },

  "prisma:migrate:reset": {
    title: "Reset database",
    description: "Drop all tables and reapply migrations (DESTRUCTIVE - dev only)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "destructive",
    effects: { deletes: ["all database tables"], creates: ["database schema"] },
    buildCommand: () => ({ cmd: "npx prisma migrate reset --force" }),
  },

  "db:setup": {
    title: "Full DB setup (CI)",
    description: "Deploy migrations + seed database in one step",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["prisma/migrations", "prisma/seed.ts"], writes: ["database"] },
    buildCommand: () => ({ cmd: "npx prisma migrate deploy" }),
  },

  "db:check": {
    title: "Check database",
    description: "Verify database connection and show table counts",
    supportsPlan: false,
    supportsVerbose: false,
    risk: "safe",
    effects: { reads: ["database"] },
    buildCommand: () => ({
      cmd: "npx tsx -e \"const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{await p.$connect();const counts={parameters:await p.parameter.count(),tags:await p.tag.count(),users:await p.user.count(),calls:await p.call.count(),parameterSets:await p.parameterSet.count(),analysisRuns:await p.analysisRun.count(),knowledgeDocs:await p.knowledgeDoc.count()};console.log(JSON.stringify({ok:true,counts,summary:'DB connected, '+Object.entries(counts).map(([k,v])=>k+':'+v).join(', ')}));await p.$disconnect();})().catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exit(1);})\""
    }),
  },

  "git:status": {
    title: "Git status",
    description: "Shows working tree + branch",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: [".git"] },
    buildCommand: () => ({ cmd: "git status -sb" }),
  },
  "git:last": {
    title: "Last commits",
    description: "Shows last N commits (default 10)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: [".git"] },
    buildCommand: (body) => {
      const n = safeInt(body.n, 10);
      return { cmd: `git log --oneline -n ${n}` };
    },
  },

  "sys:env": {
    title: "Env summary",
    description: "Shows node version (shell-free)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["process.env"], writes: [] },
    buildCommand: () => ({ cmd: "node -v" }),
  },

  "kb:paths": {
    title: "KB paths",
    description: "Show resolved KB root and key ingest paths (parameters + transcripts + sources)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: {
      reads: ["HF_KB_PATH"],
      writes: [],
    },
    buildCommand: () => ({
      cmd:
        "node -e \"const path=require('path');const cwd=process.cwd();const env=(process.env.HF_KB_PATH||'').trim();const kbRoot=env||path.resolve(cwd,'../../knowledge');const pRaw=path.join(kbRoot,'parameters','raw','parameters.csv');const tRaw=path.join(kbRoot,'transcripts','raw');const sources=path.join(kbRoot,'sources');const derived=path.join(kbRoot,'derived');const vectors=path.join(kbRoot,'vectors');console.log(JSON.stringify({ok:true,cwd,kbRoot,envHF_KB_PATH:env||null,paths:{parametersRaw:pRaw,transcriptsRaw:tRaw,sources,derived,vectors},notes:{parametersCsv:'<KB_ROOT>/parameters/raw/parameters.csv',transcriptsDrop:'<KB_ROOT>/transcripts/raw/',setEnv:'Set HF_KB_PATH to override kbRoot'}},null,2));\"",
    }),
  },

  // --- Convenience aliases used by the UI ---

  "snapshots:import": {
    title: "Snapshots: import parameters",
    description: "UI alias. Snapshot Parameters.csv (raw → immutable snapshot + manifest)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["HF_KB_PATH", "<kb>/parameters/raw/parameters.csv"],
      writes: ["<kb>/parameters/snapshots"],
      creates: ["<kb>/parameters/snapshots/<snapshotId>/*"],
    },
    buildCommand: (body) => {
      const force = asBool(body.force, false);
      return {
        cmd:
          "npx tsx -e \"import('./lib/knowledge/parameters').then(async (m) => {\n" +
          "  const force = " + (force ? "true" : "false") + ";\n" +
          "  const mod = (m && ((m as any).default ?? m)) as any;\n" +
          "  const root = (mod && typeof mod === 'object') ? mod : {};\n" +
          "  const fn = (typeof mod === 'function') ? mod : (root.importParametersSnapshot || root.importParametersSnapshots || root.importParametersSnapshotFromCsv || root.importParameters || root.importSnapshot || root.import);\n" +
          "  if (typeof fn !== 'function') {\n" +
          "    const expKeys = m ? Object.keys(m as any) : [];\n" +
          "    const defKeys = (root && typeof root === 'object') ? Object.keys(root) : [];\n" +
          "    throw new Error('No compatible import function found in ./lib/knowledge/parameters. Exports: ' + expKeys.join(', ') + ' | default keys: ' + defKeys.join(', '));\n" +
          "  }\n" +
          "  const res = await fn({ force });\n" +
          "  console.log(JSON.stringify({ ok: true, snapshot: res }, null, 2));\n" +
          "}).catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\""
      };
    },
  },

  "transcripts:inventory": {
    title: "Transcripts: inventory raw",
    description: "UI alias. List transcript JSON files in <kb>/transcripts/raw with basic metadata + sha256",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/transcripts/raw"], writes: [] },
    buildCommand: (body) => {
      const limit = safeInt(body.limit, 200);
      return {
        cmd:
          "node -e \"" +
          "const fs=require('fs');" +
          "const path=require('path');" +
          "const crypto=require('crypto');" +
          "const cwd=process.cwd();" +
          "const env=(process.env.HF_KB_PATH||'').trim();" +
          "const kbRoot=env||path.resolve(cwd,'../../knowledge');" +
          "const dir=path.join(kbRoot,'transcripts','raw');" +
          "const limit=" +
          limit +
          ";" +
          "const sha256=(p)=>{try{const b=fs.readFileSync(p);return crypto.createHash('sha256').update(b).digest('hex');}catch{return null}};" +
          "let items=[];" +
          "try{if(!fs.existsSync(dir)){console.log(JSON.stringify({ok:true,dir,exists:false,count:0,items:[]},null,2));process.exit(0);}" +
          "const names=fs.readdirSync(dir).filter(n=>n.toLowerCase().endsWith('.json')).sort();" +
          "for(const name of names){if(items.length>=limit) break;const abs=path.join(dir,name);let st=null;try{st=fs.statSync(abs);}catch{continue;}" +
          "items.push({name,abs,bytes:st.size,modifiedAt:st.mtime.toISOString(),sha256:sha256(abs)});}" +
          "}catch(e){console.log(JSON.stringify({ok:false,dir,error:String(e&&e.message||e)},null,2));process.exitCode=1;return;}" +
          "console.log(JSON.stringify({ok:true,dir,exists:true,count:items.length,items},null,2));" +
          "\\\"\"",
      };
    },
  },

  "kb:build+embed": {
    title: "KB: build + embed",
    description:
      "UI alias. Build derived kb.jsonl from <kb>/sources (+ optional derived/pages) and then build embeddings.jsonl into <kb>/vectors",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["HF_KB_PATH", "<kb>/sources", "<kb>/derived/pages", "OPENAI_API_KEY"],
      writes: ["<kb>/derived", "<kb>/vectors"],
      creates: ["<kb>/derived/kb.jsonl", "<kb>/vectors/embeddings.jsonl"],
    },
    buildCommand: (body) => {
      const maxChars = typeof body.maxCharsPerChunk === "number" ? body.maxCharsPerChunk : 1800;
      const overlap = typeof body.overlapChars === "number" ? body.overlapChars : 200;
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "text-embedding-3-small";
      const batchSize = safeInt(body.batchSize, 64);

      return {
        cmd:
          "node -e \"" +
          "const {execSync}=require('child_process');" +
          "const run=(cmd)=>{execSync(cmd,{stdio:'inherit',env:{...process.env,FORCE_COLOR:'0'}});};" +
          "const maxChars=" +
          maxChars +
          ";" +
          "const overlap=" +
          overlap +
          ";" +
          "const model='" +
          model.replace(/"/g, "") +
          "';" +
          "const batchSize=" +
          batchSize +
          ";" +
          "const buildCmd=\"npx tsx -e \\\"(async () => {\\n\"+" +
          "\"  const fs = await import('node:fs');\\n\"+" +
          "\"  const path = await import('node:path');\\n\"+" +
          "\"  const { loadKnowledge } = await import('./lib/knowledge/loader');\\n\"+" +
          "\"  const cwd = process.cwd();\\n\"+" +
          "\"  const env = (process.env.HF_KB_PATH||'').trim();\\n\"+" +
          "\"  const root = env || path.resolve(cwd, '../../knowledge');\\n\"+" +
          "\"  const sourcesDir = path.join(root, 'sources');\\n\"+" +
          "\"  const derivedDir = path.join(root, 'derived');\\n\"+" +
          "\"  const pagesDir = path.join(derivedDir, 'pages');\\n\"+" +
          "\"  fs.mkdirSync(derivedDir, { recursive: true });\\n\"+" +
          "\"  const outPath = path.join(derivedDir, 'kb.jsonl');\\n\"+" +
          "\"  const stableId = (input) => { let h = 2166136261; for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };\\n\"+" +
          "\"  const chunkText = (text, max, over) => { const t = String(text || '').trim(); if (!t) return []; if (max <= 0) return [t]; const chunks = []; let i = 0; while (i < t.length) { const end = Math.min(t.length, i + max); let slice = t.slice(i, end); if (end < t.length) { const lastBreak = Math.max(slice.lastIndexOf('\\\\n\\\\n'), slice.lastIndexOf('\\\\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' ')); if (lastBreak > Math.floor(max * 0.6)) slice = slice.slice(0, lastBreak + 1).trimEnd(); } chunks.push(slice.trim()); if (end >= t.length) break; const advance = Math.max(1, slice.length - Math.max(0, over)); i += advance; } return chunks.filter(Boolean); };\\n\"+" +
          "\"  const { docs, chunks, fileCount } = await loadKnowledge({ kbRoot: sourcesDir, maxCharsPerChunk: \"+maxChars+\", overlapChars: \"+overlap+\" });\\n\"+" +
          "\"  let pageDocs = 0, pageChunks = 0;\\n\"+" +
          "\"  const lines = [];\\n\"+" +
          "\"  for (const c of chunks) { lines.push(JSON.stringify({ kind: 'chunk', id: c.id, docId: c.docId, sourcePath: c.sourcePath, title: c.title, index: c.index, text: c.text, meta: c.meta })); }\\n\"+" +
          "\"  if (fs.existsSync(pagesDir)) {\\n\"+" +
          "\"    for (const name of fs.readdirSync(pagesDir)) {\\n\"+" +
          "\"      if (!name.endsWith('.json')) continue;\\n\"+" +
          "\"      const abs = path.join(pagesDir, name);\\n\"+" +
          "\"      let payload = null;\\n\"+" +
          "\"      try { payload = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { continue; }\\n\"+" +
          "\"      if (!payload || payload.ok !== true || !payload.url || !payload.text) continue;\\n\"+" +
          "\"      pageDocs++;\\n\"+" +
          "\"      const docId = 'kbpage_' + stableId(String(payload.url));\\n\"+" +
          "\"      const pieces = chunkText(payload.text, \"+maxChars+\", \"+overlap+\");\\n\"+" +
          "\"      for (let i = 0; i < pieces.length; i++) {\\n\"+" +
          "\"        pageChunks++;\\n\"+" +
          "\"        const id = 'kbchunk_' + stableId(docId + ':' + i);\\n\"+" +
          "\"        lines.push(JSON.stringify({ kind: 'chunk', id, docId, sourcePath: '[link] ' + payload.url, title: payload.title || payload.url, index: i, text: pieces[i], meta: { url: payload.url, fetchedAt: payload.fetchedAt, contentType: payload.contentType, chunkIndex: i, totalChunks: pieces.length } }));\\n\"+" +
          "\"      }\\n\"+" +
          "\"    }\\n\"+" +
          "\"  }\\n\"+" +
          "\"  fs.writeFileSync(outPath, lines.join('\\\\n') + (lines.length ? '\\\\n' : ''));\\n\"+" +
          "\"  console.log(JSON.stringify({ ok: true, root, sourcesDir, derivedDir, outPath, sourceFileCount: fileCount, sourceDocs: docs.length, sourceChunks: chunks.length, pageDocs, pageChunks, totalChunks: chunks.length + pageChunks }, null, 2));\\n\"+" +
          "\"})().catch((e) => {\\n\"+" +
          "\"  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\\n\"+" +
          "\"  process.exitCode = 1;\\n\"+" +
          "\"});\\\"\";" +
          "const embedCmd=\"node -e \\\"" +
          "const fs=require('fs');const path=require('path');" +
          "const cwd=process.cwd();const env=(process.env.HF_KB_PATH||'').trim();" +
          "const root=env||path.resolve(cwd,'../../knowledge');" +
          "const derived=path.join(root,'derived');const vectors=path.join(root,'vectors');fs.mkdirSync(vectors,{recursive:true});" +
          "const inPath=path.join(derived,'kb.jsonl');" +
          "if(!fs.existsSync(inPath)){console.log(JSON.stringify({ok:false,error:'Missing derived/kb.jsonl. Run kb:build first.',inPath},null,2));process.exit(0);}" +
          "const outPath=path.join(vectors,'embeddings.jsonl');" +
          "const model='\"+model+\"';" +
          "const batchSize=\"+batchSize+\";" +
          "const key=process.env.OPENAI_API_KEY||'';" +
          "const lines=fs.readFileSync(inPath,'utf8').split(/\\\\r?\\\\n/).filter(Boolean);" +
          "const items=lines.map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);" +
          "const chunks=items.filter(x=>x.kind==='chunk'&&x.id&&x.text);" +
          "const out=[];" +
          "const embed=async(texts)=>{const res=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+key},body:JSON.stringify({model,input:texts})});if(!res.ok){const t=await res.text();throw new Error('Embeddings failed: '+res.status+' '+t.slice(0,300));}const json=await res.json();return (json.data||[]).map(d=>d.embedding);};" +
          "(async()=>{let wrote=0;" +
          "if(!key){for(const c of chunks){out.push(JSON.stringify({id:c.id,docId:c.docId,sourcePath:c.sourcePath,title:c.title,index:c.index,model,embedding:null,meta:{note:'OPENAI_API_KEY not set'}}));wrote++;}" +
          "fs.writeFileSync(outPath,out.join('\\\\n')+(out.length?'\\\\n':''));" +
          "console.log(JSON.stringify({ok:true,root,inPath,outPath,model,batchSize,wrote,embedded:false,reason:'OPENAI_API_KEY not set'},null,2));return;}" +
          "for(let i=0;i<chunks.length;i+=batchSize){const batch=chunks.slice(i,i+batchSize);const texts=batch.map(b=>String(b.text));const embs=await embed(texts);for(let j=0;j<batch.length;j++){const c=batch[j];out.push(JSON.stringify({id:c.id,docId:c.docId,sourcePath:c.sourcePath,title:c.title,index:c.index,model,embedding:embs[j],meta:c.meta||{}}));wrote++;}}" +
          "fs.writeFileSync(outPath,out.join('\\\\n')+(out.length?'\\\\n':''));" +
          "console.log(JSON.stringify({ok:true,root,inPath,outPath,model,batchSize,wrote,embedded:true},null,2));" +
          "})().catch(e=>{console.error(e&&e.stack||String(e));process.exitCode=1;});\\\"\";" +
          "run(buildCmd);" +
          "run(embedCmd);" +
          "console.log(JSON.stringify({ok:true,step:'kb:index',note:'Built derived/kb.jsonl and vectors/embeddings.jsonl (embedding is a no-op if OPENAI_API_KEY is unset).'},null,2));" +
          "\\\"\"",
      };
    },
  },

  // --- Ops index endpoints (used by the Ops UI tabs) ---

  "kb:index": {
    title: "Knowledge: index",
    description: "List Knowledge Base items (sources + derived) for the Ops UI",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/sources", "<kb>/derived"], writes: [] },
    buildCommand: (body) => {
      const limit = safeInt(body.limit, 200);
      return {
        cmd:
          "npx tsx -e \"(async () => {\n" +
          "  const fs = await import('node:fs');\n" +
          "  const path = await import('node:path');\n" +
          "  const cwd = process.cwd();\n" +
          "  const env = (process.env.HF_KB_PATH || '').trim();\n" +
          "  const kbRoot = env || path.resolve(cwd, '../../knowledge');\n" +
          "  const sourcesDir = path.join(kbRoot, 'sources');\n" +
          "  const derivedDir = path.join(kbRoot, 'derived');\n" +
          "  const limit = " +
          limit +
          ";\n" +
          "  const items = [];\n" +
          "  const pushFile = (kind, base, abs) => {\n" +
          "    if (items.length >= limit) return;\n" +
          "    let st; try { st = fs.statSync(abs); } catch { return; }\n" +
          "    if (!st || !st.isFile()) return;\n" +
          "    const rel = path.relative(base, abs).replace(/\\\\/g, '/');\n" +
          "    const title = rel.split('/').pop() || rel;\n" +
          "    items.push({\n" +
          "      id: kind + ':' + rel,\n" +
          "      kind,\n" +
          "      title,\n" +
          "      subtitle: rel,\n" +
          "      meta: { bytes: st.size, modifiedAt: st.mtime.toISOString(), abs, base }\n" +
          "    });\n" +
          "  };\n" +
          "  const walk = (kind, base, dir) => {\n" +
          "    if (items.length >= limit) return;\n" +
          "    if (!fs.existsSync(dir)) return;\n" +
          "    let ents = [];\n" +
          "    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }\n" +
          "    for (const it of ents) {\n" +
          "      if (items.length >= limit) break;\n" +
          "      const abs = path.join(dir, it.name);\n" +
          "      if (it.isDirectory()) walk(kind, base, abs);\n" +
          "      else if (it.isFile()) pushFile(kind, base, abs);\n" +
          "    }\n" +
          "  };\n" +
          "  walk('source', sourcesDir, sourcesDir);\n" +
          "  walk('derived', derivedDir, derivedDir);\n" +
          "  console.log(JSON.stringify({ ok: true, kbRoot, sourcesDir, derivedDir, count: items.length, items }, null, 2));\n" +
          "})().catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\"",
      };
    },
  },

  "snapshots:index": {
    title: "Snapshots: index",
    description: "List KB snapshots (currently: parameters snapshots) for the Ops UI",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/parameters/snapshots"], writes: [] },
    buildCommand: () => ({
      cmd:
        "npx tsx -e \"import('./lib/knowledge/parameters').then(async (m) => {\n" +
        "  const mod = (m && ((m as any).default ?? m)) as any;\n" +
        "  const root = (mod && typeof mod === 'object') ? mod : {};\n" +
        "  const fn = root.listParameterSnapshots || root.listParametersSnapshots || root.listSnapshots;\n" +
        "  if (typeof fn !== 'function') {\n" +
        "    const expKeys = m ? Object.keys(m as any) : [];\n" +
        "    const defKeys = (root && typeof root === 'object') ? Object.keys(root) : [];\n" +
        "    throw new Error('No compatible list snapshots function found in ./lib/knowledge/parameters. Exports: ' + expKeys.join(', ') + ' | default keys: ' + defKeys.join(', '));\n" +
        "  }\n" +
        "  const snaps = await fn();\n" +
        "  const items = (snaps || []).map((s) => ({\n" +
        "    id: 'snapshot:' + (s.id || s.snapshotId || s.name || ''),\n" +
        "    title: s.name || s.id || s.snapshotId || 'snapshot',\n" +
        "    subtitle: s.createdAt ? new Date(s.createdAt).toISOString() : (s.path || ''),\n" +
        "    meta: s\n" +
        "  }));\n" +
        "  console.log(JSON.stringify({ ok: true, kind: 'parameters', count: items.length, items }, null, 2));\n" +
        "}).catch((e) => {\n" +
        "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
        "  process.exitCode = 1;\n" +
        "});\""
    }),
  },

  "analysis:ensure-active-tags": {
    title: "Ensure Active tag links",
    description: "Create Active tag and link it to all Parameters if missing",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["Tag", "Parameter"], writes: ["Tag", "ParameterTag"] },
    buildCommand: () => ({ cmd: "npx tsx prisma/ops/ensure-active-tags.ts" }),
  },
  "analysis:snapshot:active": {
    title: "Snapshot: Active parameters",
    description: "Creates a ParameterSet from all parameters tagged Active",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["Parameter", "Tag", "ParameterTag"], writes: ["ParameterSet", "ParameterSetParameter"], creates: ["ParameterSet"] },
    buildCommand: () => ({ cmd: "npx tsx prisma/seed-analysis.ts" }),
  },
  "analysis:inspect:sets": {
    title: "Inspect: ParameterSets",
    description: "Lists recent ParameterSets with counts",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["AnalysisProfile", "AnalysisProfileParameter"] },
    buildCommand: () => ({
      cmd:
        "node -e \"const {PrismaClient}=require('\\@prisma/client');(async()=>{const prisma=new PrismaClient();try{const sets=await prisma.analysisProfile.findMany({take:50,orderBy:{createdAt:'desc'},select:{id:true,name:true,createdAt:true}});const ids=sets.map(s=>s.id);const counts=ids.length?await prisma.analysisProfileParameter.groupBy({by:['analysisProfileId'],where:{analysisProfileId:{in:ids}},_count:{_all:true}}):[];const m=new Map(counts.map(c=>[c.analysisProfileId,c._count._all]));const out={ok:true,profiles:sets.map(s=>({id:s.id,name:s.name,createdAt:s.createdAt,params:m.get(s.id)||0}))};console.log(JSON.stringify(out,null,2));}catch(e){console.error(e);process.exitCode=1;}finally{await prisma.\\$disconnect();}})();\"",
    }),
  },
  "analysis:read:profile": {
    title: "Read: AnalysisProfile",
    description: "Fetch a single AnalysisProfile plus its linked parameters",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["AnalysisProfile", "AnalysisProfileParameter", "Parameter"] },
    buildCommand: (body) => {
      const id = safeId((body as any).id) || safeId((body as any).analysisProfileId) || safeId((body as any).parameterSetId);
      // Embed the id into the node script (safeId prevents injection).
      const idLit = id ? id : "";
      return {
        cmd:
          "node -e \"const {PrismaClient}=require('\\@prisma/client');(async()=>{const prisma=new PrismaClient();const id='" +
          idLit +
          "';try{if(!id){console.log(JSON.stringify({ok:false,error:'Missing id (send {id} or {analysisProfileId})'},null,2));return;}const profile=await prisma.analysisProfile.findUnique({where:{id},select:{id:true,name:true,createdAt:true}});if(!profile){console.log(JSON.stringify({ok:false,error:'Not found',id},null,2));return;}const links=await prisma.analysisProfileParameter.findMany({where:{analysisProfileId:id}});const ids=Array.from(new Set((links||[]).map((x)=>x.parameterId).filter(Boolean)));let parameters=[];if(ids.length){try{parameters=await prisma.parameter.findMany({where:{id:{in:ids}}});}catch(e){parameters=[];}}// Preserve a sensible display order: follow link order first, then append any missing.\nconst order=new Map();(links||[]).forEach((l,i)=>{if(l&&l.parameterId&&!order.has(l.parameterId))order.set(l.parameterId,i);});parameters=(parameters||[]).slice().sort((a,b)=>{const ai=order.has(a.id)?order.get(a.id):Number.MAX_SAFE_INTEGER;const bi=order.has(b.id)?order.get(b.id):Number.MAX_SAFE_INTEGER;return ai-bi;});console.log(JSON.stringify({ok:true,profile,links,parameters},null,2));}catch(e){console.error(e);process.exitCode=1;}finally{await prisma.\\$disconnect();}})();\"",
      };
    },
  },

  // --- Knowledge cockpit (local KB folder → derived docs → vectors) ---

  // --- Parameters (versioned CSV snapshots) ---

  "kb:parameters:snapshots:list": {
    title: "Parameters: list snapshots",
    description: "List versioned Parameters.csv snapshots (filesystem-based)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/parameters/snapshots"], writes: [] },
    buildCommand: () => ({
      cmd:
        "npx tsx -e \"import('./lib/knowledge/parameters').then(async (m) => {\n" +
        "  const mod = (m && ((m as any).default ?? m)) as any;\n" +
        "  const root = (mod && typeof mod === 'object') ? mod : {};\n" +
        "  const fn = root.listParameterSnapshots || root.listParametersSnapshots || root.listSnapshots;\n" +
        "  if (typeof fn !== 'function') {\n" +
        "    const expKeys = m ? Object.keys(m as any) : [];\n" +
        "    const defKeys = (root && typeof root === 'object') ? Object.keys(root) : [];\n" +
        "    throw new Error('No compatible list snapshots function found in ./lib/knowledge/parameters. Exports: ' + expKeys.join(', ') + ' | default keys: ' + defKeys.join(', '));\n" +
        "  }\n" +
        "  const snaps = await fn();\n" +
        "  console.log(JSON.stringify({ ok: true, count: (snaps||[]).length, snapshots: snaps }, null, 2));\n" +
        "}).catch((e) => {\n" +
        "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
        "  process.exitCode = 1;\n" +
        "});\""
    }),
  },
  "kb:snapshots:list": {
    title: "KB snapshots",
    description: "List available KB snapshots (currently: parameters CSV snapshots)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/parameters/snapshots"], writes: [] },
    buildCommand: () => ({
      cmd:
        "npx tsx -e \"import('./lib/knowledge/parameters').then(async (m) => {\n" +
        "  const mod = (m && ((m as any).default ?? m)) as any;\n" +
        "  const root = (mod && typeof mod === 'object') ? mod : {};\n" +
        "  const fn = root.listParameterSnapshots || root.listParametersSnapshots || root.listSnapshots;\n" +
        "  if (typeof fn !== 'function') {\n" +
        "    const expKeys = m ? Object.keys(m as any) : [];\n" +
        "    const defKeys = (root && typeof root === 'object') ? Object.keys(root) : [];\n" +
        "    throw new Error('No compatible list snapshots function found in ./lib/knowledge/parameters. Exports: ' + expKeys.join(', ') + ' | default keys: ' + defKeys.join(', '));\n" +
        "  }\n" +
        "  const snaps = await fn();\n" +
        "  console.log(JSON.stringify({ ok: true, kind: 'parameters', count: (snaps||[]).length, snapshots: snaps }, null, 2));\n" +
        "}).catch((e) => {\n" +
        "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
        "  process.exitCode = 1;\n" +
        "});\""
    }),
  },

  "kb:parameters:import": {
    title: "Parameters: import snapshot",
    description: "Snapshot Parameters.csv (raw → immutable snapshot + manifest)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["HF_KB_PATH", "<kb>/parameters/raw/parameters.csv"],
      writes: ["<kb>/parameters/snapshots"],
      creates: ["<kb>/parameters/snapshots/<snapshotId>/*"],
    },
    buildCommand: (body) => {
      const force = asBool(body.force, false);
      return {
        cmd:
          "npx tsx -e \"import('./lib/knowledge/parameters').then(async (m) => {\n" +
          "  const ns = (m || {}) as any;\n" +
          "  const d1 = ns?.default;\n" +
          "  const d2 = d1?.default;\n" +
          "  const force = " + (force ? "true" : "false") + ";\n" +
          "\n" +
          "  const candidates: Array<[string, any]> = [\n" +
          "    ['ns.importParametersSnapshot', ns.importParametersSnapshot],\n" +
          "    ['ns.importParametersSnapshots', ns.importParametersSnapshots],\n" +
          "    ['ns.importParametersSnapshotFromCsv', ns.importParametersSnapshotFromCsv],\n" +
          "    ['ns.default.importParametersSnapshot', d1?.importParametersSnapshot],\n" +
          "    ['ns.default.importParametersSnapshots', d1?.importParametersSnapshots],\n" +
          "    ['ns.default.importParametersSnapshotFromCsv', d1?.importParametersSnapshotFromCsv],\n" +
          "    ['ns.default.default.importParametersSnapshot', d2?.importParametersSnapshot],\n" +
          "    ['ns.default.default.importParametersSnapshots', d2?.importParametersSnapshots],\n" +
          "    ['ns.default.default.importParametersSnapshotFromCsv', d2?.importParametersSnapshotFromCsv],\n" +
          "  ];\n" +
          "\n" +
          "  const diag = {\n" +
          "    exports: ns ? Object.keys(ns) : [],\n" +
          "    defaultKeys: d1 && typeof d1 === 'object' ? Object.keys(d1) : [],\n" +
          "    defaultDefaultKeys: d2 && typeof d2 === 'object' ? Object.keys(d2) : [],\n" +
          "    types: Object.fromEntries(candidates.map(([k, v]) => [k, typeof v])),\n" +
          "    sample: {\n" +
          "      d1_importParametersSnapshot: d1?.importParametersSnapshot,\n" +
          "      d2_importParametersSnapshot: d2?.importParametersSnapshot,\n" +
          "    }\n" +
          "  };\n" +
          "  console.log(JSON.stringify({ ok: true, phase: 'diagnostic', force, diag }, null, 2));\n" +
          "\n" +
          "  const hit = candidates.find(([, v]) => typeof v === 'function');\n" +
          "  const fn = hit ? hit[1] : null;\n" +
          "  if (typeof fn !== 'function') {\n" +
          "    throw new Error('No compatible import function found in ./lib/knowledge/parameters. ' +\n" +
          "      'exports=' + (diag.exports||[]).join(',') + ' ' +\n" +
          "      'defaultKeys=' + (diag.defaultKeys||[]).join(',') + ' ' +\n" +
          "      'defaultDefaultKeys=' + (diag.defaultDefaultKeys||[]).join(','));\n" +
          "  }\n" +
          "\n" +
          "  const res = await (fn as any)({ force });\n" +
          "  console.log(JSON.stringify({ ok: true, picked: hit ? hit[0] : null, snapshot: res }, null, 2));\n" +
          "}).catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\"",
      };
    },
  },
  "transcripts:raw:list": {
    title: "Transcripts: list raw",
    description: "List transcript JSON files in <kb>/transcripts/raw with basic metadata and sha256",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/transcripts/raw"], writes: [] },
    buildCommand: (body) => {
      const limit = safeInt(body.limit, 200);
      return {
        cmd:
          "node -e \"" +
          "const fs=require('fs');" +
          "const path=require('path');" +
          "const crypto=require('crypto');" +
          "const cwd=process.cwd();" +
          "const env=(process.env.HF_KB_PATH||'').trim();" +
          "const kbRoot=env||path.resolve(cwd,'../../knowledge');" +
          "const dir=path.join(kbRoot,'transcripts','raw');" +
          "const limit=" +
          limit +
          ";" +
          "const sha256=(p)=>{try{const b=fs.readFileSync(p);return crypto.createHash('sha256').update(b).digest('hex');}catch{return null}};" +
          "let items=[];" +
          "try{if(!fs.existsSync(dir)){console.log(JSON.stringify({ok:true,dir,exists:false,count:0,items:[]},null,2));process.exit(0);}" +
          "const names=fs.readdirSync(dir).filter(n=>n.toLowerCase().endsWith('.json')).sort();" +
          "for(const name of names){if(items.length>=limit) break;const abs=path.join(dir,name);let st=null;try{st=fs.statSync(abs);}catch{continue;}" +
          "items.push({name,abs,bytes:st.size,modifiedAt:st.mtime.toISOString(),sha256:sha256(abs)});}" +
          "}catch(e){console.log(JSON.stringify({ok:false,dir,error:String(e&&e.message||e)},null,2));process.exitCode=1;return;}" +
          "console.log(JSON.stringify({ok:true,dir,exists:true,count:items.length,items},null,2));" +
          "\"",
      };
    },
  },

  "transcripts:process": {
    title: "Transcripts: process",
    description: "Extract calls from raw transcript JSON files into database with hash-based deduplication",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["HF_KB_PATH", "<kb>/transcripts/raw"],
      writes: ["ProcessedFile", "TranscriptBatch", "User"],
      creates: ["ProcessedFile records", "TranscriptBatch records", "User records"]
    },
    buildCommand: (body) => {
      const autoDetectType = asBool(body.autoDetectType, true);
      const createUsers = asBool(body.createUsers, true);
      const createBatches = asBool(body.createBatches, true);
      const filepath = typeof body.filepath === "string" ? body.filepath.trim() : "";

      return {
        cmd:
          "npx tsx -e \"import('./lib/ops/transcripts-process').then(async (m) => {\n" +
          "  const fn = (m && (m.processTranscripts || (m as any).default?.processTranscripts));\n" +
          "  if (typeof fn !== 'function') {\n" +
          "    throw new Error('processTranscripts function not found in ./lib/ops/transcripts-process');\n" +
          "  }\n" +
          "  const options = {\n" +
          "    autoDetectType: " + autoDetectType + ",\n" +
          "    createUsers: " + createUsers + ",\n" +
          "    createBatches: " + createBatches + ",\n" +
          (filepath ? "    filepath: '" + filepath.replace(/'/g, "\\'") + "',\n" : "") +
          "  };\n" +
          "  const result = await fn(options);\n" +
          "  console.log(JSON.stringify({ ok: result.success, result }, null, 2));\n" +
          "  if (!result.success) process.exitCode = 1;\n" +
          "}).catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\""
      };
    },
  },

  "personality:analyze": {
    title: "Personality: analyze",
    description: "Extract personality traits from call transcripts using knowledge bank parameters as scoring rubric. Creates time-series PersonalityObservation records with decay-based aggregation.",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["Parameter", "Call", "User"],
      writes: ["PersonalityObservation", "UserPersonality"],
      creates: ["PersonalityObservation records", "UserPersonality records"]
    },
    buildCommand: (body) => {
      const callId = typeof body.callId === "string" ? body.callId.trim() : "";
      const aggregate = asBool(body.aggregate, true);
      const halfLifeDays = safeInt(body.halfLifeDays, 30);
      const verbose = asBool(body.verbose, false);
      const plan = asBool(body.plan, false);

      return {
        cmd:
          "npx tsx -e \"import('./lib/ops/personality-analyze').then(async (m) => {\n" +
          "  const fn = (m && (m.analyzePersonality || (m as any).default?.analyzePersonality));\n" +
          "  if (typeof fn !== 'function') {\n" +
          "    throw new Error('analyzePersonality function not found in ./lib/ops/personality-analyze');\n" +
          "  }\n" +
          "  const options = {\n" +
          (callId ? "    callId: '" + callId.replace(/'/g, "\\'") + "',\n" : "") +
          "    aggregate: " + aggregate + ",\n" +
          "    halfLifeDays: " + halfLifeDays + ",\n" +
          "    verbose: " + verbose + ",\n" +
          "    plan: " + plan + ",\n" +
          "  };\n" +
          "  const result = await fn(options);\n" +
          "  console.log(JSON.stringify({ ok: result.errors.length === 0, result }, null, 2));\n" +
          "  if (result.errors.length > 0) process.exitCode = 1;\n" +
          "}).catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\""
      };
    },
  },

  "memory:extract": {
    title: "Memory: extract",
    description: "Extract structured memories (facts, preferences, events, topics, relationships, context) from call transcripts. Handles key normalization and contradiction resolution.",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["Call", "User", "UserMemory"],
      writes: ["UserMemory", "UserMemorySummary"],
      creates: ["UserMemory records", "UserMemorySummary records"]
    },
    buildCommand: (body) => {
      const callId = typeof body.callId === "string" ? body.callId.trim() : "";
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      const limit = safeInt(body.limit, 100);
      const aggregate = asBool(body.aggregate, true);
      const confidenceThreshold = typeof body.confidenceThreshold === "number" ? body.confidenceThreshold : 0.5;
      const verbose = asBool(body.verbose, false);
      const plan = asBool(body.plan, false);

      return {
        cmd:
          "npx tsx -e \"import('./lib/ops/memory-extract').then(async (m) => {\n" +
          "  const fn = (m && (m.extractMemories || (m as any).default?.extractMemories));\n" +
          "  if (typeof fn !== 'function') {\n" +
          "    throw new Error('extractMemories function not found in ./lib/ops/memory-extract');\n" +
          "  }\n" +
          "  const options = {\n" +
          (callId ? "    callId: '" + callId.replace(/'/g, "\\'") + "',\n" : "") +
          (userId ? "    userId: '" + userId.replace(/'/g, "\\'") + "',\n" : "") +
          "    limit: " + limit + ",\n" +
          "    aggregate: " + aggregate + ",\n" +
          "    confidenceThreshold: " + confidenceThreshold + ",\n" +
          "    verbose: " + verbose + ",\n" +
          "    plan: " + plan + ",\n" +
          "  };\n" +
          "  const result = await fn(options);\n" +
          "  console.log(JSON.stringify({ ok: result.errors.length === 0, result }, null, 2));\n" +
          "  if (result.errors.length > 0) process.exitCode = 1;\n" +
          "}).catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\""
      };
    },
  },

  "knowledge:ingest": {
    title: "Knowledge: ingest",
    description: "Ingest knowledge documents (PDFs, markdown, text) with hash-based deduplication and resumable chunking",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: {
      reads: ["HF_KB_PATH/sources/knowledge"],
      writes: ["KnowledgeDoc", "KnowledgeChunk"],
      creates: ["KnowledgeDoc records", "KnowledgeChunk records"]
    },
    buildCommand: (body) => {
      const maxDocuments = safeInt(body.maxDocuments, 0); // 0 = unlimited
      const maxCharsPerChunk = safeInt(body.maxCharsPerChunk, 1500);
      const overlapChars = safeInt(body.overlapChars, 200);
      const forceReprocess = asBool(body.forceReprocess, false);
      const resumePartial = asBool(body.resumePartial, true);
      const verbose = asBool(body.verbose, false);
      const quiet = asBool(body.quiet, false);
      const plan = asBool(body.plan, false);
      const skipPdfs = asBool(body.skipPdfs, false);
      const maxPdfSizeMB = safeInt(body.maxPdfSizeMB, 100);
      // Memory limit in MB (default 512MB for background runs)
      const maxMemoryMB = safeInt(body.maxMemoryMB, 512);

      return {
        cmd:
          `node --max-old-space-size=${maxMemoryMB} -e "import('./lib/ops/knowledge-ingest.ts').then(async (m) => {\n` +
          "  const fn = (m && (m.ingestKnowledge || (m as any).default?.ingestKnowledge));\n" +
          "  if (typeof fn !== 'function') {\n" +
          "    throw new Error('ingestKnowledge function not found in ./lib/ops/knowledge-ingest');\n" +
          "  }\n" +
          "  const options = {\n" +
          "    maxDocuments: " + maxDocuments + ",\n" +
          "    maxCharsPerChunk: " + maxCharsPerChunk + ",\n" +
          "    overlapChars: " + overlapChars + ",\n" +
          "    forceReprocess: " + forceReprocess + ",\n" +
          "    resumePartial: " + resumePartial + ",\n" +
          "    verbose: " + verbose + ",\n" +
          "    quiet: " + quiet + ",\n" +
          "    plan: " + plan + ",\n" +
          "    skipPdfs: " + skipPdfs + ",\n" +
          "    maxPdfSizeMB: " + maxPdfSizeMB + ",\n" +
          "  };\n" +
          "  const result = await fn(options);\n" +
          "  console.log(JSON.stringify({ ok: result.errors.length === 0, result }, null, 2));\n" +
          "  if (result.errors.length > 0) process.exitCode = 1;\n" +
          "}).catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          '});" --experimental-strip-types'
      };
    },
  },

  "kb:status": {
    title: "KB status",
    description: "Summarise KB sources + derived artifacts (local-only)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH"], writes: [] },
    buildCommand: () => ({
      cmd:
        "node -e \"const fs=require('fs');const path=require('path');const root=(process.env.HF_KB_PATH||'').trim()||path.resolve(process.cwd(),'../../knowledge');const ex=(p)=>{try{return fs.existsSync(p)}catch{return false}};const statDir=(p)=>{try{const items=fs.readdirSync(p,{withFileTypes:true});let files=0,dirs=0;for(const it of items){if(it.isDirectory())dirs++;else if(it.isFile())files++;}return {exists:true,files,dirs};}catch(e){return {exists:false,files:0,dirs:0,error:String(e&&e.message||e)}};};const sources=path.join(root,'sources');const derived=path.join(root,'derived');const vectors=path.join(root,'vectors');const out={ok:true,root,paths:{sources,derived,vectors},sources:statDir(sources),derived:statDir(derived),vectors:statDir(vectors),hint:'Set HF_KB_PATH to point at your KB root. Suggested structure: <kb>/sources, <kb>/derived, <kb>/vectors.'};console.log(JSON.stringify(out,null,2));\"",
    }),
  },

  "kb:sources:list": {
    title: "KB list sources",
    description: "List files under <kb>/sources (optionally filter by extension)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/sources"], writes: [] },
    buildCommand: (body) => {
      const ext = typeof body.ext === "string" ? body.ext.trim().toLowerCase() : "";
      const limit = safeInt(body.limit, 200);
      const safeExt = ext && /^[a-z0-9]+$/.test(ext) ? ext : "";
      return {
        cmd:
          "node -e \"const fs=require('fs');const path=require('path');const root=(process.env.HF_KB_PATH||'').trim()||path.resolve(process.cwd(),'../../knowledge');const dir=path.join(root,'sources');const ext='" +
          safeExt +
          "';const limit=" +
          limit +
          ";const walk=(d,out)=>{try{for(const it of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,it.name);if(it.isDirectory())walk(p,out);else if(it.isFile()){if(!ext||p.toLowerCase().endsWith('.'+ext))out.push(p);if(out.length>=limit)return;}}}catch(e){/*ignore*/}};const files=[];walk(dir,files);console.log(JSON.stringify({ok:true,dir,ext:ext||null,count:files.length,files},null,2));\"",
      };
    },
  },

  "kb:links:extract": {
    title: "KB extract links",
    description: "Extract URLs found in source docs (placeholder; no fetch)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: ["HF_KB_PATH", "<kb>/sources"], writes: ["<kb>/derived"], creates: ["<kb>/derived/links.json"] },
    buildCommand: (body) => {
      const dryRun = asBool(body.dryRun, false);
      return {
        cmd: `npx tsx lib/ops/kb-links-extract.ts${dryRun ? " --dry-run" : ""}`,
      };
    },
  },

  "kb:links:scrape": {
    title: "KB scrape links (one-time)",
    description: "Fetch + store readable text for new URLs (TODO: implement)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["<kb>/derived/links.json"], writes: ["<kb>/derived"], creates: ["<kb>/derived/pages/*"] },
    buildCommand: (body) => {
      const limit = safeInt(body.limit, 50);
      return {
        cmd:
          "node -e \"const fs=require('fs');const path=require('path');\nconst cwd=process.cwd();const env=(process.env.HF_KB_PATH||'').trim();const root=env||path.resolve(cwd,'../../knowledge');\nconst derived=path.join(root,'derived');\nconst pagesDir=path.join(derived,'pages');\nfs.mkdirSync(pagesDir,{recursive:true});\nconst linksPath=path.join(derived,'links.json');\nif(!fs.existsSync(linksPath)){console.log(JSON.stringify({ok:false,error:'Missing links.json. Run kb:links:extract first.',linksPath},null,2));process.exit(0);} \nconst links=JSON.parse(fs.readFileSync(linksPath,'utf8'));\nconst linksByFile=links.linksByFile||{};\nconst urls=Array.from(new Set(Object.values(linksByFile).flat()));\nconst limit=" +
          limit +
          ";\nconst sanitize=(u)=>u.replace(/[^a-zA-Z0-9]/g,'_').slice(0,120);\nconst strip=(html)=>String(html||'').replace(/<script[\\s\\S]*?<\\/script>/gi,' ').replace(/<style[\\s\\S]*?<\\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim();\n(async()=>{\nlet fetched=0,skipped=0,failed=0;\nfor(const url of urls){\n  if(fetched>=limit) break;\n  const id=sanitize(url);\n  const out=path.join(pagesDir,id+'.json');\n  if(fs.existsSync(out)){skipped++;continue;}\n  try{\n    const res=await fetch(url,{redirect:'follow',headers:{'user-agent':'HF-KB-Scraper/1.0'}});\n    const ct=(res.headers.get('content-type')||'').toLowerCase();\n    const body=await res.text();\n    const text=ct.includes('text/html')?strip(body):body;\n    const payload={ok:true,url,fetchedAt:new Date().toISOString(),contentType:ct,status:res.status,title:null,text};\n    fs.writeFileSync(out,JSON.stringify(payload,null,2));\n    fetched++;\n  }catch(e){\n    failed++;\n    const payload={ok:false,url,fetchedAt:new Date().toISOString(),error:String(e&&e.message||e)};\n    fs.writeFileSync(out,JSON.stringify(payload,null,2));\n  }\n}\nconsole.log(JSON.stringify({ok:true,root,derived,pagesDir,totalUrls:urls.length,limit,fetched,skipped,failed},null,2));\n})();\"",
      };
    },
  },

  "kb:build": {
    title: "KB build",
    description: "Build KB artifacts from sources + scraped pages (TODO: implement)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["<kb>/sources", "<kb>/derived"], writes: ["<kb>/derived"], creates: ["<kb>/derived/kb.jsonl"] },
    buildCommand: (body) => {
      const maxChars = typeof body.maxCharsPerChunk === "number" ? body.maxCharsPerChunk : 1800;
      const overlap = typeof body.overlapChars === "number" ? body.overlapChars : 200;
      return {
        cmd:
          "npx tsx -e \"(async () => {\n" +
          "  const fs = await import('node:fs');\n" +
          "  const path = await import('node:path');\n" +
          "  const { loadKnowledge } = await import('./lib/knowledge/loader');\n" +
          "  const cwd = process.cwd(); const env = (process.env.HF_KB_PATH||'').trim(); const root = env || path.resolve(cwd, '../../knowledge');\n" +
          "  const sourcesDir = path.join(root, 'sources');\n" +
          "  const derivedDir = path.join(root, 'derived');\n" +
          "  const pagesDir = path.join(derivedDir, 'pages');\n" +
          "  fs.mkdirSync(derivedDir, { recursive: true });\n" +
          "  const outPath = path.join(derivedDir, 'kb.jsonl');\n" +
          "  const stableId = (input) => { let h = 2166136261; for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };\n" +
          "  const chunkText = (text, max, over) => { const t = String(text || '').trim(); if (!t) return []; if (max <= 0) return [t]; const chunks = []; let i = 0; while (i < t.length) { const end = Math.min(t.length, i + max); let slice = t.slice(i, end); if (end < t.length) { const lastBreak = Math.max(slice.lastIndexOf('\\n\\n'), slice.lastIndexOf('\\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' ')); if (lastBreak > Math.floor(max * 0.6)) slice = slice.slice(0, lastBreak + 1).trimEnd(); } chunks.push(slice.trim()); if (end >= t.length) break; const advance = Math.max(1, slice.length - Math.max(0, over)); i += advance; } return chunks.filter(Boolean); };\n" +
          "  const { docs, chunks, fileCount } = await loadKnowledge({ kbRoot: sourcesDir, maxCharsPerChunk:" +
          maxChars +
          ", overlapChars:" +
          overlap +
          " });\n" +
          "  let pageDocs = 0, pageChunks = 0;\n" +
          "  const lines = [];\n" +
          "  for (const c of chunks) { lines.push(JSON.stringify({ kind: 'chunk', id: c.id, docId: c.docId, sourcePath: c.sourcePath, title: c.title, index: c.index, text: c.text, meta: c.meta })); }\n" +
          "  if (fs.existsSync(pagesDir)) {\n" +
          "    for (const name of fs.readdirSync(pagesDir)) {\n" +
          "      if (!name.endsWith('.json')) continue;\n" +
          "      const abs = path.join(pagesDir, name);\n" +
          "      let payload = null;\n" +
          "      try { payload = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { continue; }\n" +
          "      if (!payload || payload.ok !== true || !payload.url || !payload.text) continue;\n" +
          "      pageDocs++;\n" +
          "      const docId = 'kbpage_' + stableId(String(payload.url));\n" +
          "      const pieces = chunkText(payload.text," +
          maxChars +
          "," +
          overlap +
          ");\n" +
          "      for (let i = 0; i < pieces.length; i++) {\n" +
          "        pageChunks++;\n" +
          "        const id = 'kbchunk_' + stableId(docId + ':' + i);\n" +
          "        lines.push(JSON.stringify({ kind: 'chunk', id, docId, sourcePath: '[link] ' + payload.url, title: payload.title || payload.url, index: i, text: pieces[i], meta: { url: payload.url, fetchedAt: payload.fetchedAt, contentType: payload.contentType, chunkIndex: i, totalChunks: pieces.length } }));\n" +
          "      }\n" +
          "    }\n" +
          "  }\n" +
          "  fs.writeFileSync(outPath, lines.join('\\n') + (lines.length ? '\\n' : ''));\n" +
          "  console.log(JSON.stringify({ ok: true, root, sourcesDir, derivedDir, outPath, sourceFileCount: fileCount, sourceDocs: docs.length, sourceChunks: chunks.length, pageDocs, pageChunks, totalChunks: chunks.length + pageChunks }, null, 2));\n" +
          "})().catch((e) => {\n" +
          "  console.error(e && (e.stack || e.message) ? (e.stack || e.message) : String(e));\n" +
          "  process.exitCode = 1;\n" +
          "});\"",
      };
    },
  },

  "kb:vectors:build": {
    title: "KB vectors",
    description: "Create/update embeddings for KB chunks (TODO: implement)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "mutates",
    effects: { reads: ["<kb>/derived/kb.jsonl"], writes: ["<kb>/vectors"], creates: ["<kb>/vectors/index/*"] },
    buildCommand: (body) => {
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : "text-embedding-3-small";
      const batchSize = safeInt(body.batchSize, 64);
      return {
        cmd:
          "node -e \"const fs=require('fs');const path=require('path');\nconst cwd=process.cwd();const env=(process.env.HF_KB_PATH||'').trim();const root=env||path.resolve(cwd,'../../knowledge');\nconst derived=path.join(root,'derived');\nconst vectors=path.join(root,'vectors');\nfs.mkdirSync(vectors,{recursive:true});\nconst inPath=path.join(derived,'kb.jsonl');\nif(!fs.existsSync(inPath)){console.log(JSON.stringify({ok:false,error:'Missing derived/kb.jsonl. Run kb:build first.',inPath},null,2));process.exit(0);} \nconst outPath=path.join(vectors,'embeddings.jsonl');\nconst model='" +
          model.replace(/"/g, "") +
          "';\nconst batchSize=" +
          batchSize +
          ";\nconst key=process.env.OPENAI_API_KEY||'';\nconst lines=fs.readFileSync(inPath,'utf8').split(/\\r?\\n/).filter(Boolean);\nconst items=lines.map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);\nconst chunks=items.filter(x=>x.kind==='chunk'&&x.id&&x.text);\nconst out=[];\nconst embed=async(texts)=>{\n  const res=await fetch('https://api.openai.com/v1/embeddings',{\n    method:'POST',\n    headers:{'content-type':'application/json','authorization':'Bearer '+key},\n    body:JSON.stringify({model,input:texts})\n  });\n  if(!res.ok){const t=await res.text();throw new Error('Embeddings failed: '+res.status+' '+t.slice(0,300));}\n  const json=await res.json();\n  return (json.data||[]).map(d=>d.embedding);\n};\n(async()=>{\n  let wrote=0;\n  if(!key){\n    for(const c of chunks){\n      out.push(JSON.stringify({id:c.id,docId:c.docId,sourcePath:c.sourcePath,title:c.title,index:c.index,model,embedding:null,meta:{note:'OPENAI_API_KEY not set'}}));\n      wrote++;\n    }\n    fs.writeFileSync(outPath,out.join('\\n')+(out.length?'\\n':''));\n    console.log(JSON.stringify({ok:true,root,inPath,outPath,model,batchSize,wrote,embedded:false,reason:'OPENAI_API_KEY not set'},null,2));\n    return;\n  }\n  for(let i=0;i<chunks.length;i+=batchSize){\n    const batch=chunks.slice(i,i+batchSize);\n    const texts=batch.map(b=>String(b.text));\n    const embs=await embed(texts);\n    for(let j=0;j<batch.length;j++){\n      const c=batch[j];\n      out.push(JSON.stringify({id:c.id,docId:c.docId,sourcePath:c.sourcePath,title:c.title,index:c.index,model,embedding:embs[j],meta:c.meta||{}}));\n      wrote++;\n    }\n  }\n  fs.writeFileSync(outPath,out.join('\\n')+(out.length?'\\n':''));\n  console.log(JSON.stringify({ok:true,root,inPath,outPath,model,batchSize,wrote,embedded:true},null,2));\n})().catch(e=>{\n  console.error(e&&e.stack||String(e));\n  process.exitCode=1;\n});\"",
      };
    },
  },

  "kb:git:diff": {
    title: "KB diff (git)",
    description: "Show git diff for KB folder (default lib/knowledge/kb)",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "safe",
    effects: { reads: [".git", "HF_KB_PATH"], writes: [] },
    buildCommand: () => ({
      cmd:
        "node -e \"const {execSync}=require('child_process');const path=require('path');const cwd=process.cwd();const env=(process.env.HF_KB_PATH||'').trim();const root=env||path.resolve(cwd,'../../knowledge');try{const out=execSync('git diff -- '+root,{stdio:['ignore','pipe','pipe']});process.stdout.write(out);}catch(e){process.stdout.write((e&&e.stdout)||'');process.stderr.write((e&&e.stderr)||String(e&&e.message||e));process.exitCode=1;}\"",
    }),
  },

  "kb:git:revert": {
    title: "KB revert (git)",
    description: "Revert KB folder to HEAD (destructive). Use with care.",
    supportsPlan: true,
    supportsVerbose: true,
    risk: "destructive",
    effects: { reads: [".git", "HF_KB_PATH"], writes: ["HF_KB_PATH"], deletes: ["uncommitted KB changes"] },
    buildCommand: () => ({
      cmd:
        "node -e \"const {execSync}=require('child_process');const path=require('path');const cwd=process.cwd();const env=(process.env.HF_KB_PATH||'').trim();const root=env||path.resolve(cwd,'../../knowledge');try{execSync('git checkout -- '+root,{stdio:'inherit'});console.log('OK: reverted '+root);}catch(e){process.stderr.write(String(e&&e.message||e));process.exitCode=1;}\"",
    }),
  },

  // --- Service Control Operations ---

  "service:status": {
    title: "Dev Environment: status",
    description: "Check status of Docker, PostgreSQL, and HF_KB_PATH",
    supportsPlan: false,
    supportsVerbose: false,
    risk: "safe",
    effects: { reads: ["Docker", "PostgreSQL", "HF_KB_PATH"] },
    buildCommand: () => ({
      cmd: "./scripts/dev-start.sh status",
    }),
  },

  "service:start": {
    title: "Dev Environment: start (Colima)",
    description: "Start Colima + PostgreSQL container (lightweight)",
    supportsPlan: true,
    supportsVerbose: false,
    risk: "mutates",
    effects: { reads: ["Colima", "Docker"], writes: ["Colima state", "PostgreSQL container"] },
    buildCommand: () => ({
      cmd: "./scripts/dev-start.sh colima",
    }),
  },

  "service:start:docker": {
    title: "Dev Environment: start (Docker Desktop)",
    description: "Start Docker Desktop + PostgreSQL container",
    supportsPlan: true,
    supportsVerbose: false,
    risk: "mutates",
    effects: { reads: ["Docker Desktop"], writes: ["Docker Desktop state", "PostgreSQL container"] },
    buildCommand: () => ({
      cmd: "./scripts/dev-start.sh docker",
    }),
  },

  "service:stop": {
    title: "Dev Environment: stop",
    description: "Stop PostgreSQL container and Colima",
    supportsPlan: true,
    supportsVerbose: false,
    risk: "mutates",
    effects: { writes: ["PostgreSQL container", "Colima state"] },
    buildCommand: () => ({
      cmd: "./scripts/dev-start.sh stop",
    }),
  },

  "service:db:status": {
    title: "DB: status",
    description: "Check PostgreSQL container and connection status",
    supportsPlan: false,
    supportsVerbose: false,
    risk: "safe",
    effects: { reads: ["PostgreSQL container"] },
    buildCommand: () => ({
      cmd: "docker exec hf-postgres pg_isready -U postgres",
    }),
  },

  "service:db:start": {
    title: "DB: start container",
    description: "Start the hf-postgres Docker container",
    supportsPlan: true,
    supportsVerbose: false,
    risk: "mutates",
    effects: { writes: ["PostgreSQL container"] },
    buildCommand: () => ({
      cmd: "docker start hf-postgres",
    }),
  },

  "service:db:stop": {
    title: "DB: stop container",
    description: "Stop the hf-postgres Docker container",
    supportsPlan: true,
    supportsVerbose: false,
    risk: "mutates",
    effects: { writes: ["PostgreSQL container"] },
    buildCommand: () => ({
      cmd: "docker stop hf-postgres",
    }),
  },

  "service:db:restart": {
    title: "DB: restart container",
    description: "Restart the hf-postgres Docker container",
    supportsPlan: true,
    supportsVerbose: false,
    risk: "mutates",
    effects: { writes: ["PostgreSQL container"] },
    buildCommand: () => ({
      cmd: "docker restart hf-postgres",
    }),
  },

  "service:server:status": {
    title: "Server: status",
    description: "Check if Next.js dev server is running on port 3000",
    supportsPlan: false,
    supportsVerbose: false,
    risk: "safe",
    effects: { reads: ["Network ports"] },
    buildCommand: () => ({
      cmd: "lsof -i :3000 -sTCP:LISTEN",
    }),
  },
};

export async function GET(req: Request, ctx: { params: Promise<{ opid: string }> }) {
  try {
    assertLocalOnly();

    const { opid } = await ctx.params;

    if (opid === "_list") {
      const items = Object.entries(OPS).map(([id, s]) => ({
        opid: id,
        title: s.title,
        description: s.description,
      }));
      return NextResponse.json({ ok: true, items });
    }

    return NextResponse.json(
      { ok: false, error: "Use POST with includePlan=true for op previews" },
      { status: 405 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Ops preflight failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ opid: string }> }) {
  try {
    assertLocalOnly();

    const { opid } = await ctx.params;
    const spec = OPS[opid];

    if (!spec) {
      return NextResponse.json(
        { ok: false, error: `Unknown op: ${opid}` },
        { status: 404 }
      );
    }

    let body: Record<string, unknown> = {};
    let dryRun = false;
    let verbose = false;
    let includePlan = false;

    try {
      const parsed = await req.json();
      if (isPlainObject(parsed)) {
        body = safeRecord(parsed);
        dryRun = asBool((parsed as any).dryRun, false);
        verbose = asBool((parsed as any).verbose, false);
        includePlan = asBool((parsed as any).includePlan, false);
      }
    } catch {
      // no body = execute
    }

    const commandSpec = spec.buildCommand(body);

    const planOnly = includePlan && dryRun === true;

    if (planOnly) {
      const startedAt = new Date().toISOString();
      const finishedAt = startedAt;
      return NextResponse.json({
        ok: true,
        op: opid,
        opid,
        dryRun: true,
        startedAt,
        finishedAt,
        at: finishedAt,
        output: "",
        stdout: "",
        stderr: "",
        plan: {
          title: spec.title,
          description: spec.description,
          cmd: commandSpec.cmd,
          cwd: commandSpec.cwd ?? projectCwd(),
          dryRun: true,
          risk: spec.risk ?? "safe",
          effects: spec.effects ?? {},
          args: body,
        },
        events: verbose ? [{ ts: new Date().toISOString(), level: "info", phase: "plan", message: `Prepared dry-run plan for ${opid}` }] : undefined,
      });
    }

    // If requested, include a structured plan (preflight) in the response.
    const wantPlan = includePlan && (spec.supportsPlan ?? false);
    const wantVerbose = verbose && (spec.supportsVerbose ?? false);

    const result = await runCommand(opid, spec, commandSpec, body, dryRun, wantPlan, wantVerbose);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Ops execution failed" },
      { status: 500 }
    );
  }
}
