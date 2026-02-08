"use client";


import React, { useEffect, useMemo, useRef, useState } from "react";
import { uiColors } from "../../src/components/shared/uiColors";
import HealthCheck from "../admin/shared/HealthCheck";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

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



const inputBaseStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: `1px solid ${uiColors.border}`,
  borderRadius: 10,
  fontSize: 13,
  fontFamily: mono,
  color: uiColors.text,
  background: uiColors.surface,
};

type TextInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
  maxWidth?: string;
};

function TextInput(props: TextInputProps) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        ...inputBaseStyle,
        width: props.width ?? 260,
        maxWidth: props.maxWidth ?? "60vw",
      }}
    />
  );
}

type PillButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function PillButton(props: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: `1px solid ${props.selected ? uiColors.border : uiColors.borderSubtle}`,
        background: props.selected ? uiColors.surfaceSubtle : uiColors.surface,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
        color: uiColors.text,
        whiteSpace: "nowrap",
      }}
    >
      {props.label}
    </button>
  );
}

function trimOrEmpty(v: any): string {
  return typeof v === "string" ? v.trim() : "";
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
        border: `1px solid ${uiColors.border}`,
        borderRadius: 12,
        background: uiColors.surface,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid ${uiColors.borderSubtle}`,
          background: uiColors.surfaceSubtle,
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
                border: `1px solid ${uiColors.borderSubtle}`,
                background: uiColors.surface,
                color: uiColors.text,
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
              <div style={{ marginTop: 4, fontSize: 12, color: uiColors.textMuted }}>{props.subtitle}</div>
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
  const bg = tone === "brand" ? uiColors.neutralBg : tone === "danger" ? uiColors.dangerBg : uiColors.surface;
  const border = tone === "brand" ? uiColors.neutralBorder : tone === "danger" ? uiColors.dangerBorder : uiColors.border;
  const color = tone === "danger" ? uiColors.dangerText : uiColors.text;

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
  const bg = props.tone === "success" ? uiColors.successBg : props.tone === "danger" ? uiColors.dangerBg : uiColors.neutralBg;
  const border =
    props.tone === "success" ? uiColors.successBorder : props.tone === "danger" ? uiColors.dangerBorder : uiColors.neutralBorder;
  const color =
    props.tone === "success" ? uiColors.successText : props.tone === "danger" ? uiColors.dangerText : uiColors.neutralText;

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


  type OpsListItem = { opid: string; title?: string; description?: string };

  const [opsList, setOpsList] = useState<OpsListItem[] | null>(null);
  const [opsListError, setOpsListError] = useState<string | null>(null);

  type SectionKey = "schema" | "data" | "analysis" | "services" | "last" | "history" | "howto";

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
        { opid: "analysis:snapshot:active", label: "Snapshot Active controls", tone: "brand" as const },
        { opid: "analysis:inspect:sets", label: "Inspect Control Sets", tone: "neutral" as const },
      ],
      services: [
        { opid: "service:status", label: "Environment Status", tone: "neutral" as const },
        { opid: "service:start", label: "Start (Colima)", tone: "brand" as const },
        { opid: "service:start:docker", label: "Start (Docker Desktop)", tone: "brand" as const },
        { opid: "service:stop", label: "Stop All", tone: "danger" as const },
        { opid: "service:db:status", label: "DB Status", tone: "neutral" as const },
        { opid: "service:db:start", label: "DB Start", tone: "brand" as const },
        { opid: "service:db:stop", label: "DB Stop", tone: "danger" as const },
        { opid: "service:db:restart", label: "DB Restart", tone: "brand" as const },
        { opid: "service:server:status", label: "Server Status", tone: "neutral" as const },
      ],
    };

    if (!opsList) return fallback;

    const schema: any[] = [];
    const data: any[] = [];
    const analysis: any[] = [];
    const services: any[] = [];

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
      } else if (it.opid.startsWith("service:")) {
        const tone =
          it.opid.includes(":stop") || it.opid.includes(":restart")
            ? ("danger" as const)
            : it.opid.includes(":start")
            ? ("brand" as const)
            : ("neutral" as const);
        services.push({ ...entry, tone });
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
    services.sort((a, b) => a.label.localeCompare(b.label));

    return { schema, data, analysis, services };
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


  const [collapsedFrames, setCollapsedFrames] = useState({
    schema: false,
    data: true,
    analysis: true,
    services: true,
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
      services: true,
      last: true,
      history: true,
      howto: true,
      [key]: false,
    } as any);
  }


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
      services: true,
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
      services: false,
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
          border: `1px solid ${uiColors.border}`,
          borderRadius: 12,
          background: uiColors.surface,
          padding: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 240 }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Ops</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: uiColors.textMuted }}>
            Local-only command centre (calls <code>/api/ops/&lt;opid&gt;</code>)
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {running ? (
              <StatusPill tone="neutral" text={`Running: ${running}`} />
            ) : last?.op ? (
              <StatusPill tone={last.ok ? "success" : "danger"} text={`${last.ok ? "OK" : "ERROR"}: ${last.op}`} />
            ) : null}
          </div>
          
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: uiColors.text }}>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry-run
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: uiColors.text }}>
          <input type="checkbox" checked={verboseLogs} onChange={(e) => setVerboseLogs(e.target.checked)} />
          Verbose logs
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: uiColors.text }}>
          <input type="checkbox" checked={autoPollStatus} onChange={(e) => setAutoPollStatus(e.target.checked)} />
          Poll status
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: uiColors.text }}>
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

        <div style={{ width: 1, height: 26, background: uiColors.borderSubtle }} />

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: uiColors.textMuted, fontWeight: 800 }}>Stamp</div>
          <TextInput
            value={stamp}
            onChange={(v) => setStamp(slugifyName(v) || v)}
            placeholder="e.g. local_20251224"
            width={200}
          />
          <ActionButton
            label="Add stamp"
            tone="neutral"
            small
            disabled={!!running}
            onClick={() => addLocalStamp("manual")}
          />
        </div>

        <div style={{ width: 1, height: 26, background: uiColors.borderSubtle }} />

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
      </div>

      {/* Health Check - Traffic Light System Status */}
      <HealthCheck />

      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
          <div
            style={{
              border: `1px solid ${uiColors.border}`,
              borderRadius: 12,
              background: uiColors.surface,
              padding: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: uiColors.textLabel, padding: "6px 8px" }}>Sections</div>
            {opsListError ? (
              <div style={{ padding: "0 8px", fontSize: 12, color: uiColors.dangerText, fontWeight: 800 }}>
                Ops list error: {opsListError}. Using fallback buttons.
              </div>
            ) : null}

            {([
              { key: "schema" as const, label: "Schema & migrations" },
              { key: "data" as const, label: "Data" },
              { key: "analysis" as const, label: "Analysis" },
              { key: "services" as const, label: "Services" },
              { key: "last" as const, label: "Last run" },
              { key: "history" as const, label: "History" },
              { key: "howto" as const, label: "How to use" },
            ] as const).map((it) => {
              const selected = activeSection === it.key;
              return (
                <PillButton key={it.key} label={it.label} selected={selected} onClick={() => focusSection(it.key)} />
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
                            <TextInput value={migrateName} onChange={setMigrateName} placeholder="ops_manual" width={200} />
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
                          <div style={{ fontSize: 12, color: uiColors.dangerText, fontWeight: 800 }}>
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

                        <div style={{ fontSize: 12, color: uiColors.textMuted }}>
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

                        <div style={{ fontSize: 12, color: uiColors.textMuted }}>
                          Recommended pattern: <b>Create/apply migration</b> → <b>Generate</b> → <b>Seed</b>.
                        </div>
                      </Frame>
                    </div>
                  ) : null}

                  {activeSection === "analysis" ? (
                    <div id="sec_analysis">
                      <Frame
                        title="Analysis"
                        subtitle={<span>Prepare a reproducible <b>Control Set</b> snapshot and validate tag links.</span>}
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
                        <div style={{ fontSize: 12, color: uiColors.textMuted }}>
                          Snapshots should be one-click: ensure tags → snapshot active → inspect sets.
                        </div>
                      </Frame>
                    </div>
                  ) : null}

                  {activeSection === "services" ? (
                    <div id="sec_services">
                      <Frame
                        title="Services"
                        subtitle={<span>Control database and server services (local-only). Check status before starting or stopping.</span>}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: uiColors.textLabel, marginBottom: 8 }}>
                              Database (PostgreSQL)
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {ops.services
                                .filter((b) => b.opid.startsWith("service:db:"))
                                .map((b) => (
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
                          </div>

                          <div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: uiColors.textLabel, marginBottom: 8 }}>
                              Dev Server (Next.js)
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {ops.services
                                .filter((b) => b.opid.startsWith("service:server:"))
                                .map((b) => (
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
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: uiColors.textMuted }}>
                          Note: Server start/stop controls can't be implemented from within the running server. Use your terminal for those operations.
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
                        border: `1px solid ${uiColors.borderSubtle}`,
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
                        <summary style={{ cursor: "pointer", fontSize: 12, color: uiColors.textLabel, fontWeight: 800 }}>
                          Raw response
                        </summary>
                        <pre
                          style={{
                            margin: "8px 0 0",
                            padding: 12,
                            border: `1px solid ${uiColors.borderSubtle}`,
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
                        border: `1px solid ${uiColors.borderSubtle}`,
                        borderRadius: 12,
                        padding: 0,
                        minHeight: 140,
                        maxHeight: 600,
                      }}
                    >
                      {log.length === 0 ? (
                        <div style={{ padding: 12, fontSize: 13, color: uiColors.textMuted }}>No runs yet.</div>
                      ) : (
                        log.map((x) => (
                          <div key={x.id} style={{ padding: 12, borderBottom: `1px solid ${uiColors.borderSubtle}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                              <div style={{ fontFamily: mono, fontSize: 12 }}>{x.local ? "(local) " : ""}{x.opid}</div>
                              <div style={{ fontSize: 11, color: uiColors.textMuted }}>{x.ts}</div>
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 12,
                                fontWeight: 900,
                                color: x.ok ? uiColors.successText : uiColors.dangerText,
                              }}
                            >
                              {x.ok ? "OK" : "ERROR"}
                            </div>

                            {x.output ? (
                              <pre style={{ margin: "6px 0 0", fontSize: 12, whiteSpace: "pre-wrap", color: uiColors.text }}>
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
                    <ol style={{ margin: 0, paddingLeft: 18, color: uiColors.text, fontSize: 13, lineHeight: 1.35 }}>
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
                        Run <b>Ensure Active tag links</b> → <b>Snapshot Active controls</b> → <b>Inspect Control Sets</b>.
                      </li>
                    </ol>
                  </Frame>
                </div>
              ) : null}
            </div>
          </div>
        </div>


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
              background: uiColors.surface,
              borderLeft: `1px solid ${uiColors.borderSubtle}`,
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
                <div style={{ fontSize: 12, color: uiColors.textMuted, fontFamily: mono }}>{plan?.opid || ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <ActionButton label="Close" tone="neutral" small onClick={() => setPlanOpen(false)} />
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${uiColors.borderSubtle}` }} />

            {planLoading ? (
              <div style={{ fontSize: 13, color: uiColors.textMuted }}>Loading…</div>
            ) : planError ? (
              <div style={{ fontSize: 12, color: uiColors.dangerText, fontWeight: 800 }}>{planError}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                {plan?.title ? <div style={{ fontSize: 14, fontWeight: 900 }}>{plan.title}</div> : null}
                {plan?.description ? <div style={{ fontSize: 13, color: uiColors.text }}>{plan.description}</div> : null}

                {plan?.risk ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: uiColors.textMuted, fontWeight: 900 }}>Risk</div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 900,
                        border: `1px solid ${uiColors.borderSubtle}`,
                        background: uiColors.surfaceSubtle,
                        textTransform: "uppercase",
                      }}
                    >
                      {plan.risk}
                    </span>
                  </div>
                ) : null}

                {plan?.effects ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: uiColors.textMuted, fontWeight: 900 }}>Effects</div>
                    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, fontSize: 12 }}>
                      {Array.isArray(plan.effects.reads) && plan.effects.reads.length ? (
                        <>
                          <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>Reads</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.reads.join(", ")}</div>
                        </>
                      ) : null}
                      {Array.isArray(plan.effects.writes) && plan.effects.writes.length ? (
                        <>
                          <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>Writes</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.writes.join(", ")}</div>
                        </>
                      ) : null}
                      {Array.isArray(plan.effects.creates) && plan.effects.creates.length ? (
                        <>
                          <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>Creates</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.creates.join(", ")}</div>
                        </>
                      ) : null}
                      {Array.isArray(plan.effects.deletes) && plan.effects.deletes.length ? (
                        <>
                          <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>Deletes</div>
                          <div style={{ fontFamily: mono }}>{plan.effects.deletes.join(", ")}</div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div style={{ fontSize: 12, color: uiColors.textMuted, fontWeight: 900 }}>Command</div>
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    border: `1px solid ${uiColors.borderSubtle}`,
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
                  <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>CWD</div>
                  <div style={{ fontFamily: mono }}>{plan?.cwd || "(default)"}</div>

                  <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>Dry-run</div>
                  <div>{"yes"}</div>

                  <div style={{ color: uiColors.textMuted, fontWeight: 900 }}>Verbose</div>
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
      <div style={{ fontSize: 12, color: uiColors.textMuted }}>
        Tip: keep this page open while developing. If you add new ops, keep the label human-readable and the opid machine-stable.
      </div>
    </div>
  );
}
  