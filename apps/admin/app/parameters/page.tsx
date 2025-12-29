"use client";

import React from "react";

export default function ParametersPage() {
  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Parameters</h1>
      <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.5 }}>
        The custom Parameters admin UI has been disabled.
        Manage Parameters and Tags via AdminJS instead.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <a
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            textDecoration: "none",
            color: "#111827",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Open Admin
        </a>

        <a
          href="/admin/resources/Parameter"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #c7d2fe",
            background: "#eef2ff",
            textDecoration: "none",
            color: "#111827",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Parameters (Resource)
        </a>

        <a
          href="/admin/resources/Tag"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #d1fae5",
            background: "#ecfdf5",
            textDecoration: "none",
            color: "#065f46",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Tags (Resource)
        </a>
      </div>

      <div style={{ marginTop: 14, fontSize: 13, color: "#6b7280" }}>
        If you still want an in-app table editor later, we can re-introduce it after the API tag persistence is solid.
      </div>
    </div>
  );
}