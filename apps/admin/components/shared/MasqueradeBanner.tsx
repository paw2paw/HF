'use client';

/**
 * Masquerade info bar — thin fixed banner shown when impersonating another user.
 * Displays the masqueraded user's name, role, and an exit button.
 */

import { useMasquerade } from '@/contexts/MasqueradeContext';
import { VenetianMask, X } from 'lucide-react';

export const MASQUERADE_BANNER_HEIGHT = 32;
export const MASQUERADE_COLOR = '#7c3aed'; // Purple — distinct from DEV blue / STG amber

export default function MasqueradeBanner() {
  const { masquerade, isMasquerading, stopMasquerade } = useMasquerade();

  if (!isMasquerading || !masquerade) return null;

  const displayName = masquerade.name || masquerade.email || 'Unknown';

  return (
    <div
      role="status"
      aria-label={`Stepped in as ${displayName}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: MASQUERADE_BANNER_HEIGHT,
        background: MASQUERADE_COLOR,
        color: '#ffffff',
        borderBottom: '1px solid #6d28d9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.03em',
        userSelect: 'none',
        zIndex: 9998,
      }}
    >
      <VenetianMask size={14} />
      <span>
        STEPPED IN AS: {displayName} ({masquerade.role})
      </span>
      <button
        onClick={(e) => {
          e.preventDefault();
          stopMasquerade();
        }}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: '#fff',
          borderRadius: 4,
          padding: '2px 10px',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          marginLeft: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          lineHeight: '16px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
      >
        <X size={12} /> EXIT
      </button>
    </div>
  );
}
