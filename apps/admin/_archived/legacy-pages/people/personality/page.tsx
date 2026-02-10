"use client";

import { useState, useEffect } from "react";

type PersonalityProfile = {
  id: string;
  userId: string;
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  preferredTone: string | null;
  preferredLength: string | null;
  technicalLevel: string | null;
  observationsUsed: number;
  confidenceScore: number | null;
  updatedAt: string;
  user: {
    name: string | null;
    email: string | null;
    externalId: string | null;
  };
};

function TraitBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.round(value * 100) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 20, fontSize: 10, color: "#6b7280" }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
        {pct != null && (
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct > 66 ? "#10b981" : pct > 33 ? "#f59e0b" : "#ef4444",
              borderRadius: 4,
            }}
          />
        )}
      </div>
      <div style={{ width: 30, fontSize: 10, color: "#6b7280", textAlign: "right" }}>
        {pct != null ? `${pct}%` : "—"}
      </div>
    </div>
  );
}

export default function PersonalityProfilesPage() {
  const [profiles, setProfiles] = useState<PersonalityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users/personality")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setProfiles(data.profiles || []);
        } else {
          setError(data.error || "Failed to load profiles");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Personality Profiles</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Big Five personality profiles aggregated from call observations
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading...</div>
      ) : error ? (
        <div style={{ padding: 20, background: "#fef2f2", color: "#dc2626", borderRadius: 8 }}>
          {error}
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151" }}>No personality profiles yet</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Run personality analysis on calls to generate profiles
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {profiles.map((profile) => (
            <div
              key={profile.id}
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {profile.user.name || profile.user.email || profile.user.externalId || "Unknown User"}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {profile.observationsUsed} observations
                  {profile.confidenceScore != null && ` · ${Math.round(profile.confidenceScore * 100)}% confidence`}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <TraitBar label="O" value={profile.openness} />
                <TraitBar label="C" value={profile.conscientiousness} />
                <TraitBar label="E" value={profile.extraversion} />
                <TraitBar label="A" value={profile.agreeableness} />
                <TraitBar label="N" value={profile.neuroticism} />
              </div>

              {(profile.preferredTone || profile.preferredLength || profile.technicalLevel) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>Preferences</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {profile.preferredTone && (
                      <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4 }}>
                        {profile.preferredTone}
                      </span>
                    )}
                    {profile.preferredLength && (
                      <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4 }}>
                        {profile.preferredLength}
                      </span>
                    )}
                    {profile.technicalLevel && (
                      <span style={{ fontSize: 10, padding: "2px 6px", background: "#f3f4f6", borderRadius: 4 }}>
                        {profile.technicalLevel}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
