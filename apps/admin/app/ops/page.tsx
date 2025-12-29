"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type RunResult = {
  ok: boolean;
  op?: string;
  output?: string;
  error?: string;
  at?: string;
  meta?: any;
  // plan field removed (plan is handled separately)
};

type LogItem = {
  id: string;
  ts: string;
  opid: string;
  ok: boolean;
  output: string;
  meta?: any;
  local?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function formatOpOutput(json: any): { output: string; error?: string; at?: string; meta?: any } {
  // Supports both legacy shape ({ output, error, at }) and current OpResult shape
  // ({ stdout, stderr, finishedAt, exitCode, startedAt, meta }).
  const at = json?.at || json?.finishedAt || nowIso();

  const legacyOut = typeof json?.output === "string" ? json.output : "";
  const legacyErr = typeof json?.error === "string" ? json.error : "";

  const stdout = typeof json?.stdout === "string" ? json.stdout : "";
  const stderr = typeof json?.stderr === "string" ? json.stderr : "";

  // Prefer OpResult if present
  if (stdout || stderr || typeof json?.exitCode !== "undefined" || json?.startedAt || json?.finishedAt) {
    const parts: string[] = [];

    if (stdout && stdout.trim()) {
      parts.push(stdout.trimEnd());
    }

    if (stderr && stderr.trim()) {
      if (parts.length) parts.push("\n--- stderr ---\n");
      parts.push(stderr.trimEnd());
    }

    // Optional structured events (shown when the server includes them)
    const events = Array.isArray(json?.events) ? json.events : null;
    if (events && events.length) {
      const lines: string[] = [];
      for (const ev of events) {
        const ts = typeof ev?.ts === "string" ? ev.ts : typeof ev?.at === "string" ? ev.at : "";
        const level = typeof ev?.level === "string" ? ev.level : "info";
        const phase = typeof ev?.phase === "string" ? ev.phase : "";
        const msg = typeof ev?.message === "string" ? ev.message : "";

        const head = [ts, level.toUpperCase(), phase ? `[${phase}]` : ""].filter(Boolean).join(" ");
        const body = msg || "(event)";

        lines.push(`${head ? head + " " : ""}${body}`);
      }

      if (lines.length) {
        if (parts.length) parts.push("\n\n--- events ---\n");
        parts.push(lines.join("\n"));
      }
    }

    const output = parts.join("") || "";

    // If ok is false but no stderr was provided, surface a generic error
    const error = !json?.ok && !stderr && typeof json?.message === "string" ? json.message : legacyErr || undefined;

    // Keep full JSON in meta so Raw response is useful
    return { output, error, at, meta: json };
  }

  // Fallback to legacy
  return { output: legacyOut || legacyErr || "", error: legacyErr || undefined, at, meta: json };
}

async function runOp(opid: string, body?: any): Promise<RunResult> {
  const res = await fetch(`/api/ops/${encodeURIComponent(opid)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  const normalized = formatOpOutput(json);

  if (!res.ok) {
    return {
      ok: false,
      op: opid,
      error: json?.error || normalized.error || `HTTP ${res.status}`,
      output: normalized.output || "",
      at: normalized.at || nowIso(),
      meta: normalized.meta,
    };
  }

  // Prefer server-provided opid if present
  const op = json?.opid || json?.op || opid;

  return {
    ok: json?.ok !== false,
    op,
    output: normalized.output || "",
    error: normalized.error,
    at: normalized.at || nowIso(),
    meta: normalized.meta,
  } as RunResult;
}

type OpPlan = {
  opid: string;
  title?: string;
  description?: string;
  dryRun?: boolean;
  cmd?: string;
  cwd?: string;
  risk?: "safe" | "mutates" | "destructive";
  effects?: {
    reads?: string[];
    writes?: string[];
    creates?: string[];
    deletes?: string[];
  };
};

type TranscriptIndexItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: {
    name?: string;
    abs?: string;
    bytes?: number;
    modifiedAt?: string;
    sha256?: string;
    [k: string]: any;
  };
};

type TranscriptIndexResponse = {
  ok: boolean;
  kbRoot?: string;
  dir?: string;
  exists?: boolean;
  count?: number;
  items?: TranscriptIndexItem[];
  error?: string;
  [k: string]: any;
};

async function fetchPlan(
  opid: string,
  payload?: any
): Promise<{ ok: boolean; plan?: OpPlan; error?: string; raw?: any }> {
  try {
    const res = await fetch(`/api/ops/${encodeURIComponent(opid)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(payload || {}), includePlan: true, dryRun: true }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) return { ok: false, error: json?.error || `HTTP ${res.status}`, raw: json };

    const plan = (json.plan || null) as any;
    if (plan && (plan.opid || plan.cmd || plan.cwd)) {
      return {
        ok: true,
        plan: {
          opid,
          title: plan.title,
          description: plan.description,
          dryRun: true,
          cmd: plan.cmd,
          cwd: plan.cwd,
          risk: plan.risk,
          effects: plan.effects,
        },
        raw: json,
      };
    }

    const stdout = String(json.stdout || json.output || "");
    const inferredCmd = stdout.startsWith("[dry") ? stdout.replace(/^\[[^\]]+\]\s*/i, "") : stdout;
    return { ok: true, plan: { opid, dryRun: true, cmd: inferredCmd || undefined }, raw: json };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to fetch plan" };
  }
}

function tryParseJsonFromStdout(opResult: any): any {
  // Many ops return an OpResult envelope: { ok, stdout: "{...json...}\n", ... }
  // For UI tables we want the inner JSON payload.
  const stdout = typeof opResult?.stdout === "string" ? opResult.stdout.trim() : "";
  if (!stdout) return null;

  // Only attempt if it looks like JSON.
  const looksJson = stdout.startsWith("{") || stdout.startsWith("[");
  if (!looksJson) return null;

  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function unwrapOpPayload(json: any): any {
  // Prefer parsing stdout if present, otherwise return the object as-is.
  const parsed = tryParseJsonFromStdout(json);
  return parsed || json;
}

function slugifyName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");
}


const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

// Public (client-safe) KB root for display purposes only.
// Set NEXT_PUBLIC_HF_KB_PATH to show the resolved absolute KB root in the Ops UI.
// The server uses HF_KB_PATH (non-public) when executing ops.
const KB_ROOT_PUBLIC = (process.env.NEXT_PUBLIC_HF_KB_PATH || "").trim();
// Fallback display path (client-only). The server resolves its own KB root via HF_KB_PATH.
// We default the UI to the same local-dev convention used elsewhere: ~/hf_kb
const KB_ROOT_FALLBACK_DISPLAY = "~/hf_kb";

function kbRootDisplay(): string {
  return KB_ROOT_PUBLIC || `$HF_KB_PATH (default: ${KB_ROOT_FALLBACK_DISPLAY})`;
}

function kbPathDisplay(rel: string): string {
  const root = KB_ROOT_PUBLIC || KB_ROOT_FALLBACK_DISPLAY;
  return `${root.replace(/\/+$/, "")}/${rel.replace(/^\/+/, "")}`;
}

// ---- KB paths types/helpers ----
type KbPaths = {
  ok?: boolean;
  kbRoot?: string;
  parametersCsv?: string;
  transcriptsRawDir?: string;
  sourcesDir?: string;
  derivedDir?: string;
  vectorsDir?: string;
  error?: string;
  [k: string]: any;
};

function trimOrEmpty(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function formatBytes(n?: number): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : i === 1 ? 1 : 2;
  return `${x.toFixed(digits)} ${units[i]}`;
}

function formatIsoShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function Frame(props: {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const collapsible = props.collapsible === true;
  const collapsed = collapsible ? props.collapsed === true : false;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fafafa",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 220, display: "flex", gap: 10, alignItems: "baseline" }}>
          {collapsible ? (
            <button
              type="button"
              onClick={props.onToggleCollapsed}
              aria-label={collapsed ? `Expand ${props.title}` : `Collapse ${props.title}`}
              style={{
                border: "1px solid #e5e7eb",
                background: "white",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {collapsed ? "+" : "–"}
            </button>
          ) : null}

          <div>
            <div style={{ fontSize: 12, fontWeight: 900 }}>{props.title}</div>
            {props.subtitle ? (
              <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{props.subtitle}</div>
            ) : null}
          </div>
        </div>

        {props.right}
      </div>

      {collapsed ? null : (
        <div style={{ padding: 12, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {props.children}
        </div>
      )}
    </div>
  );
}

function ActionButton(props: {
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "brand" | "danger";
  running?: boolean;
  small?: boolean;
}) {
  const tone = props.tone || "neutral";
  const bg = tone === "brand" ? "#eef2ff" : tone === "danger" ? "#fff1f2" : "white";
  const border = tone === "brand" ? "#c7d2fe" : tone === "danger" ? "#fecaca" : "#ddd";
  const color = tone === "danger" ? "#991b1b" : "#111";

  return (
    <button
      onClick={props.onClick}
      disabled={!!props.disabled}
      title={props.title}
      style={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: border,
        background: bg,
        color,
        borderRadius: 10,
        padding: props.small ? "6px 10px" : "8px 10px",
        cursor: props.disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 750,
        opacity: props.disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {props.running ? "Running…" : props.label}
    </button>
  );
}

function StatusPill(props: { tone: "neutral" | "success" | "danger"; text: string }) {
  const bg = props.tone === "success" ? "#ecfdf5" : props.tone === "danger" ? "#fff1f2" : "#f3f4f6";
  const border = props.tone === "success" ? "#a7f3d0" : props.tone === "danger" ? "#fecaca" : "#e5e7eb";
  const color = props.tone === "success" ? "#065f46" : props.tone === "danger" ? "#991b1b" : "#374151";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: border,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

export default function OpsPage() {
  const [running, setRunning] = useState<string | null>(null);

  type TopTab = "ops" | "environment" | "knowledge" | "transcripts" | "snapshots";
  const [topTab, setTopTab] = useState<TopTab>("ops");

  // Runtime UI fields (client-only) for local KB paths (display + future wiring).
  const [kbRootUi, setKbRootUi] = useState<string>(() => {
    try {
      return window.localStorage.getItem("hf.kb.root") || "~/hf_kb";
    } catch {
      return "~/hf_kb";
    }
  });
  const [transcriptsRawUi, setTranscriptsRawUi] = useState<string>(() => {
    try {
      return window.localStorage.getItem("hf.kb.transcripts.raw") || "~/hf_kb/transcripts/raw";
    } catch {
      return "~/hf_kb/transcripts/raw";
    }
  });
  const [docsRawUi, setDocsRawUi] = useState<string>(() => {
    try {
      return window.localStorage.getItem("hf.kb.docs.raw") || "~/hf_kb/sources/raw";
    } catch {
      return "~/hf_kb/sources/raw";
    }
  });

  // Persist runtime UI fields
  useEffect(() => {
    try {
      window.localStorage.setItem("hf.kb.root", kbRootUi);
    } catch {}
  }, [kbRootUi]);
  useEffect(() => {
    try {
      window.localStorage.setItem("hf.kb.transcripts.raw", transcriptsRawUi);
    } catch {}
  }, [transcriptsRawUi]);
  useEffect(() => {
    try {
      window.localStorage.setItem("hf.kb.docs.raw", docsRawUi);
    } catch {}
  }, [docsRawUi]);
  const [last, setLast] = useState<RunResult | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [migrateName, setMigrateName] = useState("ops_manual");

  const [dryRun, setDryRun] = useState<boolean>(true);
  const [verboseLogs, setVerboseLogs] = useState<boolean>(true);

  const [planOpen, setPlanOpen] = useState<boolean>(false);
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<OpPlan | null>(null);
  const [autoScrollHistory, setAutoScrollHistory] = useState<boolean>(true);
  const [autoPollStatus, setAutoPollStatus] = useState<boolean>(false);
  const [stamp, setStamp] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `local_${y}${m}${day}`;
  });
  const historyRef = useRef<HTMLDivElement | null>(null);

  // --- KB paths state ---
  const [kbPaths, setKbPaths] = useState<KbPaths | null>(null);
  const [kbPathsError, setKbPathsError] = useState<string | null>(null);

  // --- Transcripts index (server) ---
  const [txIndex, setTxIndex] = useState<TranscriptIndexResponse | null>(null);
  const [txIndexError, setTxIndexError] = useState<string | null>(null);
  const [txIndexLoading, setTxIndexLoading] = useState<boolean>(false);

  async function refreshTxIndex() {
    setTxIndexLoading(true);
    setTxIndexError(null);

    try {
      const res = await fetch("/api/ops/transcripts:index", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });

      const json = (await res.json().catch(() => null)) as any;
      const payload = unwrapOpPayload(json) as any;

      if (!res.ok || !payload) {
        setTxIndex(null);
        setTxIndexError(payload?.error || json?.error || `HTTP ${res.status}`);
        setTxIndexLoading(false);
        return;
      }

      setTxIndex(payload as TranscriptIndexResponse);
      setTxIndexError(payload?.ok === false ? payload?.error || "Failed to index transcripts" : null);
      setTxIndexLoading(false);
    } catch (e: any) {
      setTxIndex(null);
      setTxIndexError(e?.message || "Failed to index transcripts");
      setTxIndexLoading(false);
    }
  }

  type OpsListItem = { opid: string; title?: string; description?: string };

  const [opsList, setOpsList] = useState<OpsListItem[] | null>(null);
  const [opsListError, setOpsListError] = useState<string | null>(null);

  type SectionKey = "schema" | "data" | "analysis" | "environment" | "last" | "history" | "howto";

  const [activeSection, setActiveSection] = useState<SectionKey>("schema");

  const ops = useMemo(() => {
    const fallback = {
      schema: [
        { opid: "prisma:migrate:status", label: "Migration status", tone: "neutral" as const },
        { opid: "prisma:migrate:dev", label: "Create/apply migration", tone: "brand" as const },
        { opid: "prisma:generate", label: "Generate client", tone: "brand" as const },
      ],
      data: [{ opid: "prisma:seed", label: "Seed baseline data", tone: "brand" as const }],
      analysis: [
        { opid: "analysis:ensure-active-tags", label: "Ensure Active tag links", tone: "brand" as const },
        { opid: "analysis:snapshot:active", label: "Snapshot Active parameters", tone: "brand" as const },
        { opid: "analysis:inspect:sets", label: "Inspect ParameterSets", tone: "neutral" as const },
      ],
    };

    if (!opsList) return fallback;

    const schema: any[] = [];
    const data: any[] = [];
    const analysis: any[] = [];

    for (const it of opsList) {
      const label = it.title || it.opid;
      const entry = { opid: it.opid, label, tone: "neutral" as const };

      if (it.opid.startsWith("prisma:")) {
        const tone =
          it.opid === "prisma:migrate:dev" || it.opid === "prisma:generate" || it.opid === "prisma:seed"
            ? ("brand" as const)
            : ("neutral" as const);
        schema.push({ ...entry, tone });
      } else if (it.opid.startsWith("analysis:")) {
        analysis.push({ ...entry, tone: "brand" as const });
      }
    }

    // Seed stays under Data for clarity
    const seedIdx = schema.findIndex((x) => x.opid === "prisma:seed");
    if (seedIdx >= 0) {
      const [seed] = schema.splice(seedIdx, 1);
      data.push(seed);
    }

    // stable ordering for key ops
    const order = ["prisma:migrate:status", "prisma:migrate:dev", "prisma:generate"];
    schema.sort((a, b) => {
      const ai = order.indexOf(a.opid);
      const bi = order.indexOf(b.opid);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    analysis.sort((a, b) => a.label.localeCompare(b.label));

    return { schema, data, analysis };
  }, [opsList]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ops/_list", { method: "GET" });
        const json = (await res.json().catch(() => null)) as any;
        if (cancelled) return;

        if (!res.ok || !json?.ok) {
          setOpsList(null);
          setOpsListError(json?.error || `HTTP ${res.status}`);
          return;
        }

        const items = Array.isArray(json.items) ? (json.items as OpsListItem[]) : [];
        setOpsList(items);
        setOpsListError(null);
      } catch (e: any) {
        if (cancelled) return;
        setOpsList(null);
        setOpsListError(e?.message || "Failed to load ops list");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // --- Fetch server-resolved KB paths ---
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // IMPORTANT: must execute (dryRun=false) to receive resolved paths; dryRun returns only a plan
        const res = await fetch("/api/ops/kb:paths", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dryRun: false, verbose: false, includePlan: false }),
        });

        const json = (await res.json().catch(() => null)) as any;
        const payload = unwrapOpPayload(json) as any;
        if (cancelled) return;

        if (!res.ok || !payload) {
          setKbPaths(null);
          setKbPathsError(payload?.error || json?.error || `HTTP ${res.status}`);
          return;
        }

        // kb:paths returns: { ok, kbRoot, envHF_KB_PATH, paths: { parametersRaw, transcriptsRaw, sources, derived, vectors }, ... }
        const p = payload?.paths && typeof payload.paths === "object" ? (payload.paths as any) : ({} as any);

        const resolved: KbPaths = {
          ok: !!payload?.ok,
          kbRoot: trimOrEmpty(payload?.kbRoot || p?.kbRoot || p?.root),
          parametersCsv: trimOrEmpty(p?.parametersRaw || p?.parametersCsv || p?.parameters_csv || p?.parametersPath),
          transcriptsRawDir: trimOrEmpty(p?.transcriptsRaw || p?.transcriptsRawDir || p?.transcripts_raw_dir || p?.transcriptsDir),
          sourcesDir: trimOrEmpty(p?.sources || p?.sourcesDir),
          derivedDir: trimOrEmpty(p?.derived || p?.derivedDir),
          vectorsDir: trimOrEmpty(p?.vectors || p?.vectorsDir),
        };

        setKbPaths(resolved);
        setKbPathsError(null);
      } catch (e: any) {
        if (cancelled) return;
        setKbPaths(null);
        setKbPathsError(e?.message || "Failed to load KB paths");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const [collapsedFrames, setCollapsedFrames] = useState({
    schema: false,
    data: true,
    analysis: true,
    environment: true,
    last: true,
    history: true,
    howto: true,
  });

  function focusSection(key: SectionKey) {
    setActiveSection(key);
    // Tabs behaviour: collapse everything else, expand only selected
    setCollapsedFrames({
      schema: true,
      data: true,
      analysis: true,
      environment: true,
      last: true,
      history: true,
      howto: true,
      [key]: false,
    } as any);
  }

  // Keep section tabs in sync with the top-level tab.
  useEffect(() => {
    if (topTab === "environment") {
      focusSection("environment");
    } else if (topTab === "ops") {
      focusSection("schema");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab]);

  // Auto-load transcript index when opening the Transcripts tab.
  useEffect(() => {
    if (topTab !== "transcripts") return;
    if (txIndexLoading) return;
    // If we haven't loaded anything yet, fetch once.
    if (!txIndex) {
      void refreshTxIndex();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab]);

  function toggleFrame(key: keyof typeof collapsedFrames) {
    setCollapsedFrames((p) => {
      const next = !p[key];
      if (!next) setActiveSection(key as any);
      return { ...p, [key]: next };
    });
  }

  function collapseAll() {
    setCollapsedFrames({
      schema: true,
      data: true,
      analysis: true,
      environment: true,
      last: true,
      history: true,
      howto: true,
    });
  }

  function expandAll() {
    setCollapsedFrames({
      schema: false,
      data: false,
      analysis: false,
      environment: false,
      last: false,
      history: false,
      howto: false,
    });
  }

  async function run(opid: string, body?: any) {
    // confirmations for dangerous ops
    if (opid === "db:reset") {
      const ok = window.confirm(
        "Reset database? This is destructive and intended for local-only workflows.\n\nThis will run server-side and may drop data. Continue?"
      );
      if (!ok) return;
    }

    setRunning(opid);
    setLast(null);

    const payload = {
      ...(body || {}),
      dryRun,
      verbose: verboseLogs,
      stamp: stamp?.trim() || null,
      requestedAt: nowIso(),
    };

    const res = await runOp(opid, payload);

    const output = (res.output || res.error || "").toString();
    setLast(res);

    setLog((prev) => [
      {
        id: uid(),
        ts: res.at || nowIso(),
        opid,
        ok: !!res.ok,
        output,
        meta: res.meta,
      },
      ...prev,
    ]);

    setRunning(null);
  }

  async function openPlan(opid: string, body?: any) {
    setPlanOpen(true);
    setPlanLoading(true);
    setPlanError(null);
    setPlan(null);

    const payload = {
      ...(body || {}),
      dryRun: true,
      verbose: verboseLogs,
      stamp: stamp?.trim() || null,
      requestedAt: nowIso(),
    };

    const res = await fetchPlan(opid, payload);
    if (!res.ok) {
      setPlanError(res.error || "Failed to load plan");
      setPlanLoading(false);
      return;
    }

    setPlan(res.plan || { opid });
    setPlanLoading(false);
  }

  function addLocalStamp(note?: string) {
    const s = (stamp || "").trim() || "(no stamp)";
    const msg = note ? `${s} — ${note}` : s;
    setLog((prev) => [
      {
        id: uid(),
        ts: nowIso(),
        opid: "stamp",
        ok: true,
        output: msg,
        local: true,
      },
      ...prev,
    ]);
  }

  function copyHistory() {
    const text = log
      .slice()
      .reverse()
      .map((x) => {
        const head = `[${x.ts}] ${x.ok ? "OK" : "ERROR"} ${x.opid}`;
        const body = x.output ? `\n${x.output}` : "";
        return head + body + "\n";
      })
      .join("\n");

    void navigator.clipboard.writeText(text);
  }

  useEffect(() => {
    if (!autoPollStatus) return;
    const t = window.setInterval(() => {
      if (running) return;
      void run("prisma:migrate:status");
    }, 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPollStatus, running, dryRun, stamp]);

  useEffect(() => {
    if (!autoScrollHistory) return;
    const el = historyRef.current;
    if (!el) return;
    // newest is at top; keep it pinned to the top
    el.scrollTop = 0;
  }, [log, autoScrollHistory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 14, gap: 12 }}>
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          background: "white",
          padding: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>
            {topTab === "ops"
              ? "Ops"
              : topTab === "environment"
                ? "Environment"
                : topTab === "knowledge"
                  ? "Knowledge"
                  : topTab === "transcripts"
                    ? "Transcripts"
                    : "Snapshots"}
          </h1>
          <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
            Local-only command centre (calls <code>/api/ops/&lt;opid&gt;</code>)
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {running ? (
              <StatusPill tone="neutral" text={`Running: ${running}`} />
            ) : last?.op ? (
              <StatusPill tone={last.ok ? "success" : "danger"} text={`${last.ok ? "OK" : "ERROR"}: ${last.op}`} />
            ) : null}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {([
              { key: "ops" as const, label: "Ops" },
              { key: "environment" as const, label: "Environment" },
              { key: "knowledge" as const, label: "Knowledge" },
              { key: "transcripts" as const, label: "Transcripts" },
              { key: "snapshots" as const, label: "Snapshots" },
            ] as const).map((t) => {
              const selected = topTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTopTab(t.key)}
                  style={{
                    border: "1px solid " + (selected ? "#c7d2fe" : "#e5e7eb"),
                    background: selected ? "#eef2ff" : "white",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    color: "#111",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {topTab === "ops" || topTab === "environment" ? (
          <>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#111" }}>
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              Dry-run
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#111" }}>
              <input type="checkbox" checked={verboseLogs} onChange={(e) => setVerboseLogs(e.target.checked)} />
              Verbose logs
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#111" }}>
              <input type="checkbox" checked={autoPollStatus} onChange={(e) => setAutoPollStatus(e.target.checked)} />
              Poll status
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#111" }}>
              <input
                type="checkbox"
                checked={autoScrollHistory}
                onChange={(e) => setAutoScrollHistory(e.target.checked)}
              />
              Pin history
            </label>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <ActionButton label="Expand all" tone="neutral" small disabled={!!running} onClick={expandAll} />
                <ActionButton label="Collapse all" tone="neutral" small disabled={!!running} onClick={collapseAll} />
              </div>
            </div>

            <div style={{ width: 1, height: 26, background: "#e5e7eb" }} />

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>Stamp</div>
              <input
                value={stamp}
                onChange={(e) => setStamp(slugifyName(e.target.value) || e.target.value)}
                placeholder="e.g. local_20251224"
                style={{
                  width: 200,
                  maxWidth: "60vw",
                  padding: "8px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: mono,
                }}
              />
              <ActionButton
                label="Add stamp"
                tone="neutral"
                small
                disabled={!!running}
                onClick={() => addLocalStamp("manual")}
              />
            </div>

            <div style={{ width: 1, height: 26, background: "#e5e7eb" }} />

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <ActionButton
                label="Migration status"
                tone="neutral"
                small
                disabled={!!running}
                running={running === "prisma:migrate:status"}
                title="prisma:migrate:status"
                onClick={() => run("prisma:migrate:status")}
              />
              <ActionButton
                label="Generate client"
                tone="brand"
                small
                disabled={!!running}
                running={running === "prisma:generate"}
                title="prisma:generate"
                onClick={() => run("prisma:generate")}
              />
              <ActionButton
                label="Seed baseline"
                tone="brand"
                small
                disabled={!!running}
                running={running === "prisma:seed"}
                title="prisma:seed"
                onClick={() => run("prisma:seed")}
              />
            </div>
          </>
        ) : null}
      </div>

      {(topTab === "ops" || topTab === "environment") ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "white",
              padding: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: "#111", padding: "6px 8px" }}>Sections</div>
            {opsListError ? (
              <div style={{ padding: "0 8px", fontSize: 12, color: "#991b1b", fontWeight: 800 }}>
                Ops list error: {opsListError}. Using fallback buttons.
              </div>
            ) : null}

            {(
              topTab === "environment"
                ? ([
                    { key: "environment" as const, label: "Environment" },
                    { key: "last" as const, label: "Last run" },
                    { key: "history" as const, label: "History" },
                    { key: "howto" as const, label: "How to use" },
                  ] as const)
                : ([
                    { key: "schema" as const, label: "Schema & migrations" },
                    { key: "data" as const, label: "Data" },
                    { key: "analysis" as const, label: "Analysis" },
                    { key: "environment" as const, label: "Environment" },
                    { key: "last" as const, label: "Last run" },
                    { key: "history" as const, label: "History" },
                    { key: "howto" as const, label: "How to use" },
                  ] as const)
            ).map((it) => {
              const selected = activeSection === it.key;
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => focusSection(it.key)}
                  style={{
                    border: "1px solid " + (selected ? "#c7d2fe" : "#e5e7eb"),
                    background: selected ? "#eef2ff" : "white",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    color: "#111",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.label}
                </button>
              );
            })}

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <ActionButton
                label="Snapshot Active"
                tone="brand"
                small
                disabled={!!running}
                running={running === "analysis:snapshot:active"}
                title="analysis:snapshot:active"
                onClick={() => run("analysis:snapshot:active")}
              />
              <ActionButton
                label="Inspect Sets"
                tone="neutral"
                small
                disabled={!!running}
                running={running === "analysis:inspect:sets"}
                title="analysis:inspect:sets"
                onClick={() => run("analysis:inspect:sets")}
              />
            </div>
          </div>

          <div style={{ minHeight: 0, overflow: "auto", paddingRight: 2, flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
              {topTab === "ops" ? (
                <>
                  {activeSection === "schema" ? (
                    <div id="sec_schema">
                      <Frame
                        title="Schema & migrations"
                        subtitle={
                          <span>
                            Use these to keep schema changes versioned and reversible. Dry-run returns the command that would run.
                            Turn it off to execute locally.
                          </span>
                        }
                        right={
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>Migration name</div>
                            <input
                              value={migrateName}
                              onChange={(e) => setMigrateName(e.target.value)}
                              placeholder="ops_manual"
                              style={{
                                width: 200,
                                maxWidth: "60vw",
                                padding: "8px 10px",
                                border: "1px solid #ddd",
                                borderRadius: 10,
                                fontSize: 13,
                                fontFamily: mono,
                              }}
                            />
                            <ActionButton
                              label="Log migration name"
                              tone="neutral"
                              small
                              disabled={!!running}
                              onClick={() => addLocalStamp(`migration:${migrateName || "(unnamed)"}`)}
                            />
                          </div>
                        }
                      >
                        {opsListError ? (
                          <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 800 }}>
                            Ops list error: {opsListError}. Using fallback buttons.
                          </div>
                        ) : null}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {ops.schema.map((b) => (
                            <div key={b.opid} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <ActionButton
                                label={b.label}
                                tone={b.tone}
                                disabled={!!running}
                                running={running === b.opid}
                                title={b.opid}
                                onClick={() =>
                                  b.opid === "prisma:migrate:dev"
                                    ? run("prisma:migrate:dev", { name: migrateName })
                                    : run(b.opid)
                                }
                              />
                              <ActionButton
                                label="More"
                                tone="neutral"
                                small
                                disabled={!!running}
                                title={`Plan: ${b.opid}`}
                                onClick={() =>
                                  b.opid === "prisma:migrate:dev"
                                    ? openPlan("prisma:migrate:dev", { name: migrateName })
                                    : openPlan(b.opid)
                                }
                              />
                            </div>
                          ))}
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          When <b>Dry-run</b> is enabled, the server should return what it <i>would</i> do (no DB changes).
                        </div>
                      </Frame>
                    </div>
                  ) : null}

                  {activeSection === "data" ? (
                    <div id="sec_data">
                      <Frame
                        title="Data"
                        subtitle={<span>Seed baseline data used by the admin UI and analysis workflows (local-only).</span>}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {ops.data.map((b) => (
                            <div key={b.opid} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <ActionButton
                                label={b.label}
                                tone={b.tone}
                                disabled={!!running}
                                running={running === b.opid}
                                title={b.opid}
                                onClick={() => run(b.opid)}
                              />
                              <ActionButton
                                label="More"
                                tone="neutral"
                                small
                                disabled={!!running}
                                title={`Plan: ${b.opid}`}
                                onClick={() => openPlan(b.opid)}
                              />
                            </div>
                          ))}
                        </div>

                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Recommended pattern: <b>Create/apply migration</b> → <b>Generate</b> → <b>Seed</b>.
                        </div>
                      </Frame>
                    </div>
                  ) : null}

                  {activeSection === "analysis" ? (
                    <div id="sec_analysis">
                      <Frame
                        title="Analysis"
                        subtitle={<span>Prepare a reproducible <b>ParameterSet</b> snapshot and validate tag links.</span>}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {ops.analysis.map((b) => (
                            <div key={b.opid} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <ActionButton
                                label={b.label}
                                tone={b.tone}
                                disabled={!!running}
                                running={running === b.opid}
                                title={b.opid}
                                onClick={() => run(b.opid)}
                              />
                              <ActionButton
                                label="More"
                                tone="neutral"
                                small
                                disabled={!!running}
                                title={`Plan: ${b.opid}`}
                                onClick={() => openPlan(b.opid)}
                              />
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Snapshots should be one-click: ensure tags → snapshot active → inspect sets.
                        </div>
                      </Frame>
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeSection === "environment" ? (
                <div id="sec_environment">
                  <Frame title="Environment" subtitle={<span>Visible execution context for reproducible runs.</span>}>
                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, fontSize: 13 }}>
                      <div style={{ color: "#6b7280", fontWeight: 800 }}>Stamp</div>
                      <div style={{ fontFamily: mono }}>{(stamp || "").trim() || "(none)"}</div>

                      <div style={{ color: "#6b7280", fontWeight: 800 }}>KB root</div>
                      <div style={{ fontFamily: mono }}>
                        {kbPaths?.kbRoot ? kbPaths.kbRoot : kbRootDisplay()}
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontFamily: "inherit" }}>
                          Display prefers server-resolved <b>HF_KB_PATH</b>. If unavailable, shows <b>NEXT_PUBLIC_HF_KB_PATH</b>
                          (client-safe) or the fallback <span style={{ fontFamily: mono }}>{KB_ROOT_FALLBACK_DISPLAY}</span>.
                          If you want the server to use a different location, set <b>HF_KB_PATH</b> in <span style={{ fontFamily: mono }}>.env.local</span> and restart.
                          {kbPathsError ? (
                            <span style={{ marginLeft: 8, color: "#991b1b", fontWeight: 800 }}>
                              KB paths error: {kbPathsError}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ color: "#6b7280", fontWeight: 800 }}>Parameters.csv</div>
                      <div style={{ fontFamily: mono }}>
                        {kbPaths?.parametersCsv ? kbPaths.parametersCsv : kbPathDisplay("parameters/raw/parameters.csv")}
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontFamily: "inherit" }}>
                          Update the raw CSV here, then run <span style={{ fontFamily: mono }}>kb:parameters:import</span> to create a
                          versioned snapshot.
                        </div>
                      </div>

                      <div style={{ color: "#6b7280", fontWeight: 800 }}>KB dump folder</div>
                      <div style={{ fontFamily: mono }}>
                        {kbPaths?.sourcesDir ? kbPaths.sourcesDir : kbPathDisplay("sources")}
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontFamily: "inherit" }}>
                          Drop source docs here for ingestion (e.g. PDFs, markdown, notes). This is the local-dev “dump zone”.
                        </div>
                      </div>

                      <div style={{ color: "#6b7280", fontWeight: 800 }}>Transcripts dump</div>
                      <div style={{ fontFamily: mono }}>
                        {kbPaths?.transcriptsRawDir ? kbPaths.transcriptsRawDir : kbPathDisplay("transcripts/raw")}
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontFamily: "inherit" }}>
                          Drop call transcripts here for local analysis. Future pipelines can write here (VAPI post-call, live call
                          slugs, etc.).
                        </div>
                      </div>

                      <div style={{ color: "#6b7280", fontWeight: 800 }}>Dry-run</div>
                      <div>{dryRun ? "Enabled (no changes applied)" : "Disabled (commands will execute)"}</div>

                      <div style={{ color: "#6b7280", fontWeight: 800 }}>Poll status</div>
                      <div>{autoPollStatus ? "Enabled" : "Disabled"}</div>
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                      Ops are intended for <b>local-only</b> use. The server route should block execution in production.
                    </div>
                  </Frame>
                </div>
              ) : null}

              {activeSection === "last" ? (
                <div id="sec_last">
                  <Frame title="Last run" subtitle={last?.op ? <span style={{ fontFamily: mono }}>{last.op}</span> : "—"}>
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        fontSize: 12,
                        lineHeight: 1.35,
                        minHeight: 140,
                        maxHeight: 600,
                      }}
                    >
                      {running ? `Running: ${running} …` : last?.output || last?.error || "Run an op to see output here."}
                    </pre>

                    {last?.meta ? (
                      <details>
                        <summary style={{ cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 800 }}>
                          Raw response
                        </summary>
                        <pre
                          style={{
                            margin: "8px 0 0",
                            padding: 12,
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            overflow: "auto",
                            whiteSpace: "pre-wrap",
                            fontSize: 12,
                            lineHeight: 1.35,
                            maxHeight: 420,
                          }}
                        >
                          {JSON.stringify(last.meta, null, 2)}
                        </pre>
                      </details>
                    ) : null}
                  </Frame>
                </div>
              ) : null}

              {activeSection === "history" ? (
                <div id="sec_history">
                  <Frame
                    title="History"
                    subtitle={<span>Action log. Stamps are local-only markers for correlating runs with schema/data state.</span>}
                    right={
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <ActionButton label="Copy" tone="neutral" small disabled={log.length === 0} onClick={copyHistory} />
                        <ActionButton label="Clear" tone="neutral" small disabled={log.length === 0} onClick={() => setLog([])} />
                      </div>
                    }
                  >
                    <div
                      ref={historyRef}
                      style={{
                        overflow: "auto",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 0,
                        minHeight: 140,
                        maxHeight: 600,
                      }}
                    >
                      {log.length === 0 ? (
                        <div style={{ padding: 12, fontSize: 13, color: "#6b7280" }}>No runs yet.</div>
                      ) : (
                        log.map((x) => (
                          <div key={x.id} style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                              <div style={{ fontFamily: mono, fontSize: 12 }}>{x.local ? "(local) " : ""}{x.opid}</div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>{x.ts}</div>
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 12,
                                fontWeight: 900,
                                color: x.ok ? "#065f46" : "#991b1b",
                              }}
                            >
                              {x.ok ? "OK" : "ERROR"}
                            </div>

                            {x.output ? (
                              <pre style={{ margin: "6px 0 0", fontSize: 12, whiteSpace: "pre-wrap", color: "#111" }}>
                                {x.output.length > 1400 ? x.output.slice(0, 1400) + "\n…(truncated)" : x.output}
                              </pre>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </Frame>
                </div>
              ) : null}

              {activeSection === "howto" ? (
                <div id="sec_howto">
                  <Frame title="How to use" subtitle={<span>Simple, repeatable flow for schema/data changes while collaborating.</span>}>
                    <ol style={{ margin: 0, paddingLeft: 18, color: "#111", fontSize: 13, lineHeight: 1.35 }}>
                      <li>
                        Set a <b>Stamp</b> for the work session.
                      </li>
                      <li>
                        Run <b>Create/apply migration</b> with a human-readable name.
                      </li>
                      <li>
                        Run <b>Generate client</b>.
                      </li>
                      <li>
                        Run <b>Seed baseline data</b> (if needed for dev/test).
                      </li>
                      <li>
                        Run <b>Ensure Active tag links</b> → <b>Snapshot Active parameters</b> → <b>Inspect ParameterSets</b>.
                      </li>
                    </ol>
                  </Frame>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {topTab === "knowledge" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <Frame
              title="Knowledge"
              subtitle={<span>Knowledge artefacts derived from local sources (client-side paths are editable; server uses env vars).</span>}
              right={
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <ActionButton label="KB status" tone="neutral" small disabled={!!running} running={running === "kb:status"} onClick={() => run("kb:status")} />
                  <ActionButton label="List sources" tone="neutral" small disabled={!!running} running={running === "kb:sources:list"} onClick={() => run("kb:sources:list", { limit: 200 })} />
                  <ActionButton label="Extract links" tone="neutral" small disabled={!!running} running={running === "kb:links:extract"} onClick={() => run("kb:links:extract")} />
                  <ActionButton label="Build KB" tone="brand" small disabled={!!running} running={running === "kb:build"} onClick={() => run("kb:build", { maxCharsPerChunk: 1800, overlapChars: 200 })} />
                  <ActionButton label="Build vectors" tone="brand" small disabled={!!running} running={running === "kb:vectors:build"} onClick={() => run("kb:vectors:build", { model: "text-embedding-3-small", batchSize: 64 })} />
                </div>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontWeight: 900 }}>KB root (UI)</div>
                <input
                  value={kbRootUi}
                  onChange={(e) => setKbRootUi(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: mono,
                  }}
                />

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Docs raw (UI)</div>
                <input
                  value={docsRawUi}
                  onChange={(e) => setDocsRawUi(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: mono,
                  }}
                />

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server KB root</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.kbRoot ? kbPaths.kbRoot : kbRootDisplay()}</div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server sources</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.sourcesDir ? kbPaths.sourcesDir : kbPathDisplay("sources")}</div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server derived</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.derivedDir ? kbPaths.derivedDir : kbPathDisplay("derived")}</div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server vectors</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.vectorsDir ? kbPaths.vectorsDir : kbPathDisplay("vectors")}</div>
              </div>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Use <span style={{ fontFamily: mono }}>kb:sources:list</span> to enumerate files under the server KB sources directory. Click-through/slideouts will be added once the server returns per-file hash/import/extract metadata.
              </div>
            </Frame>

            <Frame
              title="Knowledge items"
              subtitle={<span>Placeholder list: present / hashed / imported / extracted / vectorised.</span>}
            >
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No structured list available yet from the server. Next step: add ops that return a file index with hash + stamps (sources + derived + vectors) and wire this table to that response.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                    fontSize: 12,
                    color: "#374151",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Planned columns</div>
                  <div style={{ fontFamily: mono }}>
                    name · kind · present · sha256 · importedAt · extractedAt · vectorisedAt · lastError
                  </div>
                </div>
              </div>
            </Frame>
          </div>
        </div>
      ) : null}

      {topTab === "transcripts" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <Frame
              title="Transcripts"
              subtitle={<span>Raw transcripts dump + ingestion pipeline (hashed/stamped imports). Files should be JSON.</span>}
              right={
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <ActionButton
                    label={txIndexLoading ? "Refreshing…" : "Refresh"}
                    tone="neutral"
                    small
                    disabled={!!running || txIndexLoading}
                    onClick={() => refreshTxIndex()}
                  />
                  <ActionButton label="KB status" tone="neutral" small disabled={!!running} running={running === "kb:status"} onClick={() => run("kb:status")} />
                </div>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontWeight: 900 }}>KB root (UI)</div>
                <input
                  value={kbRootUi}
                  onChange={(e) => setKbRootUi(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: mono,
                  }}
                />

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Transcripts raw (UI)</div>
                <input
                  value={transcriptsRawUi}
                  onChange={(e) => setTranscriptsRawUi(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: mono,
                  }}
                />

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server transcripts</div>
                <div style={{ fontFamily: mono }}>
                  {kbPaths?.transcriptsRawDir ? kbPaths.transcriptsRawDir : kbPathDisplay("transcripts/raw")}
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", fontFamily: "inherit" }}>
                    This is the server-resolved folder used by ops (from <b>HF_KB_PATH</b>). The UI folder above is just your local drop location.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                Local drop folder (UI): <span style={{ fontFamily: mono }}>{(transcriptsRawUi || "").trim() || "(unset)"}</span>
              </div>

              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: 1.35,
                  fontFamily: mono,
                  background: "#fafafa",
                }}
              >
                {`mkdir -p ${(transcriptsRawUi || "~/hf_kb/transcripts/raw").trim() || "~/hf_kb/transcripts/raw"}`}
              </pre>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Next step: add ops that (1) scan the transcripts raw dir, (2) compute hashes, (3) copy to immutable imports with a manifest, and (4) expose status (present/hashed/imported/extracted/vectorised) for this table + slideouts.
              </div>
            </Frame>

            <Frame
              title="Transcript items"
              subtitle={
                <span>
                  Server index of <span style={{ fontFamily: mono }}>transcripts/raw</span> (present files).
                </span>
              }
            >
              {txIndexError ? (
                <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 800 }}>Index error: {txIndexError}</div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server dir</div>
                <div style={{ fontFamily: mono }}>
                  {txIndex?.dir || kbPaths?.transcriptsRawDir || kbPathDisplay("transcripts/raw")}
                </div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Files</div>
                <div style={{ fontFamily: mono }}>
                  {typeof txIndex?.count === "number" ? txIndex.count : Array.isArray(txIndex?.items) ? txIndex!.items!.length : 0}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>File</th>
                      <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>Size</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>Modified</th>
                      <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>SHA256</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txIndexLoading ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "12px", color: "#6b7280" }}>
                          Loading…
                        </td>
                      </tr>
                    ) : Array.isArray(txIndex?.items) && txIndex!.items!.length ? (
                      txIndex!.items!.map((it) => (
                        <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 800 }}>{it.meta?.name || it.title}</div>
                            {it.meta?.abs ? (
                              <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", fontFamily: mono }}>{it.meta.abs}</div>
                            ) : null}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: mono, fontSize: 12 }}>
                            {formatBytes(it.meta?.bytes)}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: mono, fontSize: 12, whiteSpace: "nowrap" }}>
                            {formatIsoShort(it.meta?.modifiedAt)}
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: mono, fontSize: 12 }}>
                            {it.meta?.sha256 ? it.meta.sha256 : ""}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ padding: "12px", color: "#6b7280" }}>
                          No files found in transcripts raw folder.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Next step after this table: add an ingest op that copies raw files into immutable imports + manifest, then extend rows with imported/derived/vectorised timestamps.
              </div>
            </Frame>
          </div>
        </div>
      ) : null}

      {topTab === "snapshots" ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <Frame
              title="Snapshots"
              subtitle={
                <span>
                  Versioned outputs you can diff, share, and reproduce (e.g. <b>ParameterSets</b>, KB imports, derived artefacts).
                </span>
              }
              right={
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <ActionButton
                    label="Snapshot Active"
                    tone="brand"
                    small
                    disabled={!!running}
                    running={running === "analysis:snapshot:active"}
                    onClick={() => run("analysis:snapshot:active")}
                  />
                  <ActionButton
                    label="Inspect Sets"
                    tone="neutral"
                    small
                    disabled={!!running}
                    running={running === "analysis:inspect:sets"}
                    onClick={() => run("analysis:inspect:sets")}
                  />
                </div>
              }
            >
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ color: "#6b7280", fontWeight: 900 }}>Stamp</div>
                <div style={{ fontFamily: mono }}>{(stamp || "").trim() || "(none)"}</div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server KB root</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.kbRoot ? kbPaths.kbRoot : kbRootDisplay()}</div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server derived</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.derivedDir ? kbPaths.derivedDir : kbPathDisplay("derived")}</div>

                <div style={{ color: "#6b7280", fontWeight: 900 }}>Server vectors</div>
                <div style={{ fontFamily: mono }}>{kbPaths?.vectorsDir ? kbPaths.vectorsDir : kbPathDisplay("vectors")}</div>
              </div>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Next step: add snapshot index ops (e.g. <span style={{ fontFamily: mono }}>kb:snapshots:list</span>) to enumerate
                stamped artefacts and wire them into a table with per-item drill-down.
              </div>
            </Frame>

            <Frame title="Snapshot items" subtitle={<span>Placeholder list: by stamp · by type · by hash.</span>}>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No server snapshot index yet. Once list ops exist, this will show snapshots with metadata (stamp, kind, sha256,
                createdAt) and open a slideout for diffs/contents.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    background: "#fafafa",
                    fontSize: 12,
                    color: "#374151",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Planned columns</div>
                  <div style={{ fontFamily: mono }}>
                    kind · stamp · present · sha256 · createdAt · sizeBytes · lastError
                  </div>
                </div>
              </div>
            </Frame>
          </div>
        </div>
      ) : null}

      {planOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 50,
          }}
          onClick={() => setPlanOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 92vw)",
              height: "100%",
              background: "white",
              borderLeft: "1px solid #e5e7eb",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900 }}>Plan</div>
                <div style={{ fontSize: 12, color: "#6b7280", fontFamily: mono }}>{plan?.opid || ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <ActionButton label="Close" tone="neutral" small onClick={() => setPlanOpen(false)} />
              </div>
            </div>

            <div style={{ borderTop: "1px solid #f3f4f6" }} />

            {planLoading ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>Loading…</div>
            ) : planError ? (
              <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 800 }}>{planError}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                {plan?.title ? <div style={{ fontSize: 14, fontWeight: 900 }}>{plan.title}</div> : null}
                {plan?.description ? <div style={{ fontSize: 13, color: "#374151" }}>{plan.description}</div> : null}

                {plan?.risk ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}>Risk</div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 900,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                        textTransform: "uppercase",
                      }}
                    >
                      {plan.risk}
                    </span>
                  </div>
                ) : null}

                {plan?.effects ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}>Effects</div>
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, fontSize: 12 }}>
                      {Array.isArray(plan.effects.reads) && plan.effects.reads.length ? (
                        <>
                          <div style={{ color: "#6b7280", fontWeight: 900 }}>Reads</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.reads.join(", ")}</div>
                        </>
                      ) : null}
                      {Array.isArray(plan.effects.writes) && plan.effects.writes.length ? (
                        <>
                          <div style={{ color: "#6b7280", fontWeight: 900 }}>Writes</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.writes.join(", ")}</div>
                        </>
                      ) : null}
                      {Array.isArray(plan.effects.creates) && plan.effects.creates.length ? (
                        <>
                          <div style={{ color: "#6b7280", fontWeight: 900 }}>Creates</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.creates.join(", ")}</div>
                        </>
                      ) : null}
                      {Array.isArray(plan.effects.deletes) && plan.effects.deletes.length ? (
                        <>
                          <div style={{ color: "#6b7280", fontWeight: 900 }}>Deletes</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.deletes.join(", ")}</div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}>Command</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    lineHeight: 1.35,
                    maxHeight: "35vh",
                    fontFamily: mono,
                  }}
                >
                  {plan?.cmd || "(not provided)"}
                </pre>

                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, fontSize: 12 }}>
                  <div style={{ color: "#6b7280", fontWeight: 900 }}>CWD</div>
                  <div style={{ fontFamily: mono }}>{plan?.cwd || "(default)"}</div>

                  <div style={{ color: "#6b7280", fontWeight: 900 }}>Dry-run</div>
                  <div>{"yes"}</div>

                  <div style={{ color: "#6b7280", fontWeight: 900 }}>Verbose</div>
                  <div>{verboseLogs ? "on" : "off"}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <ActionButton
                    label="Run"
                    tone="brand"
                    disabled={!!running}
                    onClick={() => {
                      if (plan?.opid === "prisma:migrate:dev") {
                        void run("prisma:migrate:dev", { name: migrateName });
                      } else if (plan?.opid) {
                        void run(plan.opid);
                      }
                      setPlanOpen(false);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      {topTab === "ops" ? (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Tip: keep this page open while developing. If you add new ops, keep the label human-readable and the opid machine-stable.
        </div>
      ) : null}
    </div>
  );
}
