"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";

export type ViewModePreference = "auto" | "simple" | "advanced";

interface ViewModeContextValue {
  preference: ViewModePreference;
  isAdvanced: boolean;
  setPreference: (pref: ViewModePreference) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const STORAGE_KEY = "hf.viewMode";

/** Roles at level >= 3 default to advanced when preference is "auto" */
const ADVANCED_ROLES = new Set(["SUPERADMIN", "ADMIN", "OPERATOR", "EDUCATOR"]);

function getStoredPreference(): ViewModePreference {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "simple" || stored === "advanced" || stored === "auto") {
    return stored;
  }
  return "auto";
}

function resolveAdvanced(preference: ViewModePreference, role: string | undefined): boolean {
  if (preference === "simple") return false;
  if (preference === "advanced") return true;
  // "auto" — resolve from role
  return ADVANCED_ROLES.has(role ?? "");
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const [preference, setPreferenceState] = useState<ViewModePreference>("auto");

  // Initialize from localStorage on mount
  useEffect(() => {
    setPreferenceState(getStoredPreference());
  }, []);

  const isAdvanced = resolveAdvanced(preference, role);

  const setPreference = useCallback((pref: ViewModePreference) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const value: ViewModeContextValue = {
    preference,
    isAdvanced,
    setPreference,
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
