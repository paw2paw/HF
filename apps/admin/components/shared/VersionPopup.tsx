'use client';

/**
 * VersionPopup — flyout anchored to the Version chip in the status bar.
 *
 * No fetch — all data from props (session + branding + env constants).
 * Shows: version, environment, role, institution.
 * Footer: "View Account →" link to /x/account.
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ExternalLink } from 'lucide-react';
import { envLabel } from './EnvironmentBanner';

interface VersionPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  version: string | undefined;
  roleName: string;
  institutionName: string;
}

export function VersionPopup({
  open,
  onClose,
  anchorRef,
  version,
  roleName,
  institutionName,
}: VersionPopupProps) {
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

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Version', value: version ? `v${version}` : 'Unknown' },
    { label: 'Environment', value: envLabel ?? 'Unknown' },
    { label: 'Role', value: roleName },
    { label: 'Institution', value: institutionName },
  ];

  return (
    <div className="version-popup" ref={panelRef}>
      {/* Header */}
      <div className="jobs-popup-header">
        <span className="jobs-popup-title">About</span>
        <button className="jobs-popup-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="jobs-popup-body">
        <div className="version-popup-rows">
          {rows.map(({ label, value }) => (
            <div key={label} className="version-popup-row">
              <span className="version-popup-row-label">{label}</span>
              <span className="version-popup-row-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="jobs-popup-footer">
        <button
          className="jobs-popup-viewall"
          onClick={() => {
            onClose();
            router.push('/x/account');
          }}
        >
          View Account <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}
