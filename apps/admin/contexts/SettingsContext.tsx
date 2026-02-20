"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface SettingsContextType {
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openSettings = useCallback(() => setIsOpen(true), []);
  const closeSettings = useCallback(() => setIsOpen(false), []);
  const toggleSettings = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <SettingsContext.Provider
      value={{
        isOpen,
        openSettings,
        closeSettings,
        toggleSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsModal() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettingsModal must be used within SettingsProvider");
  }
  return context;
}
