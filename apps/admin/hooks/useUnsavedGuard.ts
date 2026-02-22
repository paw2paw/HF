import { useEffect } from "react";

/**
 * useUnsavedGuard — warns user before browser refresh/close when there are unsaved changes.
 *
 * Uses `beforeunload` event. Client-side Next.js navigation is controlled by
 * the wizards themselves (they call `endFlow()` / `router.push()` explicitly),
 * so `beforeunload` covers the real risk: browser refresh/close/tab close.
 */
export function useUnsavedGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
