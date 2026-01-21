"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";

type Caller = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  personality?: {
    openness: number | null;
    conscientiousness: number | null;
    extraversion: number | null;
    agreeableness: number | null;
    neuroticism: number | null;
    confidenceScore: number | null;
  } | null;
  _count?: {
    calls: number;
    memories: number;
    personalityObservations: number;
  };
};

export default function CallersPage() {
  const [callers, setCallers] = useState<Caller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/callers?withPersonality=true&withCounts=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setCallers(data.callers || []);
        } else {
          setError(data.error || "Failed to load callers");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const getCallerLabel = (caller: Caller) => {
    return caller.name || caller.email || caller.phone || caller.externalId || "Unknown";
  };

  const filteredCallers = callers.filter((caller) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      caller.name?.toLowerCase().includes(s) ||
      caller.email?.toLowerCase().includes(s) ||
      caller.phone?.toLowerCase().includes(s) ||
      caller.externalId?.toLowerCase().includes(s)
    );
  });

  const getPersonalityBadge = (caller: Caller) => {
    if (!caller.personality || caller.personality.confidenceScore === null) return null;
    const traits = [];
    if (caller.personality.openness !== null && caller.personality.openness > 0.6) traits.push("Open");
    if (caller.personality.extraversion !== null && caller.personality.extraversion > 0.6) traits.push("Extraverted");
    if (caller.personality.agreeableness !== null && caller.personality.agreeableness > 0.6) traits.push("Agreeable");
    if (caller.personality.conscientiousness !== null && caller.personality.conscientiousness > 0.6) traits.push("Conscientious");
    if (caller.personality.neuroticism !== null && caller.personality.neuroticism > 0.6) traits.push("Neurotic");
    return traits.length > 0 ? traits.slice(0, 2).join(", ") : "Balanced";
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Callers"
        description="All callers with their calls, memories, and personality profiles"
        dataNodeId="data:users"
        count={callers.length}
      />

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search by name, email, phone, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 14,
            width: 300,
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : filteredCallers.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>
            {search ? "No callers match your search" : "No callers yet"}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            {search ? "Try a different search term" : "Callers are created when processing transcripts"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filteredCallers.map((caller) => (
            <Link
              key={caller.id}
              href={`/callers/${caller.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  transition: "all 0.15s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#a5b4fc";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Caller Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#1f2937" }}>
                      {getCallerLabel(caller)}
                    </div>
                    {caller.email && caller.name && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{caller.email}</div>
                    )}
                  </div>
                  {getPersonalityBadge(caller) && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: "3px 8px",
                        background: "#f3e8ff",
                        color: "#7c3aed",
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      {getPersonalityBadge(caller)}
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📞</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      {caller._count?.calls || 0} calls
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>💭</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      {caller._count?.memories || 0} memories
                    </span>
                  </div>
                </div>

                {/* Personality Mini-Chart */}
                {caller.personality && caller.personality.confidenceScore !== null && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { label: "O", value: caller.personality.openness, color: "#3b82f6" },
                        { label: "C", value: caller.personality.conscientiousness, color: "#10b981" },
                        { label: "E", value: caller.personality.extraversion, color: "#f59e0b" },
                        { label: "A", value: caller.personality.agreeableness, color: "#ec4899" },
                        { label: "N", value: caller.personality.neuroticism, color: "#8b5cf6" },
                      ].map((trait) => (
                        <div key={trait.label} style={{ flex: 1 }}>
                          <div
                            style={{
                              height: 4,
                              background: "#e5e7eb",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${(trait.value || 0) * 100}%`,
                                background: trait.color,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", marginTop: 2 }}>
                            {trait.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: 12, fontSize: 11, color: "#9ca3af" }}>
                  Added {new Date(caller.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
