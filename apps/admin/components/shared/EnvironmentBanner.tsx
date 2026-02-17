'use client';

/**
 * Environment indicator — no visible banner.
 * Prefixes the browser tab title for DEV/STG.
 * Exports sidebar color for the layout to apply as a left-edge strip.
 */

import { useEffect } from 'react';

const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'LIVE' : 'DEV');

/** @deprecated Banner removed — kept at 0 for any remaining references */
export const ENV_BANNER_HEIGHT = 0;

const ENV_COLORS: Record<string, { sidebar: string; sidebarWidth: number; label: string } | null> = {
  DEV:  { sidebar: '#3b82f6', sidebarWidth: 6, label: 'DEV' },    // Blue
  TEST: { sidebar: '#8b5cf6', sidebarWidth: 6, label: 'TEST' },   // Purple
  STG:  { sidebar: '#f59e0b', sidebarWidth: 6, label: 'STG' },    // Amber
  LIVE: null,                                                       // No indicator
};

/** Whether a non-production environment is active */
export const showEnvBanner = ENV_COLORS[ENV.toUpperCase()] != null;

/** Sidebar accent color for current environment (null in production) */
export const envSidebarColor = ENV_COLORS[ENV.toUpperCase()]?.sidebar ?? null;

/** Sidebar strip width in px for current environment (0 in production) */
export const envSidebarWidth = ENV_COLORS[ENV.toUpperCase()]?.sidebarWidth ?? 0;

/** Short label for the environment (null in production) */
export const envLabel = ENV_COLORS[ENV.toUpperCase()]?.label ?? null;

/**
 * Invisible component — only prefixes the browser tab title.
 * The sidebar uses `envSidebarColor` for a visual indicator.
 */
export default function EnvironmentBanner() {
  useEffect(() => {
    if (ENV.toUpperCase() === 'LIVE') return;
    const base = document.title.replace(/^\[(DEV|TEST|STG|LIVE)\]\s*/, '');
    document.title = `[${ENV.toUpperCase()}] ${base || 'HF Admin'}`;
  }, []);

  return null;
}
