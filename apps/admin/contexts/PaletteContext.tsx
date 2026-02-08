"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// Palette preset definitions
// Each palette defines overrides for the base CSS variables
export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  // Light mode overrides
  light: {
    background: string;
    surfacePrimary: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    tableHeaderBg: string;
    hoverBg: string;
  };
  // Dark mode overrides (optional - defaults to standard dark if not specified)
  dark?: {
    background: string;
    surfacePrimary: string;
    surfaceSecondary: string;
    surfaceTertiary: string;
    tableHeaderBg: string;
    hoverBg: string;
  };
}

export const palettePresets: PalettePreset[] = [
  {
    id: "bright",
    name: "Bright",
    description: "Clean, high-contrast whites",
    light: {
      background: "#fafafa",
      surfacePrimary: "#ffffff",
      surfaceSecondary: "#f5f5f5",
      surfaceTertiary: "#ebebeb",
      tableHeaderBg: "#f5f5f5",
      hoverBg: "#f9fafb",
    },
  },
  {
    id: "soft",
    name: "Soft",
    description: "Warmer, easier on the eyes",
    light: {
      background: "#f7f6f4",
      surfacePrimary: "#fdfcfa",
      surfaceSecondary: "#f3f2f0",
      surfaceTertiary: "#e9e8e6",
      tableHeaderBg: "#f3f2f0",
      hoverBg: "#f8f7f5",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Cream/sepia tones",
    light: {
      background: "#f8f5f0",
      surfacePrimary: "#fdfaf5",
      surfaceSecondary: "#f4f1ec",
      surfaceTertiary: "#ebe8e3",
      tableHeaderBg: "#f4f1ec",
      hoverBg: "#faf7f2",
    },
  },
  {
    id: "cool",
    name: "Cool",
    description: "Subtle blue tint",
    light: {
      background: "#f6f8fa",
      surfacePrimary: "#fcfdfe",
      surfaceSecondary: "#f1f4f7",
      surfaceTertiary: "#e7ebef",
      tableHeaderBg: "#f1f4f7",
      hoverBg: "#f7f9fb",
    },
  },
  {
    id: "mint",
    name: "Mint",
    description: "Fresh green undertones",
    light: {
      background: "#f4f9f7",
      surfacePrimary: "#fafdfb",
      surfaceSecondary: "#eff5f2",
      surfaceTertiary: "#e5ede9",
      tableHeaderBg: "#eff5f2",
      hoverBg: "#f6faf8",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Warm pink undertones",
    light: {
      background: "#faf6f7",
      surfacePrimary: "#fdfbfb",
      surfaceSecondary: "#f5f0f1",
      surfaceTertiary: "#ede7e8",
      tableHeaderBg: "#f5f0f1",
      hoverBg: "#faf7f8",
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft purple tint",
    light: {
      background: "#f7f6fa",
      surfacePrimary: "#fcfbfd",
      surfaceSecondary: "#f2f0f6",
      surfaceTertiary: "#e9e6ef",
      tableHeaderBg: "#f2f0f6",
      hoverBg: "#f8f7fb",
    },
  },
  {
    id: "dim",
    name: "Dim",
    description: "Reduced brightness",
    light: {
      background: "#eeeeee",
      surfacePrimary: "#f5f5f5",
      surfaceSecondary: "#e8e8e8",
      surfaceTertiary: "#dedede",
      tableHeaderBg: "#e8e8e8",
      hoverBg: "#f0f0f0",
    },
  },
];

// Dark mode palette presets
export const darkPalettePresets: PalettePreset[] = [
  {
    id: "default",
    name: "Default",
    description: "Standard dark theme",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#0f0f0f",
      surfacePrimary: "#171717",
      surfaceSecondary: "#1f1f1f",
      surfaceTertiary: "#262626",
      tableHeaderBg: "#1f1f1f",
      hoverBg: "#1a1a1a",
    },
  },
  {
    id: "darker",
    name: "Darker",
    description: "True blacks, OLED-friendly",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#000000",
      surfacePrimary: "#0a0a0a",
      surfaceSecondary: "#141414",
      surfaceTertiary: "#1a1a1a",
      tableHeaderBg: "#141414",
      hoverBg: "#0f0f0f",
    },
  },
  {
    id: "softer",
    name: "Softer",
    description: "Lighter, less contrast",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#1a1a1a",
      surfacePrimary: "#222222",
      surfaceSecondary: "#2a2a2a",
      surfaceTertiary: "#333333",
      tableHeaderBg: "#2a2a2a",
      hoverBg: "#262626",
    },
  },
  {
    id: "navy",
    name: "Navy",
    description: "Deep blue undertones",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#0c0e14",
      surfacePrimary: "#12151d",
      surfaceSecondary: "#1a1d27",
      surfaceTertiary: "#222530",
      tableHeaderBg: "#1a1d27",
      hoverBg: "#161922",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Cool gray-blue tones",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#0f1115",
      surfacePrimary: "#16181d",
      surfaceSecondary: "#1e2027",
      surfaceTertiary: "#272a32",
      tableHeaderBg: "#1e2027",
      hoverBg: "#1a1c22",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Purple-tinted darkness",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#0e0c14",
      surfacePrimary: "#15131d",
      surfaceSecondary: "#1d1a27",
      surfaceTertiary: "#262330",
      tableHeaderBg: "#1d1a27",
      hoverBg: "#191622",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Deep green undertones",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#0c100e",
      surfacePrimary: "#121816",
      surfaceSecondary: "#1a201e",
      surfaceTertiary: "#232a27",
      tableHeaderBg: "#1a201e",
      hoverBg: "#161c1a",
    },
  },
  {
    id: "warm",
    name: "Warm",
    description: "Brown/sepia undertones",
    light: { background: "", surfacePrimary: "", surfaceSecondary: "", surfaceTertiary: "", tableHeaderBg: "", hoverBg: "" },
    dark: {
      background: "#12100e",
      surfacePrimary: "#1a1816",
      surfaceSecondary: "#22201e",
      surfaceTertiary: "#2b2927",
      tableHeaderBg: "#22201e",
      hoverBg: "#1e1c1a",
    },
  },
];

interface PaletteContextValue {
  lightPalette: string;
  darkPalette: string;
  setLightPalette: (id: string) => void;
  setDarkPalette: (id: string) => void;
  lightPresets: PalettePreset[];
  darkPresets: PalettePreset[];
}

const PaletteContext = createContext<PaletteContextValue | null>(null);

const LIGHT_STORAGE_KEY = "hf.palette.light";
const DARK_STORAGE_KEY = "hf.palette.dark";

function applyPalette(preset: PalettePreset, mode: "light" | "dark") {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const colors = mode === "dark" && preset.dark ? preset.dark : preset.light;

  // Skip if no colors defined
  if (!colors.background) return;

  root.style.setProperty("--background", colors.background);
  root.style.setProperty("--surface-primary", colors.surfacePrimary);
  root.style.setProperty("--surface-secondary", colors.surfaceSecondary);
  root.style.setProperty("--surface-tertiary", colors.surfaceTertiary);
  root.style.setProperty("--table-header-bg", colors.tableHeaderBg);
  root.style.setProperty("--hover-bg", colors.hoverBg);
}

function clearPaletteOverrides() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.removeProperty("--background");
  root.style.removeProperty("--surface-primary");
  root.style.removeProperty("--surface-secondary");
  root.style.removeProperty("--surface-tertiary");
  root.style.removeProperty("--table-header-bg");
  root.style.removeProperty("--hover-bg");
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [lightPalette, setLightPaletteState] = useState("bright");
  const [darkPalette, setDarkPaletteState] = useState("default");
  const [mounted, setMounted] = useState(false);

  // Initialize from storage
  useEffect(() => {
    const storedLight = localStorage.getItem(LIGHT_STORAGE_KEY);
    const storedDark = localStorage.getItem(DARK_STORAGE_KEY);

    if (storedLight && palettePresets.some(p => p.id === storedLight)) {
      setLightPaletteState(storedLight);
    }
    if (storedDark && darkPalettePresets.some(p => p.id === storedDark)) {
      setDarkPaletteState(storedDark);
    }

    setMounted(true);
  }, []);

  // Apply palette when it changes or theme changes
  useEffect(() => {
    if (!mounted) return;

    const applyCurrentPalette = () => {
      const isDark = document.documentElement.classList.contains("dark") ||
        (!document.documentElement.classList.contains("light") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      if (isDark) {
        const preset = darkPalettePresets.find(p => p.id === darkPalette);
        if (preset?.dark) {
          applyPalette(preset, "dark");
        } else {
          clearPaletteOverrides();
        }
      } else {
        const preset = palettePresets.find(p => p.id === lightPalette);
        if (preset && lightPalette !== "bright") {
          applyPalette(preset, "light");
        } else {
          clearPaletteOverrides();
        }
      }
    };

    applyCurrentPalette();

    // Watch for theme class changes
    const observer = new MutationObserver(applyCurrentPalette);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Watch for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", applyCurrentPalette);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", applyCurrentPalette);
    };
  }, [mounted, lightPalette, darkPalette]);

  const setLightPalette = useCallback((id: string) => {
    setLightPaletteState(id);
    localStorage.setItem(LIGHT_STORAGE_KEY, id);
  }, []);

  const setDarkPalette = useCallback((id: string) => {
    setDarkPaletteState(id);
    localStorage.setItem(DARK_STORAGE_KEY, id);
  }, []);

  return (
    <PaletteContext.Provider
      value={{
        lightPalette,
        darkPalette,
        setLightPalette,
        setDarkPalette,
        lightPresets: palettePresets,
        darkPresets: darkPalettePresets,
      }}
    >
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextValue {
  const context = useContext(PaletteContext);
  if (!context) {
    throw new Error("usePalette must be used within a PaletteProvider");
  }
  return context;
}
