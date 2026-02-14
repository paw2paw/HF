'use client';

/**
 * Thin environment indicator banner.
 * Hidden in LIVE — visible in DEV (blue) and STG (amber).
 * Also prefixes the browser tab title.
 */

import { useEffect } from 'react';

const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'DEV';

const BANNER_STYLES: Record<string, { bg: string; text: string; border: string } | null> = {
  DEV:  { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' },
  STG:  { bg: '#f59e0b', text: '#1c1917', border: '#d97706' },
  LIVE: null, // hidden in production
};

export default function EnvironmentBanner() {
  const style = BANNER_STYLES[ENV.toUpperCase()] ?? BANNER_STYLES.DEV;

  // Prefix browser tab title
  useEffect(() => {
    if (ENV.toUpperCase() === 'LIVE') return;
    const base = document.title.replace(/^\[(DEV|STG|LIVE)\]\s*/, '');
    document.title = `[${ENV.toUpperCase()}] ${base || 'HF Admin'}`;
  }, []);

  if (!style) return null;

  return (
    <div
      role="status"
      aria-label={`${ENV} environment`}
      style={{
        background: style.bg,
        color: style.text,
        borderBottom: `1px solid ${style.border}`,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textAlign: 'center',
        padding: '2px 0',
        lineHeight: '16px',
        userSelect: 'none',
        zIndex: 9999,
        position: 'relative',
      }}
    >
      {ENV.toUpperCase()} ENVIRONMENT
    </div>
  );
}
