import { useState, useMemo, useCallback, useEffect, useRef } from "react";

export type SearchMode = "highlight" | "filter";

export interface SearchableNode {
  id: string;
  label: string;
  type?: string;
  slug?: string;
}

export interface UseVisualizerSearchOptions {
  /** Debounce delay in ms (default: 150) */
  debounce?: number;
  /** Initial search mode */
  mode?: SearchMode;
  /** Callback when current match changes (for zoom/scroll) */
  onMatchChange?: (nodeId: string | null) => void;
  /** Fields to search (default: label, slug) */
  searchFields?: (keyof SearchableNode)[];
}

export interface UseVisualizerSearchResult {
  /** Current search term */
  searchTerm: string;
  /** Debounced search term (use this for filtering) */
  debouncedTerm: string;
  /** Set search term */
  setSearchTerm: (term: string) => void;
  /** Clear search */
  clearSearch: () => void;
  /** Array of matching node IDs */
  matches: string[];
  /** Set of matching node IDs (for O(1) lookup) */
  matchSet: Set<string>;
  /** Check if a node matches */
  isMatch: (id: string) => boolean;
  /** Current match index (0-based) */
  currentIndex: number;
  /** Current match node ID */
  currentMatchId: string | null;
  /** Go to next match */
  nextMatch: () => void;
  /** Go to previous match */
  prevMatch: () => void;
  /** Go to specific match index */
  goToMatch: (index: number) => void;
  /** Search mode: highlight (dim non-matches) or filter (hide non-matches) */
  mode: SearchMode;
  /** Set search mode */
  setMode: (mode: SearchMode) => void;
  /** Whether there's an active search */
  isSearching: boolean;
  /** Register keyboard handler (Cmd+F, Enter, Shift+Enter, Escape) */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Focus the search input */
  focusInput: () => void;
}

export function useVisualizerSearch(
  nodes: SearchableNode[],
  options: UseVisualizerSearchOptions = {}
): UseVisualizerSearchResult {
  const {
    debounce = 150,
    mode: initialMode = "highlight",
    onMatchChange,
    searchFields = ["label", "slug"],
  } = options;

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setCurrentIndex(0); // Reset to first match on new search
    }, debounce);
    return () => clearTimeout(timer);
  }, [searchTerm, debounce]);

  // Compute matches
  const matches = useMemo(() => {
    if (!debouncedTerm.trim()) return [];
    const term = debouncedTerm.toLowerCase();
    return nodes
      .filter((node) =>
        searchFields.some((field) => {
          const value = node[field];
          return value && String(value).toLowerCase().includes(term);
        })
      )
      .map((node) => node.id);
  }, [nodes, debouncedTerm, searchFields]);

  const matchSet = useMemo(() => new Set(matches), [matches]);

  const isMatch = useCallback((id: string) => matchSet.has(id), [matchSet]);

  const currentMatchId = matches[currentIndex] ?? null;

  // Notify when current match changes
  useEffect(() => {
    onMatchChange?.(currentMatchId);
  }, [currentMatchId, onMatchChange]);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const goToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      setCurrentIndex(Math.max(0, Math.min(index, matches.length - 1)));
    },
    [matches.length]
  );

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedTerm("");
    setCurrentIndex(0);
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Global keyboard shortcut for Cmd+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+F to focus search
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
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
    matches,
    matchSet,
    isMatch,
    currentIndex,
    currentMatchId,
    nextMatch,
    prevMatch,
    goToMatch,
    mode,
    setMode,
    isSearching,
    inputRef,
    focusInput,
  };
}
