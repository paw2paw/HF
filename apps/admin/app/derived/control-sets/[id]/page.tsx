import Link from "next/link";
import React from "react";
import { uiColors } from "../../../../src/components/shared/uiColors";
import { headers } from "next/headers";

type OpEnvelope = {
  ok: boolean;
  error?: string;
  stdout?: string;
  output?: string;
};

type ControlSet = {
  id: string;
  name?: string;
  createdAt?: string;
};

type LinkRow = {
  id: string;
  parameterSetId: string;
  parameterId: string;
  definition?: string;
  scaleType?: string;
  directionality?: string;
  interpretationLow?: string;
  interpretationHigh?: string;
  createdAt?: string;
};

type ParameterRow = Record<string, any>;

type ReadSetPayload =
  | { ok: true; set: ControlSet; links?: LinkRow[]; parameters?: ParameterRow[] }
  | { ok: false; error: string };

function fmtIso(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function pickKey(p: any): string {
  return (
    (p && (p.key ?? p.slug ?? p.name ?? p.id)) ?? ""
  ).toString();
}

function pickName(p: any): string {
  return (p && (p.name ?? "")) ? String(p.name) : "";
}

function pickType(p: any): string {
  return (p && (p.type ?? p.kind ?? p.valueType ?? p.scaleType ?? "")) ? String(p.type ?? p.kind ?? p.valueType ?? p.scaleType) : "";
}

function pickValue(p: any): string {
  const v = p?.defaultValue ?? p?.value;
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function pickDescription(p: any): string {
  return (p && (p.description ?? p.definition ?? "")) ? String(p.description ?? p.definition) : "";
}

async function fetchControlSet(baseUrl: string, id: string): Promise<{ payload?: ReadSetPayload; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/ops/analysis:read:set`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });

    const env = (await res.json()) as OpEnvelope;
    if (!env || env.ok !== true) {
      return { error: env?.error ? String(env.error) : "Unknown error" };
    }

    const raw = (env.stdout || env.output || "").toString().trim();
    if (!raw) return { error: "Empty response from op" };

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Op returned non-JSON output" };
    }

    return { payload: parsed as ReadSetPayload };
  } catch (e: any) {
    return { error: e?.message ? String(e.message) : "Failed to load control set" };
  }
}

export default async function ControlSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${host}`;

  const { payload, error } = await fetchControlSet(baseUrl, id);

  const okPayload = payload && (payload as any).ok === true ? (payload as any) : null;
  const failPayload = payload && (payload as any).ok === false ? (payload as any) : null;

  const set: ControlSet | null = okPayload?.set ?? null;
  const links: LinkRow[] = (okPayload?.links ?? []) as LinkRow[];
  const parameters: ParameterRow[] = (okPayload?.parameters ?? []) as ParameterRow[];

  // If the op returns links but not the fully joined Parameter objects yet,
  // build a usable table from the link rows so the UI is still helpful.
  const tableRows: any[] = parameters.length
    ? parameters
    : links.map((l) => ({
        key: l.parameterId,
        name: "",
        type: l.scaleType ?? "",
        defaultValue: "",
        description: l.definition ?? "",
        __link: l,
      }));

  const title = set?.name || "Control set";
  const createdAt = set?.createdAt;

  return (
    <div className="p-10 h-full" style={{ background: uiColors.surfaceSubtle, color: uiColors.text }}>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-xs mb-2" style={{ color: uiColors.textMuted }}>
            Derived / Control Sets / <span style={{ color: uiColors.text }}>{id}</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: uiColors.textLabel }}>
            {title}
          </h1>
          <p className="text-sm mt-2 leading-relaxed max-w-3xl" style={{ color: uiColors.textMuted }}>
            Detailed view of a control set and its linked parameters.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/derived/control-sets"
            className="rounded-md px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{
              border: `1px solid ${uiColors.border}`,
              background: uiColors.surface,
              color: uiColors.text,
            }}
          >
            ← Back
          </Link>
          <a
            href={`/derived/control-sets/${encodeURIComponent(id)}`}
            className="rounded-md px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{
              border: `1px solid ${uiColors.border}`,
              background: uiColors.surface,
              color: uiColors.text,
            }}
          >
            Refresh
          </a>
        </div>
      </div>

      {(error || failPayload?.error) ? (
        <div
          className="mt-6 rounded-md px-4 py-3 text-sm"
          style={{
            border: `1px solid ${uiColors.dangerBorder}`,
            background: uiColors.dangerBg,
            color: uiColors.dangerText,
          }}
        >
          {error ? error : (failPayload?.error ? String(failPayload.error) : "Unknown error")}
        </div>
      ) : null}

      <div
        className="mt-6 rounded-lg overflow-hidden"
        style={{ border: `1px solid ${uiColors.borderSubtle}`, background: uiColors.surface }}
      >
        <div className="p-6" style={{ borderBottom: `1px solid ${uiColors.borderSubtle}` }}>
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-xs font-semibold" style={{ color: uiColors.textLabel }}>Control set</div>
              <div className="text-xs mt-1" style={{ color: uiColors.textMuted }}>
                Source: <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>POST /api/ops/analysis:read:set</code>
              </div>
            </div>
            <div className="text-xs" style={{ color: uiColors.textMuted }}>
              <span className="inline-flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: uiColors.surfaceSubtle, color: uiColors.text, border: `1px solid ${uiColors.borderSubtle}` }}>
                  {tableRows.length} {tableRows.length === 1 ? "item" : "items"}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: uiColors.surfaceSubtle, color: uiColors.text, border: `1px solid ${uiColors.borderSubtle}` }}>
                  {links.length} {links.length === 1 ? "link" : "links"}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-md p-4" style={{ border: `1px solid ${uiColors.borderSubtle}`, background: uiColors.surface }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: uiColors.textMuted }}>ID</div>
              <div className="mt-1 text-sm" style={{ color: uiColors.text }}>
                <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{set?.id || id}</code>
              </div>
            </div>
            <div className="rounded-md p-4" style={{ border: `1px solid ${uiColors.borderSubtle}`, background: uiColors.surface }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: uiColors.textMuted }}>Name</div>
              <div className="mt-1 text-sm" style={{ color: uiColors.text }}>
                {set?.name || "—"}
              </div>
            </div>
            <div className="rounded-md p-4" style={{ border: `1px solid ${uiColors.borderSubtle}`, background: uiColors.surface }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: uiColors.textMuted }}>Created</div>
              <div className="mt-1 text-sm" style={{ color: uiColors.text }}>
                {fmtIso(createdAt)}
              </div>
            </div>
            <div className="rounded-md p-4" style={{ border: `1px solid ${uiColors.borderSubtle}`, background: uiColors.surface }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: uiColors.textMuted }}>Linked</div>
              <div className="mt-1 text-sm" style={{ color: uiColors.text }}>
                {parameters.length ? `${parameters.length} parameters` : `${links.length} parameter links`}
              </div>
              {!parameters.length && links.length ? (
                <div className="text-[11px] mt-1" style={{ color: uiColors.textMuted }}>
                  Note: op returned links but no joined parameter rows yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-6" style={{ borderTop: `1px solid ${uiColors.borderSubtle}` }}>
          <details>
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: uiColors.textLabel }}>
              Control set JSON
            </summary>
            <pre
              className="mt-3 text-xs rounded-md p-4 overflow-auto"
              style={{ background: uiColors.surfaceSubtle, border: `1px solid ${uiColors.borderSubtle}`, color: uiColors.text }}
            >
{JSON.stringify(
  {
    set,
    linksCount: links.length,
    parametersCount: parameters.length,
  },
  null,
  2
)}
            </pre>
          </details>
        </div>
      </div>

      <div
        className="mt-6 rounded-lg overflow-hidden"
        style={{ border: `1px solid ${uiColors.borderSubtle}`, background: uiColors.surface }}
      >
        <div className="p-6" style={{ borderBottom: `1px solid ${uiColors.borderSubtle}` }}>
          <div className="flex items-baseline justify-between gap-6">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: uiColors.textLabel }}>Parameters</h2>
              <div className="text-xs mt-1" style={{ color: uiColors.textMuted }}>
                Showing <span style={{ color: uiColors.text, fontWeight: 600 }}>{tableRows.length}</span> {tableRows.length === 1 ? "parameter" : "parameters"}.
              </div>
            </div>
          </div>
        </div>

        {!tableRows.length ? (
          <div className="p-6 text-sm" style={{ color: uiColors.textMuted }}>
            No parameters linked to this control set.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead
                className="sticky top-0 z-10"
                style={{ background: uiColors.surfaceSubtle, borderBottom: `1px solid ${uiColors.borderSubtle}` }}
              >
                <tr>
                  <th className="text-left font-semibold px-6 py-3 w-[160px]" style={{ color: uiColors.textLabel }}>Key</th>
                  <th className="text-left font-semibold px-6 py-3 w-[220px]" style={{ color: uiColors.textLabel }}>Name</th>
                  <th className="text-left font-semibold px-6 py-3 w-[140px]" style={{ color: uiColors.textLabel }}>Type</th>
                  <th className="text-left font-semibold px-6 py-3 w-[220px]" style={{ color: uiColors.textLabel }}>Default / Value</th>
                  <th className="text-left font-semibold px-6 py-3" style={{ color: uiColors.textLabel }}>Description</th>
                  <th className="text-left font-semibold px-6 py-3 w-[120px]" style={{ color: uiColors.textLabel }}>Raw</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((p, idx) => {
                  const key = pickKey(p) || String(p?.parameterId || p?.id || idx);
                  const name = pickName(p);
                  const type = pickType(p);
                  const value = pickValue(p);
                  const desc = pickDescription(p);
                  const zebra = idx % 2 === 0;

                  return (
                    <tr
                      key={key + ":" + idx}
                      className="border-b last:border-b-0"
                      style={{ borderColor: uiColors.borderSubtle, background: zebra ? uiColors.surface : uiColors.surfaceSubtle }}
                    >
                      <td className="px-6 py-3 align-top">
                        <code
                          className="text-xs"
                          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", color: uiColors.text }}
                        >
                          {key}
                        </code>
                      </td>
                      <td className="px-6 py-3 align-top" style={{ color: uiColors.text }}>
                        {name || <span style={{ color: uiColors.textMuted }}>—</span>}
                      </td>
                      <td className="px-6 py-3 align-top">
                        {type ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{
                              background: uiColors.surface,
                              color: uiColors.text,
                              border: `1px solid ${uiColors.borderSubtle}`,
                            }}
                          >
                            {type}
                          </span>
                        ) : (
                          <span style={{ color: uiColors.textMuted }}>—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 align-top" style={{ color: uiColors.text }}>
                        {value ? (
                          <code
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              background: uiColors.surface,
                              border: `1px solid ${uiColors.borderSubtle}`,
                              color: uiColors.text,
                            }}
                          >
                            {value}
                          </code>
                        ) : (
                          <span style={{ color: uiColors.textMuted }}>—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 align-top" style={{ color: uiColors.text }}>
                        {desc || <span style={{ color: uiColors.textMuted }}>—</span>}
                      </td>
                      <td className="px-6 py-3 align-top">
                        <details>
                          <summary
                            className="cursor-pointer text-xs font-semibold"
                            style={{ color: uiColors.textLabel }}
                          >
                            View
                          </summary>
                          <pre
                            className="mt-2 text-xs rounded-md p-3 overflow-auto max-h-72"
                            style={{ background: uiColors.surface, border: `1px solid ${uiColors.borderSubtle}`, color: uiColors.text }}
                          >
{JSON.stringify(p, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}