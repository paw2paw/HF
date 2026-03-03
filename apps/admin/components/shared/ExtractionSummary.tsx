'use client';

/**
 * ExtractionSummary — Rich post-extraction results card.
 *
 * Shows document count, stat bar (TPs, questions, vocab, images),
 * per-file list with DocType badges, and per-category pill breakdown.
 *
 * Two modes:
 *   - Full (default) — hero checkmark, full stats, action buttons. Used in step wizards.
 *   - Compact — smaller, no hero, no buttons. Used inline in chat.
 */

import './extraction-summary.css';
import './wizard-summary.css'; // reuse wiz-hero-check + wiz-fade-up keyframes
import { FileText, AlertTriangle, Check } from 'lucide-react';
import type { PackUploadResult } from '@/components/wizards/PackUploadStep';
import { DocTypeBadge } from '@/app/x/content-sources/_components/shared/badges';

// ── Category pill colors ─────────────────────────

const CATEGORY_PILL_COLORS: Record<string, { color: string; bg: string }> = {
  fact:       { color: 'var(--accent-primary)',        bg: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' },
  definition: { color: 'var(--badge-cyan-text, #0891b2)', bg: 'color-mix(in srgb, var(--badge-cyan-text, #0891b2) 10%, transparent)' },
  rule:       { color: 'var(--status-warning-text)',    bg: 'color-mix(in srgb, var(--status-warning-text) 10%, transparent)' },
  process:    { color: 'var(--accent-secondary, #8b5cf6)', bg: 'color-mix(in srgb, var(--accent-secondary, #8b5cf6) 10%, transparent)' },
  example:    { color: 'var(--status-success-text)',    bg: 'color-mix(in srgb, var(--status-success-text) 10%, transparent)' },
  threshold:  { color: 'var(--badge-pink-text, #be185d)', bg: 'color-mix(in srgb, var(--badge-pink-text, #be185d) 10%, transparent)' },
};

// ── Props ────────────────────────────────────────

interface ExtractionSummaryProps {
  result: PackUploadResult;
  /** Compact mode for chat embed (no hero, smaller) */
  compact?: boolean;
  /** Continue button handler (full mode) */
  onContinue?: () => void;
  /** Re-upload / back button handler (full mode) */
  onReUpload?: () => void;
}

// ── Component ────────────────────────────────────

export function ExtractionSummary({
  result,
  compact = false,
  onContinue,
  onReUpload,
}: ExtractionSummaryProps) {
  const { extractionTotals, classifications, sourceCount, subjects, categoryCounts } = result;

  const totalTPs = extractionTotals?.assertions ?? 0;
  const totalQs = extractionTotals?.questions ?? 0;
  const totalVocab = extractionTotals?.vocabulary ?? 0;
  const totalImages = extractionTotals?.images ?? 0;
  const isEmpty = totalTPs === 0 && totalQs === 0 && totalVocab === 0;

  // Build subtitle
  const parts: string[] = [];
  if (sourceCount && sourceCount > 0) parts.push(`${sourceCount} document${sourceCount !== 1 ? 's' : ''}`);
  if (subjects && subjects.length > 0) parts.push(`${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`);
  const subtitle = parts.join('  ·  ');

  // Filter stats to only show non-zero
  const stats = [
    { label: 'Teaching Points', value: totalTPs },
    { label: 'Questions', value: totalQs },
    { label: 'Vocabulary', value: totalVocab },
    { label: 'Images', value: totalImages },
  ].filter(s => s.value > 0);

  // Sort categories by count descending
  const sortedCategories = categoryCounts
    ? Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
    : [];

  // ── Empty state ──

  if (isEmpty) {
    return (
      <div className={`es-root${compact ? ' es-root--compact' : ''}`}>
        <div className="es-warning">
          <div className="es-warning-icon">
            <AlertTriangle size={24} />
          </div>
          <h2 className="es-warning-title">No Teaching Points Found</h2>
          <p className="es-warning-desc">
            Files were processed but no teaching points could be extracted.
            Try uploading different content.
          </p>
        </div>
        {!compact && (onReUpload || onContinue) && (
          <div className="es-actions">
            {onReUpload && (
              <button className="wiz-action-back" onClick={onReUpload}>
                Re-upload
              </button>
            )}
            <div className="es-actions-spacer" />
            {onContinue && (
              <button className="wiz-action-secondary" onClick={onContinue}>
                Skip
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Success state ──

  return (
    <div className={`es-root${compact ? ' es-root--compact' : ''}`}>
      {/* Hero */}
      <div className="es-hero">
        {!compact && <SuccessCheckmark />}
        <h2 className="es-hero-title">
          {compact && <Check size={16} style={{ color: 'var(--status-success-text)' }} />}
          Content Extracted
        </h2>
        {subtitle && <p className="es-hero-subtitle">{subtitle}</p>}
      </div>

      {/* Stat bar */}
      {stats.length > 0 && (
        <div className="es-stat-bar">
          {stats.map(s => (
            <div key={s.label} className="es-stat">
              <span className="es-stat-value">{s.value}</span>
              <span className="es-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      {classifications && classifications.length > 0 && (
        <div className="es-section">
          <div className="es-section-label">Documents</div>
          <div className="es-file-list">
            {classifications.map((file, i) => (
              <div key={i} className="es-file-row">
                <FileText size={14} className="es-file-icon" />
                <span className="es-file-name">{file.fileName}</span>
                <DocTypeBadge type={file.documentType} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category pills */}
      {sortedCategories.length > 0 && (
        <div className="es-section">
          <div className="es-section-label">Teaching Points by Type</div>
          <div className="es-categories">
            {sortedCategories.map(([cat, count]) => {
              const colors = CATEGORY_PILL_COLORS[cat];
              return (
                <span
                  key={cat}
                  className="es-category-pill"
                  style={colors ? {
                    color: colors.color,
                    background: colors.bg,
                    borderColor: colors.color,
                  } : undefined}
                >
                  {cat} <span className="es-category-count">{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions (full mode only) */}
      {!compact && (onReUpload || onContinue) && (
        <div className="es-actions">
          {onReUpload && (
            <button className="wiz-action-back" onClick={onReUpload}>
              Back
            </button>
          )}
          <div className="es-actions-spacer" />
          {onContinue && (
            <button className="wiz-action-primary" onClick={onContinue}>
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Animated Checkmark (reused from WizardSummary) ──

function SuccessCheckmark() {
  return (
    <svg className="wiz-hero-check" viewBox="0 0 64 64">
      <circle
        className="wiz-check-circle"
        cx="32"
        cy="32"
        r="30"
      />
      <polyline
        className="wiz-check-mark"
        points="20,34 28,42 44,24"
      />
    </svg>
  );
}
