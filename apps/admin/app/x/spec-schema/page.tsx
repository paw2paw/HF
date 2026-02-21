"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SpecSchemaPage() {
  const [schema, setSchema] = useState<any>(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    loadSchema();
  }, []);

  async function loadSchema() {
    setLoadingSchema(true);
    try {
      const res = await fetch("/api/x/spec-schema");
      const data = await res.json();
      if (data.ok) {
        setSchema(data.schema);
      } else {
        setSchemaError(data.error || "Failed to load schema");
      }
    } catch (e: any) {
      setSchemaError(e.message || "Network error");
    } finally {
      setLoadingSchema(false);
    }
  }

  function handleDownload() {
    if (!schema) return;
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feature-spec-schema.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="hf-page-title">
            BDD Spec Schema
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Reference schema for creating BDD spec files
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            href="/x/playground"
            style={{
              padding: "8px 16px",
              background: "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            📤 Upload Spec in Studio
          </Link>
        </div>
      </div>

      {/* Schema Card */}
      <div
        style={{
          padding: 20,
          background: "var(--surface-primary)",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              feature-spec-schema.json
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              JSON Schema for BDD specification files
            </div>
          </div>
          <button
            onClick={handleDownload}
            disabled={!schema}
            style={{
              padding: "8px 16px",
              background: schema ? "var(--surface-secondary)" : "var(--button-disabled-bg)",
              color: schema ? "var(--text-primary)" : "var(--text-muted)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: schema ? "pointer" : "not-allowed",
              opacity: schema ? 1 : 0.6,
            }}
          >
            Download Schema
          </button>
        </div>

        {/* Info box */}
        <div
          style={{
            padding: 12,
            background: "var(--status-info-bg)",
            border: "1px solid var(--status-info-border)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--status-info-text)",
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          This schema defines the structure of BDD spec files. Download it, create a <code>.spec.json</code> file
          conforming to this schema, then upload it via{" "}
          <Link href="/x/playground" style={{ fontWeight: 600, textDecoration: "underline" }}>
            Studio
          </Link>{" "}
          to activate it in the system.
        </div>

        {/* Schema viewer */}
        {loadingSchema ? (
          <div style={{ fontSize: 14, color: "var(--text-muted)", padding: 40, textAlign: "center" }}>
            Loading schema...
          </div>
        ) : schemaError ? (
          <div style={{ fontSize: 14, color: "var(--status-error-text)", padding: 20 }}>{schemaError}</div>
        ) : (
          <div
            style={{
              maxHeight: 600,
              overflow: "auto",
              background: "var(--background)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}
          >
            <pre
              style={{
                margin: 0,
                padding: 16,
                fontSize: 12,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
              }}
            >
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
