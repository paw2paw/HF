"use client";

import React, { useEffect, useMemo, useState } from "react";
import { uiColors } from "../../src/components/shared/uiColors";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

// Public (client-safe) KB root for display purposes only.
// Set NEXT_PUBLIC_HF_KB_PATH to show the resolved absolute KB root in the UI.
// The server uses HF_KB_PATH (non-public) when resolving paths.
const KB_ROOT_PUBLIC = (process.env.NEXT_PUBLIC_HF_KB_PATH || "").trim();
// Fallback display path (client-only). The server resolves its own KB root via HF_KB_PATH.
const KB_ROOT_FALLBACK_DISPLAY = "~/hf_kb";

function kbRootDisplay(): string {
  return KB_ROOT_PUBLIC || `$HF_KB_PATH (default: ${KB_ROOT_FALLBACK_DISPLAY})`;
}

function kbPathDisplay(rel: string): string {
  const root = KB_ROOT_PUBLIC || KB_ROOT_FALLBACK_DISPLAY;
  return `${root.replace(/\/+$/, "")}/${rel.replace(/^\/+/, "")}`;
}

function tryParseJsonFromStdout(opResult: any): any {
  // Many ops return an OpResult envelope: { ok, stdout: "{...json...}\n", ... }
  // For UI we want the inner JSON payload.
  const stdout = typeof opResult?.stdout === "string" ? opResult.stdout.trim() : "";
  if (!stdout) return null;

  const looksJson = stdout.startsWith("{") || stdout.startsWith("[");
  if (!looksJson) return null;

  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function unwrapOpPayload(json: any): any {
  const parsed = tryParseJsonFromStdout(json);
  return parsed || json;
}

function trimOrEmpty(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

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

function Frame(props: {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
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
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: uiColors.textLabel }}>{props.title}</div>
            {props.subtitle ? (
              <div style={{ marginTop: 4, fontSize: 12, color: uiColors.textLabel }}>{props.subtitle}</div>
            ) : null}
          </div>
        </div>

        {props.right}
      </div>

      <div style={{ padding: 12, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {props.children}
      </div>
    </div>
  );
}

function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
  maxWidth?: string;
}) {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        padding: "8px 10px",
        border: `1px solid ${uiColors.border}`,
        borderRadius: 10,
        color: uiColors.text,
        background: uiColors.surface,
        fontSize: 13,
        fontFamily: mono,
        width: props.width ?? 260,
        maxWidth: props.maxWidth ?? "60vw",
      }}
    />
  );
}

function StatusPill(props: { tone: "neutral" | "danger" | "success"; text: string }) {
  const bg =
    props.tone === "success" ? uiColors.successBg : props.tone === "danger" ? uiColors.dangerBg : uiColors.neutralBg;
  const border =
    props.tone === "success"
      ? uiColors.successBorder
      : props.tone === "danger"
        ? uiColors.dangerBorder
        : uiColors.neutralBorder;
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

export default function ConfigPage() {
  const [kbPaths, setKbPaths] = useState<KbPaths | null>(null);
  const [kbPathsError, setKbPathsError] = useState<string | null>(null);

  // purely a local UI stamp for reproducibility notes
  const [stamp, setStamp] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `local_${y}${m}${day}`;
  });

  const status = useMemo(() => {
    if (kbPathsError) return { tone: "danger" as const, text: "Error loading KB paths" };
    if (!kbPaths) return { tone: "neutral" as const, text: "Loading…" };
    if (kbPaths?.ok === false) return { tone: "danger" as const, text: "KB paths returned ok=false" };
    return { tone: "success" as const, text: "Resolved" };
  }, [kbPaths, kbPathsError]);

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

        const p = payload?.paths && typeof payload.paths === "object" ? (payload.paths as any) : ({} as any);

        const resolved: KbPaths = {
          ok: !!payload?.ok,
          kbRoot: trimOrEmpty(payload?.kbRoot || p?.kbRoot || p?.root),
          parametersCsv: trimOrEmpty(p?.parametersRaw || p?.parametersCsv || p?.parameters_csv || p?.parametersPath),
          transcriptsRawDir: trimOrEmpty(
            p?.transcriptsRaw || p?.transcriptsRawDir || p?.transcripts_raw_dir || p?.transcriptsDir
          ),
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 14, gap: 12, color: uiColors.text }}>
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
        <div style={{ minWidth: 260 }}>
          <h1 style={{ margin: 0, fontSize: 18, color: uiColors.text }}>Environment</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: uiColors.textLabel }}>
            Resolved runtime paths used by the server (via <code>/api/ops/kb:paths</code>).
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill tone={status.tone} text={status.text} />
            {kbPathsError ? (
              <span style={{ fontSize: 12, color: uiColors.dangerText, fontWeight: 800 }}>{kbPathsError}</span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: uiColors.textLabel, fontWeight: 900 }}>Stamp</div>
          <TextInput value={stamp} onChange={setStamp} placeholder="e.g. local_20260105" width={200} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ minHeight: 0, overflow: "auto", paddingRight: 2, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <Frame title="Environment" subtitle={<span>Visible execution context for reproducible runs.</span>}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, fontSize: 13 }}>
                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>Stamp</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>{(stamp || "").trim() || "(none)"}</div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>KB root</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPaths?.kbRoot ? kbPaths.kbRoot : kbRootDisplay()}
                  <div style={{ marginTop: 6, fontSize: 12, color: uiColors.textMuted, fontFamily: "inherit" }}>
                    Display prefers server-resolved <b>HF_KB_PATH</b>. If unavailable, shows <b>NEXT_PUBLIC_HF_KB_PATH</b>
                    (client-safe) or the fallback <span style={{ fontFamily: mono }}>{KB_ROOT_FALLBACK_DISPLAY}</span>. If
                    you want the server to use a different location, set <b>HF_KB_PATH</b> in{" "}
                    <span style={{ fontFamily: mono }}>.env.local</span> and restart.
                  </div>
                </div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>Runtime config</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPathDisplay("derived/runtime-config.json")}
                  <div style={{ marginTop: 6, fontSize: 12, color: uiColors.textMuted, fontFamily: "inherit" }}>
                    Optional JSON overrides for KB subpaths (e.g. parameters raw CSV, snapshots dir). Defaults apply if
                    this file is absent.
                  </div>
                </div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>Parameters.csv</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPaths?.parametersCsv ? kbPaths.parametersCsv : kbPathDisplay("parameters/raw/parameters.csv")}
                  <div style={{ marginTop: 6, fontSize: 12, color: uiColors.textMuted, fontFamily: "inherit" }}>
                    This path can be overridden via <span style={{ fontFamily: mono }}>{kbPathDisplay("derived/runtime-config.json")}</span>.
                    Update the raw CSV, then run <span style={{ fontFamily: mono }}>kb:parameters:import</span> to create a
                    versioned snapshot.
                  </div>
                </div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>KB dump folder</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPaths?.sourcesDir ? kbPaths.sourcesDir : kbPathDisplay("sources")}
                  <div style={{ marginTop: 6, fontSize: 12, color: uiColors.textMuted, fontFamily: "inherit" }}>
                    Drop source docs here for ingestion (e.g. PDFs, markdown, notes). This is the local-dev “dump zone”.
                  </div>
                </div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>Transcripts dump</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPaths?.transcriptsRawDir ? kbPaths.transcriptsRawDir : kbPathDisplay("transcripts/raw")}
                  <div style={{ marginTop: 6, fontSize: 12, color: uiColors.textMuted, fontFamily: "inherit" }}>
                    Drop call transcripts here for local analysis. Future pipelines can write here (VAPI post-call, live
                    call slugs, etc.).
                  </div>
                </div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>Derived</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPaths?.derivedDir ? kbPaths.derivedDir : kbPathDisplay("derived")}
                </div>

                <div style={{ color: uiColors.textLabel, fontWeight: 800 }}>Vectors</div>
                <div style={{ fontFamily: mono, color: uiColors.text }}>
                  {kbPaths?.vectorsDir ? kbPaths.vectorsDir : kbPathDisplay("derived/vectors")}
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: uiColors.textMuted }}>
                This page is read-only. Execution controls (dry-run, ops, history) live on the <b>Ops</b> page.
              </div>
            </Frame>
          </div>
        </div>
      </div>
    </div>
  );
}
