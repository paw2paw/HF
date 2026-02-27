"use client";

/**
 * Holographic Page — Undo Stack
 *
 * Cmd+Z pops the last field change.
 * Max 50 entries. Only field edits, not navigation.
 */

import { useCallback, useEffect, useRef } from "react";

interface UndoEntry {
  field: string;
  previousValue: unknown;
  timestamp: number;
}

const MAX_UNDO = 50;

interface UseUndoStackOptions {
  /** Called when an undo fires — apply the reverted value */
  onUndo: (field: string, value: unknown) => void;
}

export function useUndoStack({ onUndo }: UseUndoStackOptions) {
  const stackRef = useRef<UndoEntry[]>([]);

  /** Push a field change onto the stack (call BEFORE applying the new value) */
  const pushUndo = useCallback(
    (field: string, previousValue: unknown) => {
      stackRef.current.push({
        field,
        previousValue,
        timestamp: Date.now(),
      });
      // Trim to max size
      if (stackRef.current.length > MAX_UNDO) {
        stackRef.current = stackRef.current.slice(-MAX_UNDO);
      }
    },
    [],
  );

  /** Pop and apply the most recent undo entry */
  const undo = useCallback(() => {
    const entry = stackRef.current.pop();
    if (!entry) return;
    onUndo(entry.field, entry.previousValue);
  }, [onUndo]);

  /** Clear the stack (e.g. after save or page navigation) */
  const clearStack = useCallback(() => {
    stackRef.current = [];
  }, []);

  // Keyboard listener for Cmd+Z / Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        // Don't intercept if focused on an input/textarea (let browser handle)
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;

        e.preventDefault();
        undo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  return { pushUndo, undo, clearStack };
}
