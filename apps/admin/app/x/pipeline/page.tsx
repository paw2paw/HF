"use client";

import { useState } from "react";
import { Search, AccountTree } from "@mui/icons-material";
import RunInspector from "./components/RunInspector";
import Blueprint from "./components/Blueprint";

type Tab = "inspector" | "blueprint";

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState<Tab>("inspector");

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Pipeline</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Visualize and inspect the prompt composition pipeline
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 24,
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: 12,
        }}
      >
        <TabButton
          active={activeTab === "inspector"}
          onClick={() => setActiveTab("inspector")}
          icon={<Search style={{ fontSize: 18 }} />}
          label="Run Inspector"
        />
        <TabButton
          active={activeTab === "blueprint"}
          onClick={() => setActiveTab("blueprint")}
          icon={<AccountTree style={{ fontSize: 18 }} />}
          label="Blueprint"
        />
      </div>

      {/* Tab Content */}
      {activeTab === "inspector" ? <RunInspector /> : <Blueprint />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        background: active ? "#4f46e5" : "transparent",
        color: active ? "white" : "#6b7280",
        fontWeight: active ? 600 : 500,
        fontSize: 14,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#f3f4f6";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
}
