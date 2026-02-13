// Sidebar layout persistence utilities

import { SidebarLayout, EMPTY_LAYOUT } from "./types";

const SIDEBAR_LAYOUT_KEY = "hf.sidebar.layout";
const SIDEBAR_ORDER_KEY = "hf.sidebar.section-order"; // Legacy key for migration

function getStorageKey(userId: string | undefined): string {
  return userId ? `${SIDEBAR_LAYOUT_KEY}.${userId}` : SIDEBAR_LAYOUT_KEY;
}

function getLegacyStorageKey(userId: string | undefined): string {
  return userId ? `${SIDEBAR_ORDER_KEY}.${userId}` : SIDEBAR_ORDER_KEY;
}

/**
 * Load layout from localStorage with legacy migration support
 */
export function loadLayout(userId: string | undefined): SidebarLayout | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getStorageKey(userId);
    const stored = localStorage.getItem(key);

    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure all fields exist (handle older stored layouts)
      return {
        ...EMPTY_LAYOUT,
        ...parsed,
      };
    }

    // Migrate from legacy section-order-only format
    const legacyKey = getLegacyStorageKey(userId);
    const legacyStored = localStorage.getItem(legacyKey);

    if (legacyStored) {
      const layout: SidebarLayout = {
        ...EMPTY_LAYOUT,
        sectionOrder: JSON.parse(legacyStored),
      };
      // Save in new format and remove legacy
      localStorage.setItem(key, JSON.stringify(layout));
      localStorage.removeItem(legacyKey);
      return layout;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Save layout to localStorage
 */
export function saveLayout(
  layout: SidebarLayout,
  userId: string | undefined
): void {
  if (typeof window === "undefined") return;

  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Clear layout from localStorage
 */
export function clearLayout(userId: string | undefined): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(getStorageKey(userId));
    // Also clear legacy key if it exists
    localStorage.removeItem(getLegacyStorageKey(userId));
  } catch {
    // Ignore errors
  }
}

/**
 * Load global default layout from API
 */
export async function loadGlobalDefault(): Promise<SidebarLayout | null> {
  try {
    const res = await fetch("/api/admin/sidebar-layout");
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.layout) return null;

    // Ensure all fields exist
    return {
      ...EMPTY_LAYOUT,
      ...data.layout,
    };
  } catch {
    return null;
  }
}

/**
 * Save layout as global default (admin only)
 */
export async function saveGlobalDefault(
  layout: SidebarLayout
): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/sidebar-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Load personal default layout from API (survives cache clears)
 */
export async function loadPersonalDefault(): Promise<SidebarLayout | null> {
  try {
    const res = await fetch("/api/sidebar-layout/personal");
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.layout) return null;

    return {
      ...EMPTY_LAYOUT,
      ...data.layout,
    };
  } catch {
    return null;
  }
}

/**
 * Save layout as personal default (any authenticated user)
 */
export async function savePersonalDefault(
  layout: SidebarLayout
): Promise<boolean> {
  try {
    const res = await fetch("/api/sidebar-layout/personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Clear personal default layout from API
 */
export async function clearPersonalDefault(): Promise<void> {
  try {
    await fetch("/api/sidebar-layout/personal", { method: "DELETE" });
  } catch {
    // Ignore errors — may not exist
  }
}
