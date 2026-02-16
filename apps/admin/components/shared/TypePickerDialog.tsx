"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────

export interface PickerCategory {
  key: string;
  label: string;
  color?: string;
}

export interface PickerItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  /** Optional icon or badge rendered to the left of the name */
  badge?: React.ReactNode;
  /** Extra metadata displayed as muted text */
  meta?: string;
  /** Whether the item is already selected / in use */
  disabled?: boolean;
  disabledReason?: string;
}

export interface TypePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: PickerItem) => void;
  title: string;
  categories: PickerCategory[];
  items: PickerItem[];
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Category to select initially */
  defaultCategory?: string;
}

// ── Component ───────────────────────────────────────────────────

export function TypePickerDialog({
  open,
  onClose,
  onSelect,
  title,
  categories,
  items,
  searchPlaceholder = "Search...",
  defaultCategory,
}: TypePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(defaultCategory || categories[0]?.key || "");
  const searchRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveCategory(defaultCategory || categories[0]?.key || "");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, defaultCategory, categories]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Filter items by search + category
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesCategory = !activeCategory || activeCategory === "__all" || item.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.meta?.toLowerCase().includes(q)
      );
    });
  }, [items, activeCategory, search]);

  // Category counts (unfiltered)
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    return counts;
  }, [items]);

  // If search is active, auto-switch to "All" to show cross-category results
  const effectiveCategory = search.trim() ? "__all" : activeCategory;

  const effectiveFiltered = useMemo(() => {
    if (!search.trim()) return filtered;
    const q = search.toLowerCase().trim();
    return items.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.meta?.toLowerCase().includes(q)
    );
  }, [items, search, filtered]);

  const displayItems = search.trim() ? effectiveFiltered : filtered;

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      data-testid="picker-overlay"
    >
      <div
        style={{
          background: "var(--surface-primary, #fff)",
          border: "1px solid var(--border-default, #e5e7eb)",
          borderRadius: 16,
          width: 560,
          maxHeight: "min(480px, 80vh)",
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
        }}
        data-testid="picker-dialog"
      >
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-default, #e5e7eb)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary, #111)" }}>{title}</span>
            <button
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                border: "none",
                background: "none",
                color: "var(--text-muted, #9ca3af)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted, #9ca3af)",
              }}
            />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                borderRadius: 8,
                border: "1px solid var(--border-default, #e5e7eb)",
                background: "var(--surface-secondary, #f9fafb)",
                color: "var(--text-primary, #111)",
                fontSize: 13,
                outline: "none",
              }}
              data-testid="picker-search"
            />
          </div>
        </div>

        {/* Body: categories + items */}
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Categories */}
          <div
            style={{
              borderRight: "1px solid var(--border-default, #e5e7eb)",
              padding: 8,
              overflowY: "auto",
            }}
          >
            {categories.map((cat) => {
              const isActive = !search.trim() && activeCategory === cat.key;
              const count = categoryCounts.get(cat.key) || 0;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setSearch("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    color: isActive
                      ? cat.color || "var(--accent-primary, #3b82f6)"
                      : "var(--text-secondary, #6b7280)",
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    border: "none",
                    background: isActive
                      ? cat.color
                        ? `color-mix(in srgb, ${cat.color} 10%, transparent)`
                        : "rgba(59,130,246,0.08)"
                      : "none",
                    marginBottom: 2,
                    textAlign: "left",
                    transition: "all 0.1s",
                  }}
                  data-testid={`picker-cat-${cat.key}`}
                >
                  {cat.label}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Items */}
          <div style={{ padding: 8, overflowY: "auto" }}>
            {displayItems.length === 0 ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "var(--text-muted, #9ca3af)",
                fontSize: 13,
              }}>
                {search.trim() ? `No results for "${search}"` : "No items in this category"}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {displayItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!item.disabled) {
                        onSelect(item);
                        onClose();
                      }
                    }}
                    disabled={item.disabled}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-default, #e5e7eb)",
                      background: "none",
                      cursor: item.disabled ? "not-allowed" : "pointer",
                      opacity: item.disabled ? 0.5 : 1,
                      textAlign: "left",
                      transition: "all 0.1s",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      if (!item.disabled) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent-primary, #3b82f6)";
                        (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--accent-primary, #3b82f6) 4%, transparent)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default, #e5e7eb)";
                      (e.currentTarget as HTMLButtonElement).style.background = "none";
                    }}
                    data-testid={`picker-item-${item.id}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {item.badge}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary, #111)" }}>
                        {item.name}
                      </span>
                      {item.meta && (
                        <span style={{ fontSize: 10, color: "var(--text-muted, #9ca3af)", marginLeft: "auto" }}>
                          {item.meta}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-secondary, #6b7280)",
                        marginTop: 3,
                        lineHeight: 1.4,
                      }}>
                        {item.description}
                        {item.disabled && item.disabledReason && (
                          <span style={{ color: "var(--text-muted, #9ca3af)", fontStyle: "italic" }}>
                            {" "}&mdash; {item.disabledReason}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
