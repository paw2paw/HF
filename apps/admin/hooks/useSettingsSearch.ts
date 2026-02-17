"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { SettingsPanel } from "@/lib/settings-panels";

export interface SettingsSearchResult {
  /** IDs of panels that match the search */
  matchingPanelIds: Set<string>;
  /** Keys of individual settings that match (for auto panels) */
  matchingSettingKeys: Set<string>;
  /** Whether a search is active */
  isSearching: boolean;
  /** Current search term */
  searchTerm: string;
  /** Debounced search term */
  debouncedTerm: string;
  /** Set the search term */
  setSearchTerm: (term: string) => void;
  /** Clear the search */
  clearSearch: () => void;
  /** Ref for the search input (for keyboard shortcuts) */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Focus the search input */
  focusInput: () => void;
}

export function useSettingsSearch(panels: SettingsPanel[]): SettingsSearchResult {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce 200ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Build searchable index (memoized — only rebuilds when panels change)
  const searchIndex = useMemo(() => {
    return panels.map((panel) => {
      const terms: string[] = [
        panel.label.toLowerCase(),
        panel.description.toLowerCase(),
      ];
      const settingKeys: { key: string; searchText: string }[] = [];

      if (panel.content.kind === "auto") {
        for (const s of panel.content.settings) {
          const text = `${s.label} ${s.description} ${s.key}`.toLowerCase();
          terms.push(text);
          settingKeys.push({ key: s.key, searchText: text });
        }
      } else {
        for (const t of panel.content.searchTerms) {
          terms.push(t.toLowerCase());
        }
      }

      return {
        panelId: panel.id,
        allText: terms.join(" "),
        settingKeys,
      };
    });
  }, [panels]);

  // Compute matches
  const { matchingPanelIds, matchingSettingKeys } = useMemo(() => {
    const panelIds = new Set<string>();
    const settingKeys = new Set<string>();

    if (!debouncedTerm.trim()) {
      return { matchingPanelIds: panelIds, matchingSettingKeys: settingKeys };
    }

    const words = debouncedTerm.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return { matchingPanelIds: panelIds, matchingSettingKeys: settingKeys };
    }

    for (const entry of searchIndex) {
      // Panel matches if ALL words appear somewhere in its searchable text
      const panelMatches = words.every((w) => entry.allText.includes(w));
      if (panelMatches) {
        panelIds.add(entry.panelId);

        // For auto panels, also track which individual settings matched
        for (const sk of entry.settingKeys) {
          if (words.some((w) => sk.searchText.includes(w))) {
            settingKeys.add(sk.key);
          }
        }
      }
    }

    return { matchingPanelIds: panelIds, matchingSettingKeys: settingKeys };
  }, [debouncedTerm, searchIndex]);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedTerm("");
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Cmd+F to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        focusInput();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusInput]);

  const isSearching = debouncedTerm.trim().length > 0;

  return {
    matchingPanelIds,
    matchingSettingKeys,
    isSearching,
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
    inputRef,
    focusInput,
  };
}
