'use client';

/**
 * HealthPopup — flyout anchored to the Health RAG chip in the status bar.
 *
 * Receives pre-fetched IniResult from StatusBar (no internal fetch).
 * Shows: check list (status dot + label + message + severity pill + remediation).
 * Footer: last checked timestamp + "View Settings →" link.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ExternalLink } from 'lucide-react';

// Mirrors lib/system-ini.ts types (server lib — not importable in client bundle)
type CheckStatus = 'pass' | 'warn' | 'fail';
type RagStatus = 'green' | 'amber' | 'red';

interface IniCheck {
  status: CheckStatus;
  label: string;
  message: string;
  severity: 'critical' | 'recommended' | 'optional';
  remediation?: string;
}

export interface IniResult {
  ok: boolean;
  status: RagStatus;
  summary: { pass: number; warn: number; fail: number; total: number };
  checks: Record<string, IniCheck>;
  timestamp: string;
}

interface HealthPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  healthData: IniResult | null;
  ragStatus: RagStatus | null;
}

const RAG_BADGE_CLASS: Record<RagStatus, string> = {
  green: 'health-popup-rag-green',
  amber: 'health-popup-rag-amber',
  red: 'health-popup-rag-red',
};

const STATUS_DOT_CLASS: Record<CheckStatus, string> = {
  pass: 'health-popup-dot-pass',
  warn: 'health-popup-dot-warn',
  fail: 'health-popup-dot-fail',
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'health-popup-sev-critical',
  recommended: 'health-popup-sev-recommended',
  optional: 'health-popup-sev-optional',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function HealthPopup({ open, onClose, anchorRef, healthData, ragStatus }: HealthPopupProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // Outside-click handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  // Escape handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const checksArray = healthData
    ? Object.entries(healthData.checks).map(([key, check]) => ({ key, ...check }))
    : [];

  // Sort: fail first, then warn, then pass
  const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  checksArray.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  const ragLabel =
    ragStatus === 'green' ? 'Healthy' : ragStatus === 'amber' ? 'Degraded' : 'Unhealthy';

  return (
    <div className="health-popup" ref={panelRef}>
      {/* Header */}
      <div className="jobs-popup-header">
        <div className="health-popup-header-left">
          <span className="jobs-popup-title">System Health</span>
          {ragStatus && (
            <span className={`health-popup-rag-badge ${RAG_BADGE_CLASS[ragStatus]}`}>
              {ragLabel}
            </span>
          )}
        </div>
        <button className="jobs-popup-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="jobs-popup-body">
        {!healthData ? (
          <div className="health-popup-no-data">
            No health data available. Requires SUPERADMIN access.
          </div>
        ) : (
          checksArray.map(({ key, status, label, message, severity, remediation }) => (
            <div key={key} className="health-popup-check-row">
              <span className={`health-popup-check-dot ${STATUS_DOT_CLASS[status]}`} />
              <div className="health-popup-check-content">
                <div className="health-popup-check-top">
                  <span className="health-popup-check-label">{label}</span>
                  <span className={`health-popup-sev-pill ${SEVERITY_CLASS[severity]}`}>
                    {severity}
                  </span>
                </div>
                <div className="health-popup-check-message">{message}</div>
                {remediation && status !== 'pass' && (
                  <div className="health-popup-remediation">{remediation}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="jobs-popup-footer">
        {healthData?.timestamp && (
          <span className="health-popup-footer-time">Checked {timeAgo(healthData.timestamp)}</span>
        )}
        <button
          className="jobs-popup-viewall"
          onClick={() => {
            onClose();
            router.push('/x/settings');
          }}
        >
          View Settings <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}
