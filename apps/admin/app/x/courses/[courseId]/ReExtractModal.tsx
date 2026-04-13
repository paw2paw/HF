'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { getDocTypeInfo } from '@/lib/doc-type-icons';
import { useSourceStatus } from '@/hooks/useSourceStatus';
import { EXTRACTOR_VERSION, isExtractionOutdated } from '@/lib/content-trust/extractors/registry';

// ── Types ──────────────────────────────────────────────

type SourceItem = {
  id: string;
  name: string;
  documentType: string;
  extractorVersion: number | null;
  assertionCount: number;
};

type ReExtractResult = {
  sourceId: string;
  name: string;
  jobId: string | null;
  error?: string;
};

type Phase = 'select' | 'confirm' | 'extracting' | 'recomposing' | 'done';

interface ReExtractModalProps {
  courseId: string;
  sources: SourceItem[];
  onClose: () => void;
  onComplete: () => void;
}

// ── Component ──────────────────────────────────────────

export function ReExtractModal({ courseId, sources, onClose, onComplete }: ReExtractModalProps) {
  // Pre-select sources with outdated extractor version
  const [selected, setSelected] = useState<Set<string>>(() => {
    const outdated = sources.filter((s) => isExtractionOutdated(s.extractorVersion));
    return new Set(outdated.map((s) => s.id));
  });
  const [phase, setPhase] = useState<Phase>('select');
  const [error, setError] = useState<string | null>(null);
  const [activeCallerCount, setActiveCallerCount] = useState(0);
  const [extractResults, setExtractResults] = useState<ReExtractResult[]>([]);
  const [recomposeResult, setRecomposeResult] = useState<{ composed: number; failed: number } | null>(null);
  const completedRef = useRef(false);

  // Track extraction progress for in-flight sources
  const extractingIds = extractResults
    .filter((r) => r.jobId)
    .map((r) => r.sourceId);
  const statusMap = useSourceStatus(extractingIds, {
    enabled: phase === 'extracting' && extractingIds.length > 0,
    pollInterval: 5_000,
  });

  // Check if all extractions are done
  const allExtracted = phase === 'extracting'
    && extractingIds.length > 0
    && extractingIds.every((id) => {
      const s = statusMap[id];
      return s && s.assertionCount > 0;
    });

  // Auto-trigger recompose when extractions finish
  useEffect(() => {
    if (allExtracted && !completedRef.current) {
      completedRef.current = true;
      triggerRecompose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allExtracted]);

  const totalAssertions = sources
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + s.assertionCount, 0);

  const toggleSource = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === sources.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sources.map((s) => s.id)));
    }
  };

  const handleConfirm = async () => {
    setPhase('extracting');
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/re-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to start re-extraction');
        setPhase('confirm');
        return;
      }
      setExtractResults(data.sources || []);
      setActiveCallerCount(data.activeCallerCount || 0);

      // If no jobs were triggered (all failed), go to done
      const triggered = (data.sources || []).filter((s: ReExtractResult) => s.jobId);
      if (triggered.length === 0) {
        setPhase('done');
      }
    } catch {
      setError('Network error');
      setPhase('confirm');
    }
  };

  const triggerRecompose = useCallback(async () => {
    if (activeCallerCount === 0) {
      setPhase('done');
      return;
    }
    setPhase('recomposing');
    try {
      const res = await fetch(`/api/courses/${courseId}/re-extract/recompose`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setRecomposeResult({ composed: data.composed, failed: data.failed });
      }
    } catch {
      // Non-fatal — extraction still succeeded
    }
    setPhase('done');
  }, [courseId, activeCallerCount]);

  const canClose = phase === 'select' || phase === 'confirm' || phase === 'done';

  return (
    <div className="hf-modal-overlay" onClick={() => canClose && onClose()}>
      <div className="hf-modal" style={{ maxWidth: 560, padding: 24 }} onClick={(e) => e.stopPropagation()}>

        {/* ── Title ── */}
        <h3 className="hf-modal-title hf-flex hf-items-center hf-gap-sm">
          <RefreshCw size={18} />
          Re-extract Content
        </h3>

        {/* ── Phase: Select sources ── */}
        {(phase === 'select' || phase === 'confirm') && (
          <>
            <p className="hf-text-sm hf-text-muted hf-mb-md">
              Select sources to re-extract. Existing assertions will be purged and rebuilt from the original documents.
              {sources.some((s) => isExtractionOutdated(s.extractorVersion)) && (
                <> Sources marked <strong>Outdated</strong> were extracted with an older version and are pre-selected.</>
              )}
            </p>

            {/* Select All toggle */}
            <label className="hf-flex hf-items-center hf-gap-sm hf-mb-sm hf-text-sm" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selected.size === sources.length}
                onChange={toggleAll}
                className="hf-checkbox"
              />
              <span className="hf-text-bold">Select all ({sources.length})</span>
            </label>

            {/* Source checklist */}
            <div className="hf-card-compact hf-mb-md" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {sources.map((src) => {
                const info = getDocTypeInfo(src.documentType);
                const Icon = info.icon;
                const outdated = isExtractionOutdated(src.extractorVersion);
                return (
                  <label
                    key={src.id}
                    className="hf-flex hf-items-center hf-gap-sm hf-link-row"
                    style={{ cursor: 'pointer', padding: '8px 12px' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(src.id)}
                      onChange={() => toggleSource(src.id)}
                      className="hf-checkbox"
                    />
                    <Icon size={16} style={{ color: info.color, flexShrink: 0 }} />
                    <div className="hf-flex-1">
                      <div className="hf-text-sm hf-text-secondary">{src.name}</div>
                    </div>
                    {outdated && (
                      <span className="hf-badge hf-badge-sm hf-badge-warning">Outdated</span>
                    )}
                    <span className="hf-badge hf-badge-sm" style={{ color: info.color, borderColor: info.color }}>
                      {info.label}
                    </span>
                    <span className="hf-text-xs hf-text-placeholder">
                      {src.assertionCount} pts
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Confirmation warning */}
            {phase === 'confirm' && selected.size > 0 && (
              <div className="hf-banner hf-banner-warning hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div className="hf-flex hf-items-center hf-gap-xs hf-text-bold hf-text-sm">
                  <AlertTriangle size={14} />
                  Confirm re-extraction
                </div>
                <div className="hf-text-sm hf-mt-xs">
                  {selected.size} source{selected.size === 1 ? '' : 's'} selected
                  {totalAssertions > 0 && ` — ${totalAssertions} assertions will be purged and rebuilt`}.
                  {' '}Active callers will have prompts recomposed automatically.
                </div>
                <div className="hf-text-xs hf-text-muted hf-mt-xs">
                  If extraction fails mid-run, affected sources will have no content until retried.
                </div>
              </div>
            )}

            {error && (
              <div className="hf-banner hf-banner-error hf-mb-md">{error}</div>
            )}

            {/* Actions */}
            <div className="hf-modal-actions">
              <button onClick={onClose} className="hf-btn hf-btn-secondary">
                Cancel
              </button>
              {phase === 'select' ? (
                <button
                  onClick={() => setPhase('confirm')}
                  disabled={selected.size === 0}
                  className="hf-btn hf-btn-primary"
                >
                  Next — {selected.size} selected
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0}
                  className="hf-btn hf-btn-warning"
                >
                  Re-extract {selected.size} source{selected.size === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Phase: Extracting ── */}
        {phase === 'extracting' && (
          <>
            <div className="hf-banner hf-banner-info hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="hf-text-bold hf-text-sm">Extracting content...</div>
              <div className="hf-text-sm hf-mt-xs">
                {extractingIds.filter((id) => statusMap[id]?.assertionCount > 0).length}/{extractingIds.length} sources complete
              </div>
            </div>

            <div className="hf-card-compact hf-mb-md">
              {extractResults.map((r) => {
                const src = sources.find((s) => s.id === r.sourceId);
                const info = src ? getDocTypeInfo(src.documentType) : null;
                const Icon = info?.icon;
                const status = statusMap[r.sourceId];
                const isDone = status && status.assertionCount > 0;

                return (
                  <div key={r.sourceId} className={`hf-flex hf-items-center hf-gap-sm ${r.jobId && !isDone ? 'hf-glow-active' : ''}`} style={{ padding: '8px 12px' }}>
                    {Icon && <Icon size={16} style={{ color: info!.color, flexShrink: 0 }} />}
                    <span className="hf-flex-1 hf-text-sm hf-text-secondary">{r.name}</span>
                    {r.error ? (
                      <span className="hf-text-xs hf-text-error">{r.error}</span>
                    ) : isDone ? (
                      <CheckCircle size={14} className="hf-text-success" />
                    ) : (
                      <span className="hf-spinner" style={{ width: 14, height: 14 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Phase: Recomposing ── */}
        {phase === 'recomposing' && (
          <div className="hf-banner hf-banner-info hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="hf-text-bold hf-text-sm">Recomposing prompts for active callers...</div>
            <div className="hf-text-sm hf-mt-xs hf-text-muted">
              Updating {activeCallerCount} caller{activeCallerCount === 1 ? '' : 's'} with fresh content
            </div>
          </div>
        )}

        {/* ── Phase: Done ── */}
        {phase === 'done' && (
          <>
            <div className="hf-banner hf-banner-success hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="hf-flex hf-items-center hf-gap-xs hf-text-bold hf-text-sm">
                <CheckCircle size={14} />
                Re-extraction complete
              </div>
              <div className="hf-text-sm hf-mt-xs">
                {extractResults.filter((r) => r.jobId).length} source{extractResults.filter((r) => r.jobId).length === 1 ? '' : 's'} re-extracted.
                {recomposeResult && recomposeResult.composed > 0 && (
                  <> Prompts recomposed for {recomposeResult.composed} caller{recomposeResult.composed === 1 ? '' : 's'}.</>
                )}
              </div>
              {extractResults.some((r) => r.error) && (
                <div className="hf-flex hf-items-center hf-gap-xs hf-text-sm hf-mt-xs" style={{ color: 'var(--status-error-text)' }}>
                  <XCircle size={14} />
                  {extractResults.filter((r) => r.error).length} source{extractResults.filter((r) => r.error).length === 1 ? '' : 's'} failed
                </div>
              )}
            </div>

            {/* Show per-source error details when failures occurred */}
            {extractResults.some((r) => r.error) && (
              <div className="hf-card-compact hf-mb-md" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {extractResults.filter((r) => r.error).map((r) => {
                  const src = sources.find((s) => s.id === r.sourceId);
                  const info = src ? getDocTypeInfo(src.documentType) : null;
                  const Icon = info?.icon;
                  return (
                    <div key={r.sourceId} className="hf-flex hf-items-center hf-gap-sm" style={{ padding: '8px 12px' }}>
                      {Icon && <Icon size={16} style={{ color: info!.color, flexShrink: 0 }} />}
                      <span className="hf-flex-1 hf-text-sm hf-text-secondary">{r.name}</span>
                      <span className="hf-text-xs hf-text-error">{r.error}</span>
                    </div>
                  );
                })}
              {recomposeResult && recomposeResult.failed > 0 && (
                <div className="hf-text-xs hf-text-muted hf-mt-xs">
                  {recomposeResult.failed} caller{recomposeResult.failed === 1 ? '' : 's'} failed to recompose
                </div>
              )}
            </div>

            <div className="hf-modal-actions">
              <button
                onClick={() => { onComplete(); onClose(); }}
                className="hf-btn hf-btn-primary"
              >
                Done
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
