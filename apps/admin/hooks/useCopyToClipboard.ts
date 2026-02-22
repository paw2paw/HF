"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Hook for copying text to clipboard with auto-clearing feedback.
 *
 * Supports two usage patterns:
 * - Boolean: `const { copied, copy } = useCopyToClipboard();`
 * - Keyed (multiple buttons): `const { copiedKey, copy } = useCopyToClipboard();`
 *
 * @example Boolean (single copy button)
 * ```tsx
 * const { copied, copy } = useCopyToClipboard();
 * <button onClick={() => copy(text)}>{copied ? "Copied!" : "Copy"}</button>
 * ```
 *
 * @example Keyed (multiple copy buttons)
 * ```tsx
 * const { copiedKey, copy } = useCopyToClipboard();
 * <button onClick={() => copy(text, "prompt")}>
 *   {copiedKey === "prompt" ? "Copied!" : "Copy"}
 * </button>
 * ```
 */
export function useCopyToClipboard(timeoutMs = 2000) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback(
    (text: string, key?: string) => {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedKey(key ?? "_default");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedKey(null), timeoutMs);
    },
    [timeoutMs]
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { copied: copiedKey !== null, copiedKey, copy };
}
