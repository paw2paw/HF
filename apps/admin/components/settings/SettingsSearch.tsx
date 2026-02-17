"use client";

import { Search, X } from "lucide-react";

interface SettingsSearchProps {
  value: string;
  onChange: (term: string) => void;
  onClear: () => void;
  resultCount: number;
  isSearching: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function SettingsSearch({
  value,
  onChange,
  onClear,
  resultCount,
  isSearching,
  inputRef,
}: SettingsSearchProps) {
  return (
    <div style={{ padding: "0 12px 12px", borderBottom: "1px solid var(--border-default)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
          background: "var(--surface-secondary)",
        }}
      >
        <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClear();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search settings..."
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
          }}
        />
        {isSearching && (
          <>
            <span style={{
              fontSize: 11,
              color: resultCount > 0 ? "var(--text-muted)" : "var(--status-error-text)",
              whiteSpace: "nowrap",
            }}>
              {resultCount > 0 ? `${resultCount} found` : "No results"}
            </span>
            <button
              onClick={onClear}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
