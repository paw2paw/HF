"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  type TermKey,
  type TermMap,
  TECHNICAL_TERMS,
  pluralize,
  lc,
} from "@/lib/terminology/types";

interface TerminologyContextValue {
  /** The fully resolved terminology map (11 keys) */
  terms: TermMap;
  /** Whether still loading from API */
  loading: boolean;
  /** Pluralize a term key (e.g. plural("caller") → "Students") */
  plural: (key: TermKey) => string;
  /** Lowercase a term key (e.g. lower("domain") → "school") */
  lower: (key: TermKey) => string;
  /** Lowercase + plural (e.g. lowerPlural("caller") → "students") */
  lowerPlural: (key: TermKey) => string;
  /** Re-fetch terminology from API (e.g., after saving changes) */
  refresh: () => Promise<void>;
}

const TerminologyContext = createContext<TerminologyContextValue | null>(null);

export function TerminologyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [terms, setTerms] = useState<TermMap>(TECHNICAL_TERMS);
  const [loading, setLoading] = useState(true);

  const fetchTerminology = useCallback(async () => {
    try {
      const r = await fetch("/api/terminology");
      if (!r.ok) return;
      const res = await r.json();
      if (res.ok && res.terms) {
        setTerms(res.terms);
      }
    } catch {
      // Fallback to TECHNICAL_TERMS
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

/**
 * Hook to access resolved terminology for the current user.
 *
 * Returns the unified 11-key TermMap resolved by role + institution type.
 * ADMIN/SUPERADMIN/SUPER_TESTER see technical terms (Domain, Playbook, etc.).
 * All other roles see their institution type's labels (School, Lesson Plan, etc.).
 */
export function useTerminology(): TerminologyContextValue {
  const context = useContext(TerminologyContext);
  if (!context) {
    return {
      terms: TECHNICAL_TERMS,
      loading: false,
      plural: (key) => pluralize(TECHNICAL_TERMS[key]),
      lower: (key) => lc(TECHNICAL_TERMS[key]),
      lowerPlural: (key) => lc(pluralize(TECHNICAL_TERMS[key])),
      refresh: async () => {},
    };
  }
  return context;
}
