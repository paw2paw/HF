"use client";

import { useState } from "react";
import { Search, AccountTree } from "@mui/icons-material";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import RunInspector from "./components/RunInspector";
import Blueprint from "./components/Blueprint";

type Tab = "inspector" | "blueprint";

const TABS = [
  { id: "inspector", label: <><Search style={{ fontSize: 16, marginRight: 6 }} />Run Inspector</> },
  { id: "blueprint", label: <><AccountTree style={{ fontSize: 16, marginRight: 6 }} />Blueprint</> },
];

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState<Tab>("inspector");

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Run History</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
          View and inspect past prompt composition runs
        </p>
      </div>

      {/* Tabs */}
      <DraggableTabs
        storageKey="pipeline-tabs"
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
        containerStyle={{ marginBottom: 24 }}
      />

      {/* Tab Content */}
      {activeTab === "inspector" ? <RunInspector /> : <Blueprint />}
    </div>
  );
}
