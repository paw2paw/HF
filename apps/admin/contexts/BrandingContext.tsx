"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  InstitutionBranding,
  DEFAULT_BRANDING,
  applyBrandingToDOM,
  clearBrandingFromDOM,
} from "@/lib/branding";

interface BrandingContextValue {
  branding: InstitutionBranding;
  loading: boolean;
  /** Force a re-fetch from the API (e.g. after creating a new institution). */
  refreshBranding: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<InstitutionBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [fetchKey, setFetchKey] = useState(0);

  const refreshBranding = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  // Fetch branding from API on mount and when refreshBranding() is called
  useEffect(() => {
    let cancelled = false;

    fetch("/api/institution/branding")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((res) => {
        if (!cancelled && res.ok && res.branding) {
          setBranding(res.branding);
        }
      })
      .catch(() => {
        // Fallback to defaults (e.g. on public pages where auth fails)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setMounted(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  // Apply branding CSS variable overrides when branding changes
  useEffect(() => {
    if (!mounted) return;
    applyBrandingToDOM(branding);

    return () => {
      clearBrandingFromDOM();
    };
  }, [mounted, branding]);

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext);
  if (!context) {
    // Return defaults when used outside provider (e.g. public join pages)
    return { branding: DEFAULT_BRANDING, loading: false, refreshBranding: () => {} };
  }
  return context;
}
