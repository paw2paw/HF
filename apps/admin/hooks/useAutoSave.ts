"use client";

/**
 * Holographic Page — Auto-Save Hook
 *
 * Debounced PATCH with optimistic UI.
 * - 800ms debounce after last edit
 * - Optimistic: value shows immediately
 * - On error: reverts + shows error indicator
 * - Create mode: first save = POST, then switches to PATCH
 */

import { useCallback, useRef, useEffect } from "react";
import type { SaveStatus } from "./useHolographicState";

interface AutoSaveOptions {
  /** Domain ID — null in create mode */
  id: string | null;
  /** Dirty field names */
  dirty: string[];
  /** Callback to get current values for dirty fields */
  getValues: () => Record<string, unknown>;
  /** Dispatch save status changes */
  onStatusChange: (status: SaveStatus) => void;
  /** Called after a successful save */
  onSaved: (response: { id?: string }) => void;
  /** Called on error */
  onError: (error: string) => void;
  /** Clear dirty markers */
  onClearDirty: () => void;
  /** Debounce delay in ms */
  delay?: number;
}

export function useAutoSave({
  id,
  dirty,
  getValues,
  onStatusChange,
  onSaved,
  onError,
  onClearDirty,
  delay = 800,
}: AutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const save = useCallback(async () => {
    if (dirty.length === 0) return;

    const values = getValues();
    onStatusChange("saving");

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const isCreate = !id;
      const url = isCreate ? "/api/domains" : `/api/domains/${id}`;
      const method = isCreate ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      const data = await res.json();
      onClearDirty();
      onStatusChange("saved");
      onSaved(data);

      // Reset status after 2s
      setTimeout(() => onStatusChange("idle"), 2000);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      onStatusChange("error");
      onError(err.message || "Save failed");
    }
  }, [id, dirty, getValues, onStatusChange, onSaved, onError, onClearDirty]);

  // Debounce: trigger save after delay when dirty changes
  useEffect(() => {
    if (dirty.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, delay, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /** Force an immediate save (bypass debounce) */
  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    save();
  }, [save]);

  return { saveNow };
}
