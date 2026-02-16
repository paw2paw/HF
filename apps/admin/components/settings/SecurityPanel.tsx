"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import type { PanelProps } from "@/lib/settings-panels";

interface AccessMatrix {
  roles: string[];
  matrix: Record<string, Record<string, string>>;
}

export function SecurityPanel(_props: PanelProps) {
  const [accessMatrix, setAccessMatrix] = useState<AccessMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch on mount (panel is only mounted when active)
  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/access-matrix")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.contract) {
          setAccessMatrix({
            roles: data.contract.roles,
            matrix: data.contract.matrix,
          });
        } else {
          setError(data.error || "Failed to load access matrix");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ color: "var(--text-muted)" }}>
          <Lock size={18} strokeWidth={1.5} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          Entity Access Matrix
        </h2>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Per-role CRUD permissions and data scopes for all system entities.
        Loaded from the <code style={{ fontSize: 12, padding: "1px 4px", borderRadius: 4, background: "var(--surface-tertiary)" }}>ENTITY_ACCESS_V1</code> contract.
      </p>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "C", desc: "Create", color: "#22c55e" },
          { label: "R", desc: "Read", color: "#3b82f6" },
          { label: "U", desc: "Update", color: "#f59e0b" },
          { label: "D", desc: "Delete", color: "#ef4444" },
        ].map((op) => (
          <div key={op.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: op.color, color: "#fff",
            }}>{op.label}</span>
            <span style={{ color: "var(--text-muted)" }}>{op.desc}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: "var(--surface-tertiary)", color: "var(--text-muted)",
          }}>—</span>
          <span style={{ color: "var(--text-muted)" }}>No access</span>
        </div>
      </div>

      {/* Scope legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { scope: "ALL", desc: "All records", bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
          { scope: "DOMAIN", desc: "Same domain only", bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
          { scope: "OWN", desc: "Own records only", bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
        ].map((s) => (
          <span key={s.scope} style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: s.bg, color: s.text,
          }}>{s.scope}: {s.desc}</span>
        ))}
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading access matrix...</p>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "#ef4444" }}>{error}</p>
      )}

      {accessMatrix && (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border-default)" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ background: "var(--surface-secondary)" }}>
                <th style={{
                  padding: "10px 14px", textAlign: "left", fontWeight: 600,
                  color: "var(--text-primary)", position: "sticky", left: 0,
                  background: "var(--surface-secondary)", borderRight: "1px solid var(--border-default)",
                }}>Entity</th>
                {accessMatrix.roles.map((role) => (
                  <th key={role} style={{
                    padding: "10px 8px", textAlign: "center", fontWeight: 600,
                    color: "var(--text-primary)", fontSize: 10, letterSpacing: "0.05em",
                  }}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(accessMatrix.matrix).map(([entity, roleMap], idx) => (
                <tr key={entity} style={{
                  background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                }}>
                  <td style={{
                    padding: "8px 14px", fontWeight: 500, color: "var(--text-primary)",
                    position: "sticky", left: 0, borderRight: "1px solid var(--border-default)",
                    background: idx % 2 === 0 ? "var(--surface-primary)" : "var(--surface-secondary)",
                  }}>{entity}</td>
                  {accessMatrix.roles.map((role) => {
                    const rule = roleMap[role] || "NONE";
                    const [scope, ops] = rule.split(":");
                    const isNone = scope === "NONE";

                    const scopeColors: Record<string, { bg: string; text: string }> = {
                      ALL: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
                      DOMAIN: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
                      OWN: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
                      NONE: { bg: "transparent", text: "var(--text-muted)" },
                    };
                    const sc = scopeColors[scope] || scopeColors.NONE;

                    const opColors: Record<string, string> = {
                      C: "#22c55e", R: "#3b82f6", U: "#f59e0b", D: "#ef4444",
                    };

                    return (
                      <td key={role} style={{ padding: "6px 8px", textAlign: "center" }}>
                        {isNone ? (
                          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                            <span style={{
                              padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600,
                              background: sc.bg, color: sc.text,
                            }}>{scope}</span>
                            <div style={{ display: "flex", gap: 2 }}>
                              {(ops || "").split("").map((op) => (
                                <span key={op} style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 16, height: 16, borderRadius: 3, fontSize: 9, fontWeight: 700,
                                  background: opColors[op] || "#6b7280", color: "#fff",
                                }}>{op}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
        The access matrix is stored as a contract in the database and cached for 30 seconds.
        To modify permissions, update the <code style={{ fontSize: 11, padding: "1px 4px", borderRadius: 4, background: "var(--surface-tertiary)" }}>ENTITY_ACCESS_V1</code> contract
        via seed scripts or the Fallback Defaults tab.
      </div>
    </div>
  );
}
