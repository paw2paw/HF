"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "./spec-sync.css";

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

  return (
    <div className="ss-layout">
      <div className="ss-header">
        <div>
          <div>
            <a href="/x/settings" className="ss-back-link">&larr; Back to Settings</a>
            <h1 className="hf-page-title ss-title">Import Specs from Files</h1>
          </div>
          <p className="ss-subtitle">
            Load <code>docs-archive/bdd-specs/*.spec.json</code> files into the database (DB is the source of truth after import)
          </p>
        </div>
        <div className="ss-header-actions">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="ss-btn-refresh"
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
          <button
            onClick={syncSelected}
            disabled={syncing || !status?.unseeded.length}
            className={`ss-btn-import ${status?.unseeded.length ? "ss-btn-import-active" : "ss-btn-import-disabled"}`}
          >
            {syncing
              ? "Importing..."
              : selectedSpecs.size > 0
                ? `Import ${selectedSpecs.size} Selected`
                : `Import All ${status?.unseeded.length || 0}`}
          </button>
        </div>
      </div>

      <div className="ss-content">
      {error && (
        <div className="hf-banner hf-banner-error">
          {error}
        </div>
      )}

      {syncResult && (
        <div className={`hf-banner ${syncResult.ok ? "hf-banner-success" : "hf-banner-error"}`}>
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
          <div className="ss-summary-grid">
            <div className="ss-summary-card ss-summary-card-default">
              <div className="ss-summary-value">{status.summary.totalFiles}</div>
              <div className="ss-summary-label ss-summary-label-default">Spec Files</div>
            </div>
            <div className="ss-summary-card ss-summary-card-success">
              <div className="ss-summary-value hf-text-success">{status.summary.synced}</div>
              <div className="ss-summary-label ss-summary-label-success">Imported</div>
            </div>
            <div className={`ss-summary-card ${status.summary.unseeded ? "ss-summary-card-warning" : "ss-summary-card-default"}`}>
              <div className={`ss-summary-value ${status.summary.unseeded ? "hf-text-warning" : ""}`}>{status.summary.unseeded}</div>
              <div className={`ss-summary-label ${status.summary.unseeded ? "ss-summary-label-warning" : "ss-summary-label-default"}`}>Ready to Import</div>
            </div>
            <div className="ss-summary-card ss-summary-card-default">
              <div className="ss-summary-value">{status.summary.orphaned}</div>
              <div className="ss-summary-label ss-summary-label-default">DB-Only</div>
            </div>
          </div>

          {/* Unseeded Specs */}
          {status.unseeded.length > 0 && (
            <div className="ss-section">
              <h2 className="ss-section-heading">
                <span className="hf-badge hf-badge-warning ss-badge-bordered-warning">{status.unseeded.length}</span>
                Ready to Import
                <span className="ss-section-hint">— spec files not yet loaded into database</span>
              </h2>
              <div className="ss-table-wrap">
                <table className="ss-table">
                  <thead>
                    <tr className="ss-thead-row">
                      <th className="ss-th ss-th-center">
                        <input
                          type="checkbox"
                          checked={selectedSpecs.size === status.unseeded.length && status.unseeded.length > 0}
                          onChange={toggleAll}
                          className="ss-checkbox"
                          title="Select all"
                        />
                      </th>
                      <th className="ss-th">ID</th>
                      <th className="ss-th">Title</th>
                      <th className="ss-th">File</th>
                      <th className="ss-th">Type</th>
                      <th className="ss-th">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.unseeded.map((spec) => (
                      <tr
                        key={spec.id}
                        className={`ss-tr-border ss-tr-clickable ${selectedSpecs.has(spec.id) ? "ss-tr-selected" : ""}`}
                        onClick={() => toggleSpec(spec.id)}
                      >
                        <td className="ss-td-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSpecs.has(spec.id)}
                            onChange={() => toggleSpec(spec.id)}
                            className="ss-checkbox"
                          />
                        </td>
                        <td className="ss-td-mono">{spec.id}</td>
                        <td className="ss-td">{spec.title}</td>
                        <td className="ss-td-secondary">{spec.filename}</td>
                        <td className="ss-td">
                          <span className={`hf-badge ${spec.specType === "SYSTEM" ? "hf-badge-info ss-badge-bordered-info" : "hf-badge-success ss-badge-bordered"}`}>{spec.specType}</span>
                        </td>
                        <td className="ss-td">
                          <span className="ss-badge-role">{spec.specRole}</span>
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
            <div className="ss-section">
              <h2 className="ss-section-heading">
                <span className="hf-badge hf-badge-info ss-badge-bordered-info">{status.orphaned.length}</span>
                DB-Only Specs
                <span className="ss-section-hint">— created via UI or source file removed (this is normal)</span>
              </h2>
              <div className="ss-table-wrap">
                <table className="ss-table">
                  <thead>
                    <tr className="ss-thead-row">
                      <th className="ss-th">Slug</th>
                      <th className="ss-th">Name</th>
                      <th className="ss-th">Type</th>
                      <th className="ss-th">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.orphaned.map((spec) => (
                      <tr key={spec.dbId} className="ss-tr-border">
                        <td className="ss-td-mono">
                          <Link href={`/x/specs?id=${spec.dbId}`} className="ss-link">{spec.slug}</Link>
                        </td>
                        <td className="ss-td">{spec.name}</td>
                        <td className="ss-td">
                          <span className={`hf-badge ${spec.specType === "SYSTEM" ? "hf-badge-info ss-badge-bordered-info" : "hf-badge-success ss-badge-bordered"}`}>{spec.specType}</span>
                        </td>
                        <td className="ss-td">
                          {spec.isActive ? "Yes" : <span className="ss-text-muted">No</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Already Imported (collapsed by default) */}
          <details className="ss-details">
            <summary className="ss-summary">
              <span className="hf-badge hf-badge-success ss-badge-bordered">{status.synced.length}</span>
              Already Imported
              <span className="ss-section-hint">— file has been loaded into database</span>
            </summary>
            <div className="ss-table-wrap ss-table-wrap-mt">
              <table className="ss-table">
                <thead>
                  <tr className="ss-thead-row">
                    <th className="ss-th">ID</th>
                    <th className="ss-th">DB Slug</th>
                    <th className="ss-th">Type</th>
                    <th className="ss-th">Role</th>
                    <th className="ss-th">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {status.synced.map((spec) => (
                    <tr key={spec.id} className="ss-tr-border">
                      <td className="ss-td-mono">{spec.id}</td>
                      <td className="ss-td-mono-sm">
                        <Link href={`/x/specs?q=${spec.dbSlug}`} className="ss-link">{spec.dbSlug}</Link>
                      </td>
                      <td className="ss-td">
                        <span className={`hf-badge ${spec.specType === "SYSTEM" ? "hf-badge-info ss-badge-bordered-info" : "hf-badge-success ss-badge-bordered"}`}>{spec.specType}</span>
                      </td>
                      <td className="ss-td">
                        <span className="ss-badge-role">{spec.specRole || "\u2014"}</span>
                      </td>
                      <td className="ss-td-secondary">
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
