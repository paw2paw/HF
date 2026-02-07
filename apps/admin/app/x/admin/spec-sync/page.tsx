"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SyncStatus {
  ok: boolean;
  summary: {
    totalFiles: number;
    synced: number;
    unseeded: number;
    orphaned: number;
  };
  synced: Array<{
    id: string;
    filename: string;
    dbSlug: string;
    dbUpdatedAt: string;
    specType: string;
    specRole: string | null;
  }>;
  unseeded: Array<{
    id: string;
    filename: string;
    title: string;
    specType: string;
    specRole: string;
  }>;
  orphaned: Array<{
    dbId: string;
    slug: string;
    name: string;
    specType: string;
    isActive: boolean;
  }>;
}

export default function SpecSyncPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/spec-sync");
      const data = await res.json();
      if (data.ok) {
        setStatus(data);
      } else {
        setError(data.error || "Failed to fetch status");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch status");
    } finally {
      setLoading(false);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/spec-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSyncResult(data);
      if (data.ok) {
        // Refresh status after sync
        await fetchStatus();
      }
    } catch (e: any) {
      setSyncResult({ ok: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const badgeStyle = (type: "success" | "warning" | "error" | "info") => {
    const colors = {
      success: { bg: "var(--status-success-bg)", color: "var(--status-success-text)", border: "var(--status-success-border)" },
      warning: { bg: "var(--status-warning-bg)", color: "var(--status-warning-text)", border: "var(--status-warning-border)" },
      error: { bg: "var(--status-error-bg)", color: "var(--status-error-text)", border: "var(--status-error-border)" },
      info: { bg: "var(--status-info-bg)", color: "var(--status-info-text)", border: "var(--status-info-border)" },
    };
    return {
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: colors[type].bg,
      color: colors[type].color,
      border: `1px solid ${colors[type].border}`,
    };
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Spec Sync Status</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
            Compare <code>bdd-specs/*.spec.json</code> files with database records
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border-primary)",
              background: "var(--surface-primary)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
          <button
            onClick={syncAll}
            disabled={syncing || !status?.unseeded.length}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: status?.unseeded.length ? "var(--status-info-bg)" : "var(--surface-secondary)",
              color: status?.unseeded.length ? "var(--status-info-text)" : "var(--text-muted)",
              cursor: syncing || !status?.unseeded.length ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {syncing ? "Syncing..." : `Seed ${status?.unseeded.length || 0} Unseeded`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: "var(--status-error-bg)", border: "1px solid var(--status-error-border)", borderRadius: 8, marginBottom: 16, color: "var(--status-error-text)" }}>
          {error}
        </div>
      )}

      {syncResult && (
        <div style={{
          padding: 12,
          background: syncResult.ok ? "var(--status-success-bg)" : "var(--status-error-bg)",
          border: `1px solid ${syncResult.ok ? "var(--status-success-border)" : "var(--status-error-border)"}`,
          borderRadius: 8,
          marginBottom: 16,
          color: syncResult.ok ? "var(--status-success-text)" : "var(--status-error-text)",
        }}>
          {syncResult.ok ? (
            <>
              <strong>Sync Complete!</strong> {syncResult.summary?.specsProcessed} specs processed,{" "}
              {syncResult.summary?.parametersCreated} params created, {syncResult.summary?.specsCreated} specs created
            </>
          ) : (
            <>Error: {syncResult.error}</>
          )}
        </div>
      )}

      {status && (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{status.summary.totalFiles}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Spec Files</div>
            </div>
            <div style={{ padding: 16, background: "var(--status-success-bg)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: "var(--status-success-text)" }}>{status.summary.synced}</div>
              <div style={{ fontSize: 12, color: "var(--status-success-text)" }}>Synced</div>
            </div>
            <div style={{ padding: 16, background: status.summary.unseeded ? "var(--status-warning-bg)" : "var(--surface-secondary)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: status.summary.unseeded ? "var(--status-warning-text)" : "var(--text-primary)" }}>{status.summary.unseeded}</div>
              <div style={{ fontSize: 12, color: status.summary.unseeded ? "var(--status-warning-text)" : "var(--text-secondary)" }}>Unseeded</div>
            </div>
            <div style={{ padding: 16, background: status.summary.orphaned ? "var(--status-error-bg)" : "var(--surface-secondary)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: status.summary.orphaned ? "var(--status-error-text)" : "var(--text-primary)" }}>{status.summary.orphaned}</div>
              <div style={{ fontSize: 12, color: status.summary.orphaned ? "var(--status-error-text)" : "var(--text-secondary)" }}>Orphaned</div>
            </div>
          </div>

          {/* Unseeded Specs */}
          {status.unseeded.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={badgeStyle("warning")}>{status.unseeded.length}</span>
                Unseeded Specs
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>— in bdd-specs/ but not in database</span>
              </h2>
              <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-primary)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-secondary)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>ID</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Title</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>File</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Type</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.unseeded.map((spec) => (
                      <tr key={spec.id} style={{ borderTop: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 500 }}>{spec.id}</td>
                        <td style={{ padding: "10px 12px" }}>{spec.title}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12 }}>{spec.filename}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={badgeStyle(spec.specType === "SYSTEM" ? "info" : "success")}>{spec.specType}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ ...badgeStyle("info"), background: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>{spec.specRole}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Orphaned Specs */}
          {status.orphaned.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={badgeStyle("error")}>{status.orphaned.length}</span>
                Orphaned Specs
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>— in database but no matching file</span>
              </h2>
              <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-primary)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-secondary)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Slug</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Name</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Type</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.orphaned.map((spec) => (
                      <tr key={spec.dbId} style={{ borderTop: "1px solid var(--border-primary)" }}>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>
                          <Link href={`/x/specs?id=${spec.dbId}`} style={{ color: "var(--text-link)" }}>{spec.slug}</Link>
                        </td>
                        <td style={{ padding: "10px 12px" }}>{spec.name}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={badgeStyle(spec.specType === "SYSTEM" ? "info" : "success")}>{spec.specType}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {spec.isActive ? "Yes" : <span style={{ color: "var(--text-muted)" }}>No</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Synced Specs (collapsed by default) */}
          <details style={{ marginBottom: 24 }}>
            <summary style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={badgeStyle("success")}>{status.synced.length}</span>
              Synced Specs
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>— file matches database record</span>
            </summary>
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-primary)", borderRadius: 8, overflow: "hidden", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-secondary)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>ID</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>DB Slug</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Role</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {status.synced.map((spec) => (
                    <tr key={spec.id} style={{ borderTop: "1px solid var(--border-primary)" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 500 }}>{spec.id}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>
                        <Link href={`/x/specs?q=${spec.dbSlug}`} style={{ color: "var(--text-link)" }}>{spec.dbSlug}</Link>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={badgeStyle(spec.specType === "SYSTEM" ? "info" : "success")}>{spec.specType}</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ ...badgeStyle("info"), background: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}>{spec.specRole || "—"}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
                        {new Date(spec.dbUpdatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
