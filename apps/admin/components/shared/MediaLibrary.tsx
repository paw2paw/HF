"use client";

import { ArrowUpDown } from "lucide-react";

export interface SharedMediaItem {
  id: string;
  mediaId: string;
  fileName: string;
  mimeType: string;
  title: string | null;
  content: string;
  sharedAt: string;
  callId: string;
  url: string;
}

type SortField = "date" | "name" | "type";
type SortOrder = "asc" | "desc";
type TypeFilter = "all" | "image" | "pdf" | "audio";

interface MediaLibraryProps {
  items: SharedMediaItem[];
  loading: boolean;
  sort: SortField;
  order: SortOrder;
  filter: TypeFilter;
  onSortChange: (sort: SortField) => void;
  onOrderChange: (order: SortOrder) => void;
  onFilterChange: (filter: TypeFilter) => void;
  emptyMessage?: string;
}

const FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "pdf", label: "PDFs" },
  { value: "audio", label: "Audio" },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
];

function mediaIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "\u{1F5BC}";
  if (mimeType === "application/pdf") return "\u{1F4C4}";
  if (mimeType.startsWith("audio/")) return "\u{1F3B5}";
  return "\u{1F4CE}";
}

function mediaTypeLabel(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("audio/")) return "Audio";
  return "File";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function MediaLibrary({
  items,
  loading,
  sort,
  order,
  filter,
  onSortChange,
  onOrderChange,
  onFilterChange,
  emptyMessage = "No shared files yet",
}: MediaLibraryProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
          flexWrap: "wrap",
        }}
      >
        {/* Filter chips */}
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              style={{
                padding: "4px 10px",
                borderRadius: 14,
                fontSize: 12,
                border: "1px solid",
                borderColor: filter === f.value ? "var(--accent-primary, #4338ca)" : "var(--border-default, #d1d5db)",
                background: filter === f.value ? "var(--accent-primary, #4338ca)" : "var(--surface-primary, #fff)",
                color: filter === f.value ? "var(--button-primary-text, #fff)" : "var(--text-secondary, #374151)",
                cursor: "pointer",
                fontWeight: filter === f.value ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortField)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--border-default, #d1d5db)",
              background: "var(--surface-primary, #fff)",
              color: "var(--text-secondary, #374151)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => onOrderChange(order === "desc" ? "asc" : "desc")}
            title={order === "desc" ? "Newest first" : "Oldest first"}
            style={{
              padding: 4,
              borderRadius: 6,
              border: "1px solid var(--border-default, #d1d5db)",
              background: "var(--surface-primary, #fff)",
              color: "var(--text-muted, #667781)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted, #667781)", fontSize: 13 }}>
            Loading files...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted, #667781)", fontSize: 13 }}>
            {emptyMessage}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "inherit",
                  border: "1px solid var(--border-default, #e5e7eb)",
                  background: "var(--surface-primary, #fff)",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-secondary, #f9fafb)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-primary, #fff)")}
              >
                {/* Type icon */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    background: "var(--surface-secondary, #f3f4f6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  {item.mimeType.startsWith("image/") ? (
                    <img
                      src={item.url}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                    />
                  ) : (
                    mediaIcon(item.mimeType)
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text-primary, #111)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title || item.fileName}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted, #667781)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mediaTypeLabel(item.mimeType)}
                    {item.content && item.content !== (item.title || item.fileName)
                      ? ` \u2022 ${item.content}`
                      : ""}
                  </div>
                </div>

                {/* Date */}
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted, #667781)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {formatDate(item.sharedAt)}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
