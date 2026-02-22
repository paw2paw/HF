'use client';

/**
 * StatusBar — persistent bottom bar consolidating all status indicators.
 *
 * Normal mode:
 *   Left:  [Institution chip] [ENV badge] [Health RAG] [Jobs chip]
 *   Right: [Bug trigger] [Version]
 *
 * Masquerade mode (entire bar turns purple):
 *   Left:  [Mask icon + user info + EXIT]
 *   Right: [Bug trigger] [Version]
 *
 * Hidden on auth/sim/embed pages.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building2, VenetianMask, X, Bug, Radio, Cog } from 'lucide-react';
import { useBranding } from '@/contexts/BrandingContext';
import { useMasquerade } from '@/contexts/MasqueradeContext';
import { useErrorCapture } from '@/contexts/ErrorCaptureContext';
import { envLabel, envSidebarColor, envTextColor, showEnvBanner } from './EnvironmentBanner';

/** Height of the status bar in pixels — use for layout calculations */
export const STATUS_BAR_HEIGHT = 32;

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  EDUCATOR: 'Educator',
  SUPER_TESTER: 'Super Tester',
  TESTER: 'Tester',
  VIEWER: 'Viewer',
  DEMO: 'Demo',
};

const ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5,
  ADMIN: 4,
  OPERATOR: 3,
  SUPER_TESTER: 2,
  TESTER: 1,
  VIEWER: 1,
  DEMO: 0,
};

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

// ── Bug Report bridge ──
// BugReportButton registers its open callback here so StatusBar can trigger it.
type BugReportOpener = () => void;
let bugReportOpener: BugReportOpener | null = null;

export function registerBugReportOpener(fn: BugReportOpener) {
  bugReportOpener = fn;
}
export function unregisterBugReportOpener() {
  bugReportOpener = null;
}

export function StatusBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { branding, loading: brandingLoading } = useBranding();
  const { isMasquerading, masquerade, stopMasquerade } = useMasquerade();
  const { errorCount } = useErrorCapture();

  const router = useRouter();
  // System health RAG (ADMIN+ only, polls every 120s)
  const [healthRag, setHealthRag] = useState<'green' | 'amber' | 'red' | null>(null);
  // Deep logging toggle (ADMIN+ only)
  const [deepLogging, setDeepLogging] = useState(false);
  // Active jobs count (OPERATOR+, polls every 20s)
  const [jobsCount, setJobsCount] = useState(0);
  const userRole = (session?.user?.role as string) || '';
  const roleLevel = ROLE_LEVEL[userRole] ?? 0;
  const isAdmin = roleLevel >= 4;
  const isOperator = roleLevel >= 3;

  useEffect(() => {
    if (!isAdmin || !session?.user) return;

    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/system/ini');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) setHealthRag(data.status);
      } catch {
        // Silent fail
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 120000);
    return () => clearInterval(interval);
  }, [isAdmin, session?.user]);

  // Deep logging state (ADMIN+ only, polls every 30s to match cache TTL)
  useEffect(() => {
    if (!isAdmin || !session?.user) return;

    const fetchDeepLogging = async () => {
      try {
        const res = await fetch('/api/admin/deep-logging');
        if (res.ok) {
          const data = await res.json();
          setDeepLogging(data.enabled);
        }
      } catch {
        // Silent fail
      }
    };

    fetchDeepLogging();
    const interval = setInterval(fetchDeepLogging, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, session?.user]);

  // Active jobs count (OPERATOR+ only, polls every 20s)
  useEffect(() => {
    if (!isOperator || !session?.user) return;

    const fetchJobsCount = async () => {
      try {
        const res = await fetch('/api/tasks/counts');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) setJobsCount(data.counts?.processing ?? 0);
      } catch {
        // Silent fail
      }
    };

    fetchJobsCount();
    const interval = setInterval(fetchJobsCount, 20000);
    return () => clearInterval(interval);
  }, [isOperator, session?.user]);

  const handleToggleDeepLogging = useCallback(async () => {
    const newValue = !deepLogging;
    setDeepLogging(newValue); // Optimistic update
    try {
      const res = await fetch('/api/admin/deep-logging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue }),
      });
      if (!res.ok) setDeepLogging(!newValue); // Revert on failure
    } catch {
      setDeepLogging(!newValue); // Revert on failure
    }
  }, [deepLogging]);

  const handleBugClick = useCallback(() => {
    bugReportOpener?.();
  }, []);

  // Visibility rules — same as sidebar
  const isAuthPage = pathname?.startsWith('/login');
  const isSimPage = pathname?.startsWith('/x/sim');
  const isEmbed = searchParams.get('embed') === '1';

  if (isAuthPage || isSimPage || isEmbed || !session?.user) return null;

  const isMasq = isMasquerading && masquerade;
  const hasInstitution = !brandingLoading && branding.name !== 'HumanFirst Foundation';

  return (
    <div
      className={`hf-status-bar${isMasq ? ' hf-status-bar-masquerade' : ''}`}
      role="status"
      aria-label="Status bar"
    >
      {/* ── Left cluster ── */}
      <div className="hf-status-cluster">
        {isMasq ? (
          <>
            <span className="hf-status-item">
              <VenetianMask size={13} />
              <span className="hf-status-bold">STEPPED IN:</span>
              <span>{masquerade.name || masquerade.email || 'Unknown'}</span>
              <span className="hf-status-separator">&middot;</span>
              <span>{ROLE_LABELS[masquerade.role] || masquerade.role}</span>
              {masquerade.institutionName && (
                <>
                  <span className="hf-status-separator">&middot;</span>
                  <span>{masquerade.institutionName}</span>
                </>
              )}
            </span>
            <button
              className="hf-status-exit-btn"
              onClick={(e) => {
                e.preventDefault();
                stopMasquerade();
              }}
            >
              <X size={11} /> EXIT
            </button>
          </>
        ) : (
          <>
            {/* Institution chip */}
            {hasInstitution && (
              <span className="hf-status-item">
                <Building2 size={13} />
                <span className="hf-status-bold">{branding.name}</span>
                {branding.typeName && (
                  <>
                    <span className="hf-status-separator">&middot;</span>
                    <span>{branding.typeName}</span>
                  </>
                )}
              </span>
            )}

            {/* Environment badge */}
            {showEnvBanner && envLabel && envSidebarColor && (
              <span
                className="hf-status-env-badge"
                style={{ background: envSidebarColor, ...(envTextColor ? { color: envTextColor } : {}) }}
              >
                {envLabel}
              </span>
            )}

            {/* Health RAG */}
            {isAdmin && healthRag && (
              <span className="hf-status-item" title={`System: ${healthRag}`}>
                <span
                  className="hf-status-health-dot"
                  style={{
                    background:
                      healthRag === 'green'
                        ? 'var(--status-success-text)'
                        : healthRag === 'amber'
                          ? 'var(--status-warning-text)'
                          : 'var(--status-error-text)',
                  }}
                />
                <span>
                  {healthRag === 'green'
                    ? 'Healthy'
                    : healthRag === 'amber'
                      ? 'Degraded'
                      : 'Unhealthy'}
                </span>
              </span>
            )}

            {/* Jobs indicator (OPERATOR+, only when active jobs exist) */}
            {isOperator && jobsCount > 0 && (
              <span
                className="hf-status-jobs-chip"
                onClick={() => router.push('/x/jobs')}
                title={`${jobsCount} active job${jobsCount !== 1 ? 's' : ''}`}
              >
                <Cog size={12} className="hf-status-jobs-spin" />
                <span className="hf-status-jobs-badge">
                  {jobsCount > 9 ? '9+' : jobsCount}
                </span>
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Right cluster ── */}
      <div className="hf-status-cluster-right">
        {/* Deep Logging toggle */}
        {isAdmin && (
          <span
            className={`hf-status-item hf-status-clickable${deepLogging ? ' hf-status-deep-logging-active' : ''}`}
            onClick={handleToggleDeepLogging}
            title={deepLogging ? 'Deep logging ON — capturing full AI prompts/responses (click to turn off)' : 'Deep logging OFF (click to turn on)'}
          >
            <span className={`hf-status-deep-dot${deepLogging ? ' hf-status-deep-dot-active' : ''}`} />
            <span>{deepLogging ? 'DEEP LOG' : 'LOG'}</span>
          </span>
        )}

        {/* Bug Report trigger */}
        {isOperator && (
          <span
            className="hf-status-item hf-status-clickable"
            onClick={handleBugClick}
            title="Report a bug"
          >
            <Bug size={13} />
            {errorCount > 0 && (
              <span className="hf-status-bug-badge">
                {errorCount > 9 ? '9+' : errorCount}
              </span>
            )}
          </span>
        )}

        {/* Version */}
        {APP_VERSION && (
          <span className="hf-status-version">v{APP_VERSION}</span>
        )}
      </div>
    </div>
  );
}
