/**
 * Caller Domain Section
 * Shows current domain, onboarding status, and allows domain switching
 */

"use client";

import React, { useState } from "react";
import { DomainSwitchModal } from "./DomainSwitchModal";
import { Badge } from "@/src/components/shared/Badges";

interface CallerDomainSectionProps {
  caller: {
    id: string;
    domainId: string | null;
    domain: {
      id: string;
      slug: string;
      name: string;
    } | null;
    domainSwitchCount: number;
    previousDomainId: string | null;
  };
  onboardingSession: {
    id: string;
    isComplete: boolean;
    wasSkipped: boolean;
    currentPhase: string | null;
    discoveredGoals: number;
    createdAt: string;
    completedAt: string | null;
  } | null;
  availableDomains: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isDefault: boolean;
  }>;
  onDomainSwitched: () => void;
}

export function CallerDomainSection({
  caller,
  onboardingSession,
  availableDomains,
  onDomainSwitched,
}: CallerDomainSectionProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSuccess = (result: any) => {
    setSuccessMessage(
      `Switched to ${result.newDomain.name}. Archived ${result.archivedGoalsCount} goals, created ${result.newGoals.length} new goals.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
    onDomainSwitched();
  };

  // Auto-hide success message
  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (!caller.domain) {
    return (
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
          Domain & Onboarding
        </h3>
        <div
          style={{
            padding: 16,
            background: "var(--status-warning-bg)",
            color: "var(--status-warning-text)",
            borderRadius: 8,
          }}
        >
          ⚠️ No domain assigned
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Domain & Onboarding
          </h3>
          <button
            onClick={() => setShowSwitchModal(true)}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              background: "var(--accent-primary)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Switch Domain
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div
            style={{
              padding: 12,
              background: "#dcfce7",
              color: "#166534",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            ✅ {successMessage}
          </div>
        )}

        {/* Domain Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
              Current Domain
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {caller.domain.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {caller.domain.slug}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
              Domain Switches
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {caller.domainSwitchCount}
            </div>
            {caller.domainSwitchCount > 0 && caller.previousDomainId && (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Previously: {caller.previousDomainId}
              </div>
            )}
          </div>
        </div>

        {/* Onboarding Status */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
            Onboarding Status in {caller.domain.name}
          </div>
          {onboardingSession ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {onboardingSession.isComplete ? (
                <>
                  <Badge text="Completed" tone="success" variant="solid" />
                  {onboardingSession.wasSkipped && (
                    <Badge text="Skipped" tone="neutral" variant="soft" />
                  )}
                </>
              ) : (
                <>
                  <Badge text="In Progress" tone="warning" variant="solid" />
                  {onboardingSession.currentPhase && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Current phase: {onboardingSession.currentPhase}
                    </span>
                  )}
                </>
              )}
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {onboardingSession.discoveredGoals} goal(s) discovered
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Badge text="Not Started" tone="neutral" variant="soft" />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Will begin on first call
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Domain Switch Modal */}
      {showSwitchModal && (
        <DomainSwitchModal
          callerId={caller.id}
          currentDomain={caller.domain}
          availableDomains={availableDomains}
          onClose={() => setShowSwitchModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
