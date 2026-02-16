"use client";

import { useState, useEffect, useCallback } from "react";
import { MediaLibrary, type SharedMediaItem } from "@/components/shared/MediaLibrary";

interface MediaLibraryPanelProps {
  callerId: string;
  onClose: () => void;
}

export function MediaLibraryPanel({ callerId, onClose }: MediaLibraryPanelProps) {
  const [items, setItems] = useState<SharedMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"date" | "name" | "type">("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<"all" | "image" | "pdf" | "audio">("all");

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, order, type: filter });
      const res = await fetch(`/api/callers/${callerId}/media-history?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setItems(data.media || []);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [callerId, sort, order, filter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 0,
        right: 0,
        maxHeight: "70%",
        background: "var(--surface-primary, #fff)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-default, #e5e7eb)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "var(--text-primary, #111)" }}>
          Shared Files
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            color: "var(--text-muted, #667781)",
            padding: "2px 6px",
          }}
        >
          {"\u2715"}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
        <MediaLibrary
          items={items}
          loading={loading}
          sort={sort}
          order={order}
          filter={filter}
          onSortChange={setSort}
          onOrderChange={setOrder}
          onFilterChange={setFilter}
          emptyMessage="No files have been shared yet"
        />
      </div>
    </div>
  );
}
