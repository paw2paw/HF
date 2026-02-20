"use client";

import { useState } from "react";
import ContentSourceWizard from "./_components/ContentSourceWizard";
import ContentSourcesLibrary from "./_components/ContentSourcesLibrary";

export default function ContentSourcesPage() {
  const [viewMode, setViewMode] = useState<"wizard" | "library">("wizard");

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {viewMode === "wizard" ? "Content Sources" : "Content Library"}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            {viewMode === "wizard"
              ? "Select a content source or upload a new one to start teaching."
              : "Manage all content sources, upload documents, and review assertions."}
          </p>
        </div>
        <button
          onClick={() => setViewMode(viewMode === "wizard" ? "library" : "wizard")}
          style={{
            padding: "6px 16px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--surface-secondary)",
            color: "var(--text-secondary)",
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {viewMode === "wizard" ? "View Library" : "Back to Wizard"}
        </button>
      </div>

      {/* Content */}
      {viewMode === "wizard" ? <ContentSourceWizard /> : <ContentSourcesLibrary />}
    </div>
  );
}
