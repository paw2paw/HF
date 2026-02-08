"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

export type FancySelectOption = {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  isAction?: boolean; // For special actions like "+ Create new..."
};

export type FancySelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FancySelectOption[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  selectedStyle?: { border: string; background: string }; // Custom style when selected
  style?: React.CSSProperties;
};

export function FancySelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchable = true,
  clearable = false,
  disabled = false,
  selectedStyle,
  style,
}: FancySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value && !o.isAction);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase();
    return options.filter(
      (o) =>
        o.isAction ||
        o.label.toLowerCase().includes(s) ||
        o.subtitle?.toLowerCase().includes(s)
    );
  }, [options, search]);

  const handleSelect = useCallback(
    (option: FancySelectOption) => {
      onChange(option.value);
      setSearch("");
      setIsOpen(false);
      setHighlightIndex(0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[highlightIndex]) {
            handleSelect(filteredOptions[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setHighlightIndex(0);
          break;
      }
    },
    [isOpen, filteredOptions, highlightIndex, handleSelect]
  );

  // Scroll highlighted into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${highlightIndex}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHighlightIndex(0);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [filteredOptions.length]);

  const hasValue = !!value && !!selectedOption;
  const inputBorder = hasValue && selectedStyle ? selectedStyle.border : "1px solid var(--border-default)";
  const inputBg = hasValue && selectedStyle ? selectedStyle.background : disabled ? "var(--surface-secondary)" : "var(--surface-primary)";

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        ref={inputRef}
        type="text"
        readOnly={!searchable}
        value={isOpen && searchable ? search : selectedOption?.label || ""}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          if (selectedOption) setSearch("");
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "8px 12px",
          paddingRight: 36,
          fontSize: 13,
          border: inputBorder,
          borderRadius: 6,
          outline: "none",
          background: inputBg,
          color: "var(--text-primary)",
          cursor: disabled ? "not-allowed" : searchable ? "text" : "pointer",
        }}
      />

      {/* Right icons */}
      <div
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 6,
          pointerEvents: clearable && hasValue ? "auto" : "none",
        }}
      >
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setSearch("");
              inputRef.current?.focus();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1,
              pointerEvents: "auto",
            }}
          >
            &times;
          </button>
        )}
        <span style={{ color: "var(--text-muted)", fontSize: 10, pointerEvents: "none" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: 300,
            overflowY: "auto",
            zIndex: 100,
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No options found
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "6px 12px",
                  fontSize: 11,
                  color: "var(--text-placeholder)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {filteredOptions.filter((o) => !o.isAction).length} option
                {filteredOptions.filter((o) => !o.isAction).length !== 1 ? "s" : ""}
              </div>
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  data-index={index}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background:
                      highlightIndex === index
                        ? "var(--status-info-bg)"
                        : option.value === value
                          ? "var(--surface-secondary)"
                          : "transparent",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontStyle: option.isAction ? "italic" : "normal",
                  }}
                >
                  {/* Selection indicator */}
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: option.value === value && !option.isAction ? "var(--button-primary-bg)" : "transparent",
                      flexShrink: 0,
                    }}
                  />

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: option.isAction ? 400 : 500,
                        color: option.isAction ? "var(--text-muted)" : "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {option.label}
                    </div>
                    {option.subtitle && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {option.subtitle}
                      </div>
                    )}
                  </div>

                  {/* Badge */}
                  {option.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--surface-secondary)",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {option.badge}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
