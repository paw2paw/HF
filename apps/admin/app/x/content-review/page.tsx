"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import "./content-review.css";

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
      className="cr-trust-badge"
      style={{
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
  if (!validUntil) return <span className="cr-freshness-none">No expiry</span>;
  const days = Math.floor((new Date(validUntil).getTime() - Date.now()) / 86400000);
  if (days < 0) {
    return (
      <span className="cr-freshness-expired">
        Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days <= 60) {
    return (
      <span className="cr-freshness-expiring">
        Expires in {days}d
      </span>
    );
  }
  return (
    <span className="cr-freshness-valid">
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

  const isDisabled = !newTrustLevel || !notes.trim() || saving;

  return (
    <div>
      <AdvancedBanner />
      {/* Header */}
      <div className="cr-header">
        <div className="hf-flex hf-items-center hf-flex-between">
          <div>
            <h1 className="cr-header-title">
              Content Review Queue
            </h1>
            <p className="cr-header-desc">
              Review and verify content sources. Promote trust levels with audit trail.
            </p>
          </div>
          <Link href="/x/content-sources" className="cr-header-link">
            Source Registry
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="cr-summary-row">
        <div className={`cr-stat-card ${needsReview.length > 0 ? "cr-stat-card-error" : "cr-stat-card-default"}`}>
          <div className={`cr-stat-value ${needsReview.length > 0 ? "cr-stat-value-error" : ""}`}>
            {needsReview.length}
          </div>
          <div className={`cr-stat-label ${needsReview.length > 0 ? "cr-stat-label-error" : ""}`}>
            Needs Review (L0/L1)
          </div>
        </div>
        <div className={`cr-stat-card ${expired.length > 0 ? "cr-stat-card-warning" : "cr-stat-card-default"}`}>
          <div className={`cr-stat-value ${expired.length > 0 ? "cr-stat-value-warning" : ""}`}>
            {expired.length}
          </div>
          <div className={`cr-stat-label ${expired.length > 0 ? "cr-stat-label-warning" : ""}`}>
            Expired / Expiring
          </div>
        </div>
        <div className="cr-stat-card cr-stat-card-default">
          <div className="cr-stat-value">
            {sources.length}
          </div>
          <div className="cr-stat-label">
            Total Sources
          </div>
        </div>
      </div>

      {/* Success/Error banner */}
      {saveMessage && (
        <div className={`cr-save-banner ${saveMessage.type === "success" ? "cr-save-banner-success" : "cr-save-banner-error"}`}>
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="cr-tabs">
        {([
          { key: "needs-review", label: "Needs Review", count: needsReview.length },
          { key: "expired", label: "Expired/Expiring", count: expired.length },
          { key: "all", label: "All Sources", count: sources.length },
        ] as { key: ReviewTab; label: string; count: number }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`cr-tab ${activeTab === tab.key ? "cr-tab-active" : "cr-tab-inactive"}`}
          >
            {tab.label}{tab.count >= 0 ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {/* Source list */}
      {(
      <div className="cr-list">
        {loading ? (
          <div className="cr-loading">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="cr-empty">
            <div className="cr-empty-icon">
              {activeTab === "needs-review" ? "\u2705" : activeTab === "expired" ? "\u2705" : "\u2728"}
            </div>
            <div className="cr-empty-title">
              {activeTab === "needs-review"
                ? "No sources need review"
                : activeTab === "expired"
                ? "No expired sources"
                : "No content sources yet"}
            </div>
            <div className="cr-empty-hint">
              {activeTab === "all" && (
                <Link href="/x/content-sources" className="cr-link-accent">
                  Add sources in the registry
                </Link>
              )}
            </div>
          </div>
        ) : (
          displayed.map((source) => (
            <div key={source.id} className="cr-source-row">
              {/* Source info */}
              <div className="cr-source-info">
                <div className="cr-source-name-row">
                  <span className="cr-source-name">
                    {source.name}
                  </span>
                  <TrustBadge level={source.trustLevel} />
                  <FreshnessBadge validUntil={source.validUntil} />
                </div>
                <div className="cr-source-meta">
                  <span className="cr-source-slug">{source.slug}</span>
                  {source.publisherOrg && <span>{source.publisherOrg}</span>}
                  {source.qualificationRef && <span>{source.qualificationRef}</span>}
                  {source._count.assertions > 0 && (
                    <span>{source._count.assertions} assertions</span>
                  )}
                </div>
                {source.verifiedAt && (
                  <div className="cr-source-verified">
                    Verified {new Date(source.verifiedAt).toLocaleDateString()}
                    {source.verificationNotes && ` — ${source.verificationNotes.substring(0, 80)}${source.verificationNotes.length > 80 ? "..." : ""}`}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="cr-actions">
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
                  className="cr-btn-review"
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
          className="hf-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPromotingSource(null);
          }}
        >
          <div className="cr-modal-content">
            <h2 className="cr-modal-title">
              Review Source
            </h2>
            <p className="cr-modal-desc">
              Verify and update trust level for this content source.
            </p>

            {/* Source details */}
            <div className="cr-detail-card">
              <div className="cr-detail-name">
                {promotingSource.name}
              </div>
              <div className="cr-detail-meta-row">
                <span className="cr-detail-slug">{promotingSource.slug}</span>
                <TrustBadge level={promotingSource.trustLevel} />
              </div>
              {promotingSource.publisherOrg && (
                <div className="cr-detail-field">Publisher: {promotingSource.publisherOrg}</div>
              )}
              {promotingSource.qualificationRef && (
                <div className="cr-detail-field">Qualification: {promotingSource.qualificationRef}</div>
              )}
              <FreshnessBadge validUntil={promotingSource.validUntil} />
            </div>

            {/* Trust level selector */}
            <div className="cr-field">
              <label className="cr-field-label">
                New Trust Level
              </label>
              <select
                value={newTrustLevel}
                onChange={(e) => setNewTrustLevel(e.target.value)}
                className="cr-select"
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
            <div className="cr-field-lg">
              <label className="cr-field-label">
                Verification Notes *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe why this trust level is appropriate. E.g., 'Verified against CII accreditation register - qualification R04 confirmed active for 2025/26 academic year.'"
                className="cr-textarea"
              />
              <div className="cr-field-hint">
                Required. Explain how you verified this source against the original material.
              </div>
            </div>

            {/* Error from save */}
            {saveMessage?.type === "error" && (
              <div className="cr-modal-error">
                {saveMessage.text}
              </div>
            )}

            {/* Actions */}
            <div className="cr-modal-actions">
              <button
                onClick={() => setPromotingSource(null)}
                className="cr-btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={isDisabled}
                className="cr-btn-save"
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
