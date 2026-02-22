/**
 * Spec Import Detail Modal
 * Shows import status: which spec files have been loaded into the database
 * DB is the source of truth after import — files are bootstrap material only
 */

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import "./spec-sync-detail-modal.css";

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

  return (
    <div
      className="ssd-overlay"
      onClick={onClose}
    >
      <div
        className="ssd-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ssd-header">
          <div>
            <div className="ssd-title">Import Specs from Files</div>
            <div className="ssd-subtitle">
              Load{" "}
              <code className="ssd-code">
                docs-archive/bdd-specs/*.spec.json
              </code>{" "}
              files into the database
            </div>
          </div>
          <button
            onClick={onClose}
            className="ssd-close-btn"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="ssd-loading">
            Loading sync status...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="hf-banner hf-banner-error">
            ❌ {error}
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div
            className="ssd-sync-result"
            data-status={syncResult.ok ? "success" : "error"}
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
            <div className="ssd-summary-grid">
              <div className="ssd-summary-card ssd-summary-card-default">
                <div className="ssd-summary-value">
                  {status.summary.totalFiles}
                </div>
                <div className="ssd-summary-label">Spec Files</div>
              </div>
              <div className="ssd-summary-card ssd-summary-card-success">
                <div className="ssd-summary-value ssd-summary-value-success">
                  {status.summary.synced}
                </div>
                <div className="ssd-summary-label ssd-summary-label-success">
                  Imported
                </div>
              </div>
              <div className={`ssd-summary-card ${status.summary.unseeded ? "ssd-summary-card-warning" : "ssd-summary-card-inactive"}`}>
                <div className={`ssd-summary-value ${status.summary.unseeded ? "ssd-summary-value-warning" : ""}`}>
                  {status.summary.unseeded}
                </div>
                <div className={`ssd-summary-label ${status.summary.unseeded ? "ssd-summary-label-warning" : ""}`}>
                  Ready to Import
                </div>
              </div>
              <div className="ssd-summary-card ssd-summary-card-default">
                <div className="ssd-summary-value">
                  {status.summary.orphaned}
                </div>
                <div className="ssd-summary-label">DB-Only</div>
              </div>
            </div>

            {/* Unseeded Specs Section */}
            {status.unseeded.length > 0 ? (
              <div className="ssd-section">
                <div className="ssd-section-header">
                  <h2 className="ssd-section-title">
                    <span className="hf-badge hf-badge-warning">
                      {status.unseeded.length}
                    </span>
                    Ready to Import
                    <span className="ssd-section-hint">
                      — spec files not yet loaded into database
                    </span>
                  </h2>
                  <button
                    onClick={syncSelected}
                    disabled={syncing || status.unseeded.length === 0}
                    className="ssd-import-btn"
                  >
                    {syncing
                      ? "Importing..."
                      : selectedSpecs.size > 0
                      ? `Import ${selectedSpecs.size} Selected`
                      : `Import All ${status.unseeded.length}`}
                  </button>
                </div>
                <div className="ssd-table-container">
                  <table className="ssd-table">
                    <thead>
                      <tr>
                        <th className="ssd-th-center">
                          <input
                            type="checkbox"
                            checked={
                              selectedSpecs.size === status.unseeded.length &&
                              status.unseeded.length > 0
                            }
                            onChange={toggleAll}
                            className="ssd-checkbox"
                            title="Select all"
                          />
                        </th>
                        <th>ID</th>
                        <th>Title</th>
                        <th>File</th>
                        <th>Type</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.unseeded.map((spec) => (
                        <tr
                          key={spec.id}
                          className={`ssd-row-selectable ${selectedSpecs.has(spec.id) ? "ssd-row-selected" : ""}`}
                          onClick={() => toggleSpec(spec.id)}
                        >
                          <td
                            className="ssd-cell-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedSpecs.has(spec.id)}
                              onChange={() => toggleSpec(spec.id)}
                              className="ssd-checkbox"
                            />
                          </td>
                          <td className="ssd-cell-mono">{spec.id}</td>
                          <td>{spec.title}</td>
                          <td className="ssd-cell-secondary">{spec.filename}</td>
                          <td>
                            <span className={`hf-badge ${spec.specType === "SYSTEM" ? "hf-badge-info" : "hf-badge-success"}`}>
                              {spec.specType}
                            </span>
                          </td>
                          <td>
                            <span className="ssd-badge-role">
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
              <div className="ssd-all-synced">
                <div className="ssd-all-synced-icon">✅</div>
                <div className="ssd-all-synced-title">
                  All spec files imported!
                </div>
                <div className="ssd-all-synced-desc">
                  All spec files are imported into the database
                </div>
              </div>
            )}

            {/* Synced Specs Section (Collapsible) */}
            {status.synced.length > 0 && (
              <details
                open={showSynced}
                onToggle={(e) => setShowSynced((e.target as HTMLDetailsElement).open)}
                className="ssd-details"
              >
                <summary className="ssd-summary">
                  <span className="ssd-toggle-icon">
                    {showSynced ? "▼" : "▶"}
                  </span>
                  <span className="hf-badge hf-badge-success">
                    {status.synced.length}
                  </span>
                  Already Imported
                  <span className="ssd-section-hint">
                    — file has been loaded into database
                  </span>
                </summary>
                <div className="ssd-table-container">
                  <table className="ssd-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>DB Slug</th>
                        <th>Type</th>
                        <th>Role</th>
                        <th>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.synced.map((spec) => (
                        <tr key={spec.id}>
                          <td className="ssd-cell-mono">{spec.id}</td>
                          <td>
                            <Link
                              href={`/x/specs?q=${spec.dbSlug}`}
                              className="ssd-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {spec.dbSlug}
                            </Link>
                          </td>
                          <td>
                            <span className={`hf-badge ${spec.specType === "SYSTEM" ? "hf-badge-info" : "hf-badge-success"}`}>
                              {spec.specType}
                            </span>
                          </td>
                          <td>
                            {spec.specRole ? (
                              <span className="ssd-badge-role">
                                {spec.specRole}
                              </span>
                            ) : (
                              <span className="ssd-no-role">—</span>
                            )}
                          </td>
                          <td className="ssd-cell-secondary">
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
              <div className="ssd-section">
                <h2 className="ssd-section-title ssd-section-title-spaced">
                  <span className="hf-badge hf-badge-info">
                    {status.orphaned.length}
                  </span>
                  DB-Only Specs
                  <span className="ssd-section-hint">
                    — created via UI or source file removed (this is normal)
                  </span>
                </h2>
                <div className="ssd-orphaned-info">
                  These specs exist in the database only. They were created via the
                  UI import or their source file was removed. This is normal — the
                  database is the source of truth.
                </div>
                <div className="ssd-table-container">
                  <table className="ssd-table">
                    <thead>
                      <tr>
                        <th>DB Slug</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.orphaned.map((spec) => (
                        <tr key={spec.dbId}>
                          <td>
                            <Link
                              href={`/x/specs?id=${spec.dbId}`}
                              className="ssd-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {spec.slug}
                            </Link>
                          </td>
                          <td>{spec.name}</td>
                          <td>
                            <span className={`hf-badge ${spec.specType === "SYSTEM" ? "hf-badge-info" : "hf-badge-success"}`}>
                              {spec.specType}
                            </span>
                          </td>
                          <td>
                            <span className={`hf-badge ${spec.isActive ? "hf-badge-success" : "hf-badge-error"}`}>
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
