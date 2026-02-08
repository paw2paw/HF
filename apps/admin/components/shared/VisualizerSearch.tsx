"use client";

import React, { KeyboardEvent } from "react";
import { SearchMode, UseVisualizerSearchResult } from "@/hooks/useVisualizerSearch";

export interface VisualizerSearchProps {
  search: UseVisualizerSearchResult;
  /** Placeholder text */
  placeholder?: string;
  /** Show mode toggle (highlight/filter) */
  showModeToggle?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function VisualizerSearch({
  search,
  placeholder = "Search nodes...",
  showModeToggle = true,
  className = "",
}: VisualizerSearchProps) {
  const {
    searchTerm,
    setSearchTerm,
    clearSearch,
    matches,
    currentIndex,
    nextMatch,
    prevMatch,
    mode,
    setMode,
    isSearching,
    inputRef,
  } = search;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearSearch();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-1.5 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/20"
        />
        {/* Search icon */}
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {/* Clear button */}
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            title="Clear (Esc)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results row: count + navigation + mode */}
      {isSearching && (
        <div className="flex items-center justify-between gap-2">
          {/* Match count and navigation */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {matches.length === 0 ? (
                "No matches"
              ) : (
                <>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {currentIndex + 1}
                  </span>
                  {" / "}
                  {matches.length}
                </>
              )}
            </span>
            {matches.length > 1 && (
              <div className="flex gap-0.5">
                <button
                  onClick={prevMatch}
                  className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-500 dark:text-neutral-400"
                  title="Previous (Shift+Enter)"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={nextMatch}
                  className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-500 dark:text-neutral-400"
                  title="Next (Enter)"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Mode toggle */}
          {showModeToggle && matches.length > 0 && (
            <div className="flex rounded overflow-hidden border border-neutral-300 dark:border-neutral-600">
              <ModeButton
                mode="highlight"
                currentMode={mode}
                onClick={() => setMode("highlight")}
                icon={
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" opacity={0.3} />
                    <circle cx="12" cy="12" r="5" />
                  </svg>
                }
                title="Highlight matches, dim others"
              />
              <ModeButton
                mode="filter"
                currentMode={mode}
                onClick={() => setMode("filter")}
                icon={
                  <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                }
                title="Hide non-matches"
              />
            </div>
          )}
        </div>
      )}

      {/* Keyboard hint (only when not searching) */}
      {!isSearching && (
        <div className="text-[10px] text-neutral-400 dark:text-neutral-500">
          <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 font-mono">
            {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+F
          </kbd>
          {" to search"}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  mode,
  currentMode,
  onClick,
  icon,
  title,
}: {
  mode: SearchMode;
  currentMode: SearchMode;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  const isActive = mode === currentMode;
  return (
    <button
      onClick={onClick}
      className={`px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1 transition-colors ${
        isActive
          ? "bg-indigo-500 text-white"
          : "bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"
      }`}
      title={title}
    >
      {icon}
    </button>
  );
}
