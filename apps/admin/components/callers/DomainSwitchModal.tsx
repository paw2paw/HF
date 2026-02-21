/**
 * Domain Switch Modal
 * Allows switching a caller from one domain to another with preview and re-onboarding options
 */

"use client";

import React, { useEffect, useState } from "react";

export interface DomainSwitchModalProps {
  /** Caller ID */
  callerId: string;
  /** Current domain info */
  currentDomain: {
    id: string;
    slug: string;
    name: string;
  };
  /** Available domains to switch to */
  availableDomains: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isDefault: boolean;
  }>;
  /** Close handler */
  onClose: () => void;
  /** Success handler - called after successful domain switch */
  onSuccess: (result: any) => void;
}

interface DomainPreview {
  ok: boolean;
  domain: {
    id: string;
    slug: string;
    name: string;
    onboardingWelcome: string | null;
    onboardingIdentitySpec: {
      name: string;
      slug: string;
    } | null;
  };
  impactPreview: {
    activeGoalsCount: number;
    newGoalsCount: number;
    newGoalsPreview: string[];
  };
}

export function DomainSwitchModal({
  callerId,
  currentDomain,
  availableDomains,
  onClose,
  onSuccess,
}: DomainSwitchModalProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  const [preview, setPreview] = useState<DomainPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out current domain from available options
  const switchableDomains = availableDomains.filter((d) => d.id !== currentDomain.id);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !switching) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, switching]);

  // Load preview when domain selected
  useEffect(() => {
    if (!selectedDomainId) {
      setPreview(null);
      return;
    }

    const loadPreview = async () => {
      setLoadingPreview(true);
      setError(null);
      try {
        // Fetch domain onboarding config
        const res = await fetch(`/api/domains/${selectedDomainId}/onboarding`);
        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "Failed to load domain preview");
        }

        // Fetch current caller's active goals count
        const callerRes = await fetch(`/api/callers/${callerId}`);
        const callerData = await callerRes.json();
        const activeGoals = callerData.caller?.goals?.filter((g: any) =>
          g.status === "ACTIVE" || g.status === "PAUSED"
        ) || [];

        // Fetch target domain's published playbook for goal preview
        const playbooksRes = await fetch(`/api/playbooks?domainId=${selectedDomainId}`);
        const playbooksData = await playbooksRes.json();
        const publishedPlaybook = playbooksData.playbooks?.find((pb: any) => pb.status === "PUBLISHED");
        const newGoalsPreview = publishedPlaybook?.config?.goals?.map((g: any) => g.name) || [];

        setPreview({
          ok: true,
          domain: data.domain,
          impactPreview: {
            activeGoalsCount: activeGoals.length,
            newGoalsCount: newGoalsPreview.length,
            newGoalsPreview: newGoalsPreview.slice(0, 5), // Show first 5
          },
        });
      } catch (e: any) {
        setError(e.message || "Failed to load preview");
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();
  }, [selectedDomainId, callerId]);

  const handleSwitch = async () => {
    if (!selectedDomainId) return;

    setSwitching(true);
    setError(null);

    try {
      const res = await fetch(`/api/callers/${callerId}/switch-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId: selectedDomainId,
          skipOnboarding,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to switch domain");
      }

      // Success!
      onSuccess(data);
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to switch domain");
    } finally {
      setSwitching(false);
    }
  };

  const selectedDomain = switchableDomains.find((d) => d.id === selectedDomainId);

  return (
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
        if (e.target === e.currentTarget && !switching) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface-primary)",
          borderRadius: 16,
          padding: 28,
          width: 600,
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
            Switch Domain
          </h2>
          <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "var(--text-muted)" }}>
            Move this caller to a different domain with optional re-onboarding
          </p>
        </div>

        {/* Current Domain */}
        <div
          style={{
            padding: 16,
            background: "var(--surface-secondary)",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
            Current Domain
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            {currentDomain.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {currentDomain.slug}
          </div>
        </div>

        {/* Domain Selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
            Switch to
          </label>
          <select
            value={selectedDomainId}
            onChange={(e) => setSelectedDomainId(e.target.value)}
            disabled={switching}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 15,
              border: "2px solid var(--border-default)",
              borderRadius: 8,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">Select a domain...</option>
            {switchableDomains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {domain.name} {domain.isDefault ? "(Default)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Preview Panel */}
        {loadingPreview && (
          <div
            style={{
              padding: 20,
              background: "var(--surface-tertiary)",
              borderRadius: 8,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading preview...</p>
          </div>
        )}

        {preview && !loadingPreview && (
          <div
            style={{
              padding: 16,
              background: "var(--badge-blue-bg)",
              border: "1px solid var(--status-info-border)",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, color: "var(--status-info-text)" }}>
              What will happen:
            </h4>

            {/* Goals Impact */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--status-info-text)", marginBottom: 4 }}>
                <strong>Goals:</strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--status-info-text)" }}>
                <li>
                  Archive {preview.impactPreview.activeGoalsCount} active goal(s) from {currentDomain.name}
                </li>
                <li>
                  Create {preview.impactPreview.newGoalsCount} new goal(s) from {selectedDomain?.name}
                  {preview.impactPreview.newGoalsPreview.length > 0 && (
                    <ul style={{ marginTop: 4 }}>
                      {preview.impactPreview.newGoalsPreview.map((goal, i) => (
                        <li key={i} style={{ fontSize: 12 }}>
                          {goal}
                        </li>
                      ))}
                      {preview.impactPreview.newGoalsCount > preview.impactPreview.newGoalsPreview.length && (
                        <li style={{ fontSize: 12, fontStyle: "italic" }}>
                          ... and {preview.impactPreview.newGoalsCount - preview.impactPreview.newGoalsPreview.length} more
                        </li>
                      )}
                    </ul>
                  )}
                </li>
              </ul>
            </div>

            {/* Onboarding */}
            <div>
              <div style={{ fontSize: 13, color: "var(--status-info-text)", marginBottom: 4 }}>
                <strong>First Call Experience:</strong>
              </div>
              <div style={{ fontSize: 13, color: "var(--status-info-text)", paddingLeft: 20 }}>
                {preview.domain.onboardingIdentitySpec ? (
                  <div>Uses {preview.domain.onboardingIdentitySpec.name}</div>
                ) : (
                  <div style={{ fontStyle: "italic" }}>Uses default onboarding flow</div>
                )}
                {preview.domain.onboardingWelcome && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: "white",
                      borderRadius: 6,
                      fontSize: 12,
                      fontStyle: "italic",
                      border: "1px solid var(--badge-blue-bg)",
                    }}
                  >
                    "{preview.domain.onboardingWelcome.substring(0, 150)}
                    {preview.domain.onboardingWelcome.length > 150 && "..."}"
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Re-onboarding Option */}
        {selectedDomainId && (
          <div
            style={{
              padding: 16,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
              Re-onboarding
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={skipOnboarding}
                onChange={(e) => setSkipOnboarding(e.target.checked)}
                disabled={switching}
                style={{ width: 16, height: 16 }}
              />
              <span>
                Skip re-onboarding (caller is already familiar with {selectedDomain?.name})
              </span>
            </label>
            {!skipOnboarding && (
              <p style={{ margin: "8px 0 0 24px", fontSize: 12, color: "var(--text-muted)" }}>
                Caller will experience a brief re-introduction on their next call
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 12,
              background: "var(--status-error-bg)",
              color: "var(--status-error-text)",
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={switching}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              cursor: switching ? "not-allowed" : "pointer",
              opacity: switching ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSwitch}
            disabled={!selectedDomainId || switching || loadingPreview}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              background:
                selectedDomainId && !switching && !loadingPreview
                  ? "var(--accent-primary)"
                  : "var(--border-default)",
              color: "var(--text-on-dark)",
              border: "none",
              borderRadius: 8,
              cursor:
                selectedDomainId && !switching && !loadingPreview
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            {switching ? "Switching..." : "Switch Domain"}
          </button>
        </div>
      </div>
    </div>
  );
}
