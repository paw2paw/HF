"use client";

import { useState, useEffect } from "react";
import type { StepFormProps } from "@/lib/workflow/types";

export function DomainStepForm({
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
  const [isDefault, setIsDefault] = useState(prefilled?.isDefault || false);
  const [creating, setCreating] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Apply AI field updates
  useEffect(() => {
    if (pendingFieldUpdates) {
      if (pendingFieldUpdates.slug) setSlug(pendingFieldUpdates.slug);
      if (pendingFieldUpdates.name) setName(pendingFieldUpdates.name);
      if (pendingFieldUpdates.description) setDescription(pendingFieldUpdates.description);
      if (pendingFieldUpdates.isDefault !== undefined) setIsDefault(pendingFieldUpdates.isDefault);
      onFieldUpdatesApplied?.();
    }
  }, [pendingFieldUpdates, onFieldUpdatesApplied]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!slug.trim()) errs.slug = "Slug is required";
    else if (!/^[a-z0-9-]+$/.test(slug)) errs.slug = "Slug must be lowercase letters, numbers, and hyphens only";
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
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || null,
          isDefault,
        }),
      });
      const data = await res.json();

      if (data.ok || data.id) {
        const domainId = data.id || data.domain?.id;

        // Auto-scaffold: create identity spec, playbook, publish, configure onboarding
        setScaffolding(true);
        try {
          await fetch(`/api/domains/${domainId}/scaffold`, { method: "POST" });
        } catch {
          // Best-effort — domain was still created successfully
        } finally {
          setScaffolding(false);
        }

        onComplete({
          id: domainId,
          slug: slug.trim(),
          name: name.trim(),
        });
      } else {
        setErrors({ submit: data.error || "Failed to create domain" });
        onError([data.error || "Failed to create domain"]);
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

      {/* Slug */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          Slug <span style={{ color: "var(--error-text)" }}>*</span>
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
          placeholder="e.g., food-safety-l2"
          style={{
            ...inputStyle,
            ...(errors.slug ? { borderColor: "var(--error-text)" } : {}),
          }}
        />
        {errors.slug && (
          <p style={{ fontSize: 12, color: "var(--error-text)", margin: "4px 0 0" }}>{errors.slug}</p>
        )}
      </div>

      {/* Name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          Name <span style={{ color: "var(--error-text)" }}>*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Food Safety Level 2"
          style={{
            ...inputStyle,
            ...(errors.name ? { borderColor: "var(--error-text)" } : {}),
          }}
        />
        {errors.name && (
          <p style={{ fontSize: 12, color: "var(--error-text)", margin: "4px 0 0" }}>{errors.name}</p>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of this domain..."
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {/* Is Default */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Set as default domain for new callers
          </span>
        </label>
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
            marginBottom: 16,
          }}
        >
          {errors.submit}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
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
          {scaffolding ? "Setting up..." : creating ? "Creating..." : "Create Domain"}
        </button>
      </div>
    </div>
  );
}
