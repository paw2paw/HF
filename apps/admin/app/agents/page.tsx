

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentCard } from '@/components/agents/AgentCard';

type AgentId = string;

type AgentRunStatus = string;

type ArtifactLink = {
  label: string;
  kind: 'input' | 'output' | 'log';
  path?: string;
  opid?: string;
};

type AgentRun = {
  id: string;
  agentId: AgentId;
  agentTitle?: string;
  startedAt: string;
  finishedAt?: string;
  status: AgentRunStatus;
  summary?: string;
  opid?: string;
  dryRun?: boolean;
  stdout?: string;
  stderr?: string;
  artifacts?: ArtifactLink[];
};

// Minimal JSON-Schema-ish shape (YAML-compatible) used to render settings generically.
// We only implement what we need right now; more can be added incrementally.
type JsonSchema = {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
};

type AgentConfig = {
  agentId: AgentId;
  enabled: boolean;
  title: string;
  description: string;
  // Agent-defined knobs (schema-driven). Arbitrary nested object.
  settings: Record<string, any>;
  // Optional: how to render/validate settings.
  schema?: JsonSchema;
};

type ApiOk<T> = { ok: true } & T;

type ApiErr = { ok: false; error: string };

type EffectiveAgent = AgentConfig & { resolved?: Record<string, any> };

type ResolvedPayload = {
  env?: Record<string, any>;
  layout?: Record<string, any>;
  // Optional extras from server (if implemented)
  storePath?: string;
  defaults?: any;
  overrides?: any;
  effectiveAgents?: EffectiveAgent[];
};


type GetAgentsResponse = ApiOk<{ agents: AgentConfig[]; resolved?: ResolvedPayload }> | ApiErr;

type SaveAgentsRequest = { agents: AgentConfig[] };

type SaveAgentsResponse = ApiOk<{ agents: AgentConfig[] }> | ApiErr;

type RunAgentRequest = { agentId: AgentId; dryRun?: boolean };

type RunAgentResponse = ApiOk<{ run: AgentRun }> | ApiErr;

type GetRunsResponse = ApiOk<{ runs: AgentRun[] }> | ApiErr;

// The server/manifest may use slightly different field names (e.g. `id` instead of `agentId`).
// Normalize everything into the UI's `AgentConfig` shape so rendering (schema/settings) is reliable.
type AnyAgentLike = Record<string, any>;

function normalizeAgent(raw: AnyAgentLike): AgentConfig {
  // IMPORTANT: only treat machine identifiers as agentId.
  // Never fall back to human-facing fields like title/name, otherwise Run/History calls break.
  const agentId: string = String(raw.agentId ?? raw.id ?? raw.key ?? '').trim();

  return {
    agentId,
    enabled: Boolean(raw.enabled ?? raw.isEnabled ?? true),
    title: String((raw.title ?? raw.name ?? agentId) || 'Untitled'),
    description: String(raw.description ?? raw.desc ?? ''),
    // settings may be called config/overrides/etc.
    settings: (isPlainObject(raw.settings)
      ? raw.settings
      : isPlainObject(raw.config)
      ? raw.config
      : isPlainObject(raw.overrides)
      ? raw.overrides
      : {}) as Record<string, any>,
    // schema may be called settingsSchema/settings_schema
    schema: (raw.schema ?? raw.settingsSchema ?? raw.settings_schema) as any,
  };
}

function normalizeAgents(rawAgents: any): AgentConfig[] {
  if (!Array.isArray(rawAgents)) return [];
  return rawAgents
    .map((a) => (isPlainObject(a) ? normalizeAgent(a as AnyAgentLike) : null))
    .filter(Boolean) as AgentConfig[];
}


function fmtIso(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function isoToMs(iso?: string) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

type SortDir = 'desc' | 'asc';

function sortRunsByStartedAt(runs: AgentRun[], dir: SortDir): AgentRun[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...runs].sort((a, b) => {
    const ta = isoToMs(a.startedAt);
    const tb = isoToMs(b.startedAt);
    if (ta === tb) return 0;
    return ta < tb ? -1 * sign : 1 * sign;
  });
}


function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function stableStringify(v: any) {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v);
  }
}

function schemaDefaultFor(schema?: JsonSchema): any {
  if (!schema) return undefined;
  if (schema.default !== undefined) return schema.default;
  // Basic defaults by type
  if (schema.type === 'boolean') return false;
  if (schema.type === 'number' || schema.type === 'integer') return undefined;
  if (schema.type === 'string') return '';
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return undefined;
}

function schemaFieldLabel(key: string, schema?: JsonSchema) {
  const t = (schema?.title || '').trim();
  return t || key;
}

function schemaEffectiveValue(settings: Record<string, any> | undefined, key: string, schema?: JsonSchema) {
  const s = settings || {};
  if (Object.prototype.hasOwnProperty.call(s, key)) return s[key];
  return schemaDefaultFor(schema);
}

function schemaUiType(schema?: JsonSchema): 'boolean' | 'number' | 'string' | 'enum' | 'json' {
  if (!schema) return 'json';
  if (Array.isArray(schema.enum) && schema.enum.length) return 'enum';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'string') return 'string';
  // objects/arrays/unknown
  return 'json';
}


function StatusPill({ status }: { status: AgentRunStatus | 'enabled' | 'disabled' }) {
  const label = status;
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
        status === 'ok' && 'bg-green-50 text-green-700 border-green-200',
        status === 'error' && 'bg-red-50 text-red-700 border-red-200',
        status === 'running' && 'bg-blue-50 text-blue-700 border-blue-200',
        status === 'queued' && 'bg-slate-50 text-slate-700 border-slate-200',
        status === 'enabled' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
        status === 'disabled' && 'bg-gray-50 text-gray-600 border-gray-200'
      )}
    >
      {label}
    </span>
  );
}

function IconButton({
  title,
  onClick,
  children,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={classNames(
        'inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900',
        'hover:bg-neutral-100 active:bg-neutral-200',
        'focus:outline-none focus:ring-2 focus:ring-indigo-200',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function RightPanel({
  open,
  title,
  onClose,
  actions,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="w-full max-w-xl border-l border-neutral-200 bg-white h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5 gap-3">
        <div className="text-sm font-semibold text-neutral-900 truncate min-w-0">{title}</div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            Close
          </button>
        </div>
      </div>
      <div className="p-6 overflow-auto flex-1">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-neutral-800 mb-1">{label}</div>
      <input
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={classNames(
          'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900',
          'focus:outline-none focus:ring-2 focus:ring-indigo-200',
          disabled && 'bg-neutral-50 text-neutral-600'
        )}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: number | undefined;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-neutral-800 mb-1">{label}</div>
      <input
        disabled={disabled}
        type="number"
        value={typeof value === 'number' ? String(value) : ''}
        placeholder={placeholder}
        onChange={(e) => {
          const t = e.target.value;
          if (!t) return onChange(undefined);
          const n = Number(t);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        className={classNames(
          'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900',
          'focus:outline-none focus:ring-2 focus:ring-indigo-200',
          disabled && 'bg-neutral-50 text-neutral-600'
        )}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-neutral-800 mb-1">{label}</div>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={classNames(
          'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900',
          'focus:outline-none focus:ring-2 focus:ring-indigo-200',
          disabled && 'bg-neutral-50 text-neutral-600'
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const trackStyle: React.CSSProperties = {
    position: 'relative',
    width: 48,
    height: 28,
    borderRadius: 9999,
    border: '1px solid',
    borderColor: checked ? '#10b981' : '#d1d5db',
    backgroundColor: checked ? '#10b981' : '#d1d5db',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease, opacity 150ms ease',
    padding: 0,
  };

  const knobStyle: React.CSSProperties = {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 24,
    height: 24,
    borderRadius: 9999,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
    transform: `translateX(${checked ? 20 : 0}px)`,
    transition: 'transform 150ms ease',
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      style={trackStyle}
      className={classNames(
        // keep tailwind classes for when Tailwind is present
        'relative inline-flex h-7 w-12 items-center rounded-full border transition-colors',
        checked ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-300 border-gray-300',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )}
    >
      <span aria-hidden style={knobStyle} />
    </button>
  );
}
function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        gap: 12,
        alignItems: 'center',
      }}
      className={classNames('grid grid-cols-[240px_1fr] gap-3 items-center')}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }} className="text-xs font-medium text-neutral-800">
        {label}
      </div>
      <code
        style={{
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: 12,
          color: '#111827',
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        className="px-2 py-1 rounded border bg-gray-50 block truncate text-xs text-gray-900"
        title={value}
      >
        {value || '—'}
      </code>
    </div>
  );
}

function JsonDetails({ label, value }: { label: string; value: any }) {
  const oneLine = useMemo(() => {
    try {
      const s = JSON.stringify(value ?? {}, null, 0);
      return s.length > 240 ? s.slice(0, 240) + '…' : s;
    } catch {
      return String(value);
    }
  }, [value]);

  return (
    <details
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        background: '#ffffff',
        overflow: 'hidden',
      }}
      className="rounded-md border bg-white overflow-hidden"
    >
      <summary
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          padding: '10px 12px',
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 8,
          alignItems: 'center',
        }}
        className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-neutral-800 grid grid-cols-[180px_1fr] gap-2 items-center"
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
        <code
          style={{
            fontSize: 11,
            color: '#4b5563',
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
          className="text-[11px] font-normal text-gray-600 truncate px-2 py-1 rounded border bg-gray-50"
          title={oneLine}
        >
          {oneLine}
        </code>
      </summary>
      <pre
        style={{
          fontSize: 12,
          background: '#f9fafb',
          borderTop: '1px solid #e5e7eb',
          padding: 12,
          overflow: 'auto',
          maxHeight: 320,
          margin: 0,
        }}
        className="text-xs bg-gray-50 border-t p-3 overflow-auto max-h-80"
      >
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </details>
  );
}

function ReqItem({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        background: '#ffffff',
        alignItems: 'flex-start',
      }}
      className="flex items-start gap-3 rounded-md border bg-white p-3"
    >
      <div
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          border: '1px solid',
          borderColor: ok ? '#a7f3d0' : '#fde68a',
          color: ok ? '#047857' : '#b45309',
          background: ok ? '#ecfdf5' : '#fffbeb',
          marginTop: 2,
        }}
        className={classNames(
          'mt-0.5 h-5 w-5 rounded-full flex items-center justify-center text-[12px] font-extrabold border',
          ok ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200'
        )}
      >
        {ok ? '✓' : '!'}
      </div>
      <div style={{ minWidth: 0, flex: 1 }} className="min-w-0 flex-1">
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }} className="text-xs font-medium text-neutral-800">
          {label}
        </div>
        <code
          style={{
            marginTop: 6,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#f9fafb',
            fontSize: 12,
            color: '#111827',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          className="mt-1 px-2 py-1 rounded border bg-gray-50 block truncate text-xs text-gray-900"
          title={value}
        >
          {value}
        </code>
      </div>
    </div>
  );
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  return (await res.json()) as T;
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()) as T;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resolved, setResolved] = useState<ResolvedPayload | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAgent, setDrawerAgent] = useState<AgentConfig | null>(null);
  const [drawerRuns, setDrawerRuns] = useState<AgentRun[]>([]);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerSort, setDrawerSort] = useState<SortDir>('desc');
  const [drawerLoading, setDrawerLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const attempts = ['/api/agents', '/api/agents?source=repo', '/api/agents?fallback=1'];

    try {
      let lastErr: any = null;

      for (const url of attempts) {
        try {
          const data = await apiGet<GetAgentsResponse>(url);
          if (!data || !(data as any).ok) {
            const msg = (data as any)?.error ? String((data as any).error) : `Failed to load agents from ${url}`;
            throw new Error(msg);
          }
          setAgents(normalizeAgents((data as any).agents));
          setResolved((data as any).resolved || null);
          lastErr = null;
          break;
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (lastErr) throw lastErr;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Failed to load agents';

      // Provide a more actionable message for the common manifest-path error.
      if (msg.includes('Agents manifest not found')) {
        setError(
          [
            msg,
            '',
            'Troubleshooting:',
            '- Confirm repo manifest exists: /Users/paulwander/projects/HF/lib/agents.json',
            '- Confirm HF_KB_PATH is set (apps/admin/.env.local): HF_KB_PATH=/Users/paulwander/hf_kb',
            '- Confirm KB manifest exists if you expect it: $HF_KB_PATH/.hf/agents.manifest.json (or adjust server to look for agents.json)',
            '- Hit /api/agents in the browser to see the raw error payload.',
          ].join('\n')
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const body: SaveAgentsRequest = {
        agents: agents.map((a) => ({
          ...a,
          // include `id` for back-compat with manifest/server shapes
          id: (a as any).id ?? a.agentId,
        })) as any,
      };
      const resp = await apiPost<SaveAgentsResponse>('/api/agents', body);
      if (!resp.ok) throw new Error(resp.error);
      setAgents(normalizeAgents((resp as any).agents));
      // Re-fetch resolved paths after saving overrides
      try {
        const data = await apiGet<GetAgentsResponse>('/api/agents');
        if (data.ok) setResolved(data.resolved || null);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [agents]);

  const effectiveAgents = useMemo(() => {
    const eff = resolved?.effectiveAgents as any;
    if (Array.isArray(eff) && eff.length) return normalizeAgents(eff);
    return agents;
  }, [agents, resolved]);

  const agentRows = useMemo(() => {
    return effectiveAgents.map((agent) => ({ agent }));
  }, [effectiveAgents]);

  const sortedDrawerRuns = useMemo(() => {
    return sortRunsByStartedAt(drawerRuns, drawerSort);
  }, [drawerRuns, drawerSort]);

  const runAgent = useCallback(
    async (agentId: AgentId, dryRun: boolean) => {
      setRunningId(agentId);
      setError(null);
      try {
        if (!String(agentId || '').trim()) {
          throw new Error('Cannot run agent: missing agentId (check agents manifest)');
        }
        const body: RunAgentRequest = { agentId, dryRun };
        const resp = await apiPost<RunAgentResponse>('/api/agents/run', body);
        if (!resp.ok) throw new Error(resp.error);

        // Always open the history panel for the agent being run
        const a = effectiveAgents.find((x: any) => String(x.agentId ?? x.id) === agentId) as any;
        if (a) {
          setDrawerAgent(a);
          setDrawerOpen(true);
        }
        setDrawerRuns((prev) => [resp.run, ...prev]);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : 'Run failed');
      } finally {
        setRunningId(null);
      }
    },
    [effectiveAgents]
  );

  const openHistory = useCallback(async (agent: AgentConfig) => {
    setDrawerAgent(agent);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerRuns([]);
    setDrawerError(null);
    try {
      const agentId = String((agent as any).agentId ?? (agent as any).id ?? '');
      const resp = await apiGet<GetRunsResponse>(`/api/agents/runs?agentId=${agentId}&limit=200`);
      if (!resp.ok) throw new Error((resp as any).error);
      setDrawerRuns(resp.runs || []);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Failed to load history';
      setDrawerError(msg);
      setDrawerRuns([]);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerAgent(null);
    setDrawerRuns([]);
  }, []);

  const updateAgent = useCallback(
    (agentId: AgentId, patch: Partial<AgentConfig>) => {
      setAgents((prev) =>
        prev.map((a) => {
          const aId = String((a as any).agentId ?? (a as any).id ?? '');
          if (aId !== agentId) return a;
          const nextSettings = patch.settings ? { ...(a.settings || {}), ...(patch.settings || {}) } : (a.settings || {});
          const rest: any = { ...patch };
          delete rest.settings;
          return { ...a, ...rest, settings: nextSettings };
        })
      );
    },
    []
  );

  return (
    <div className="p-10 h-full bg-neutral-50">
      <div className="flex gap-6 h-full">
        {/* Left column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-neutral-900">Agents</h1>
              <p className="text-sm text-neutral-800 mt-2 leading-relaxed max-w-3xl">
                Toggle agents ON/OFF, configure non-path knobs, run on demand, and inspect run history with artifacts. All paths are resolved server-side from HF_KB_PATH.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={refresh}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={persist}
                className="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <pre className="whitespace-pre-wrap font-sans">{error}</pre>
            </div>
          ) : null}

          {!error && !loading && !resolved ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Server-resolved settings are unavailable (GET /api/agents did not return a{' '}
              <code className="px-1">resolved</code> payload).
            </div>
          ) : null}

          {/* Agent Cards Grid */}
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {agentRows.map(({ agent }, idx) => {
              const busy = runningId === agent.agentId;
              const cardKey = (String(agent.agentId || '').trim() || `${(agent.title || 'agent').trim()}:${idx}`);
              return (
                <AgentCard
                  key={cardKey}
                  agent={agent}
                  onUpdate={(patch) => updateAgent(agent.agentId, patch)}
                  onRun={(dryRun) => runAgent(agent.agentId, dryRun)}
                  onViewHistory={() => openHistory(agent)}
                  isRunning={busy}
                />
              );
            })}
          </div>

          {!agentRows.length && !loading ? (
            <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-gray-600">
              No agents configured.
            </div>
          ) : null}

          {loading ? (
            <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-10 text-center text-sm text-gray-600">
              Loading agents...
            </div>
          ) : null}

          <div className="mt-8 overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-6 py-6">
              <div className="text-sm font-medium">Runtime settings (read-only)</div>
              <div className="text-xs text-neutral-700 mt-1">
                Paths are resolved server-side from HF_KB_PATH and are always read-only here. Agent settings are rendered from each agent’s schema.
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <KvRow label="HF_KB_PATH (env)" value={String(resolved?.env?.HF_KB_PATH || '')} />
                <KvRow label="Effective KB root (server)" value={String(resolved?.layout?.root || '')} />
                <KvRow label="Sources dir" value={String(resolved?.layout?.sourcesDir || '')} />
                <KvRow label="Derived dir" value={String(resolved?.layout?.derivedDir || '')} />
                <KvRow label="Vectors dir" value={String(resolved?.layout?.vectorsDir || '')} />
                <KvRow label="Pages dir" value={String(resolved?.layout?.pagesDir || '')} />
                <KvRow label="Agents store (server)" value={String(resolved?.storePath || '')} />
              </div>

              <div className="pt-2">
                <div className="text-xs font-medium text-neutral-800 mb-2">Required paths</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <ReqItem ok={Boolean(resolved?.layout?.sourcesDir)} label="sources/" value={String(resolved?.layout?.sourcesDir || 'sources/')} />
                  <ReqItem
                    ok={Boolean(resolved?.layout?.root)}
                    label="transcripts/raw/"
                    value={String(resolved?.layout?.root ? `${resolved.layout.root}/transcripts/raw` : 'transcripts/raw')}
                  />
                  <ReqItem
                    ok={Boolean(resolved?.layout?.root)}
                    label="parameters/raw/parameters.csv"
                    value={String(
                      resolved?.layout?.root
                        ? `${resolved.layout.root}/parameters/raw/parameters.csv`
                        : 'parameters/raw/parameters.csv'
                    )}
                  />
                  <ReqItem ok={Boolean(resolved?.layout?.derivedDir)} label="derived/ (auto-created)" value={String(resolved?.layout?.derivedDir || 'derived/')} />
                </div>
              </div>

              {resolved?.defaults || resolved?.overrides ? (
                <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <JsonDetails label="Defaults (server)" value={resolved?.defaults ?? {}} />
                  <JsonDetails label="Overrides (stored)" value={resolved?.overrides ?? {}} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 text-xs text-neutral-600">
            Data source: <code className="px-1">/api/agents</code> (agents + resolved env/layout + defaults/overrides when available),{' '}
            <code className="px-1">/api/agents/run</code> (run), <code className="px-1">/api/agents/runs</code> (history).
          </div>
        </div>

        {/* Right column */}
        <RightPanel
          open={drawerOpen}
          title={drawerAgent ? `${drawerAgent.title} — Run history` : 'Run history'}
          onClose={closeDrawer}
          actions={
            <button
              type="button"
              onClick={() => setDrawerSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              title="Toggle sort order"
            >
              Sort: {drawerSort === 'desc' ? 'Newest' : 'Oldest'}
            </button>
          }
        >
          {drawerLoading ? (
            <div className="text-sm text-neutral-700">Loading…</div>
          ) : drawerError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <pre className="whitespace-pre-wrap font-sans">{drawerError}</pre>
            </div>
          ) : sortedDrawerRuns.length ? (
            <div className="space-y-3">
              {sortedDrawerRuns.map((r) => (
                <div key={r.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-neutral-900 truncate">
                        <span className="font-semibold">{r.agentTitle ?? r.agentId}</span>
                        {r.summary ? <span className="text-neutral-600"> — {r.summary}</span> : null}
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-xs text-neutral-800 mt-2">
                    Started: {fmtIso(r.startedAt)}
                    {r.finishedAt ? ` • Finished: ${fmtIso(r.finishedAt)}` : ''}
                  </div>
                  {r.opid ? (
                    <div className="text-xs text-neutral-800 mt-1">
                      Ops: <code className="px-1 rounded bg-neutral-100 text-neutral-900">{r.opid}</code>
                      {r.dryRun ? <span className="ml-2 text-neutral-700">(dry-run)</span> : null}
                    </div>
                  ) : null}

                  {r.artifacts?.length ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-neutral-900 mb-2">Artifacts</div>
                      <ul className="text-xs text-neutral-900 list-disc pl-5">
                        {r.artifacts.map((a, idx) => (
                          <li key={String(a.path ?? a.opid ?? a.label ?? idx)}>
                            <span className="mr-2 text-neutral-600">[{a.kind}]</span>
                            {a.path ? (
                              <code className="px-1">{a.path}</code>
                            ) : a.opid ? (
                              <code className="px-1">{a.opid}</code>
                            ) : (
                              <span>{a.label}</span>
                            )}
                            {a.label ? <span className="ml-2 text-neutral-600">— {a.label}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-neutral-600">No artifacts recorded for this run.</div>
                  )}

                  {(r.stdout || r.stderr) && (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      {r.stdout ? (
                        <div>
                          <div className="text-xs font-medium text-neutral-800">stdout</div>
                          <pre className="mt-2 text-xs bg-neutral-50 border border-neutral-200 rounded-md p-3 overflow-auto max-h-48 text-neutral-900">{r.stdout}</pre>
                        </div>
                      ) : null}
                      {r.stderr ? (
                        <div>
                          <div className="text-xs font-medium text-neutral-800">stderr</div>
                          <pre className="mt-2 text-xs bg-neutral-50 border border-neutral-200 rounded-md p-3 overflow-auto max-h-48 text-neutral-900">{r.stderr}</pre>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-700">No runs yet. Use Run or Dry-run.</div>
          )}

          <div className="mt-6 text-xs text-neutral-700 border-t border-neutral-200 pt-4">
            Note: history is loaded from <code className="px-1">/api/agents/runs</code> (if implemented).
          </div>
        </RightPanel>
      </div>
    </div>
  );
}