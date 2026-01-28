"use client";

import SystemStatusCard from "../../components/cockpit/SystemStatusCard";
import EnvironmentControlsCard from "../../components/cockpit/EnvironmentControlsCard";
import AgentPathsCard from "../../components/cockpit/AgentPathsCard";
import ServiceTogglesPanel from "../../components/cockpit/ServiceTogglesPanel";
import ActiveConfigSummary from "../../components/cockpit/ActiveConfigSummary";
import RunningAgentsCard from "../../components/cockpit/RunningAgentsCard";
import LoggingSettingsCard from "../../components/cockpit/LoggingSettingsCard";
import AIEngineSettingsCard from "../../components/cockpit/AIEngineSettingsCard";

export default function CockpitPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Cockpit</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          System status, environment controls, and configuration
        </p>
      </div>

      {/* Row 1: Status + Running Agents */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <SystemStatusCard />
        <RunningAgentsCard />
      </div>

      {/* Row 2: Environment Controls (full width) */}
      <div style={{ marginBottom: 20 }}>
        <EnvironmentControlsCard />
      </div>

      {/* Row 2: Agent Paths (full width) */}
      <div style={{ marginBottom: 20 }}>
        <AgentPathsCard />
      </div>

      {/* Row 3: Config + Toggles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <ActiveConfigSummary />
        <ServiceTogglesPanel />
      </div>

      {/* Row 4: AI Engine + Logging Settings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <AIEngineSettingsCard />
        <LoggingSettingsCard />
      </div>

      {/* CLI Reference */}
      <div
        style={{
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, marginBottom: 12 }}>
          CLI Commands
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            fontFamily: "monospace",
            fontSize: 12,
          }}
        >
          <div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 2 }}>Start (Colima)</div>
            <code style={{ color: "#374151" }}>npm run dev:start</code>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 2 }}>Start (Docker)</div>
            <code style={{ color: "#374151" }}>npm run dev:start:docker</code>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 2 }}>Status</div>
            <code style={{ color: "#374151" }}>npm run dev:status</code>
          </div>
          <div>
            <div style={{ color: "#9ca3af", fontSize: 10, marginBottom: 2 }}>Stop</div>
            <code style={{ color: "#374151" }}>npm run dev:stop</code>
          </div>
        </div>
      </div>
    </div>
  );
}
