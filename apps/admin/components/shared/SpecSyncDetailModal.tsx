/**
 * Spec Import Detail Modal
 * Shows import status: which spec files have been loaded into the database
 * DB is the source of truth after import — files are bootstrap material only
 */

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export interface SpecSyncDetailModalProps {
  /** Close handler */
  onClose: () => void;
  /** Callback after successful sync to refresh parent state */
  onSyncComplete: () => void;
}

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

export function SpecSyncDetailModal({
  onClose,
  onSyncComplete,
}: SpecSyncDetailModalProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set());
  const [showSynced, setShowSynced] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch sync status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/spec-sync");
      const data = await res.json();
      if (data.ok) {
        setStatus(data);
      } else {
        setError(data.error || "Failed to fetch sync status");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch sync status");
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
        onSyncComplete(); // Notify parent to refresh pills
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

  const badgeStyle = (type: "success" | "warning" | "error" | "info") => {
    const colors = {
      success: {
        bg: "var(--status-success-bg)",
        color: "var(--status-success-text)",
        border: "var(--status-success-border)",
      },
      warning: {
        bg: "var(--status-warning-bg)",
        color: "var(--status-warning-text)",
        border: "var(--status-warning-border)",
      },
      error: {
        bg: "var(--status-error-bg)",
        color: "var(--status-error-text)",
        border: "var(--status-error-border)",
      },
      info: {
        bg: "var(--status-info-bg)",
        color: "var(--status-info-text)",
        border: "var(--status-info-border)",
      },
    };
    return {
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      background: colors[type].bg,
      color: colors[type].color,
      border: `1px solid ${colors[type].border}`,
      display: "inline-block",
    };
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
          border: "1px solid var(--border-default)",
          maxWidth: 900,
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              Import Specs from Files
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
              }}
            >
              Load{" "}
              <code
                style={{
                  background: "var(--surface-secondary)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                docs-archive/bdd-specs/*.spec.json
              </code>{" "}
              files into the database
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 24,
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            Loading sync status...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: 12,
              background: "var(--status-error-bg)",
              border: "1px solid var(--status-error-border)",
              borderRadius: 8,
              marginBottom: 16,
              color: "var(--status-error-text)",
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div
            style={{
              padding: 12,
              background: syncResult.ok
                ? "var(--status-success-bg)"
                : "var(--status-error-bg)",
              border: `1px solid ${
                syncResult.ok
                  ? "var(--status-success-border)"
                  : "var(--status-error-border)"
              }`,
              borderRadius: 8,
              marginBottom: 16,
              color: syncResult.ok
                ? "var(--status-success-text)"
                : "var(--status-error-text)",
            }}
          >
            {syncResult.ok ? (
              <>
                <strong>Import Complete!</strong>{" "}
                {syncResult.summary?.specsSucceeded || syncResult.summary?.specsProcessed || 0} specs imported,{" "}
                {syncResult.summary?.parametersCreated || 0} params created,{" "}
                {syncResult.summary?.specsCreated || 0} specs created
              </>
            ) : (
              <>
                <strong>{syncResult.summary?.specsFailed > 0 ? "Partial Import" : "Error"}:</strong>{" "}
                {syncResult.summary?.specsFailed > 0 ? (
                  <>{syncResult.summary.specsSucceeded} succeeded, {syncResult.summary.specsFailed} failed</>
                ) : (
                  syncResult.error
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        {!loading && status && (
          <>
            {/* Summary Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 600 }}>
                  {status.summary.totalFiles}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                  }}
                >
                  Spec Files
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: "var(--status-success-bg)",
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid var(--status-success-border)",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "var(--status-success-text)",
                  }}
                >
                  {status.summary.synced}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--status-success-text)",
                    marginTop: 4,
                  }}
                >
                  Imported
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: status.summary.unseeded
                    ? "var(--status-warning-bg)"
                    : "var(--surface-secondary)",
                  borderRadius: 8,
                  textAlign: "center",
                  border: `1px solid ${
                    status.summary.unseeded
                      ? "var(--status-warning-border)"
                      : "var(--border-subtle)"
                  }`,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: status.summary.unseeded
                      ? "var(--status-warning-text)"
                      : "var(--text-primary)",
                  }}
                >
                  {status.summary.unseeded}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: status.summary.unseeded
                      ? "var(--status-warning-text)"
                      : "var(--text-secondary)",
                    marginTop: 4,
                  }}
                >
                  Ready to Import
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                  textAlign: "center",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {status.summary.orphaned}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 4,
                  }}
                >
                  DB-Only
                </div>
              </div>
            </div>

            {/* Unseeded Specs Section */}
            {status.unseeded.length > 0 ? (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={badgeStyle("warning")}>
                      {status.unseeded.length}
                    </span>
                    Ready to Import
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--text-secondary)",
                      }}
                    >
                      — spec files not yet loaded into database
                    </span>
                  </h2>
                  <button
                    onClick={syncSelected}
                    disabled={syncing || status.unseeded.length === 0}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        syncing || status.unseeded.length === 0
                          ? "var(--button-disabled-bg)"
                          : "var(--button-primary-bg)",
                      color: "white",
                      cursor:
                        syncing || status.unseeded.length === 0
                          ? "not-allowed"
                          : "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      opacity: syncing || status.unseeded.length === 0 ? 0.6 : 1,
                    }}
                  >
                    {syncing
                      ? "Importing..."
                      : selectedSpecs.size > 0
                      ? `Import ${selectedSpecs.size} Selected`
                      : `Import All ${status.unseeded.length}`}
                  </button>
                </div>
                <div
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "var(--surface-secondary)",
                        }}
                      >
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            width: 40,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={
                              selectedSpecs.size === status.unseeded.length &&
                              status.unseeded.length > 0
                            }
                            onChange={toggleAll}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                            title="Select all"
                          />
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          ID
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Title
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          File
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Role
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.unseeded.map((spec) => (
                        <tr
                          key={spec.id}
                          style={{
                            borderTop: "1px solid var(--border-default)",
                            background: selectedSpecs.has(spec.id)
                              ? "var(--status-info-bg)"
                              : "transparent",
                            cursor: "pointer",
                          }}
                          onClick={() => toggleSpec(spec.id)}
                        >
                          <td
                            style={{ padding: "10px 12px", textAlign: "center" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSpecs.has(spec.id)}
                              onChange={() => toggleSpec(spec.id)}
                              style={{ cursor: "pointer", width: 16, height: 16 }}
                            />
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "monospace",
                              fontWeight: 500,
                            }}
                          >
                            {spec.id}
                          </td>
                          <td style={{ padding: "10px 12px" }}>{spec.title}</td>
                          <td
                            style={{
                              padding: "10px 12px",
                              color: "var(--text-secondary)",
                              fontSize: 12,
                            }}
                          >
                            {spec.filename}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={badgeStyle(
                                spec.specType === "SYSTEM" ? "info" : "success"
                              )}
                            >
                              {spec.specType}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                ...badgeStyle("info"),
                                background: "var(--surface-secondary)",
                                color: "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                              }}
                            >
                              {spec.specRole}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  background: "var(--status-success-bg)",
                  border: "1px solid var(--status-success-border)",
                  borderRadius: 8,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--status-success-text)",
                  }}
                >
                  All spec files imported!
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--status-success-text)",
                    marginTop: 4,
                  }}
                >
                  All spec files are imported into the database
                </div>
              </div>
            )}

            {/* Synced Specs Section (Collapsible) */}
            {status.synced.length > 0 && (
              <details
                open={showSynced}
                onToggle={(e) => setShowSynced((e.target as HTMLDetailsElement).open)}
                style={{ marginBottom: 24 }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    listStyle: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      marginRight: 4,
                    }}
                  >
                    {showSynced ? "▼" : "▶"}
                  </span>
                  <span style={badgeStyle("success")}>
                    {status.synced.length}
                  </span>
                  Already Imported
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--text-secondary)",
                    }}
                  >
                    — file has been loaded into database
                  </span>
                </summary>
                <div
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "var(--surface-secondary)" }}>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          ID
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          DB Slug
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Role
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Last Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.synced.map((spec) => (
                        <tr
                          key={spec.id}
                          style={{
                            borderTop: "1px solid var(--border-default)",
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "monospace",
                              fontWeight: 500,
                            }}
                          >
                            {spec.id}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <Link
                              href={`/x/specs?q=${spec.dbSlug}`}
                              style={{
                                color: "var(--accent-primary)",
                                textDecoration: "none",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {spec.dbSlug}
                            </Link>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={badgeStyle(
                                spec.specType === "SYSTEM" ? "info" : "success"
                              )}
                            >
                              {spec.specType}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {spec.specRole ? (
                              <span
                                style={{
                                  ...badgeStyle("info"),
                                  background: "var(--surface-secondary)",
                                  color: "var(--text-secondary)",
                                  border: "1px solid var(--border-default)",
                                }}
                              >
                                {spec.specRole}
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: 12,
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              color: "var(--text-secondary)",
                              fontSize: 12,
                            }}
                          >
                            {new Date(spec.dbUpdatedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {/* Orphaned Specs Section */}
            {status.orphaned.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={badgeStyle("info")}>
                    {status.orphaned.length}
                  </span>
                  DB-Only Specs
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--text-secondary)",
                    }}
                  >
                    — created via UI or source file removed (this is normal)
                  </span>
                </h2>
                <div
                  style={{
                    padding: 12,
                    background: "var(--status-warning-bg)",
                    border: "1px solid var(--status-warning-border)",
                    borderRadius: 8,
                    marginBottom: 12,
                    fontSize: 13,
                    color: "var(--status-warning-text)",
                  }}
                >
                  These specs exist in the database only. They were created via the
                  UI import or their source file was removed. This is normal — the
                  database is the source of truth.
                </div>
                <div
                  style={{
                    background: "var(--surface-primary)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "var(--surface-secondary)" }}>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          DB Slug
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Name
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.orphaned.map((spec) => (
                        <tr
                          key={spec.dbId}
                          style={{
                            borderTop: "1px solid var(--border-default)",
                          }}
                        >
                          <td style={{ padding: "10px 12px" }}>
                            <Link
                              href={`/x/specs?id=${spec.dbId}`}
                              style={{
                                color: "var(--accent-primary)",
                                textDecoration: "none",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {spec.slug}
                            </Link>
                          </td>
                          <td style={{ padding: "10px 12px" }}>{spec.name}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={badgeStyle(
                                spec.specType === "SYSTEM" ? "info" : "success"
                              )}
                            >
                              {spec.specType}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={badgeStyle(
                                spec.isActive ? "success" : "error"
                              )}
                            >
                              {spec.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
