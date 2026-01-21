"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AnalysisProfile = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    parameters: number;
    runs: number;
  };
};

export default function AnalysisProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<AnalysisProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchProfiles = useCallback(() => {
    fetch("/api/analysis-profiles")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setProfiles(data.profiles || []);
        } else {
          setError(data.error || "Failed to load analysis profiles");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreateNew = useCallback(async () => {
    const name = prompt("Enter a name for the new profile:", `Analysis Profile ${new Date().toLocaleDateString()}`);
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch("/api/analysis-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/analysis-profiles/${data.profile.id}/configure`);
      } else {
        setError(data.error || "Failed to create");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }, [router]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/analysis-profiles/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
      } else {
        setError(data.error || "Failed to delete");
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Analysis Profiles</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Configure which traits to analyze and how to weight them
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link
            href="/analyzer-config"
            style={{
              padding: "10px 20px",
              background: "#fff",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              color: "#374151",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Equalizer View
          </Link>
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
            {creating ? "Creating..." : "+ New Profile"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 16 }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 12, background: "none", border: "none", color: "#dc2626", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      ) : profiles.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎚️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No analysis profiles yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 16 }}>
            Create a profile to configure which personality traits to analyze
          </div>
          <button
            onClick={handleCreateNew}
            style={{
              padding: "10px 20px",
              background: "#3b82f6",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create First Profile
          </button>
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
                  Runs
                </th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Last Updated
                </th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{profile.name}</div>
                    {profile.description && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{profile.description}</div>
                    )}
                    <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>
                      {profile.id.slice(0, 8)}...
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14 }}>
                    {profile._count?.parameters || 0}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", fontSize: 14 }}>
                    {profile._count?.runs || 0}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(profile.updatedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Link
                        href={`/analysis-profiles/${profile.id}/configure`}
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
                      {(profile._count?.runs || 0) === 0 && (
                        <button
                          onClick={() => handleDelete(profile.id, profile.name)}
                          style={{
                            padding: "6px 12px",
                            background: "#fff",
                            color: "#dc2626",
                            border: "1px solid #fecaca",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "#f0fdf4",
          borderRadius: 8,
          border: "1px solid #bbf7d0",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#166534", marginBottom: 4 }}>
          What are Analysis Profiles?
        </div>
        <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
          Analysis Profiles define which personality and behavioral parameters to look for when analyzing
          conversations. Each profile can weight parameters differently - for example, an "Empathy Focus"
          profile might weight emotional intelligence parameters higher than cognitive ones.
        </div>
      </div>
    </div>
  );
}
