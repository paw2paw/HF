"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

type ContentSource = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  trustLevel: string;
  publisherOrg: string | null;
  accreditingBody: string | null;
  qualificationRef: string | null;
  validFrom: string | null;
  validUntil: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { assertions: number };
};

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory Standard", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)", level: 5 },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited Material", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)", level: 4 },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published Reference", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)", level: 3 },
  { value: "EXPERT_CURATED", label: "L2 Expert Curated", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)", level: 2 },
  { value: "AI_ASSISTED", label: "L1 AI Assisted", color: "var(--trust-l1-text)", bg: "var(--trust-l1-bg)", level: 1 },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "var(--trust-l0-text)", bg: "var(--trust-l0-bg)", level: 0 },
];

function TrustBadge({ level }: { level: string }) {
  const config = TRUST_LEVELS.find((t) => t.value === level) || TRUST_LEVELS[5];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}

function FreshnessBadge({ validUntil }: { validUntil: string | null }) {
  if (!validUntil) return <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>No expiry</span>;
  const days = Math.floor((new Date(validUntil).getTime() - Date.now()) / 86400000);
  if (days < 0) {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, color: "#991b1b", background: "#fef2f2", padding: "2px 6px", borderRadius: 4 }}>
        Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days <= 60) {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, color: "#92400e", background: "#fffbeb", padding: "2px 6px", borderRadius: 4 }}>
        Expires in {days}d
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
      Valid until {new Date(validUntil).toLocaleDateString()}
    </span>
  );
}

type ReviewTab = "needs-review" | "expired" | "all";

export default function ContentReviewPage() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReviewTab>("needs-review");

  // Promotion modal
  const [promotingSource, setPromotingSource] = useState<ContentSource | null>(null);
  const [newTrustLevel, setNewTrustLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);


  const fetchSources = useCallback(() => {
    setLoading(true);
    fetch("/api/content-sources?activeOnly=false")
      .then((r) => r.json())
      .then((data) => {
        if (data.sources) setSources(data.sources);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Filter sources by tab
  const now = Date.now();
  const needsReview = sources.filter((s) => {
    const level = TRUST_LEVELS.find((t) => t.value === s.trustLevel);
    return level && level.level <= 1; // L0, L1
  });

  const expired = sources.filter((s) => {
    if (!s.validUntil) return false;
    const days = Math.floor((new Date(s.validUntil).getTime() - now) / 86400000);
    return days < 0 || days <= 60;
  });

  const displayed = activeTab === "needs-review" ? needsReview : activeTab === "expired" ? expired : sources;

  const handlePromote = async () => {
    if (!promotingSource || !newTrustLevel || !notes.trim()) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/content-sources/${promotingSource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustLevel: newTrustLevel, verificationNotes: notes }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveMessage({ type: "success", text: `Trust level updated to ${newTrustLevel}` });
        setPromotingSource(null);
        setNewTrustLevel("");
        setNotes("");
        fetchSources();
      } else {
        setSaveMessage({ type: "error", text: data.error || "Failed to update" });
      }
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdvancedBanner />
      {/* Header */}
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Content Review Queue
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
              Review and verify content sources. Promote trust levels with audit trail.
            </p>
          </div>
          <Link
            href="/x/content-sources"
            style={{
              padding: "6px 12px",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--input-border)",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            Source Registry
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            flex: 1,
            padding: "12px 16px",
            background: needsReview.length > 0 ? "#fef2f2" : "var(--surface-primary)",
            border: `1px solid ${needsReview.length > 0 ? "#fca5a5" : "var(--border-default)"}`,
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: needsReview.length > 0 ? "#991b1b" : "var(--text-primary)" }}>
            {needsReview.length}
          </div>
          <div style={{ fontSize: 11, color: needsReview.length > 0 ? "#991b1b" : "var(--text-muted)", fontWeight: 500 }}>
            Needs Review (L0/L1)
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "12px 16px",
            background: expired.length > 0 ? "#fffbeb" : "var(--surface-primary)",
            border: `1px solid ${expired.length > 0 ? "#fcd34d" : "var(--border-default)"}`,
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: expired.length > 0 ? "#92400e" : "var(--text-primary)" }}>
            {expired.length}
          </div>
          <div style={{ fontSize: 11, color: expired.length > 0 ? "#92400e" : "var(--text-muted)", fontWeight: 500 }}>
            Expired / Expiring
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
            {sources.length}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            Total Sources
          </div>
        </div>
      </div>

      {/* Success/Error banner */}
      {saveMessage && (
        <div
          style={{
            padding: "8px 14px",
            marginBottom: 12,
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            background: saveMessage.type === "success" ? "#f0fdf4" : "#fef2f2",
            color: saveMessage.type === "success" ? "#166534" : "#991b1b",
            border: `1px solid ${saveMessage.type === "success" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {([
          { key: "needs-review", label: "Needs Review", count: needsReview.length },
          { key: "expired", label: "Expired/Expiring", count: expired.length },
          { key: "all", label: "All Sources", count: sources.length },
        ] as { key: ReviewTab; label: string; count: number }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              border: activeTab === tab.key ? "1px solid var(--accent-primary)" : "1px solid var(--input-border)",
              borderRadius: 6,
              cursor: "pointer",
              background: activeTab === tab.key ? "var(--surface-selected)" : "var(--surface-primary)",
              color: activeTab === tab.key ? "var(--accent-primary)" : "var(--text-muted)",
            }}
          >
            {tab.label}{tab.count >= 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* Source list */}
      {(
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {activeTab === "needs-review" ? "\u2705" : activeTab === "expired" ? "\u2705" : "\u2728"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {activeTab === "needs-review"
                ? "No sources need review"
                : activeTab === "expired"
                ? "No expired sources"
                : "No content sources yet"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {activeTab === "all" && (
                <Link href="/x/content-sources" style={{ color: "var(--accent-primary)" }}>
                  Add sources in the registry
                </Link>
              )}
            </div>
          </div>
        ) : (
          displayed.map((source, i) => (
            <div
              key={source.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: i < displayed.length - 1 ? "1px solid var(--border-default)" : "none",
              }}
            >
              {/* Source info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {source.name}
                  </span>
                  <TrustBadge level={source.trustLevel} />
                  <FreshnessBadge validUntil={source.validUntil} />
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{source.slug}</span>
                  {source.publisherOrg && <span>{source.publisherOrg}</span>}
                  {source.qualificationRef && <span>{source.qualificationRef}</span>}
                  {source._count.assertions > 0 && (
                    <span>{source._count.assertions} assertions</span>
                  )}
                </div>
                {source.verifiedAt && (
                  <div style={{ fontSize: 10, color: "var(--text-placeholder)", marginTop: 2 }}>
                    Verified {new Date(source.verifiedAt).toLocaleDateString()}
                    {source.verificationNotes && ` — ${source.verificationNotes.substring(0, 80)}${source.verificationNotes.length > 80 ? "..." : ""}`}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => {
                    setPromotingSource(source);
                    // Default to next level up
                    const currentLevel = TRUST_LEVELS.find((t) => t.value === source.trustLevel);
                    const nextUp = TRUST_LEVELS.find((t) => t.level === (currentLevel?.level || 0) + 1);
                    setNewTrustLevel(nextUp?.value || "");
                    setNotes("");
                    setSaveMessage(null);
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#f0fdf4",
                    color: "#166534",
                    border: "1px solid #86efac",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Review
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Promotion Modal */}
      {promotingSource && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPromotingSource(null);
          }}
        >
          <div
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 24,
              width: 480,
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
              Review Source
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
              Verify and update trust level for this content source.
            </p>

            {/* Source details */}
            <div
              style={{
                background: "var(--surface-secondary)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {promotingSource.name}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>{promotingSource.slug}</span>
                <TrustBadge level={promotingSource.trustLevel} />
              </div>
              {promotingSource.publisherOrg && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Publisher: {promotingSource.publisherOrg}</div>
              )}
              {promotingSource.qualificationRef && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Qualification: {promotingSource.qualificationRef}</div>
              )}
              <FreshnessBadge validUntil={promotingSource.validUntil} />
            </div>

            {/* Trust level selector */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                New Trust Level
              </label>
              <select
                value={newTrustLevel}
                onChange={(e) => setNewTrustLevel(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 12,
                  border: "1px solid var(--input-border)",
                  borderRadius: 6,
                  background: "var(--surface-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">Select trust level...</option>
                {TRUST_LEVELS.map((tl) => (
                  <option
                    key={tl.value}
                    value={tl.value}
                    disabled={tl.value === promotingSource.trustLevel}
                  >
                    {tl.label} {tl.value === promotingSource.trustLevel ? "(current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Verification notes */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 4 }}>
                Verification Notes *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe why this trust level is appropriate. E.g., 'Verified against CII accreditation register - qualification R04 confirmed active for 2025/26 academic year.'"
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 12,
                  border: "1px solid var(--input-border)",
                  borderRadius: 6,
                  minHeight: 80,
                  resize: "vertical",
                  background: "var(--surface-primary)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ fontSize: 10, color: "var(--text-placeholder)", marginTop: 2 }}>
                Required. Explain how you verified this source against the original material.
              </div>
            </div>

            {/* Error from save */}
            {saveMessage?.type === "error" && (
              <div style={{ padding: "6px 10px", background: "#fef2f2", color: "#991b1b", borderRadius: 6, fontSize: 11, marginBottom: 12 }}>
                {saveMessage.text}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPromotingSource(null)}
                style={{
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 500,
                  background: "var(--surface-secondary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--input-border)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={!newTrustLevel || !notes.trim() || saving}
                style={{
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: !newTrustLevel || !notes.trim() || saving ? "var(--surface-secondary)" : "#166534",
                  color: !newTrustLevel || !notes.trim() || saving ? "var(--text-muted)" : "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: !newTrustLevel || !notes.trim() || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Update Trust Level"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
