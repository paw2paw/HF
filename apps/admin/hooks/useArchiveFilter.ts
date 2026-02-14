"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook for managing archive visibility toggle per entity type.
 * Persists to localStorage so the preference survives page reloads.
 *
 * @param entityKey - Entity identifier (e.g. "callers") used in the storage key
 * @returns [showArchived, toggleShowArchived] tuple
 */
export function useArchiveFilter(entityKey: string): [boolean, () => void] {
  const storageKey = `hf.filter.showArchived.${entityKey}`;
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "true") setShowArchived(true);
    } catch {
      // localStorage unavailable (SSR, etc.)
    }
  }, [storageKey]);

  const toggle = useCallback(() => {
    setShowArchived((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, [storageKey]);

  return [showArchived, toggle];
}
