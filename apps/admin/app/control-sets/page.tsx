"use client";

import { useState, useEffect } from "react";

type ControlSet = {
  id: string;
  name: string;
  description: string | null;
  version: string;
  isActive: boolean;
  avgScore: number | null;
  callCount: number;
  createdAt: string;
  updatedAt: string;
  promptTemplate?: { name: string } | null;
  _count?: {
    parameters: number;
    calls: number;
  };
};

export default function ControlSetsPage() {
  const [controlSets, setControlSets] = useState<ControlSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/control-sets")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setControlSets(data.controlSets || []);
        } else {
          setError(data.error || "Failed to load control sets");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Control Sets</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Parameter configurations for agent experiments
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : controlSets.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📌</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No control sets yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Create control sets to configure agent behavior experiments
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 16 }}>
          {controlSets.map((cs) => (
            <div
              key={cs.id}
              style={{
                background: "#fff",
                border: cs.isActive ? "2px solid #10b981" : "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{cs.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>v{cs.version}</div>
                </div>
                {cs.isActive && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      background: "#ecfdf5",
                      color: "#10b981",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>

              {cs.description && (
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{cs.description}</div>
              )}

              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                <span>{cs._count?.parameters || 0} parameters</span>
                <span>{cs.callCount} calls</span>
                {cs.avgScore != null && <span>Avg: {(cs.avgScore * 100).toFixed(0)}%</span>}
              </div>

              {cs.promptTemplate && (
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  Template: {cs.promptTemplate.name}
                </div>
              )}

              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
                Updated {new Date(cs.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
