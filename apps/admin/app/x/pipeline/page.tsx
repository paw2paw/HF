"use client";

import { useState } from "react";
import { DraggableTabs } from "@/components/shared/DraggableTabs";
import { FileSearch, Workflow } from "lucide-react";
import RunInspector from "./components/RunInspector";
import Blueprint from "./components/Blueprint";

type Tab = "inspector" | "blueprint";

const TABS = [
  { id: "inspector", label: "Run Inspector", icon: <FileSearch size={14} /> },
  { id: "blueprint", label: "Blueprint", icon: <Workflow size={14} /> },
];

export default function PipelinePage() {
  const [activeTab, setActiveTab] = useState<Tab>("inspector");

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Run History</h1>
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
