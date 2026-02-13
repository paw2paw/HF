"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type BDDUpload = {
  id: string;
  filename: string;
  fileType: "STORY" | "PARAMETER";
  status: "UPLOADED" | "VALIDATED" | "COMPILED" | "ERROR";
  storyId: string | null;
  name: string | null;
  uploadedAt: string;
};

type BDDFeatureSet = {
  id: string;
  featureId: string;
  name: string;
  version: string;
  parameterCount: number;
  constraintCount: number;
  definitionCount: number;
  isActive: boolean;
  compiledAt: string;
};

export default function LabPage() {
  const [uploads, setUploads] = useState<BDDUpload[]>([]);
  const [featureSets, setFeatureSets] = useState<BDDFeatureSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dbSpecs, setDbSpecs] = useState<any[]>([]);
  const [filesystemInfo, setFilesystemInfo] = useState<{ available: boolean; fileCount: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [uploadsRes, featuresRes, specsRes] = await Promise.all([
        fetch("/api/lab/uploads?limit=5"),
        fetch("/api/lab/features?limit=5"),
        fetch("/api/lab/sync-specs"),
      ]);

      const uploadsData = await uploadsRes.json();
      const featuresData = await featuresRes.json();
      const specsData = await specsRes.json();

      if (uploadsData.ok) setUploads(uploadsData.uploads || []);
      if (featuresData.ok) setFeatureSets(featuresData.features || []);
      if (specsData.ok) {
        setDbSpecs(specsData.specs || []);
        setFilesystemInfo(specsData.filesystem || null);
      }
    } catch (err) {
      console.error("Failed to load lab data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncSpecs = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/lab/sync-specs", { method: "POST" });
      const data = await res.json();

      if (data.ok) {
        setSyncResult({ message: data.message, type: "success" });
        // Refresh the data
        fetchData();
      } else {
        setSyncResult({ message: data.error || "Sync failed", type: "error" });
      }
    } catch (err: any) {
      setSyncResult({ message: err.message || "Network error", type: "error" });
    } finally {
      setSyncing(false);
    }
  };

  const workflowSteps = [
    {
      num: 1,
      title: "Upload",
      description: "Upload BDD XML specs (stories & parameters)",
      icon: "📤",
      href: "/lab/upload",
      color: "#4f46e5",
    },
    {
      num: 2,
      title: "Validate",
      description: "Parse and validate XML structure",
      icon: "✓",
      href: "/lab/upload",
      color: "#8b5cf6",
    },
    {
      num: 3,
      title: "Compile",
      description: "Extract parameters, constraints, definitions",
      icon: "⚙️",
      href: "/lab/features",
      color: "#10b981",
    },
    {
      num: 4,
      title: "Test",
      description: "Run specs against real Callers/Calls",
      icon: "🧪",
      href: "/lab/features",
      color: "#f59e0b",
    },
    {
      num: 5,
      title: "Publish",
      description: "Activate for use in Playbooks",
      icon: "🚀",
      href: "/lab/features",
      color: "#ef4444",
    },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      UPLOADED: { bg: "#dbeafe", text: "#1d4ed8", label: "Uploaded" },
      VALIDATED: { bg: "#dcfce7", text: "#166534", label: "Validated" },
      COMPILED: { bg: "#f0fdf4", text: "#15803d", label: "Compiled" },
      ERROR: { bg: "#fef2f2", text: "#dc2626", label: "Error" },
    };
    const s = styles[status] || styles.UPLOADED;
    return (
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          padding: "2px 6px",
          borderRadius: 4,
          background: s.bg,
          color: s.text,
        }}
      >
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🧪</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>BDD Lab</h1>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 4,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            EXPERIMENTAL
          </span>
        </div>
        <p style={{ fontSize: 15, color: "#6b7280", margin: 0, maxWidth: 600 }}>
          Simplified BDD-first spec development. Upload XML specs, compile to feature sets,
          test against real data, then publish to Playbooks.
        </p>
      </div>

      {/* Workflow Steps */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 32,
          padding: 20,
          background: "#f9fafb",
          borderRadius: 12,
          overflowX: "auto",
        }}
      >
        {workflowSteps.map((step, i) => (
          <Link
            key={step.num}
            href={step.href}
            style={{
              flex: 1,
              minWidth: 140,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "16px 12px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              textDecoration: "none",
              transition: "all 0.15s ease",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: step.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>{step.icon}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 4 }}>
              {step.num}. {step.title}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>
              {step.description}
            </div>
            {i < workflowSteps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  right: -12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 18,
                  color: "#d1d5db",
                }}
              >
                →
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Database Specs (Source of Truth) */}
      <div
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>📋</span>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>BDD Specs in Database</h2>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.2)",
                }}
              >
                SOURCE OF TRUTH
              </span>
            </div>
            <p style={{ fontSize: 14, margin: 0, opacity: 0.9, maxWidth: 500 }}>
              {dbSpecs.length} specs loaded in database.
              {filesystemInfo?.available && ` (${filesystemInfo.fileCount} files in docs-archive/bdd-specs/ for re-seeding)`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {filesystemInfo?.available && (
              <button
                onClick={handleSyncSpecs}
                disabled={syncing || !filesystemInfo?.fileCount}
                style={{
                  padding: "10px 16px",
                  background: syncing ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: syncing || !filesystemInfo?.fileCount ? "not-allowed" : "pointer",
                }}
              >
                {syncing ? "Re-seeding..." : "Re-seed from Files"}
              </button>
            )}
            <Link
              href="/x/import"
              style={{
                padding: "12px 24px",
                background: "white",
                color: "#4f46e5",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Upload New Spec
            </Link>
          </div>
        </div>
        {syncResult && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              background: syncResult.type === "success" ? "rgba(255,255,255,0.2)" : "rgba(255,0,0,0.2)",
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            {syncResult.message}
          </div>
        )}
        {dbSpecs.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Specs: {dbSpecs.map(s => s.id).join(", ")}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
        <Link
          href="/lab/upload"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 20,
            background: "#4f46e5",
            borderRadius: 12,
            textDecoration: "none",
            color: "white",
            transition: "transform 0.15s ease",
          }}
        >
          <span style={{ fontSize: 32 }}>📤</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Upload New Specs</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Alternative: Upload via web interface
            </div>
          </div>
        </Link>

        <Link
          href="/lab/features"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 20,
            background: "#6366f1",
            borderRadius: 12,
            textDecoration: "none",
            color: "white",
            transition: "transform 0.15s ease",
          }}
        >
          <span style={{ fontSize: 32 }}>📦</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>View Feature Sets</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              See compiled specs and activate them
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Recent Uploads */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Uploads</h2>
            <Link href="/lab/upload" style={{ fontSize: 12, color: "#4f46e5" }}>
              View all →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : uploads.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                background: "#f9fafb",
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>No uploads yet</div>
              <Link
                href="/lab/upload"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  fontSize: 12,
                  color: "#4f46e5",
                }}
              >
                Upload your first spec →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "#f9fafb",
                    borderRadius: 6,
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {upload.fileType === "STORY" ? "📖" : "📐"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {upload.name || upload.filename}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {new Date(upload.uploadedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {getStatusBadge(upload.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature Sets */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Feature Sets</h2>
            <Link href="/lab/features" style={{ fontSize: 12, color: "#4f46e5" }}>
              View all →
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading...</div>
          ) : featureSets.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                background: "#f9fafb",
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>No feature sets compiled</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Upload and compile specs to create feature sets
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {featureSets.map((fs) => (
                <Link
                  key={fs.id}
                  href={`/lab/features/${fs.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "#f9fafb",
                    borderRadius: 6,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontSize: 16 }}>📦</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{fs.name}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      {fs.parameterCount} params • {fs.constraintCount} constraints • v{fs.version}
                    </div>
                  </div>
                  {fs.isActive && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#dcfce7",
                        color: "#166534",
                      }}
                    >
                      Active
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div
        style={{
          marginTop: 32,
          padding: 20,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 12,
        }}
      >
        <div style={{ fontWeight: 600, color: "#0369a1", marginBottom: 8 }}>
          About BDD Lab
        </div>
        <div style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.6 }}>
          BDD Lab provides a simplified workflow for developing analysis specifications using
          Behavior-Driven Development (BDD) principles. Upload XML specs defining stories with
          acceptance criteria and parameter measurement formulas. The compiler extracts all
          parameters, constraints, and definitions into a <strong>Data Dictionary</strong> that
          can be tested against real callers and calls before publishing to production Playbooks.
        </div>
      </div>
    </div>
  );
}
