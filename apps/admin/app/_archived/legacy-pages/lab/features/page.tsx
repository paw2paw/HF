"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type BDDFeatureSet = {
  id: string;
  featureId: string;
  name: string;
  description: string | null;
  version: string;
  parameterCount: number;
  constraintCount: number;
  definitionCount: number;
  isActive: boolean;
  activatedAt: string | null;
  compiledAt: string;
  lastTestAt: string | null;
  lastTestResult: any;
  _count: { uploads: number };
};

export default function LabFeaturesPage() {
  const [features, setFeatures] = useState<BDDFeatureSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const fetchFeatures = useCallback(async () => {
    try {
      let url = "/api/lab/features";
      if (filter === "active") {
        url += "?active=true";
      } else if (filter === "inactive") {
        url += "?active=false";
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setFeatures(data.features || []);
      }
    } catch (err) {
      console.error("Failed to fetch features:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const handleActivate = async (id: string, activate: boolean) => {
    try {
      const res = await fetch(`/api/lab/features/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchFeatures();
      }
    } catch (err) {
      console.error("Failed to toggle activation:", err);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Link href="/lab" style={{ color: "#6b7280", textDecoration: "none" }}>
            ← Lab
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>📦</span>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Feature Sets</h1>
            </div>
            <p style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 0 0" }}>
              Compiled BDD specs ready for testing and publishing to Playbooks.
            </p>
          </div>

          <Link
            href="/lab/upload"
            style={{
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 500,
              background: "#4f46e5",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            + Upload Specs
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          padding: 4,
          background: "#f3f4f6",
          borderRadius: 8,
          width: "fit-content",
        }}
      >
        {(["all", "active", "inactive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              background: filter === f ? "#fff" : "transparent",
              color: filter === f ? "#111827" : "#6b7280",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              boxShadow: filter === f ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Features Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading feature sets...</div>
      ) : features.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
            No feature sets yet
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
            Upload and compile BDD specs to create feature sets.
          </div>
          <Link
            href="/lab/upload"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              background: "#4f46e5",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Upload Specs →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {features.map((feature) => (
            <div
              key={feature.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 20,
                transition: "box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <Link
                      href={`/lab/features/${feature.id}`}
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#111827",
                        textDecoration: "none",
                      }}
                    >
                      {feature.name}
                    </Link>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        background: "#f3f4f6",
                        color: "#6b7280",
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      v{feature.version}
                    </span>
                    {feature.isActive && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          background: "#dcfce7",
                          color: "#166534",
                          borderRadius: 4,
                          fontWeight: 500,
                        }}
                      >
                        Active
                      </span>
                    )}
                  </div>

                  {feature.description && (
                    <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px 0" }}>
                      {feature.description}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                    <span style={{ color: "#4f46e5" }}>
                      <strong>{feature.parameterCount}</strong> parameters
                    </span>
                    <span style={{ color: "#8b5cf6" }}>
                      <strong>{feature.constraintCount}</strong> constraints
                    </span>
                    <span style={{ color: "#10b981" }}>
                      <strong>{feature.definitionCount}</strong> definitions
                    </span>
                    <span style={{ color: "#6b7280" }}>
                      <strong>{feature._count.uploads}</strong> source files
                    </span>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af" }}>
                    Compiled: {new Date(feature.compiledAt).toLocaleString()}
                    {feature.lastTestAt && (
                      <> • Last tested: {new Date(feature.lastTestAt).toLocaleString()}</>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    href={`/lab/features/${feature.id}`}
                    style={{
                      padding: "8px 12px",
                      fontSize: 13,
                      background: "#f3f4f6",
                      color: "#374151",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/lab/features/${feature.id}/test`}
                    style={{
                      padding: "8px 12px",
                      fontSize: 13,
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    Test
                  </Link>
                  <button
                    onClick={() => handleActivate(feature.id, !feature.isActive)}
                    style={{
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      background: feature.isActive ? "#fef2f2" : "#f0fdf4",
                      color: feature.isActive ? "#dc2626" : "#166534",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    {feature.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
