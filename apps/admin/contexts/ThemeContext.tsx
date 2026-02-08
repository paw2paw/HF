"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "hf.theme.preference";

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return getSystemTheme();
  }
  return preference;
}

function applyTheme(theme: ResolvedTheme, preference: ThemePreference) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  // Clear both classes first
  root.classList.remove("dark", "light");

  // Tailwind's dark: classes require .dark on html element
  // CSS variables also use .dark class (with media query as fallback)
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    // Light theme
    // Add .light class only when explicitly selected (to override dark media query)
    if (preference === "light") {
      root.classList.add("light");
    }
    root.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const stored = getStoredPreference();
    const resolved = resolveTheme(stored);
    setPreferenceState(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved, stored);
    setMounted(true);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (preference === "system") {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyTheme(newResolved, "system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference, mounted]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    localStorage.setItem(STORAGE_KEY, pref);
    const resolved = resolveTheme(pref);
    setResolvedTheme(resolved);
    applyTheme(resolved, pref);
  }, []);

  const toggleTheme = useCallback(() => {
    // Cycle: system -> light -> dark -> system
    const next: ThemePreference =
      preference === "system" ? "light" :
      preference === "light" ? "dark" : "system";
    setPreference(next);
  }, [preference, setPreference]);

  // Prevent flash by not rendering until mounted
  // The CSS will handle the initial theme via media query
  const value: ThemeContextValue = {
    preference,
    resolvedTheme,
    setPreference,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Script to inject into head to prevent flash
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('hf.theme.preference');
    var pref = (stored === 'light' || stored === 'dark') ? stored : 'system';
    var isDark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.remove('dark', 'light');
    // Tailwind dark: classes require .dark on html element
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      // Add .light only when explicitly selected (to override dark media query)
      if (pref === 'light') {
        root.classList.add('light');
      }
      root.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;
