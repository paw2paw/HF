"use client";

import { useState, useEffect, useCallback } from "react";
import type { StepFormProps } from "@/lib/workflow/types";

// ============================================================================
// Types
// ============================================================================

interface IdentitySpec {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface ContentSpec {
  id: string;
  slug: string;
  name: string;
}

interface OnboardingData {
  domain: {
    id: string;
    slug: string;
    name: string;
    onboardingWelcome: string | null;
    onboardingIdentitySpecId: string | null;
    onboardingFlowPhases: any;
    onboardingDefaultTargets: any;
    onboardingIdentitySpec: IdentitySpec | null;
  };
  identitySpecs: IdentitySpec[];
}

// ============================================================================
// OnboardingStepForm
// ============================================================================

export function OnboardingStepForm({
  step,
  prefilled,
  collectedData,
  onComplete,
  onSkip,
  onError,
}: StepFormProps) {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [contentSpecs, setContentSpecs] = useState<ContentSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [identitySpecId, setIdentitySpecId] = useState<string>("");
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [examEnabled, setExamEnabled] = useState(false);
  const [examCurriculumSlug, setExamCurriculumSlug] = useState<string>("");

  // Resolve domainId from prefilled or collected data
  const domainId =
    prefilled?.domainId ||
    Object.values(collectedData).find((d) => d.id && d.slug)?.id ||
    null;

  const loadData = useCallback(async () => {
    if (!domainId) return;
    setLoading(true);

    try {
      const [onboardingRes, specsRes] = await Promise.all([
        fetch(`/api/domains/${domainId}/onboarding`),
        fetch("/api/analysis-specs?active=true"),
      ]);

      const onboardingData = await onboardingRes.json();
      if (onboardingData.ok) {
        setData(onboardingData);
        setIdentitySpecId(onboardingData.domain.onboardingIdentitySpecId || "");
        setWelcomeMessage(onboardingData.domain.onboardingWelcome || "");

        // Load exam config from onboardingDefaultTargets
        const targets = onboardingData.domain.onboardingDefaultTargets || {};
        if (targets.examConfig) {
          setExamEnabled(targets.examConfig.enabled || false);
          setExamCurriculumSlug(targets.examConfig.curriculumSpecSlug || "");
        }
      }

      const specsData = await specsRes.json();
      if (specsData.ok !== false && Array.isArray(specsData.specs)) {
        setContentSpecs(
          specsData.specs
            .filter((s: any) => s.specRole === "CONTENT")
            .map((s: any) => ({
              id: s.id,
              slug: s.slug,
              name: s.name,
            })),
        );
      }
    } catch {
      // Load failed — show error state
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!domainId) return;
    setSaving(true);

    try {
      // Build updated targets with exam config
      const currentTargets = data?.domain.onboardingDefaultTargets || {};
      const updatedTargets = {
        ...currentTargets,
        examConfig: examEnabled
          ? { enabled: true, curriculumSpecSlug: examCurriculumSlug }
          : { enabled: false },
      };

      const res = await fetch(`/api/domains/${domainId}/onboarding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingWelcome: welcomeMessage || null,
          onboardingIdentitySpecId: identitySpecId || null,
          onboardingDefaultTargets: updatedTargets,
        }),
      });

      const result = await res.json();
      if (!result.ok) {
        onError([result.error || "Failed to save onboarding config"]);
        setSaving(false);
        return;
      }

      onComplete({
        domainId,
        onboardingConfigured: true,
        identitySpecId: identitySpecId || null,
        examEnabled,
        examCurriculumSlug: examEnabled ? examCurriculumSlug : null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      onError([msg]);
    } finally {
      setSaving(false);
    }
  };

  // No domain found
  if (!domainId) {
    return (
      <div style={cardStyle}>
        <h3 style={titleStyle}>{step.title}</h3>
        <p style={mutedStyle}>
          No domain found in previous steps. Create a domain first.
        </p>
        {!step.required && (
          <button onClick={onSkip} style={secondaryButtonStyle}>
            Skip
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>{step.title}</h3>
      <p style={mutedStyle}>
        {step.description || "Configure onboarding and exam readiness for this domain."}
      </p>

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          Loading onboarding config...
        </div>
      )}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Identity Spec */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Identity Spec</legend>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
              Which persona greets new callers in this domain?
            </p>
            <select
              value={identitySpecId}
              onChange={(e) => setIdentitySpecId(e.target.value)}
              style={selectStyle}
            >
              <option value="">None selected</option>
              {data.identitySpecs.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name} ({spec.slug})
                </option>
              ))}
            </select>
          </fieldset>

          {/* Welcome Message */}
          <fieldset style={fieldsetStyle}>
            <legend style={legendStyle}>Welcome Message</legend>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Optional custom welcome for first call..."
              rows={3}
              style={textareaStyle}
            />
          </fieldset>

          {/* Exam Readiness */}
          <fieldset style={{
            ...fieldsetStyle,
            border: examEnabled ? "2px solid var(--accent-primary)" : fieldsetStyle.border,
            background: examEnabled ? "var(--accent-bg, #f5f3ff)" : fieldsetStyle.background,
          }}>
            <legend style={legendStyle}>Exam Readiness</legend>

            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              marginBottom: examEnabled ? 16 : 0,
            }}>
              <input
                type="checkbox"
                checked={examEnabled}
                onChange={(e) => setExamEnabled(e.target.checked)}
                style={{ width: 18, height: 18, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  This domain has a formal exam or assessment
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Enables readiness tracking, formative assessments, and exam gating
                </div>
              </div>
            </label>

            {examEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Curriculum (CONTENT spec)</label>
                  <select
                    value={examCurriculumSlug}
                    onChange={(e) => setExamCurriculumSlug(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select curriculum...</option>
                    {contentSpecs.map((spec) => (
                      <option key={spec.id} value={spec.slug}>
                        {spec.name} ({spec.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--accent-bg, #ede9fe)",
                  border: "1px solid var(--accent-primary)",
                  fontSize: 12,
                  color: "var(--accent-primary)",
                  lineHeight: 1.5,
                }}>
                  All thresholds and weights are loaded from the EXAM_READINESS_V1 contract at runtime.
                  Readiness is computed from module mastery + formative assessment scores.
                </div>
              </div>
            )}
          </fieldset>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
            {!step.required && (
              <button onClick={onSkip} style={secondaryButtonStyle}>
                Skip
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                background: saving
                  ? "var(--surface-tertiary)"
                  : "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, #8b5cf6) 100%)",
                color: saving ? "var(--text-muted)" : "var(--surface-primary)",
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 4px 12px rgba(99, 102, 241, 0.3)",
              }}
            >
              {saving ? "Saving..." : "Save Onboarding Config"}
            </button>
          </div>
        </div>
      )}

      {!loading && !data && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Could not load onboarding config.
          <div style={{ marginTop: 12 }}>
            <button onClick={loadData} style={secondaryButtonStyle}>Retry</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Styles (matching ActivateStepForm patterns)
// ============================================================================

const cardStyle: React.CSSProperties = {
  background: "var(--surface-primary)",
  border: "1px solid var(--border-default)",
  borderRadius: 16,
  padding: 24,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text-primary)",
  margin: "0 0 4px",
};

const mutedStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  margin: "0 0 24px",
};

const fieldsetStyle: React.CSSProperties = {
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  padding: 16,
  margin: 0,
  background: "var(--surface-secondary)",
};

const legendStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  padding: "0 6px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 14,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--surface-primary)",
  color: "var(--text-primary)",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 14,
  borderRadius: 8,
  border: "1px solid var(--border-default)",
  background: "var(--surface-primary)",
  color: "var(--text-primary)",
  resize: "vertical",
  fontFamily: "inherit",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 10,
  border: "1px solid var(--border-default)",
  background: "var(--surface-secondary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
