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
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set());

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

  const syncSpecs = async (specIds?: string[]) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/spec-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(specIds ? { specIds } : {}),
      });
      const data = await res.json();
      setSyncResult(data);
      if (data.ok) {
        // Clear selection and refresh status after sync
        setSelectedSpecs(new Set());
        await fetchStatus();
      }
    } catch (e: any) {
      setSyncResult({ ok: false, error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const toggleSpec = (specId: string) => {
    setSelectedSpecs((prev) => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  };

  const toggleAll = () => {
    if (!status) return;
    if (selectedSpecs.size === status.unseeded.length) {
      setSelectedSpecs(new Set());
    } else {
      setSelectedSpecs(new Set(status.unseeded.map((s) => s.id)));
    }
  };

  const syncSelected = () => {
    if (selectedSpecs.size > 0) {
      syncSpecs(Array.from(selectedSpecs));
    } else {
      syncSpecs(); // Sync all
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div>
            <a href="/x/settings" style={{ fontSize: 13, color: "var(--accent-primary)", textDecoration: "none" }}>&larr; Back to Settings</a>
            <h1 className="hf-page-title" style={{ marginTop: 4 }}>Import Specs from Files</h1>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
            Load <code>docs-archive/bdd-specs/*.spec.json</code> files into the database (DB is the source of truth after import)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--surface-primary)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
          <button
            onClick={syncSelected}
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
            {syncing
              ? "Importing..."
              : selectedSpecs.size > 0
                ? `Import ${selectedSpecs.size} Selected`
                : `Import All ${status?.unseeded.length || 0}`}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
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
              <strong>Import Complete!</strong> {syncResult.summary?.specsSucceeded || syncResult.summary?.specsProcessed} specs imported,{" "}
              {syncResult.summary?.parametersCreated} params created, {syncResult.summary?.specsCreated} specs created
            </>
          ) : (
            <>
              <strong>{syncResult.summary?.specsFailed > 0 ? "Partial Import" : "Error"}:</strong>{" "}
              {syncResult.summary?.specsFailed > 0 ? (
                <>{syncResult.summary.specsSucceeded} succeeded, {syncResult.summary.specsFailed} failed — check results below</>
              ) : (
                syncResult.error
              )}
            </>
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
              <div style={{ fontSize: 12, color: "var(--status-success-text)" }}>Imported</div>
            </div>
            <div style={{ padding: 16, background: status.summary.unseeded ? "var(--status-warning-bg)" : "var(--surface-secondary)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: status.summary.unseeded ? "var(--status-warning-text)" : "var(--text-primary)" }}>{status.summary.unseeded}</div>
              <div style={{ fontSize: 12, color: status.summary.unseeded ? "var(--status-warning-text)" : "var(--text-secondary)" }}>Ready to Import</div>
            </div>
            <div style={{ padding: 16, background: "var(--surface-secondary)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>{status.summary.orphaned}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>DB-Only</div>
            </div>
          </div>

          {/* Unseeded Specs */}
          {status.unseeded.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={badgeStyle("warning")}>{status.unseeded.length}</span>
                Ready to Import
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>— spec files not yet loaded into database</span>
              </h2>
              <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-secondary)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "center", width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedSpecs.size === status.unseeded.length && status.unseeded.length > 0}
                          onChange={toggleAll}
                          style={{ cursor: "pointer", width: 16, height: 16 }}
                          title="Select all"
                        />
                      </th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>ID</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Title</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>File</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Type</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.unseeded.map((spec) => (
                      <tr
                        key={spec.id}
                        style={{
                          borderTop: "1px solid var(--border-default)",
                          background: selectedSpecs.has(spec.id) ? "var(--status-info-bg)" : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => toggleSpec(spec.id)}
                      >
                        <td style={{ padding: "10px 12px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSpecs.has(spec.id)}
                            onChange={() => toggleSpec(spec.id)}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 500 }}>{spec.id}</td>
                        <td style={{ padding: "10px 12px" }}>{spec.title}</td>
                        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 12 }}>{spec.filename}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={badgeStyle(spec.specType === "SYSTEM" ? "info" : "success")}>{spec.specType}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ ...badgeStyle("info"), background: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>{spec.specRole}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DB-Only Specs */}
          {status.orphaned.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={badgeStyle("info")}>{status.orphaned.length}</span>
                DB-Only Specs
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>— created via UI or source file removed (this is normal)</span>
              </h2>
              <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
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
                      <tr key={spec.dbId} style={{ borderTop: "1px solid var(--border-default)" }}>
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

          {/* Already Imported (collapsed by default) */}
          <details style={{ marginBottom: 24 }}>
            <summary style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={badgeStyle("success")}>{status.synced.length}</span>
              Already Imported
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>— file has been loaded into database</span>
            </summary>
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden", marginTop: 12 }}>
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
                    <tr key={spec.id} style={{ borderTop: "1px solid var(--border-default)" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 500 }}>{spec.id}</td>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>
                        <Link href={`/x/specs?q=${spec.dbSlug}`} style={{ color: "var(--text-link)" }}>{spec.dbSlug}</Link>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={badgeStyle(spec.specType === "SYSTEM" ? "info" : "success")}>{spec.specType}</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ ...badgeStyle("info"), background: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}>{spec.specRole || "—"}</span>
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
    </div>
  );
}
