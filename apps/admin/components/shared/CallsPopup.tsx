'use client';

/**
 * CallsPopup — flyout anchored to the Calls chip in the status bar.
 *
 * Receives pre-fetched activity data from StatusBar (no internal fetch).
 * Shows: stat row (today / 7d active / total) + recent calls list.
 * Footer: "View Analytics →" link to /x/analytics.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ExternalLink, Phone } from 'lucide-react';

interface RecentCall {
  id: string;
  callerName: string;
  callerId: string | null;
  createdAt: string;
}

export interface ActivityData {
  callsToday: number;
  activeCallers7d: number;
  totalCallers: number;
  recentCalls: RecentCall[];
}

interface CallsPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  activityData: ActivityData | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function CallsPopup({ open, onClose, anchorRef, activityData }: CallsPopupProps) {
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

  return (
    <div className="calls-popup" ref={panelRef}>
      {/* Header */}
      <div className="jobs-popup-header">
        <span className="jobs-popup-title">Activity</span>
        <button className="jobs-popup-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="jobs-popup-body">
        {!activityData ? (
          <div className="jobs-popup-empty">No activity data</div>
        ) : (
          <>
            {/* Stats row */}
            <div className="calls-popup-stats">
              <div className="calls-popup-stat">
                <span className="calls-popup-stat-value">{activityData.callsToday}</span>
                <span className="calls-popup-stat-label">Today</span>
              </div>
              <div className="calls-popup-stat-divider" />
              <div className="calls-popup-stat">
                <span className="calls-popup-stat-value">{activityData.activeCallers7d}</span>
                <span className="calls-popup-stat-label">Active 7d</span>
              </div>
              <div className="calls-popup-stat-divider" />
              <div className="calls-popup-stat">
                <span className="calls-popup-stat-value">{activityData.totalCallers}</span>
                <span className="calls-popup-stat-label">Total</span>
              </div>
            </div>

            {/* Recent calls */}
            {activityData.recentCalls.length > 0 && (
              <div className="jobs-popup-section">
                <div className="jobs-popup-section-label">Recent Calls</div>
                {activityData.recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className="jobs-popup-row"
                    style={{ cursor: call.callerId ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (call.callerId) {
                        onClose();
                        router.push(`/x/callers/${call.callerId}`);
                      }
                    }}
                  >
                    <div className="jobs-popup-row-icon">
                      <Phone size={13} />
                    </div>
                    <div className="jobs-popup-row-content">
                      <div className="jobs-popup-row-name">{call.callerName}</div>
                      <div className="jobs-popup-row-meta">{timeAgo(call.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="jobs-popup-footer">
        <button
          className="jobs-popup-viewall"
          onClick={() => {
            onClose();
            router.push('/x/analytics');
          }}
        >
          View Analytics <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}
