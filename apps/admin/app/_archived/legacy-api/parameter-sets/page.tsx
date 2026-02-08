"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ParameterSet = {
  id: string;
  name: string;
  createdAt: string;
  _count?: {
    parameters: number;
    runs: number;
  };
};

export default function ParameterSetsPage() {
  const router = useRouter();
  const [parameterSets, setParameterSets] = useState<ParameterSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchSets = useCallback(() => {
    fetch("/api/parameter-sets")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setParameterSets(data.parameterSets || []);
        } else {
          setError(data.error || "Failed to load parameter sets");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const handleCreateNew = useCallback(async () => {
    const name = prompt("Enter a name for the new configuration:", `Analysis Config ${new Date().toLocaleDateString()}`);
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/parameter-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/parameter-sets/${data.parameterSet.id}/configure`);
      } else {
        setError(data.error || "Failed to create");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }, [router]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Parameter Sets</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Configure and manage analyzer presets
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          disabled={creating}
          style={{
            padding: "10px 20px",
            background: "#3b82f6",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.7 : 1,
          }}
        >
          {creating ? "Creating..." : "+ New Configuration"}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
        </div>
      ) : parameterSets.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No parameter sets yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Create a parameter set snapshot for analysis
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Name
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Parameters
                </th>
                <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Analysis Runs
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Created
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {parameterSets.map((ps) => (
                <tr key={ps.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{ps.name}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>
                      {ps.id.slice(0, 8)}...
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14 }}>
                    {ps._count?.parameters || 0}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14 }}>
                    {ps._count?.runs || 0}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(ps.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <Link
                      href={`/parameter-sets/${ps.id}/configure`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: "#eff6ff",
                        color: "#1e40af",
                        border: "1px solid #bfdbfe",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                      </svg>
                      Configure
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
