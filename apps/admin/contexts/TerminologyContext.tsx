"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  type TerminologyProfile,
  type TerminologyPresetId,
  DEFAULT_TERMINOLOGY,
  pluralize,
  lc,
} from "@/lib/terminology/types";

interface TerminologyContextValue {
  /** The fully resolved terminology profile */
  terms: TerminologyProfile;
  /** The active preset ID */
  preset: TerminologyPresetId;
  /** Whether still loading from API */
  loading: boolean;
  /** Pluralize a term key (e.g. plural("learner") → "Students") */
  plural: (key: keyof TerminologyProfile) => string;
  /** Lowercase a term key (e.g. lower("institution") → "school") */
  lower: (key: keyof TerminologyProfile) => string;
  /** Lowercase + plural (e.g. lowerPlural("learner") → "students") */
  lowerPlural: (key: keyof TerminologyProfile) => string;
  /** Re-fetch terminology from API (e.g., after saving changes) */
  refresh: () => Promise<void>;
}

const TerminologyContext = createContext<TerminologyContextValue | null>(null);

export function TerminologyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [terms, setTerms] = useState<TerminologyProfile>(DEFAULT_TERMINOLOGY);
  const [preset, setPreset] = useState<TerminologyPresetId>("corporate");
  const [loading, setLoading] = useState(true);

  const fetchTerminology = useCallback(async () => {
    try {
      const r = await fetch("/api/institution/terminology");
      if (!r.ok) return;
      const res = await r.json();
      if (res.ok && res.terminology) {
        setTerms(res.terminology);
        if (res.preset) setPreset(res.preset);
      }
    } catch {
      // Fallback to current values
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchTerminology().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchTerminology]);

  const value: TerminologyContextValue = {
    terms,
    preset,
    loading,
    plural: (key) => pluralize(terms[key]),
    lower: (key) => lc(terms[key]),
    lowerPlural: (key) => lc(pluralize(terms[key])),
    refresh: fetchTerminology,
  };

  return (
    <TerminologyContext.Provider value={value}>
      {children}
    </TerminologyContext.Provider>
  );
}

export function useTerminology(): TerminologyContextValue {
  const context = useContext(TerminologyContext);
  if (!context) {
    return {
      terms: DEFAULT_TERMINOLOGY,
      preset: "corporate",
      loading: false,
      plural: (key) => pluralize(DEFAULT_TERMINOLOGY[key]),
      lower: (key) => lc(DEFAULT_TERMINOLOGY[key]),
      lowerPlural: (key) => lc(pluralize(DEFAULT_TERMINOLOGY[key])),
      refresh: async () => {},
    };
  }
  return context;
}
