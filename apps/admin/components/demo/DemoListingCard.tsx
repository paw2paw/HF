"use client";

import Link from "next/link";
import type { DemoSpec, DemoAudience } from "@/lib/demo/types";

interface DemoListingCardProps {
  spec: DemoSpec;
}

const AUDIENCE_LABELS: Record<DemoAudience, { label: string; color: string; bg: string }> = {
  operator: { label: "Operator", color: "var(--badge-indigo-text)", bg: "color-mix(in srgb, var(--badge-indigo-text) 10%, transparent)" },
  team_member: { label: "Team", color: "var(--badge-cyan-text)", bg: "color-mix(in srgb, var(--badge-cyan-text) 10%, transparent)" },
  evaluator: { label: "Evaluator", color: "var(--status-success-text)", bg: "color-mix(in srgb, var(--status-success-text) 10%, transparent)" },
  developer: { label: "Developer", color: "var(--badge-orange-text)", bg: "color-mix(in srgb, var(--badge-orange-text) 10%, transparent)" },
};

export function DemoListingCard({ spec }: DemoListingCardProps) {
  return (
    <Link
      href={`/x/demos/${spec.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        style={{
          padding: 20,
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          background: "var(--surface-primary)",
          cursor: "pointer",
          transition: "all 0.15s ease",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: "100%",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)";
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
        }}
      >
        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{spec.icon}</span>
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              {spec.title}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                margin: "2px 0 0 0",
              }}
            >
              {spec.subtitle}
            </p>
          </div>
        </div>

        {/* Objectives preview */}
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {spec.objectives.slice(0, 3).map((obj, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
              <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>•</span>
              <span>{obj}</span>
            </div>
          ))}
          {spec.objectives.length > 3 && (
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              +{spec.objectives.length - 3} more
            </span>
          )}
        </div>

        {/* Footer: duration + audience tags */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ⏱ {spec.estimatedMinutes} min · {spec.steps.length} steps
          </span>

          <div style={{ display: "flex", gap: 4 }}>
            {spec.audience.map((aud) => {
              const config = AUDIENCE_LABELS[aud];
              return (
                <span
                  key={aud}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 4,
                    color: config.color,
                    background: config.bg,
                  }}
                >
                  {config.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Link>
  );
}
