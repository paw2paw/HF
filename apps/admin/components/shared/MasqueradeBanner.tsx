/**
 * Masquerade constants — shared across components that need masquerade styling.
 * The visible indicator now lives in StatusBar.tsx (bottom bar turns purple).
 */

/** @deprecated Banner removed — kept at 0 for any remaining references */
export const MASQUERADE_BANNER_HEIGHT = 0;

/** Purple accent used by StatusBar masquerade mode + MasqueradeUserPicker */
export const MASQUERADE_COLOR = 'var(--masquerade-color, #7c3aed)';

/** @deprecated Banner removed — masquerade indicator now in StatusBar */
export default function MasqueradeBanner() {
  return null;
}
