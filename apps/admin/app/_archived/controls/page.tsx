"use client";

import React from "react";
import Link from "next/link";
import { uiColors } from "../../src/components/shared/uiColors";

export default function ControlsIndexPage() {
  return (
    <div
      style={{
        padding: 16,
        maxWidth: 960,
        color: uiColors.text,
      }}
    >
      <h1 style={{ margin: 0, color: uiColors.textLabel }}>Controls</h1>

      <p style={{ marginTop: 10, color: uiColors.textMuted, lineHeight: 1.5 }}>
        <b>Controls</b> are atomic, measurable levers used by agents, models, and policies.
        They represent things that can be evaluated, targeted, or constrained — such as
        conversational quality, personality signals, guardrails, or system behaviour.
      </p>

      <p style={{ marginTop: 8, color: uiColors.textMuted, lineHeight: 1.5 }}>
        Individual controls are not edited directly at runtime.
        Instead, they are assembled into <b>Control Sets</b>, which are versioned,
        auditable snapshots consumed by the system.
      </p>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          border: `1px solid ${uiColors.borderSubtle}`,
          background: uiColors.surfaceSubtle,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: uiColors.textLabel }}>
          Recommended workflow
        </div>

        <ol
          style={{
            marginTop: 8,
            paddingLeft: 18,
            fontSize: 13,
            color: uiColors.text,
            lineHeight: 1.5,
          }}
        >
          <li>Define and maintain atomic controls (traits, metrics, guardrails).</li>
          <li>Group controls into <b>Control Sets</b>.</li>
          <li>Version and snapshot Control Sets via Ops.</li>
          <li>Attach Control Sets to models, policies, or experiments.</li>
        </ol>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        <Link
          href="/derived/control-sets"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${uiColors.successBorder}`,
            background: uiColors.successBg,
            textDecoration: "none",
            color: uiColors.successText,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Open Control Sets →
        </Link>

        <Link
          href="/ops"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${uiColors.border}`,
            background: uiColors.surface,
            textDecoration: "none",
            color: uiColors.text,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Go to Ops
        </Link>

        <Link
          href="/history"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${uiColors.border}`,
            background: uiColors.surface,
            textDecoration: "none",
            color: uiColors.text,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          View Change History
        </Link>
      </div>

      <div style={{ marginTop: 18, fontSize: 12, color: uiColors.textMuted }}>
        Note: The previous <b>Parameters</b> UI has been deprecated.
        Database-level editing (Admin) remains available for maintenance,
        but runtime behaviour is driven exclusively by <b>Control Sets</b>.
      </div>
    </div>
  );
}