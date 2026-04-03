'use client';

/**
 * LogViewer — unified log viewer for popup (status bar) and fullscreen (page/overlay).
 *
 * Two modes:
 *   - "popup": compact flyout anchored to status bar Logs chip
 *   - "fullscreen": full-featured page view (used on /x/logs or as overlay)
 *
 * Tabs: All | AI | System | Errors
 * Fetches from /api/logs/ai-calls. Polls while open.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ExternalLink, FileText, Zap, Maximize2, Minimize2,
  Copy, ClipboardCopy, RefreshCw,
} from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import type { LogEntry, LogType } from '@/lib/log-types';
import {
  ALL_TYPES, LOG_TYPE_COLORS, isDeepEntry, isErrorEntry, timeAgo, formatForClaude,
  deriveStatus, LOG_STATUS_COLORS,
} from '@/lib/log-types';

// ── Types ──────────────────────────────────────────────

export type LogViewerMode = 'popup' | 'fullscreen';
type LogTab = 'all' | 'ai' | 'system' | 'errors';

const TABS: { id: LogTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: 'AI' },
  { id: 'system', label: 'System' },
  { id: 'errors', label: 'Errors' },
];

interface LogViewerProps {
  mode: LogViewerMode;
  // Popup-mode props
  open?: boolean;
  onClose?: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  deepLogging?: boolean;
  onToggleDeepLogging?: () => void;
  onExpand?: () => void;
  // Fullscreen-mode props
  onMinimize?: () => void;
}

// ── Helpers ────────────────────────────────────────────

const DEEP_BADGE = { bg: 'var(--status-error-text)', text: 'var(--surface-primary)' };

const STATUS_LABELS: Record<string, string> = { ok: 'OK', error: 'Error', slow: 'Slow', neutral: '' };

/** Title-case a kebab/snake segment: "suggest-outcomes" → "Suggest Outcomes" */
function humanize(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Derive wizard + step from stage string: "pipeline:extract" → { wizardName: "Pipeline", wizardStep: "Extract" } */
function deriveWizardStep(stage?: string): { wizardName: string; wizardStep: string } | null {
  if (!stage) return null;
  const clean = stage.replace(/:error$/, '');
  const colonIdx = clean.indexOf(':');
  if (colonIdx < 1) return null;
  const prefix = clean.slice(0, colonIdx);
  const suffix = clean.slice(colonIdx + 1);
  if (!suffix) return null;
  return { wizardName: humanize(prefix), wizardStep: humanize(suffix) };
}

function getLogContext(log: LogEntry): { userName?: string; entityLabel?: string; wizardName?: string; wizardStep?: string } {
  const m = log.metadata;
  const userName = (m?.userName as string) || undefined;
  const entityLabel = (m?.entityLabel as string) || undefined;
  let wizardName = (m?.wizardName as string) || undefined;
  let wizardStep = (m?.wizardStep as string) || undefined;

  // Always derive wizard+step from stage when not in metadata
  if (!wizardName || !wizardStep) {
    const derived = deriveWizardStep(log.stage);
    if (derived) {
      wizardName = wizardName || derived.wizardName;
      wizardStep = wizardStep || derived.wizardStep;
    }
  }

  return { userName, entityLabel, wizardName, wizardStep };
}

function getFilteredLogs(logs: LogEntry[], tab: LogTab, typeFilter: LogType[], deepOnly: boolean): LogEntry[] {
  let result = logs;
  if (tab === 'ai') result = result.filter(l => l.type === 'ai');
  else if (tab === 'system') result = result.filter(l => l.type === 'system');
  else if (tab === 'errors') result = result.filter(isErrorEntry);
  else if (typeFilter.length < ALL_TYPES.length) result = result.filter(l => typeFilter.includes(l.type));
  if (deepOnly) result = result.filter(isDeepEntry);
  return result;
}

// ── Component ──────────────────────────────────────────

export function LogViewer({
  mode, open, onClose, anchorRef, deepLogging, onToggleDeepLogging, onExpand, onMinimize,
}: LogViewerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LogTab>('all');
  const [typeFilter, setTypeFilter] = useState<LogType[]>([...ALL_TYPES]);
  const [deepOnly, setDeepOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const { copiedKey: copied, copy: copyToClipboard } = useCopyToClipboard();
  const cursorRef = useRef<string | null>(null);

  const isPopup = mode === 'popup';
  const isFullscreen = mode === 'fullscreen';

  // ── Data fetching (cursor-based) ──

  const fetchLogs = useCallback(async (full?: boolean) => {
    try {
      const params = new URLSearchParams();
      if (isFullscreen && typeFilter.length < ALL_TYPES.length) {
        params.set('type', typeFilter.join(','));
      }
      // Use cursor for incremental polls (not on first load or full refresh)
      if (!full && cursorRef.current) {
        params.set('since', cursorRef.current);
      }
      const qs = params.toString();
      const res = await fetch(`/api/logs/ai-calls${qs ? `?${qs}` : ''}`);

      // 304 = no new entries since cursor
      if (res.status === 304) return;
      if (!res.ok) return;

      const data = await res.json();
      const raw: LogEntry[] = data.logs || [];

      if (cursorRef.current && !full && raw.length > 0) {
        // Merge new entries at the front, cap at 100
        setLogs(prev => {
          const merged = [...raw, ...prev];
          return (isPopup ? merged.slice(0, 8) : merged.slice(0, 100));
        });
      } else {
        setLogs(isPopup ? raw.slice(0, 8) : raw);
      }

      if (data.latest) cursorRef.current = data.latest;
      if (typeof data.loggingEnabled === 'boolean') setLoggingEnabled(data.loggingEnabled);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [isPopup, isFullscreen, typeFilter]);

  // Fetch on open/mount + polling
  useEffect(() => {
    if (isPopup && !open) return;
    setLoading(true);
    cursorRef.current = null; // Reset cursor on mount/reopen
    fetchLogs(true); // Full fetch on first load
    if (!autoRefresh && isFullscreen) return;
    const interval = setInterval(() => fetchLogs(), isPopup ? 5000 : 4000);
    return () => clearInterval(interval);
  }, [isPopup, open, fetchLogs, autoRefresh, isFullscreen]);

  // ── Outside-click + Escape (popup only) ──

  useEffect(() => {
    if (!isPopup || !open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        anchorRef?.current && !anchorRef.current.contains(target)
      ) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isPopup, open, onClose, anchorRef]);

  useEffect(() => {
    if (!isPopup || !open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPopup, open, onClose]);

  // ── Derived ──

  const filteredLogs = getFilteredLogs(logs, activeTab, typeFilter, deepOnly);
  const errorCount = logs.filter(isErrorEntry).length;
  const aiCount = filteredLogs.filter(l => l.type === 'ai').length;
  const deepCount = logs.filter(isDeepEntry).length;
  const totalTokens = filteredLogs.reduce(
    (sum, l) => sum + (l.usage?.inputTokens || 0) + (l.usage?.outputTokens || 0), 0,
  );

  // ── Actions (fullscreen only) ──

  const toggleLogging = async (enabled: boolean) => {
    setLoggingEnabled(enabled);
    try {
      await fetch('/api/logs/ai-calls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
    } catch (err) { console.error("[LogViewer] Failed to toggle logging:", err); }
  };

  const clearLogs = async () => {
    await fetch('/api/logs/ai-calls', { method: 'DELETE' });
    cursorRef.current = null;
    fetchLogs(true);
  };

  const toggleTypeFilter = (type: LogType) => {
    setTypeFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
    );
  };

  const copyAllLogs = () => copyToClipboard(filteredLogs.map(l => JSON.stringify(l)).join('\n'), 'all');

  // ── Early exit for popup when closed ──

  if (isPopup && !open) return null;

  // ── Tab strip (shared) ──

  const tabStrip = (
    <div className="logs-viewer-tabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`logs-viewer-tab${activeTab === tab.id ? ' logs-viewer-tab-active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
          {tab.id === 'errors' && errorCount > 0 && (
            <span className="logs-viewer-tab-badge">
              {errorCount > 99 ? '99+' : errorCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  // ── Type badge helper ──

  const typeBadge = (log: LogEntry) => {
    const colors = LOG_TYPE_COLORS[log.type] || LOG_TYPE_COLORS.ai;
    return (
      <span
        className="logs-viewer-type-badge"
        style={{ background: colors.bg, color: colors.text }}
      >
        {log.type}
      </span>
    );
  };

  const deepBadge = (log: LogEntry) =>
    isDeepEntry(log) ? <span className="logs-viewer-deep-badge">DEEP</span> : null;

  const statusDot = (log: LogEntry) => {
    const status = deriveStatus(log);
    return (
      <span
        className="logs-viewer-status-dot"
        style={{ background: LOG_STATUS_COLORS[status] }}
        title={STATUS_LABELS[status] || undefined}
      />
    );
  };

  const contextLine = (log: LogEntry) => {
    const ctx = getLogContext(log);
    if (!ctx) return null;
    const parts: string[] = [];
    if (ctx.userName) parts.push(ctx.userName);
    if (ctx.entityLabel) parts.push(ctx.entityLabel);
    if (ctx.wizardName && ctx.wizardStep) parts.push(`${ctx.wizardName} \u203a ${ctx.wizardStep}`);
    else if (ctx.wizardName) parts.push(ctx.wizardName);
    else if (ctx.wizardStep) parts.push(ctx.wizardStep);
    if (parts.length === 0) return null;
    return (
      <div className="logs-viewer-context-line">
        {statusDot(log)}
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="logs-viewer-context-sep">{'\u00b7'}</span>}
            <span className="logs-viewer-context-chip">{part}</span>
          </span>
        ))}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // POPUP MODE
  // ════════════════════════════════════════════════════════

  if (isPopup) {
    return (
      <div className="logs-popup" ref={panelRef}>
        {/* Header */}
        <div className="jobs-popup-header">
          <span className="jobs-popup-title">Logs</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onToggleDeepLogging && (
              <button
                className={`logs-popup-deep-toggle${deepLogging ? ' logs-popup-deep-toggle-active' : ''}`}
                onClick={onToggleDeepLogging}
                title={deepLogging ? 'Deep logging ON (click to turn off)' : 'Deep logging OFF (click to turn on)'}
              >
                <Zap size={11} />
                <span>Deep</span>
              </button>
            )}
            {onExpand && (
              <button className="logs-popup-expand" onClick={onExpand} title="Expand to fullscreen">
                <Maximize2 size={13} />
              </button>
            )}
            <button className="jobs-popup-close" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="calls-popup-stats">
          <div className="calls-popup-stat">
            <span className="calls-popup-stat-value">{logs.length}</span>
            <span className="calls-popup-stat-label">Recent</span>
          </div>
          <div className="calls-popup-stat-divider" />
          <div className="calls-popup-stat">
            <span className="calls-popup-stat-value">{logs.filter(l => l.type === 'ai').length}</span>
            <span className="calls-popup-stat-label">AI</span>
          </div>
          <div className="calls-popup-stat-divider" />
          <div className="calls-popup-stat">
            <span className="calls-popup-stat-value">{totalTokens > 0 ? `${Math.round(totalTokens / 1000)}k` : '0'}</span>
            <span className="calls-popup-stat-label">Tokens</span>
          </div>
          <div className="calls-popup-stat-divider" />
          <div className="calls-popup-stat">
            <span className="calls-popup-stat-value" style={deepCount > 0 ? { color: 'var(--status-error-text)' } : undefined}>{deepCount}</span>
            <span className="calls-popup-stat-label">Deep</span>
          </div>
        </div>

        {/* Tabs */}
        {tabStrip}

        {/* Body */}
        <div className="jobs-popup-body">
          {loading ? (
            <div className="jobs-popup-loading"><span className="hf-spinner" /></div>
          ) : filteredLogs.length === 0 ? (
            <div className="jobs-popup-empty">
              {activeTab === 'errors'
                ? 'No errors detected.'
                : `No ${activeTab === 'all' ? '' : activeTab + ' '}log entries yet.`}
              {activeTab === 'all' && !deepLogging && ' Toggle Deep to capture full AI prompts.'}
            </div>
          ) : (
            <div className="jobs-popup-section">
              <div className="jobs-popup-section-label">Recent</div>
              {filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="jobs-popup-row"
                  onClick={() => {
                    onClose?.();
                    window.open('/x/logs', '_blank');
                  }}
                >
                  <div className="jobs-popup-row-icon">
                    <FileText size={13} />
                  </div>
                  <div className="jobs-popup-row-content">
                    {(() => {
                      const ctx = getLogContext(log);
                      const wiz = ctx.wizardName && ctx.wizardStep
                        ? `${ctx.wizardName} \u203a ${ctx.wizardStep}`
                        : ctx.wizardName || ctx.wizardStep || log.stage;
                      return (
                        <div className="jobs-popup-row-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {statusDot(log)}
                          {typeBadge(log)}
                          {deepBadge(log)}
                          <span style={{ fontSize: 12 }}>{wiz}</span>
                        </div>
                      );
                    })()}
                    <div className="jobs-popup-row-meta">
                      {timeAgo(log.timestamp)}
                      {log.durationMs ? ` \u00b7 ${log.durationMs}ms` : ''}
                      {log.usage?.inputTokens ? ` \u00b7 ${log.usage.inputTokens + (log.usage?.outputTokens || 0)} tok` : ''}
                    </div>
                  </div>
                  <button
                    className="logs-popup-copy-btn"
                    title="Copy full log entry"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(formatForClaude(log), `popup-${idx}`); }}
                  >
                    {copied === `popup-${idx}` ? <ClipboardCopy size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="jobs-popup-footer">
          <button
            className="jobs-popup-viewall"
            onClick={() => { onClose?.(); window.open('/x/logs', '_blank'); }}
          >
            View All Logs <ExternalLink size={11} />
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // FULLSCREEN MODE
  // ════════════════════════════════════════════════════════

  const estimatedCost = (totalTokens / 1000000) * 3;

  return (
    <div className="logs-viewer-fullscreen">
      {/* Header */}
      <div className="logs-viewer-header">
        <div>
          <h1 className="hf-page-title">Logs</h1>
          <p className="logs-viewer-subtitle">
            {filteredLogs.length} entries{deepOnly ? ` (${deepCount} deep)` : ''}
            {aiCount > 0 && ` | ${totalTokens.toLocaleString()} tokens | ~$${estimatedCost.toFixed(4)}`}
          </p>
        </div>
        <div className="logs-viewer-toolbar">
          <label className="hf-flex hf-gap-xs hf-items-center hf-text-sm">
            <input
              type="checkbox"
              checked={loggingEnabled}
              onChange={(e) => toggleLogging(e.target.checked)}
            />
            Logging {loggingEnabled ? 'ON' : 'OFF'}
          </label>
          <span className="logs-viewer-separator" />
          <label className="hf-flex hf-gap-xs hf-items-center hf-text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={() => { cursorRef.current = null; fetchLogs(true); }} className="hf-btn hf-btn-primary hf-btn-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={copyAllLogs}
            disabled={filteredLogs.length === 0}
            className="hf-btn hf-btn-secondary hf-btn-sm"
          >
            {copied === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          <button onClick={clearLogs} className="hf-btn hf-btn-destructive hf-btn-sm">
            Clear
          </button>
          {onMinimize && (
            <button onClick={onMinimize} className="hf-btn hf-btn-secondary hf-btn-sm" title="Minimize to popup">
              <Minimize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {tabStrip}

      {/* Type filter chips (hidden on Errors tab) */}
      {activeTab !== 'errors' && (
        <div className="logs-viewer-filter-row">
          {ALL_TYPES.map(type => {
            const isActive = typeFilter.includes(type);
            const colors = LOG_TYPE_COLORS[type];
            return (
              <button
                key={type}
                onClick={() => toggleTypeFilter(type)}
                className="hf-filter-pill"
                style={isActive ? {
                  border: `1px solid color-mix(in srgb, ${colors.text} 25%, transparent)`,
                  background: colors.bg,
                  color: colors.text,
                } : undefined}
              >
                {type.toUpperCase()}
              </button>
            );
          })}
          <span className="logs-viewer-separator" />
          <button
            onClick={() => setDeepOnly(v => !v)}
            className="hf-filter-pill"
            style={deepOnly ? {
              background: DEEP_BADGE.bg,
              color: DEEP_BADGE.text,
              border: `1px solid ${DEEP_BADGE.bg}`,
            } : undefined}
          >
            DEEP {deepCount > 0 ? `(${deepCount})` : ''}
          </button>
        </div>
      )}

      {/* Log list */}
      {loading ? (
        <div className="hf-empty-compact"><div className="hf-spinner" /></div>
      ) : filteredLogs.length === 0 ? (
        <div className="hf-empty-compact">
          <div className="hf-text-muted">
            {activeTab === 'errors'
              ? 'No errors detected. System is healthy.'
              : deepOnly
                ? 'No deep log entries. Toggle deep logging ON in the status bar, then run a wizard or pipeline.'
                : 'No logs yet. Activity will appear here.'}
          </div>
        </div>
      ) : (
        <div className="logs-viewer-list">
          {filteredLogs.map((log, idx) => {
            const isExpanded = expandedLog === idx;
            const inputTokens = log.usage?.inputTokens || 0;
            const outputTokens = log.usage?.outputTokens || 0;
            const isDeep = isDeepEntry(log);
            const isError = isErrorEntry(log);

            return (
              <div
                key={idx}
                className={`logs-viewer-card${isError ? ' logs-viewer-card-error' : ''}${isDeep ? ' logs-viewer-card-deep' : ''}`}
              >
                {/* Context line — always shows wizard › step + optional user/entity */}
                {contextLine(log)}
                {/* Row header */}
                <div
                  className="logs-viewer-card-row"
                  onClick={() => setExpandedLog(isExpanded ? null : idx)}
                >
                  <div className="logs-viewer-card-row-left">
                    {typeBadge(log)}
                    {deepBadge(log)}
                    <span className="logs-viewer-stage-chip">{log.stage}</span>
                    <span className="logs-viewer-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {log.message && (
                      <span className="logs-viewer-stage-chip" style={{ color: 'var(--text-secondary)', background: 'transparent' }}>
                        {log.message.slice(0, 50)}{log.message.length > 50 ? '...' : ''}
                      </span>
                    )}
                  </div>
                  <div className="logs-viewer-card-row-right">
                    {log.type === 'ai' && (
                      <>
                        <span className="logs-viewer-token-stat">
                          <strong>{inputTokens.toLocaleString()}</strong> in
                        </span>
                        <span className="logs-viewer-token-stat">
                          <strong>{outputTokens.toLocaleString()}</strong> out
                        </span>
                        <span className="hf-text-muted">
                          {(log.promptLength || 0).toLocaleString()} chars
                        </span>
                      </>
                    )}
                    {log.durationMs && <span className="hf-text-muted">{log.durationMs}ms</span>}
                    {/* Copy buttons */}
                    <div className="logs-viewer-card-copy-row">
                      {log.type === 'ai' && log.promptPreview && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(log.promptPreview!, `prompt-${idx}`); }}
                          className="hf-btn hf-btn-secondary hf-btn-sm"
                        >
                          <Copy size={12} />
                          {copied === `prompt-${idx}` ? 'Copied!' : 'Prompt'}
                        </button>
                      )}
                      {log.type === 'ai' && log.responsePreview && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(log.responsePreview!, `response-${idx}`); }}
                          className="hf-btn hf-btn-secondary hf-btn-sm"
                        >
                          <FileText size={12} />
                          {copied === `response-${idx}` ? 'Copied!' : 'Response'}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(formatForClaude(log), `full-${idx}`); }}
                        className="hf-btn hf-btn-secondary hf-btn-sm"
                      >
                        <ClipboardCopy size={12} />
                        {copied === `full-${idx}` ? 'Copied!' : 'Full'}
                      </button>
                    </div>
                    <span className="logs-viewer-expand-arrow">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="logs-viewer-card-detail">
                    {/* Prompt */}
                    {log.type === 'ai' && log.promptPreview && (
                      <div>
                        <div className="logs-viewer-pre-label">
                          PROMPT ({(log.promptLength || 0).toLocaleString()} chars)
                          {isDeep && <span className="logs-viewer-deep-tag">FULL</span>}
                        </div>
                        <pre className={`logs-viewer-pre${isDeep ? ' logs-viewer-pre-deep' : ''}`}>
                          {log.promptPreview}
                        </pre>
                      </div>
                    )}

                    {/* Response */}
                    {log.type === 'ai' && log.responsePreview && (
                      <div>
                        <div className="logs-viewer-pre-label">
                          RESPONSE ({(log.responseLength || 0).toLocaleString()} chars)
                          {isDeep && <span className="logs-viewer-deep-tag">FULL</span>}
                        </div>
                        <pre className={`logs-viewer-pre${isDeep ? ' logs-viewer-pre-deep' : ''}`}>
                          {log.responsePreview}
                        </pre>
                      </div>
                    )}

                    {/* Metadata */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div>
                        <div className="logs-viewer-pre-label">METADATA</div>
                        <pre className="logs-viewer-pre">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
