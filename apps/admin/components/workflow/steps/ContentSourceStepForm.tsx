"use client";

import { useState, useEffect } from "react";
import type { StepFormProps } from "@/lib/workflow/types";

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 — Regulatory Standard", description: "Official standard or regulation" },
  { value: "ACCREDITED_MATERIAL", label: "L4 — Accredited Material", description: "Accredited by recognised body" },
  { value: "PUBLISHED_REFERENCE", label: "L3 — Published Reference", description: "Published book or journal" },
  { value: "EXPERT_CURATED", label: "L2 — Expert Curated", description: "Expert-reviewed content" },
  { value: "AI_ASSISTED", label: "L1 — AI Assisted", description: "AI-extracted, not verified" },
  { value: "UNVERIFIED", label: "L0 — Unverified", description: "Not yet verified" },
];

export function ContentSourceStepForm({
  step,
  prefilled,
  onComplete,
  onSkip,
  onError,
  pendingFieldUpdates,
  onFieldUpdatesApplied,
}: StepFormProps) {
  const [slug, setSlug] = useState(prefilled?.slug || "");
  const [name, setName] = useState(prefilled?.name || "");
  const [description, setDescription] = useState(prefilled?.description || "");
  const [trustLevel, setTrustLevel] = useState(prefilled?.trustLevel || "UNVERIFIED");
  const [publisherOrg, setPublisherOrg] = useState(prefilled?.publisherOrg || "");
  const [accreditingBody, setAccreditingBody] = useState(prefilled?.accreditingBody || "");
  const [qualificationRef, setQualificationRef] = useState(prefilled?.qualificationRef || "");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Apply AI field updates
  useEffect(() => {
    if (pendingFieldUpdates) {
      if (pendingFieldUpdates.slug) setSlug(pendingFieldUpdates.slug);
      if (pendingFieldUpdates.name) setName(pendingFieldUpdates.name);
      if (pendingFieldUpdates.description) setDescription(pendingFieldUpdates.description);
      if (pendingFieldUpdates.trustLevel) setTrustLevel(pendingFieldUpdates.trustLevel);
      if (pendingFieldUpdates.publisherOrg) setPublisherOrg(pendingFieldUpdates.publisherOrg);
      if (pendingFieldUpdates.accreditingBody) setAccreditingBody(pendingFieldUpdates.accreditingBody);
      if (pendingFieldUpdates.qualificationRef) setQualificationRef(pendingFieldUpdates.qualificationRef);
      onFieldUpdatesApplied?.();
    }
  }, [pendingFieldUpdates, onFieldUpdatesApplied]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!slug.trim()) errs.slug = "Slug is required";
    if (!name.trim()) errs.name = "Name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) {
      onError(Object.values(errors));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/content-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          trustLevel,
          publisherOrg: publisherOrg.trim() || undefined,
          accreditingBody: accreditingBody.trim() || undefined,
          qualificationRef: qualificationRef.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (data.ok || data.id || data.source) {
        onComplete({
          id: data.id || data.source?.id,
          slug: slug.trim(),
          name: name.trim(),
          trustLevel,
        });
      } else {
        setErrors({ submit: data.error || "Failed to create content source" });
        onError([data.error || "Failed to create content source"]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setErrors({ submit: msg });
      onError([msg]);
    } finally {
      setCreating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    borderRadius: 10,
    border: "1px solid var(--border-default)",
    background: "var(--surface-secondary)",
    color: "var(--text-primary)",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
        {step.title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px" }}>
        {step.description}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Slug */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Slug <span style={{ color: "var(--error-text)" }}>*</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
            placeholder="e.g., highfield-l2-food-safety"
            style={{ ...inputStyle, ...(errors.slug ? { borderColor: "var(--error-text)" } : {}) }}
          />
          {errors.slug && <p style={{ fontSize: 12, color: "var(--error-text)", margin: "4px 0 0" }}>{errors.slug}</p>}
        </div>

        {/* Name */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Name <span style={{ color: "var(--error-text)" }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Highfield L2 Food Safety Qualification Spec"
            style={{ ...inputStyle, ...(errors.name ? { borderColor: "var(--error-text)" } : {}) }}
          />
          {errors.name && <p style={{ fontSize: 12, color: "var(--error-text)", margin: "4px 0 0" }}>{errors.name}</p>}
        </div>

        {/* Trust Level */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Trust Level
          </label>
          <select
            value={trustLevel}
            onChange={(e) => setTrustLevel(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {TRUST_LEVELS.map((tl) => (
              <option key={tl.value} value={tl.value}>
                {tl.label}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {TRUST_LEVELS.find((tl) => tl.value === trustLevel)?.description}
          </p>
        </div>

        {/* Publisher */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Publisher / Organisation
          </label>
          <input
            type="text"
            value={publisherOrg}
            onChange={(e) => setPublisherOrg(e.target.value)}
            placeholder="e.g., Highfield Qualifications"
            style={inputStyle}
          />
        </div>

        {/* Accrediting Body */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Accrediting Body
          </label>
          <input
            type="text"
            value={accreditingBody}
            onChange={(e) => setAccreditingBody(e.target.value)}
            placeholder="e.g., Ofqual, CII"
            style={inputStyle}
          />
        </div>

        {/* Qualification Reference */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Qualification Reference
          </label>
          <input
            type="text"
            value={qualificationRef}
            onChange={(e) => setQualificationRef(e.target.value)}
            placeholder="e.g., 603/2624/6"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Description */}
      <div style={{ marginTop: 20 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the content source..."
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {/* Error banner */}
      {errors.submit && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            color: "var(--error-text)",
            fontSize: 13,
            marginTop: 16,
          }}
        >
          {errors.submit}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        {!step.required && (
          <button
            onClick={onSkip}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        )}
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            padding: "10px 24px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            background: creating
              ? "var(--surface-tertiary)"
              : "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%)",
            color: creating ? "var(--text-muted)" : "var(--surface-primary)",
            cursor: creating ? "default" : "pointer",
            boxShadow: creating ? "none" : "0 4px 12px rgba(99, 102, 241, 0.3)",
          }}
        >
          {creating ? "Registering..." : "Register Source"}
        </button>
      </div>
    </div>
  );
}
