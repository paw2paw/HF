"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";

const COOKIE_NAME = "hf.masquerade";
const BROADCAST_CHANNEL = "hf.masquerade";

export interface MasqueradeState {
  userId: string;
  email: string;
  name: string | null;
  role: UserRole;
  assignedDomainId: string | null;
  startedAt: string;
  startedBy: string;
}

interface MasqueradeContextValue {
  /** Current masquerade state, or null if not masquerading */
  masquerade: MasqueradeState | null;
  /** Convenience boolean */
  isMasquerading: boolean;
  /** The role to use for UI filtering (masqueraded role or real role) */
  effectiveRole: string;
  /** The userId to use (masqueraded or real) */
  effectiveUserId: string;
  /** Start masquerading as another user */
  startMasquerade: (userId: string) => Promise<void>;
  /** Stop masquerading */
  stopMasquerade: () => Promise<void>;
}

const MasqueradeContext = createContext<MasqueradeContextValue | null>(null);

/** Read the masquerade cookie from document.cookie (client-side only). */
function readMasqueradeCookie(): MasqueradeState | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.split("=").slice(1).join("="));
    const parsed = JSON.parse(raw);
    if (!parsed.userId || !parsed.role || !parsed.startedBy) return null;
    return parsed as MasqueradeState;
  } catch {
    return null;
  }
}

export function MasqueradeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [masquerade, setMasquerade] = useState<MasqueradeState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize from cookie on mount — deferred to avoid hydration mismatch
  // (server has no cookie access, so always renders masquerade=null)
  useEffect(() => {
    setMasquerade(readMasqueradeCookie());
    setHydrated(true);
  }, []);

  // Cross-tab sync via BroadcastChannel
  useEffect(() => {
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL);
      channel.onmessage = () => {
        setMasquerade(readMasqueradeCookie());
      };
      channelRef.current = channel;
      return () => channel.close();
    } catch {
      // BroadcastChannel not supported (e.g., SSR or very old browser)
    }
  }, []);

  // Re-read cookie on window focus (catches changes from other tabs without BroadcastChannel)
  useEffect(() => {
    const handleFocus = () => {
      setMasquerade(readMasqueradeCookie());
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const startMasquerade = useCallback(async (userId: string) => {
    const res = await fetch("/api/admin/masquerade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to start masquerade");
    }
    // Re-read from cookie (server set it in the response)
    setMasquerade(readMasqueradeCookie());
    // Notify other tabs
    try { channelRef.current?.postMessage("changed"); } catch {}
    // Reload to refresh server components with new identity
    window.location.reload();
  }, []);

  const stopMasquerade = useCallback(async () => {
    await fetch("/api/admin/masquerade", { method: "DELETE" });
    setMasquerade(null);
    // Notify other tabs
    try { channelRef.current?.postMessage("changed"); } catch {}
    // Reload to refresh server components with real identity
    window.location.reload();
  }, []);

  const realRole = session?.user?.role ?? "VIEWER";
  const realUserId = session?.user?.id ?? "";

  // Gate all masquerade-derived values on hydration to prevent SSR mismatch.
  // Before hydration, all consumers see isMasquerading=false regardless of cookie.
  const active = hydrated ? masquerade : null;

  const value: MasqueradeContextValue = {
    masquerade: active,
    isMasquerading: active !== null,
    effectiveRole: active?.role ?? realRole,
    effectiveUserId: active?.userId ?? realUserId,
    startMasquerade,
    stopMasquerade,
  };

  return (
    <MasqueradeContext.Provider value={value}>
      {children}
    </MasqueradeContext.Provider>
  );
}

export function useMasquerade(): MasqueradeContextValue {
  const ctx = useContext(MasqueradeContext);
  if (!ctx) {
    throw new Error("useMasquerade must be used within a MasqueradeProvider");
  }
  return ctx;
}
