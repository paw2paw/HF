'use client';

import { useEffect } from 'react';

/**
 * Dynamic favicon — HF monogram colored by environment.
 *
 * DEV (Cloud Run):  Blue background (#3b82f6)
 * DEV (VM/local):   Blue background with green corner dot
 * TEST:             Purple background (#8b5cf6)
 * STG:              Amber background (#f59e0b)
 * LIVE:             Navy background (#1F1B4A) with gold "HF" text
 *
 * Replaces the default Next.js triangle favicon at runtime.
 */

const ENV = (process.env.NEXT_PUBLIC_APP_ENV || 'DEV').toUpperCase();

interface EnvFaviconConfig {
  bg: string;
  text: string;
  /** Optional corner dot color for VM/localhost */
  dot?: string;
}

const ENV_FAVICON: Record<string, EnvFaviconConfig> = {
  DEV:  { bg: '#3b82f6', text: '#ffffff' },
  TEST: { bg: '#8b5cf6', text: '#ffffff' },
  STG:  { bg: '#f59e0b', text: '#ffffff' },
  LIVE: { bg: '#1F1B4A', text: '#F5B856' },
};

function generateFaviconSVG(config: EnvFaviconConfig, isLocal: boolean): string {
  const { bg, text } = config;

  // Corner dot for VM/localhost — small green circle in bottom-right
  const dotMarkup = isLocal && ENV === 'DEV'
    ? '<circle cx="27" cy="27" r="6" fill="#22c55e" stroke="#ffffff" stroke-width="1.5"/>'
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="${bg}"/>
  <text x="16" y="17" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700"
        fill="${text}">HF</text>
  ${dotMarkup}
</svg>`;
}

function setFavicon(svg: string) {
  const encoded = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  // Remove any existing favicons
  const existing = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  existing.forEach((el) => el.remove());

  // Set new SVG favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = encoded;
  document.head.appendChild(link);
}

export default function DynamicFavicon() {
  useEffect(() => {
    const config = ENV_FAVICON[ENV] || ENV_FAVICON.DEV;
    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
    const svg = generateFaviconSVG(config, isLocal);
    setFavicon(svg);
  }, []);

  return null;
}
