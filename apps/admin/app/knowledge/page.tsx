

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type RunResult = {
  ok: boolean;
  op?: string;
  output?: string;
  error?: string;
  at?: string;
  meta?: any;
  stdout?: string;
  stderr?: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
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

const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

async function runOp(opid: string, body?: any): Promise<RunResult> {
  const res = await fetch(`/api/ops/${encodeURIComponent(opid)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    return {
      ok: false,
      op: opid,
      error: json?.error || `HTTP ${res.status}`,
      output: String(json?.stderr || json?.message || ""),
      at: nowIso(),
      meta: json,
    };
  }

  const stdout = String(json?.stdout ?? json?.output ?? "");
  const stderr = String(json?.stderr ?? "");
  const output = (stdout || stderr || (json?.ok ? "OK" : "") || "").toString();

  return {
    ok: !!json?.ok,
    op: opid,
    output,
    at: json?.finishedAt || json?.at || nowIso(),
    meta: json,
    stdout,
    stderr,
    startedAt: json?.startedAt,
    finishedAt: json?.finishedAt,
    exitCode: json?.exitCode ?? null,
  };
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

export default function KnowledgeCockpitPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [last, setLast] = useState<RunResult | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);

  const [dryRun, setDryRun] = useState<boolean>(true);
  const [verboseLogs, setVerboseLogs] = useState<boolean>(true);

  const [sourcesExt, setSourcesExt] = useState<string>(".md,.txt,.csv,.tsv,.json,.pdf");
  const [sourcesLimit, setSourcesLimit] = useState<number>(250);
  const [linksLimit, setLinksLimit] = useState<number>(5000);

  const [autoScrollHistory, setAutoScrollHistory] = useState<boolean>(true);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const ops = useMemo(
    () => ({}),
    []
  );

  const [collapsedFrames, setCollapsedFrames] = useState({
    last: false,
    history: false,
  });

  function toggleFrame(key: keyof typeof collapsedFrames) {
    setCollapsedFrames((p) => ({ ...p, [key]: !p[key] }));
  }

  // All KB run operations removed.

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
    if (!autoScrollHistory) return;
    const el = historyRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [log, autoScrollHistory]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 14, gap: 12 }}>
      <Frame
        title="Last run"
        subtitle={last?.op ? <span style={{ fontFamily: mono }}>{last.op}</span> : "—"}
        collapsible
        collapsed={collapsedFrames.last}
        onToggleCollapsed={() => toggleFrame("last")}
      >
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
            maxHeight: 420,
            fontFamily: mono,
          }}
        >
          {running ? `Running: ${running} …` : last?.output || last?.error || "Run an op to see output here."}
        </pre>

        {last?.meta ? (
          <details>
            <summary style={{ cursor: "pointer", fontSize: 12, color: "#374151", fontWeight: 800 }}>Raw response</summary>
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
                fontFamily: mono,
              }}
            >
              {JSON.stringify(last.meta, null, 2)}
            </pre>
          </details>
        ) : null}
      </Frame>
      <Frame
        title="History"
        subtitle={<span>Action log.</span>}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <ActionButton label="Copy" tone="neutral" small disabled={log.length === 0} onClick={copyHistory} />
            <ActionButton label="Clear" tone="neutral" small disabled={log.length === 0} onClick={() => setLog([])} />
          </div>
        }
        collapsible
        collapsed={collapsedFrames.history}
        onToggleCollapsed={() => toggleFrame("history")}
      >
        <div
          ref={historyRef}
          style={{
            overflow: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 0,
            minHeight: 140,
            maxHeight: 420,
          }}
        >
          {log.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: "#6b7280" }}>No runs yet.</div>
          ) : (
            log.map((x) => (
              <div key={x.id} style={{ padding: 12, borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontFamily: mono, fontSize: 12 }}>
                    {x.local ? "(local) " : ""}
                    {x.opid}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{x.ts}</div>
                </div>

                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: x.ok ? "#065f46" : "#991b1b" }}>
                  {x.ok ? "OK" : "ERROR"}
                </div>

                {x.output ? (
                  <pre style={{ margin: "6px 0 0", fontSize: 12, whiteSpace: "pre-wrap", color: "#111", fontFamily: mono }}>
                    {x.output.length > 1400 ? x.output.slice(0, 1400) + "\n…(truncated)" : x.output}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </Frame>
    </div>
  );
}