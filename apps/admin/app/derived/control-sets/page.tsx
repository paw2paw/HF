"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { uiColors } from "../../../src/components/shared/uiColors";

const mono =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

type SnapshotRow = {
  id: string;
  createdAt?: string;
  stamp?: string;
  label?: string;
  notes?: string;
  source?: string;
  // extra fields are allowed
  [k: string]: any;
};

type OpEnvelope = {
  ok?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  [k: string]: any;
};

function tryParseJsonFromStdout(opResult: any): any {
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
    props.tone === "success"
      ? uiColors.successText
      : props.tone === "danger"
        ? uiColors.dangerText
        : uiColors.neutralText;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
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

function ActionButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const disabled = !!props.disabled;
  return (
    <button
      type="button"
      title={props.title}
      disabled={disabled}
      onClick={props.onClick}
      style={{
        border: `1px solid ${disabled ? uiColors.borderSubtle : uiColors.border}`,
        background: disabled ? uiColors.surfaceSubtle : uiColors.surface,
        color: disabled ? uiColors.textMuted : uiColors.text,
        padding: "8px 10px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.label}
    </button>
  );
}

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
              <div style={{ marginTop: 4, fontSize: 12, color: uiColors.textMuted }}>{props.subtitle}</div>
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

function normalizeSnapshotRows(payload: any): SnapshotRow[] {
  // Accept a few possible shapes:
  // - { snapshots: [...] }
  // - { sets: [...] }
  // - [...] (array)
  // - { items: [...] }
  const arr =
    (Array.isArray(payload) ? payload : null) ||
    (Array.isArray(payload?.snapshots) ? payload.snapshots : null) ||
    (Array.isArray(payload?.sets) ? payload.sets : null) ||
    (Array.isArray(payload?.items) ? payload.items : null) ||
    [];

  return arr
    .map((x: any, idx: number) => {
      const id =
        trimOrEmpty(x?.id) ||
        trimOrEmpty(x?.setId) ||
        trimOrEmpty(x?.parameterSetId) ||
        trimOrEmpty(x?.slug) ||
        `row_${idx}`;

      const createdAt = trimOrEmpty(x?.createdAt || x?.created_at || x?.ts || x?.timestamp);
      const stamp = trimOrEmpty(x?.stamp || x?.sessionStamp || x?.session_stamp);
      const label = trimOrEmpty(x?.label || x?.name || x?.title);
      const notes = trimOrEmpty(x?.notes || x?.note || x?.description);
      const source = trimOrEmpty(x?.source || x?.origin || x?.from);

      return { id, createdAt, stamp, label, notes, source, raw: x } as SnapshotRow;
    })
    // newest first if dates exist
    .sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return (isFinite(tb) ? tb : 0) - (isFinite(ta) ? ta : 0);
    });
}

async function fetchSnapshotIndex(): Promise<{ rows: SnapshotRow[]; raw: any } | { error: string; raw?: any }> {
  // Uses existing ops endpoint to avoid inventing a new API.
  // Preferred op: analysis:inspect:sets
  const res = await fetch("/api/ops/analysis:inspect:sets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dryRun: false, verbose: false, includePlan: false }),
  });

  const json = (await res.json().catch(() => null)) as any;
  const payload = unwrapOpPayload(json) as any;

  if (!res.ok || !payload) {
    return { error: payload?.error || json?.error || `HTTP ${res.status}`, raw: payload || json };
  }

  // Sometimes payload itself is the OpEnvelope, sometimes it's the inner JSON.
  const envelope: OpEnvelope | null = payload?.stdout || payload?.stderr || payload?.ok !== undefined ? (payload as any) : null;
  const inner = envelope ? unwrapOpPayload(envelope) : payload;

  const rows = normalizeSnapshotRows(inner);
  return { rows, raw: inner };
}

export default function ControlSetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SnapshotRow[]>([]);

  const status = useMemo(() => {
    if (loading) return { tone: "neutral" as const, text: "Loading…" };
    if (error) return { tone: "danger" as const, text: "Error" };
    return { tone: "success" as const, text: `${rows.length} set${rows.length === 1 ? "" : "s"}` };
  }, [loading, error, rows.length]);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const out = await fetchSnapshotIndex();
      if ("error" in out) {
        setRows([]);
        setError(out.error);
      } else {
        setRows(out.rows);
        setError(null);
      }
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Failed to load control sets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div style={{ minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: 18, color: uiColors.text }}>Control sets</h1>
          <div style={{ marginTop: 4, fontSize: 12, color: uiColors.textMuted }}>
            Read-only index of derived control sets (backed by <code>/api/ops/analysis:inspect:sets</code>).
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill tone={status.tone} text={status.text} />
            {error ? <span style={{ fontSize: 12, color: uiColors.dangerText, fontWeight: 900 }}>{error}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <ActionButton label={loading ? "Refreshing…" : "Refresh"} disabled={loading} onClick={refresh} />
          <Link
            href="/ops#sec_analysis"
            style={{
              border: `1px solid ${uiColors.border}`,
              background: uiColors.surface,
              color: uiColors.text,
              padding: "8px 10px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 900,
              textDecoration: "none",
            }}
            title="Run snapshot ops"
          >
            Go to Ops
          </Link>
        </div>
      </div>

      <Frame
        title="Control sets"
        subtitle={
          <span>
            Click a row to open details.
          </span>
        }
      >
        {loading ? (
          <div style={{ fontSize: 13, color: uiColors.textMuted }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: uiColors.textMuted }}>
            No control sets found. Create one via Ops → Analysis → <b>Snapshot Active</b>.
          </div>
        ) : (
          <div style={{ overflow: "auto", border: `1px solid ${uiColors.borderSubtle}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: uiColors.surfaceSubtle }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: uiColors.textLabel,
                      borderBottom: `1px solid ${uiColors.borderSubtle}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ID
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: uiColors.textLabel,
                      borderBottom: `1px solid ${uiColors.borderSubtle}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Created
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: uiColors.textLabel,
                      borderBottom: `1px solid ${uiColors.borderSubtle}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Stamp
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 12,
                      color: uiColors.textLabel,
                      borderBottom: `1px solid ${uiColors.borderSubtle}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Label
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ borderBottom: `1px solid ${uiColors.borderSubtle}` }}>
                      <Link
                        href={`/derived/control-sets/${encodeURIComponent(r.id)}`}
                        style={{
                          display: "block",
                          padding: "10px 12px",
                          fontFamily: mono,
                          color: uiColors.text,
                          textDecoration: "none",
                        }}
                        title={r.id}
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${uiColors.borderSubtle}`,
                        color: uiColors.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontFamily: mono }}>{r.createdAt || "—"}</span>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${uiColors.borderSubtle}`,
                        color: uiColors.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontFamily: mono }}>{r.stamp || "—"}</span>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        borderBottom: `1px solid ${uiColors.borderSubtle}`,
                        color: uiColors.text,
                      }}
                    >
                      {r.label || r.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 12, color: uiColors.textMuted }}>
          Note: this page uses the existing ops endpoint for speed. If you later add a dedicated control-sets API, swap the fetch
          implementation without changing the UI.
        </div>
      </Frame>
    </div>
  );
}
