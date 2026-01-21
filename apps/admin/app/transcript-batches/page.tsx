"use client";

import { useState, useEffect, Fragment } from "react";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type RawFile = {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
};

type ProcessedFile = {
  id: string;
  filename: string;
  filepath: string;
  fileHash: string;
  fileType: string;
  callCount: number;
  callsExtracted: number;
  callsFailed: number;
  usersCreated: number;
  sizeBytes: string;
  status: string;
  processedAt: string | null;
  sourcePreserved: boolean;
  errorMessage: string | null;
  createdAt: string;
};

type FailedCall = {
  id: string;
  processedFileId: string;
  callIndex: number;
  externalId: string | null;
  errorType: string;
  errorMessage: string;
  rawData: any;
  retryCount: number;
  resolvedAt: string | null;
  createdAt: string;
  processedFile: {
    filename: string;
    filepath: string;
  };
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
  PROCESSING: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
  COMPLETED: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
  PARTIAL: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
  FAILED: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
};

const ERROR_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  NO_TRANSCRIPT: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
  INVALID_FORMAT: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  DUPLICATE: { bg: "var(--status-info-bg)", text: "var(--status-info-text)" },
  DB_ERROR: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  NO_CUSTOMER: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
  UNKNOWN: { bg: "var(--status-neutral-bg)", text: "var(--status-neutral-text)" },
};

export default function TranscriptsPage() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [rawFiles, setRawFiles] = useState<RawFile[]>([]);
  const [failedCalls, setFailedCalls] = useState<FailedCall[]>([]);
  const [failedStats, setFailedStats] = useState<{ total: number; unresolved: number; byType: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"raw" | "processed" | "failed">("raw");
  const [expandedFailedCall, setExpandedFailedCall] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/processed-files").then((r) => r.json()),
      fetch("/api/transcripts/raw-files").then((r) => r.json()),
      fetch("/api/failed-calls").then((r) => r.json()),
    ])
      .then(([fileData, rawData, failedData]) => {
        if (fileData.ok) setFiles(fileData.files || []);
        if (rawData.ok) setRawFiles(rawData.files || []);
        if (failedData.ok) {
          setFailedCalls(failedData.failedCalls || []);
          setFailedStats(failedData.stats || null);
        }
        if (!fileData.ok && !rawData.ok) {
          setError(fileData.error || rawData.error || "Failed to load data");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const formatBytes = (bytes: string | number) => {
    const b = typeof bytes === "string" ? parseInt(bytes) : bytes;
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch("/api/failed-calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], action: "resolve" }),
      });
      if (res.ok) {
        setFailedCalls((prev) =>
          prev.map((fc) => (fc.id === id ? { ...fc, resolvedAt: new Date().toISOString() } : fc))
        );
      }
    } catch (e) {
      console.error("Failed to resolve:", e);
    }
  };

  // Count stats
  const extractedCalls = files.reduce((sum, f) => sum + (f.callsExtracted || 0), 0);
  const failedCallsCount = failedStats?.unresolved || 0;

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Transcripts"
        description="Raw transcript files and extracted calls"
        dataNodeId="data:transcripts"
        count={rawFiles.length}
      />

      {/* Summary stats */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <div style={{
            padding: "12px 20px",
            background: "var(--surface-secondary)",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Files</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)" }}>{rawFiles.length}</div>
          </div>
          <div style={{
            padding: "12px 20px",
            background: "var(--surface-secondary)",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Calls Extracted</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "var(--status-success-text)" }}>{extractedCalls}</div>
          </div>
          {failedCallsCount > 0 && (
            <div
              style={{
                padding: "12px 20px",
                background: "var(--surface-secondary)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                cursor: "pointer",
              }}
              onClick={() => setTab("failed")}
            >
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Failed</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--status-error-text)" }}>{failedCallsCount}</div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab("raw")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            background: tab === "raw" ? "var(--tab-active-bg)" : "var(--tab-inactive-bg)",
            color: tab === "raw" ? "var(--tab-active-text)" : "var(--tab-inactive-text)",
            border: tab === "raw" ? "none" : "1px solid var(--tab-inactive-border)",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Raw Files ({rawFiles.length})
        </button>
        <button
          onClick={() => setTab("processed")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            background: tab === "processed" ? "var(--tab-active-bg)" : "var(--tab-inactive-bg)",
            color: tab === "processed" ? "var(--tab-active-text)" : "var(--tab-inactive-text)",
            border: tab === "processed" ? "none" : "1px solid var(--tab-inactive-border)",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Processed ({files.length})
        </button>
        <button
          onClick={() => setTab("failed")}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            background: tab === "failed" ? "var(--tab-active-bg)" : "var(--tab-inactive-bg)",
            color: tab === "failed" ? "var(--tab-active-text)" : "var(--tab-inactive-text)",
            border: tab === "failed" ? "none" : "1px solid var(--tab-inactive-border)",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Failed ({failedCallsCount})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
          {error}
        </div>
      ) : tab === "raw" ? (
        /* RAW FILES TAB */
        rawFiles.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              background: "var(--surface-secondary)",
              borderRadius: 12,
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No transcript files</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
              Add JSON transcript files to <code style={{ background: "var(--surface-tertiary)", padding: "2px 6px", borderRadius: 4 }}>sources/transcripts/</code>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              Then run &quot;Transcript Processor&quot; agent to extract calls
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--table-header-bg)", borderBottom: "1px solid var(--border-default)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Filename
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Size
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Modified
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rawFiles.map((file) => {
                  const processed = files.find((f) => f.filename === file.name);
                  const status = processed?.status || null;
                  const statusStyle = status ? STATUS_COLORS[status] || STATUS_COLORS.PENDING : null;

                  return (
                    <tr key={file.path} style={{ borderBottom: "1px solid var(--table-row-border)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{file.relativePath || file.name}</div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                            maxWidth: 400,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={file.path}
                        >
                          {file.name}
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>
                        {formatBytes(file.size)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(file.modifiedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            background: statusStyle ? statusStyle.bg : "var(--status-neutral-bg)",
                            color: statusStyle ? statusStyle.text : "var(--status-neutral-text)",
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {status || "NEW"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : tab === "processed" ? (
        /* PROCESSED TAB */
        files.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              background: "var(--surface-secondary)",
              borderRadius: 12,
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No processed files yet</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
              Run the Transcript Processor agent to extract calls
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--table-header-bg)", borderBottom: "1px solid var(--border-default)" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Filename
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Calls
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Extracted
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Failed
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Size
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                    Processed
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const statusStyle = STATUS_COLORS[file.status] || STATUS_COLORS.PENDING;
                  return (
                    <tr key={file.id} style={{ borderBottom: "1px solid var(--table-row-border)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{file.filename}</div>
                        {file.errorMessage && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--status-error-text)",
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={file.errorMessage}
                          >
                            {file.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            background: statusStyle.bg,
                            color: statusStyle.text,
                            borderRadius: 4,
                            fontWeight: 600,
                          }}
                        >
                          {file.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, color: "var(--text-primary)" }}>
                        {file.callCount}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, color: "var(--status-success-text)" }}>
                        {file.callsExtracted || 0}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14, color: file.callsFailed > 0 ? "var(--status-error-text)" : "var(--text-muted)" }}>
                        {file.callsFailed || 0}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, color: "var(--text-secondary)" }}>
                        {formatBytes(file.sizeBytes)}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-secondary)" }}>
                        {file.processedAt ? new Date(file.processedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* FAILED TAB */
        failedCalls.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              background: "var(--surface-secondary)",
              borderRadius: 12,
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No failed calls</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
              All calls were extracted successfully
            </div>
          </div>
        ) : (
          <div>
            {/* Error type breakdown */}
            {failedStats?.byType && Object.keys(failedStats.byType).length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {Object.entries(failedStats.byType).map(([type, count]) => {
                  const colors = ERROR_TYPE_COLORS[type] || ERROR_TYPE_COLORS.UNKNOWN;
                  return (
                    <span
                      key={type}
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        background: colors.bg,
                        color: colors.text,
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      {type.replace(/_/g, " ")}: {count}
                    </span>
                  );
                })}
              </div>
            )}

            <div
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--table-header-bg)", borderBottom: "1px solid var(--border-default)" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                      Source File
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                      Index
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                      Error Type
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                      Message
                    </th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedCalls.filter((fc) => !fc.resolvedAt).map((fc) => {
                    const colors = ERROR_TYPE_COLORS[fc.errorType] || ERROR_TYPE_COLORS.UNKNOWN;
                    const isExpanded = expandedFailedCall === fc.id;

                    return (
                      <Fragment key={fc.id}>
                        <tr style={{ borderBottom: "1px solid var(--table-row-border)" }}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                              {fc.processedFile?.filename || "Unknown"}
                            </div>
                            {fc.externalId && (
                              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                ID: {fc.externalId}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, color: "var(--text-secondary)" }}>
                            #{fc.callIndex}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                background: colors.bg,
                                color: colors.text,
                                borderRadius: 4,
                                fontWeight: 600,
                              }}
                            >
                              {fc.errorType.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                                maxWidth: 300,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={fc.errorMessage}
                            >
                              {fc.errorMessage}
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button
                                onClick={() => setExpandedFailedCall(isExpanded ? null : fc.id)}
                                style={{
                                  fontSize: 11,
                                  padding: "4px 8px",
                                  background: "var(--surface-secondary)",
                                  border: "1px solid var(--border-default)",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {isExpanded ? "Hide" : "View"}
                              </button>
                              <button
                                onClick={() => handleResolve(fc.id)}
                                style={{
                                  fontSize: 11,
                                  padding: "4px 8px",
                                  background: "var(--status-success-bg)",
                                  border: "none",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  color: "var(--status-success-text)",
                                  fontWeight: 500,
                                }}
                              >
                                Resolve
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} style={{ padding: "0 16px 16px 16px", background: "var(--surface-secondary)" }}>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Raw Data:</div>
                              <pre
                                style={{
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  background: "var(--surface-tertiary)",
                                  padding: 12,
                                  borderRadius: 6,
                                  overflow: "auto",
                                  maxHeight: 300,
                                  color: "var(--text-primary)",
                                  margin: 0,
                                }}
                              >
                                {JSON.stringify(fc.rawData, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
