"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
}

const TerminologyContext = createContext<TerminologyContextValue | null>(null);

export function TerminologyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [terms, setTerms] = useState<TerminologyProfile>(DEFAULT_TERMINOLOGY);
  const [preset, setPreset] = useState<TerminologyPresetId>("school");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/institution/terminology")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((res) => {
        if (!cancelled && res.ok && res.terminology) {
          setTerms(res.terminology);
          if (res.preset) setPreset(res.preset);
        }
      })
      .catch(() => {
        // Fallback to defaults (e.g. on public pages where auth fails)
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value: TerminologyContextValue = {
    terms,
    preset,
    loading,
    plural: (key) => pluralize(terms[key]),
    lower: (key) => lc(terms[key]),
    lowerPlural: (key) => lc(pluralize(terms[key])),
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
      preset: "school",
      loading: false,
      plural: (key) => pluralize(DEFAULT_TERMINOLOGY[key]),
      lower: (key) => lc(DEFAULT_TERMINOLOGY[key]),
      lowerPlural: (key) => lc(pluralize(DEFAULT_TERMINOLOGY[key])),
    };
  }
  return context;
}
