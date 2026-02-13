"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import Link from "next/link";
import type { RagStatus } from "@/lib/flow/status-manifest";

// Color schemes by role
const colors = {
  source: {
    border: "#3b82f6",
    bg: "#dbeafe",
    text: "#1e3a5f",
    accent: "#1e40af",
    badgeBg: "#dbeafe",
    badgeText: "#1e40af",
    divider: "#93c5fd",
  },
  output: {
    border: "#14b8a6",
    bg: "#ccfbf1",
    text: "#134e4a",
    accent: "#0f766e",
    badgeBg: "#99f6e4",
    badgeText: "#0f766e",
    divider: "#5eead4",
  },
  both: {
    border: "#8b5cf6",
    bg: "#ede9fe",
    text: "#3b0764",
    accent: "#5b21b6",
    badgeBg: "#c4b5fd",
    badgeText: "#5b21b6",
    divider: "#a78bfa",
  },
};

const ragColors: Record<RagStatus, string> = {
  red: "#ef4444",
  amber: "#f59e0b",
  green: "#10b981",
};

// Icons for storage types
const TableIcon = () => (
  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
    <path d="M2 4.5A2.5 2.5 0 014.5 2h11A2.5 2.5 0 0118 4.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 15.5v-11zM4.5 4A.5.5 0 004 4.5v2h12v-2a.5.5 0 00-.5-.5h-11zM16 8H4v3h12V8zm0 5H4v2.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V13z" />
  </svg>
);

const PathIcon = () => (
  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  </svg>
);

interface Resource {
  type: "table" | "path";
  table?: string;
  path?: string;
  link?: string;
  label?: string;
}

export const DataNode = memo(function DataNode({ data }: NodeProps) {
  const role = (data.role as "source" | "output" | "both") || "both";
  const storageType = data.storageType as "table" | "path" | undefined;
  const ragStatus = data.ragStatus as RagStatus | undefined;
  const statusLabel = data.statusLabel as string | undefined;
  const resources = data.resources as Resource[] | undefined;

  const colorScheme = colors[role];

  // Show source handle (right side) if can be a source
  const showSourceHandle = role === "source" || role === "both";
  // Show target handle (left side) if can be an output (receives data)
  const showTargetHandle = role === "output" || role === "both";

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: colorScheme.bg,
        border: `2px solid ${colorScheme.border}`,
        minWidth: 160,
        position: "relative",
      }}
    >
      {/* RAG Status Indicator - top right corner */}
      {ragStatus && (
        <div
          title={statusLabel || ragStatus}
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: ragColors[ragStatus],
            border: "2px solid white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            cursor: "help",
          }}
        />
      )}

      {/* Left handle - for nodes that receive data (output or both) */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: colorScheme.border,
            width: 10,
            height: 10,
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colorScheme.border,
          }}
        />
        <div style={{ fontWeight: 600, fontSize: 13, color: colorScheme.text }}>
          {data.label}
        </div>
      </div>

      {/* Storage type badge and path/table info */}
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        {storageType && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "2px 6px",
              borderRadius: 4,
              background: colorScheme.badgeBg,
              color: colorScheme.badgeText,
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {storageType === "table" ? <TableIcon /> : <PathIcon />}
            {storageType.toUpperCase()}
          </span>
        )}
        {/* Role badge for "both" nodes */}
        {role === "both" && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: colorScheme.border,
              color: "white",
              fontWeight: 600,
            }}
          >
            IN/OUT
          </span>
        )}
      </div>

      {/* Path display for path-based storage */}
      {data.path && (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: colorScheme.accent,
            fontFamily: "monospace",
          }}
        >
          {data.path}
        </div>
      )}

      {/* Table display for table-based storage (if no resources) */}
      {data.table && !resources && (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: colorScheme.accent,
            fontFamily: "monospace",
          }}
        >
          {data.table}
        </div>
      )}

      {/* Stats summary line */}
      {data.stats && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: colorScheme.accent,
            display: "flex",
            gap: 8,
          }}
        >
          {data.stats.files !== undefined && data.stats.files > 0 && (
            <span>{data.stats.files} files</span>
          )}
          {data.stats.count !== undefined && data.stats.count > 0 && (
            <span>{data.stats.count} records</span>
          )}
          {data.stats.processed !== undefined && (
            <span style={{ color: data.stats.processed > 0 ? colorScheme.accent : "#9ca3af" }}>
              {data.stats.processed} processed
            </span>
          )}
          {data.stats.percentComplete !== undefined &&
            data.stats.percentComplete > 0 &&
            data.stats.percentComplete < 100 && (
              <span style={{ color: ragColors.amber }}>{data.stats.percentComplete}%</span>
            )}
        </div>
      )}

      {/* Clickable Resources */}
      {resources && resources.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: `1px solid ${colorScheme.divider}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {resources.map((res, idx) => (
            <ResourceBadge key={idx} resource={res} colorScheme={colorScheme} />
          ))}
        </div>
      )}

      {/* Right handle - for nodes that provide data (source or both) */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: colorScheme.border,
            width: 10,
            height: 10,
          }}
        />
      )}
    </div>
  );
});

function ResourceBadge({
  resource,
  colorScheme,
}: {
  resource: Resource;
  colorScheme: (typeof colors)[keyof typeof colors];
}) {
  const label = resource.label || resource.table || resource.path || "Resource";
  const isTable = resource.type === "table";

  const badge = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 6px",
        borderRadius: 4,
        background: colorScheme.badgeBg,
        color: colorScheme.badgeText,
        fontSize: 9,
        fontWeight: 500,
        cursor: resource.link ? "pointer" : "default",
      }}
      title={resource.path || resource.table}
    >
      {isTable ? <TableIcon /> : <PathIcon />}
      {label}
    </span>
  );

  if (resource.link) {
    return (
      <Link
        href={resource.link}
        style={{ textDecoration: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        {badge}
      </Link>
    );
  }

  return badge;
}
