"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import Link from "next/link";

const colors = {
  draft: "#8b5cf6",
  draftLight: "#ede9fe",
  published: "#10b981",
  publishedLight: "#d1fae5",
  running: "#f59e0b",
  runningLight: "#fef3c7",
  error: "#ef4444",
  errorLight: "#fee2e2",
  success: "#10b981",
  successLight: "#d1fae5",
};

interface Resource {
  type: "table" | "path";
  table?: string;
  path?: string;
  link?: string;
  label?: string;
}

export const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const status = data.status || "idle";
  const isPublished = data.isPublished;
  const resources = data.resources as Resource[] | undefined;
  const preflight = data.preflight as { canRun: boolean; hasWarnings: boolean } | undefined;

  // Determine colors based on status
  let borderColor = isPublished ? colors.published : colors.draft;
  let bgColor = isPublished ? colors.publishedLight : colors.draftLight;

  if (status === "running") {
    borderColor = colors.running;
    bgColor = colors.runningLight;
  } else if (status === "error") {
    borderColor = colors.error;
    bgColor = colors.errorLight;
  } else if (status === "success") {
    borderColor = colors.success;
    bgColor = colors.successLight;
  }

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: bgColor,
        border: `2px solid ${borderColor}`,
        minWidth: 160,
        transition: "all 0.2s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: borderColor,
          width: 10,
          height: 10,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Status indicator */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: borderColor,
            animation: status === "running" ? "pulse 1s infinite" : "none",
          }}
        />
        <div style={{ fontWeight: 600, fontSize: 13, color: "#1f2937" }}>{data.label}</div>
      </div>

      {/* Status badge */}
      <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {/* Group badge (if part of a group) */}
        {data.groupLabel && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: data.groupColor || "#6b7280",
              color: "white",
              fontWeight: 600,
              opacity: 0.9,
            }}
            title={`Part of: ${data.groupLabel}`}
          >
            {data.groupLabel.split(" ")[0].toUpperCase()}
          </span>
        )}
        <span
          style={{
            fontSize: 9,
            padding: "2px 6px",
            borderRadius: 4,
            background: isPublished ? colors.published : colors.draft,
            color: "white",
            fontWeight: 600,
          }}
        >
          {isPublished ? "LIVE" : data.hasDraft ? "DRAFT" : "NEW"}
        </span>
        {data.version && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: "#e5e7eb",
              color: "#374151",
            }}
          >
            {data.version}
          </span>
        )}
        {status !== "idle" && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background:
                status === "running"
                  ? colors.running
                  : status === "success"
                  ? colors.success
                  : colors.error,
              color: "white",
              fontWeight: 600,
            }}
          >
            {status.toUpperCase()}
          </span>
        )}
        {/* Prerequisite indicator */}
        {preflight && !preflight.canRun && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: colors.error,
              color: "white",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
            title="Prerequisites not met"
          >
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            PREREQ
          </span>
        )}
        {preflight && preflight.canRun && preflight.hasWarnings && (
          <span
            style={{
              fontSize: 9,
              padding: "2px 6px",
              borderRadius: 4,
              background: colors.running,
              color: "white",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
            title="Some optional prerequisites not met"
          >
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            WARN
          </span>
        )}
      </div>

      {/* Clickable Resources */}
      {resources && resources.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: `1px solid ${isPublished ? "#86efac" : "#c4b5fd"}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {resources.map((res, idx) => (
            <ResourceBadge key={idx} resource={res} isPublished={isPublished} />
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: borderColor,
          width: 10,
          height: 10,
        }}
      />

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
});

function ResourceBadge({ resource, isPublished }: { resource: Resource; isPublished?: boolean }) {
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
        background: isPublished ? "#dcfce7" : "#ede9fe",
        color: isPublished ? "#166534" : "#5b21b6",
        fontSize: 9,
        fontWeight: 500,
        cursor: resource.link ? "pointer" : "default",
      }}
      title={resource.path || resource.table}
    >
      {isTable ? (
        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4.5A2.5 2.5 0 014.5 2h11A2.5 2.5 0 0118 4.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 15.5v-11zM4.5 4A.5.5 0 004 4.5v2h12v-2a.5.5 0 00-.5-.5h-11zM16 8H4v3h12V8zm0 5H4v2.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V13z" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0-7a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8.25zm0 3.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
        </svg>
      )}
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
