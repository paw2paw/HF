"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import Link from "next/link";

const colors = {
  output: "#14b8a6",
  outputLight: "#ccfbf1",
};

interface Resource {
  type: "table" | "path";
  table?: string;
  path?: string;
  link?: string;
  label?: string;
}

export const OutputNode = memo(function OutputNode({ data }: NodeProps) {
  const resources = data.resources as Resource[] | undefined;

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: colors.outputLight,
        border: `2px solid ${colors.output}`,
        minWidth: 140,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: colors.output,
          width: 10,
          height: 10,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colors.output,
          }}
        />
        <div style={{ fontWeight: 600, fontSize: 13, color: "#134e4a" }}>{data.label}</div>
      </div>

      {data.table && !resources && (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            color: "#0f766e",
            fontFamily: "monospace",
          }}
        >
          {data.table}
        </div>
      )}

      {/* Clickable Resources */}
      {resources && resources.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: "1px solid #5eead4",
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {resources.map((res, idx) => (
            <ResourceBadge key={idx} resource={res} />
          ))}
        </div>
      )}

      {/* Output nodes can also be sources for downstream agents */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: colors.output,
          width: 10,
          height: 10,
        }}
      />
    </div>
  );
});

function ResourceBadge({ resource }: { resource: Resource }) {
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
        background: "#99f6e4",
        color: "#0f766e",
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
