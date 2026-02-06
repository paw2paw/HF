"use client";

import AIEngineSettingsCard from "../../../components/cockpit/AIEngineSettingsCard";

export default function AdminPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Admin</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          System-wide settings and configuration
        </p>
      </div>

      {/* AI Engine Settings */}
      <div style={{ marginBottom: 20 }}>
        <AIEngineSettingsCard />
      </div>

      {/* Future sections placeholder */}
      <div
        style={{
          background: "#f9fafb",
          border: "1px dashed #d1d5db",
          borderRadius: 12,
          padding: 24,
          textAlign: "center",
          color: "#9ca3af",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500 }}>More settings coming soon</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          API keys, retention policies, default behaviors
        </div>
      </div>
    </div>
  );
}
