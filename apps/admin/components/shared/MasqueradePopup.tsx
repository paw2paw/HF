'use client';

/**
 * MasqueradePopup — flyout anchored to the Mask chip in the status bar.
 *
 * Shows who the admin is viewing as, with an Exit button.
 * Same pattern as HealthPopup / CallsPopup.
 */

import { useEffect, useRef } from 'react';
import { VenetianMask, X, LogOut } from 'lucide-react';
import type { MasqueradeState } from '@/lib/masquerade';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  EDUCATOR: 'Educator',
  SUPER_TESTER: 'Super Tester',
  TESTER: 'Tester',
  STUDENT: 'Student',
  VIEWER: 'Viewer',
  DEMO: 'Demo',
};

interface MasqueradePopupProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  masquerade: MasqueradeState;
  onExit: () => void;
}

export function MasqueradePopup({ open, onClose, anchorRef, masquerade, onExit }: MasqueradePopupProps) {
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

  const displayName = masquerade.name || masquerade.email || 'Unknown';
  const roleLabel = ROLE_LABELS[masquerade.role] || masquerade.role;

  return (
    <div className="masquerade-popup" ref={panelRef}>
      {/* Header */}
      <div className="jobs-popup-header">
        <div className="masquerade-popup-header-left">
          <VenetianMask size={14} />
          <span className="jobs-popup-title">Stepped In As</span>
        </div>
        <button className="jobs-popup-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="masquerade-popup-body">
        <div className="masquerade-popup-field">
          <span className="masquerade-popup-label">Name</span>
          <span className="masquerade-popup-value">{displayName}</span>
        </div>
        {masquerade.email && (
          <div className="masquerade-popup-field">
            <span className="masquerade-popup-label">Email</span>
            <span className="masquerade-popup-value">{masquerade.email}</span>
          </div>
        )}
        <div className="masquerade-popup-field">
          <span className="masquerade-popup-label">Role</span>
          <span className="masquerade-popup-value">{roleLabel}</span>
        </div>
        {masquerade.institutionName && (
          <div className="masquerade-popup-field">
            <span className="masquerade-popup-label">Institution</span>
            <span className="masquerade-popup-value">{masquerade.institutionName}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="masquerade-popup-footer">
        <button
          className="masquerade-popup-exit-btn"
          onClick={(e) => {
            e.preventDefault();
            onExit();
          }}
        >
          <LogOut size={13} />
          Exit Masquerade
        </button>
      </div>
    </div>
  );
}
