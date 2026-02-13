import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveKbLayout } from "@/lib/knowledge/loader";
import { fileURLToPath } from "node:url";
import {
  loadSettingsLibrary,
  getSettingsLibraryPath,
  resolveSchemaRefs,
  extractDefaultsFromSchema,
} from "@/lib/settings/resolver";
import { AgentInstanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

// -------------------------
// Local-only guardrails
// -------------------------

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Agents API is disabled in production");
  }
  if (process.env.HF_OPS_ENABLED !== "true") {
    throw new Error("Agents API is disabled (set HF_OPS_ENABLED=true in .env.local)");
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function expandTilde(p: string): string {
  const t = (p || "").trim();
  if (!t) return "";
  if (t === "~") return os.homedir();
  if (t.startsWith("~/") || t.startsWith("~\\")) {
    return path.join(os.homedir(), t.slice(2));
  }
  return t;
}

// KB root resolution precedence:
// 1) HF_KB_PATH (supports ~)
// 2) ~/hf_kb (portable, user-home mutable data)
function kbRootFromEnv(): string {
  const envRaw = typeof process.env.HF_KB_PATH === "string" ? process.env.HF_KB_PATH : "";
  const env = expandTilde(envRaw);
  if (env && env.trim()) return path.resolve(env.trim());
  return path.resolve(path.join(os.homedir(), "hf_kb"));
}

// -------------------------
// Agent manifest + overrides
// -------------------------

export type AgentManifest = {
  ok?: boolean;
  updatedAt?: string;
  agents?: AgentSpec[];
};

export type AgentSpec = {
  agentId: string;
  title: string;
  description?: string;
  enabledDefault?: boolean;
  opid?: string;
  // YAML-like settings object: defaults live here; arbitrary keys permitted
  settingsSchema?: {
    defaults?: Record<string, unknown>;
    [k: string]: any;
  };
};

export type AgentConfig = {
  agentId: string;
  enabled: boolean;
  title: string;
  description: string;
  settings: Record<string, unknown>;
  // Pass-through extras for debugging/UI
  opid?: string;
  schema?: AgentSpec["settingsSchema"];
  // DB instance info (if exists)
  instance?: {
    id: string;
    status: AgentInstanceStatus;
    version: string;
    publishedAt: Date | null;
    hasDraft: boolean;
  };
};

type AgentOverride = {
  enabled?: boolean;
  settings?: Record<string, unknown>;
};

type AgentsOverridesFile = {
  ok?: boolean;
  updatedAt?: string;
  overrides?: {
    agents?: Record<string, AgentOverride>;
  };
  // legacy (older UI) shape: { agents: AgentConfig[] }
  agents?: unknown;
};

function agentsOverridesPath(kbRoot: string) {
  return path.join(kbRoot, ".hf", "agents.json");
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function thisFileDir(): string {
  try {
    // Next route handlers run as ESM in Node.
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}

async function findRepoAgentsManifestCandidates(): Promise<string[]> {
  const candidates: string[] = [];

  // 1) Original assumption (often true in dev): CWD == HF/apps/admin
  candidates.push(path.resolve(process.cwd(), "../../..", "lib", "agents.json"));

  // 2) If CWD is repo root
  candidates.push(path.resolve(process.cwd(), "lib", "agents.json"));

  // 3) Walk up from this file location (most reliable)
  const start = thisFileDir();
  let cur = start;
  for (let i = 0; i < 10; i++) {
    candidates.push(path.resolve(cur, "lib", "agents.json"));
    candidates.push(path.resolve(cur, "..", "lib", "agents.json"));
    const next = path.dirname(cur);
    if (next === cur) break;
    cur = next;
  }

  // Dedup while preserving order
  const seen = new Set<string>();
  const uniq = candidates
    .map((p) => path.resolve(p))
    .filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });

  return uniq;
}

async function agentsManifestPathRepo(): Promise<string | null> {
  const candidates = await findRepoAgentsManifestCandidates();
  for (const p of candidates) {
    if (await pathExists(p)) return p;
  }
  return null;
}

function agentsManifestPathKb(kbRoot: string) {
  // Optional: allow a user-local manifest override if present
  return path.join(kbRoot, ".hf", "agents.manifest.json");
}

async function loadAgentsManifest(kbRoot: string): Promise<{ path: string; manifest: AgentManifest } | null> {
  const kbPath = agentsManifestPathKb(kbRoot);
  const kbManifest = await readJsonIfExists<AgentManifest>(kbPath);
  if (kbManifest && Array.isArray(kbManifest.agents)) return { path: kbPath, manifest: kbManifest };

  const repoPath = await agentsManifestPathRepo();
  if (repoPath) {
    const repoManifest = await readJsonIfExists<AgentManifest>(repoPath);
    if (repoManifest && Array.isArray(repoManifest.agents)) return { path: repoPath, manifest: repoManifest };
  }

  return null;
}

function safeDefaultsFromSpec(spec: AgentSpec): Record<string, unknown> {
  const d = spec?.settingsSchema?.defaults;
  return isPlainObject(d) ? (d as Record<string, unknown>) : {};
}

function normalizeOverridesFromLegacyArray(manifest: AgentSpec[], input: unknown): Record<string, AgentOverride> {
  if (!Array.isArray(input)) return {};

  const known = new Set<string>(manifest.map((a) => a.agentId));
  const out: Record<string, AgentOverride> = {};

  for (const it of input) {
    if (!isPlainObject(it)) continue;
    const agentId = typeof it.agentId === "string" ? it.agentId : "";
    if (!agentId || !known.has(agentId)) continue;

    const enabled = typeof it.enabled === "boolean" ? it.enabled : undefined;
    const settings = isPlainObject(it.settings) ? (it.settings as Record<string, unknown>) : undefined;

    // Only store overrides that differ from defaults (enabledDefault / schema defaults)
    const spec = manifest.find((m) => m.agentId === agentId);
    const baseEnabled = typeof spec?.enabledDefault === "boolean" ? spec.enabledDefault : true;
    const baseSettings = safeDefaultsFromSpec(spec!);

    const settingsDiff: Record<string, unknown> = {};
    if (settings) {
      for (const [k, v] of Object.entries(settings)) {
        const dv = (baseSettings as any)[k];
        const same = JSON.stringify(v) === JSON.stringify(dv);
        if (!same) settingsDiff[k] = v;
      }
    }

    const patch: AgentOverride = {};
    if (typeof enabled === "boolean" && enabled !== baseEnabled) patch.enabled = enabled;
    if (Object.keys(settingsDiff).length) patch.settings = settingsDiff;

    if (patch.enabled !== undefined || patch.settings) out[agentId] = patch;
  }

  return out;
}

async function buildEffectiveAgents(
  manifestAgents: AgentSpec[],
  overridesById: Record<string, AgentOverride> | null | undefined,
  kbRoot: string
): Promise<AgentConfig[]> {
  const ov = overridesById || {};

  // Load settings library for resolving $ref
  const libraryPath = getSettingsLibraryPath(kbRoot);
  const library = await loadSettingsLibrary(libraryPath);

  return manifestAgents.map((spec) => {
    const baseEnabled = typeof spec.enabledDefault === "boolean" ? spec.enabledDefault : true;

    // Resolve $ref in schema if library exists
    let resolvedSchema = spec.settingsSchema;
    if (library && resolvedSchema) {
      resolvedSchema = resolveSchemaRefs(resolvedSchema, library);
    }

    // Extract defaults from resolved schema
    const baseSettings = resolvedSchema
      ? extractDefaultsFromSchema(resolvedSchema)
      : safeDefaultsFromSpec(spec);

    const patch = ov[spec.agentId];
    const enabled = typeof patch?.enabled === "boolean" ? patch.enabled : baseEnabled;
    const patchSettings = isPlainObject(patch?.settings) ? (patch!.settings as Record<string, unknown>) : {};

    return {
      agentId: spec.agentId,
      enabled,
      title: spec.title,
      description: spec.description || "",
      settings: { ...baseSettings, ...patchSettings },
      opid: spec.opid,
      schema: resolvedSchema, // Return resolved schema to UI
    };
  });
}

function toAbsFromKbRoot(kbRoot: string, maybeRel: string): string {
  const t = (maybeRel || "").trim();
  if (!t) return "";
  if (t.startsWith("~")) return path.resolve(expandTilde(t));
  if (path.isAbsolute(t)) return path.resolve(t);
  return path.resolve(path.join(kbRoot, t));
}

function buildResolvedSettings(kbRoot: string, layout: any, agent: AgentConfig): Record<string, unknown> {
  const s = agent.settings || {};
  const out: Record<string, unknown> = { ...s };

  // Canonical resolved dirs based on kbRoot/layout
  out.kbRoot = kbRoot;
  out.sourcesDirResolved = layout?.sourcesDir;
  out.derivedDirResolved = layout?.derivedDir;
  out.vectorsDirResolved = layout?.vectorsDir;
  out.pagesDirResolved = layout?.pagesDir;

  // Heuristic: resolve any string settings that look like relative paths
  for (const [k, v] of Object.entries(s)) {
    if (typeof v !== "string") continue;
    const kk = k.toLowerCase();
    const looksLikePath =
      kk.endsWith("dir") ||
      kk.endsWith("path") ||
      kk.includes("file") ||
      kk.includes("csv") ||
      kk.includes("json") ||
      kk.includes("folder");
    if (!looksLikePath) continue;

    out[`${k}Resolved`] = toAbsFromKbRoot(kbRoot, v);
  }

  return out;
}

function normalizeAgentsFromUi(manifestAgents: AgentSpec[], input: unknown): Array<Pick<AgentConfig, "agentId" | "enabled" | "settings">> {
  if (!Array.isArray(input)) return [];
  const known = new Set<string>(manifestAgents.map((a) => a.agentId));

  const out: Array<Pick<AgentConfig, "agentId" | "enabled" | "settings">> = [];
  for (const it of input) {
    if (!isPlainObject(it)) continue;

    const agentId = typeof it.agentId === "string" ? it.agentId : "";
    if (!agentId || !known.has(agentId)) continue;

    const enabled = typeof it.enabled === "boolean" ? it.enabled : true;
    const settings = isPlainObject(it.settings) ? (it.settings as Record<string, unknown>) : {};

    out.push({ agentId, enabled, settings });
  }

  return out;
}

function diffToOverrides(manifestAgents: AgentSpec[], effective: AgentConfig[]): Record<string, AgentOverride> {
  const manifestById = new Map<string, AgentSpec>();
  for (const a of manifestAgents) manifestById.set(a.agentId, a);

  const out: Record<string, AgentOverride> = {};

  for (const a of effective) {
    const spec = manifestById.get(a.agentId);
    if (!spec) continue;

    const baseEnabled = typeof spec.enabledDefault === "boolean" ? spec.enabledDefault : true;
    const baseSettings = safeDefaultsFromSpec(spec);

    const enabledDiff = a.enabled !== baseEnabled;

    const settingsDiff: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(a.settings || {})) {
      const dv = (baseSettings as any)[k];
      const same = JSON.stringify(v) === JSON.stringify(dv);
      if (!same) settingsDiff[k] = v;
    }

    if (enabledDiff || Object.keys(settingsDiff).length) {
      out[a.agentId] = {
        ...(enabledDiff ? { enabled: a.enabled } : {}),
        ...(Object.keys(settingsDiff).length ? { settings: settingsDiff } : {}),
      };
    }
  }

  return out;
}

// -------------------------
// Handlers
// -------------------------

/**
 * @api GET /api/agents
 * @visibility internal
 * @scope agents:read
 * @auth session
 * @tags agents
 * @description List all agents from manifest with overrides, DB instances, and resolved settings
 * @response 200 { ok: true, agents: AgentConfig[], resolved: { env, kbRoot, layout, ... } }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();

    const kbRoot = kbRootFromEnv();
    const storePath = agentsOverridesPath(kbRoot);

    const manifestLoaded = await loadAgentsManifest(kbRoot);
    if (!manifestLoaded) {
      const triedRepo = await findRepoAgentsManifestCandidates();
      throw new Error(
        "Agents manifest not found. Expected <HF_KB_PATH>/.hf/agents.manifest.json or a repo lib/agents.json. " +
          `kbPath=${agentsManifestPathKb(kbRoot)}; cwd=${process.cwd()}; triedRepo=[${triedRepo.join(", ")}]`
      );
    }

    const manifestAgents = Array.isArray(manifestLoaded.manifest.agents) ? manifestLoaded.manifest.agents : [];

    const stored = await readJsonIfExists<AgentsOverridesFile>(storePath);

    // Preferred schema: overrides.agents
    const overridesAgents =
      stored && isPlainObject(stored.overrides) && isPlainObject((stored.overrides as any).agents)
        ? ((stored.overrides as any).agents as Record<string, AgentOverride>)
        : null;

    // Legacy schema: { agents: AgentConfig[] }
    let legacyOverrides: Record<string, AgentOverride> | null = null;
    if (!overridesAgents && stored && Array.isArray(stored.agents)) {
      legacyOverrides = normalizeOverridesFromLegacyArray(manifestAgents, stored.agents);
    }

    const overridesById = overridesAgents || legacyOverrides || {};
    const agents = await buildEffectiveAgents(manifestAgents, overridesById, kbRoot);

    // Fetch DB instances to merge with manifest-based agents
    const dbInstances = await prisma.agentInstance.findMany({
      where: {
        status: { in: ["PUBLISHED", "DRAFT"] },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group instances by agentId
    const instancesByAgentId = new Map<string, typeof dbInstances>();
    for (const inst of dbInstances) {
      const arr = instancesByAgentId.get(inst.agentId) || [];
      arr.push(inst);
      instancesByAgentId.set(inst.agentId, arr);
    }

    // Merge DB instance info into agents
    const agentsWithInstances = agents.map((agent) => {
      const instances = instancesByAgentId.get(agent.agentId) || [];
      const published = instances.find((i) => i.status === "PUBLISHED");
      const draft = instances.find((i) => i.status === "DRAFT");

      // If published instance exists, use its settings
      const effectiveSettings = published
        ? { ...agent.settings, ...(published.settings as Record<string, unknown>) }
        : agent.settings;

      return {
        ...agent,
        settings: effectiveSettings,
        instance: published
          ? {
              id: published.id,
              status: published.status,
              version: published.version,
              publishedAt: published.publishedAt,
              hasDraft: !!draft,
            }
          : draft
          ? {
              id: draft.id,
              status: draft.status,
              version: draft.version,
              publishedAt: null,
              hasDraft: true,
            }
          : undefined,
      };
    });

    const layout = await resolveKbLayout({ kbRoot });

    return NextResponse.json({
      ok: true,
      agents: agentsWithInstances,
      resolved: {
        env: {
          NODE_ENV: process.env.NODE_ENV || null,
          HF_OPS_ENABLED: (process.env.HF_OPS_ENABLED || "").trim() || null,
          HF_KB_PATH: (process.env.HF_KB_PATH || "").trim() || null,
        },
        kbRoot,
        layout,
        storePath,
        manifestPath: manifestLoaded.path,
        defaults: {
          agents: manifestAgents,
        },
        overrides: {
          agents: overridesById,
          source: overridesAgents ? "overrides.agents" : legacyOverrides ? "legacy.agents[]" : "none",
          updatedAt: (stored as any)?.updatedAt || null,
        },
        effectiveAgents: agentsWithInstances.map((a) => ({
          ...a,
          resolvedSettings: buildResolvedSettings(kbRoot, layout as any, a),
        })),
        dbInstances: {
          count: dbInstances.length,
          published: dbInstances.filter((i) => i.status === "PUBLISHED").length,
          drafts: dbInstances.filter((i) => i.status === "DRAFT").length,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to load agents" }, { status: 500 });
  }
}

/**
 * @api POST /api/agents
 * @visibility internal
 * @scope agents:write
 * @auth session
 * @tags agents
 * @description Save agent configuration overrides (enabled state and settings) to the KB store
 * @body agents AgentConfig[] - Array of agent configurations to save
 * @response 200 { ok: true, agents: AgentConfig[], resolved: { kbRoot, layout, storePath, ... } }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();

    const kbRoot = kbRootFromEnv();
    const storePath = agentsOverridesPath(kbRoot);

    const manifestLoaded = await loadAgentsManifest(kbRoot);
    if (!manifestLoaded) {
      const triedRepo = await findRepoAgentsManifestCandidates();
      throw new Error(
        "Agents manifest not found. Expected <HF_KB_PATH>/.hf/agents.manifest.json or a repo lib/agents.json. " +
          `kbPath=${agentsManifestPathKb(kbRoot)}; cwd=${process.cwd()}; triedRepo=[${triedRepo.join(", ")}]`
      );
    }
    const manifestAgents = Array.isArray(manifestLoaded.manifest.agents) ? manifestLoaded.manifest.agents : [];

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    // UI sends full agents; we normalize against the manifest.
    const incoming = normalizeAgentsFromUi(manifestAgents, isPlainObject(body) ? (body as any).agents : []);

    // Convert incoming to overrides format
    const incomingOverrides: Record<string, AgentOverride> = {};
    for (const agent of incoming) {
      const spec = manifestAgents.find(m => m.agentId === agent.agentId);
      if (!spec) continue;

      const baseEnabled = typeof spec.enabledDefault === "boolean" ? spec.enabledDefault : true;
      const enabledDiff = agent.enabled !== baseEnabled;

      const patch: AgentOverride = {};
      if (enabledDiff) patch.enabled = agent.enabled;
      if (agent.settings && Object.keys(agent.settings).length > 0) {
        patch.settings = agent.settings;
      }

      if (patch.enabled !== undefined || patch.settings) {
        incomingOverrides[agent.agentId] = patch;
      }
    }

    // Build effective agents with resolved schemas
    const effectiveAgents = await buildEffectiveAgents(manifestAgents, incomingOverrides, kbRoot);
    const overrides = diffToOverrides(manifestAgents, effectiveAgents);

    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(
      storePath,
      JSON.stringify(
        {
          ok: true,
          updatedAt: new Date().toISOString(),
          overrides: {
            agents: overrides,
          },
        },
        null,
        2
      ),
      "utf8"
    );

    const layout = await resolveKbLayout({ kbRoot });

    return NextResponse.json({
      ok: true,
      agents: effectiveAgents,
      resolved: {
        kbRoot,
        layout,
        storePath,
        manifestPath: manifestLoaded.path,
        overrides: { agents: overrides },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to save agents" }, { status: 500 });
  }
}
