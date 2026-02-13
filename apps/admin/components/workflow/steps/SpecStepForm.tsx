"use client";

import { useState, useEffect, useCallback } from "react";
import type { StepFormProps } from "@/lib/workflow/types";

// ── Sub-step navigation ──────────────────────────────────

type SubStep = "basics" | "classification" | "story" | "parameters" | "review";

const SUB_STEPS: { key: SubStep; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "classification", label: "Type" },
  { key: "story", label: "Story" },
  { key: "parameters", label: "Params" },
  { key: "review", label: "Review" },
];

// ── Options ──────────────────────────────────────────────

const SPEC_TYPES = [
  { value: "DOMAIN", label: "Domain" },
  { value: "SYSTEM", label: "System" },
  { value: "ADAPT", label: "Adapt" },
  { value: "SUPERVISE", label: "Supervise" },
];

const SPEC_ROLES = [
  { value: "IDENTITY", label: "Identity" },
  { value: "CONTENT", label: "Content" },
  { value: "VOICE", label: "Voice" },
  { value: "MEASURE", label: "Measure" },
  { value: "ADAPT", label: "Adapt" },
  { value: "REWARD", label: "Reward" },
  { value: "GUARDRAIL", label: "Guardrail" },
  { value: "", label: "None" },
];

const OUTPUT_TYPES = [
  { value: "MEASURE", label: "Measure" },
  { value: "LEARN", label: "Learn" },
  { value: "ADAPT", label: "Adapt" },
  { value: "COMPOSE", label: "Compose" },
  { value: "AGGREGATE", label: "Aggregate" },
  { value: "REWARD", label: "Reward" },
  { value: "", label: "None" },
];

// ── Parameter shape ──────────────────────────────────────

interface JsonParameter {
  id: string;
  name: string;
  description: string;
  section?: string;
  isAdjustable?: boolean;
  targetRange?: { min: number; max: number };
}

// ── Component ────────────────────────────────────────────

export function SpecStepForm({
  step,
  prefilled,
  onComplete,
  onSkip,
  onError,
  pendingFieldUpdates,
  onFieldUpdatesApplied,
}: StepFormProps) {
  const [subStep, setSubStep] = useState<SubStep>("basics");
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Basics
  const [specId, setSpecId] = useState(prefilled?.id || "");
  const [title, setTitle] = useState(prefilled?.title || "");
  const [version, setVersion] = useState(prefilled?.version || "1.0");
  const [domain, setDomain] = useState(prefilled?.domain || "");

  // Classification
  const [specType, setSpecType] = useState(prefilled?.specType || "DOMAIN");
  const [specRole, setSpecRole] = useState(prefilled?.specRole || "");
  const [outputType, setOutputType] = useState(prefilled?.outputType || "MEASURE");

  // Story
  const [asA, setAsA] = useState(prefilled?.story?.asA || prefilled?.asA || "");
  const [iWant, setIWant] = useState(prefilled?.story?.iWant || prefilled?.iWant || "");
  const [soThat, setSoThat] = useState(prefilled?.story?.soThat || prefilled?.soThat || "");

  // Parameters
  const [parameters, setParameters] = useState<JsonParameter[]>(prefilled?.parameters || []);

  // Apply AI field updates
  useEffect(() => {
    if (pendingFieldUpdates) {
      if (pendingFieldUpdates.id) setSpecId(pendingFieldUpdates.id);
      if (pendingFieldUpdates.title) setTitle(pendingFieldUpdates.title);
      if (pendingFieldUpdates.version) setVersion(pendingFieldUpdates.version);
      if (pendingFieldUpdates.domain) setDomain(pendingFieldUpdates.domain);
      if (pendingFieldUpdates.specType) setSpecType(pendingFieldUpdates.specType);
      if (pendingFieldUpdates.specRole) setSpecRole(pendingFieldUpdates.specRole);
      if (pendingFieldUpdates.outputType) setOutputType(pendingFieldUpdates.outputType);
      if (pendingFieldUpdates.story) {
        if (pendingFieldUpdates.story.asA) setAsA(pendingFieldUpdates.story.asA);
        if (pendingFieldUpdates.story.iWant) setIWant(pendingFieldUpdates.story.iWant);
        if (pendingFieldUpdates.story.soThat) setSoThat(pendingFieldUpdates.story.soThat);
      }
      if (pendingFieldUpdates.asA) setAsA(pendingFieldUpdates.asA);
      if (pendingFieldUpdates.iWant) setIWant(pendingFieldUpdates.iWant);
      if (pendingFieldUpdates.soThat) setSoThat(pendingFieldUpdates.soThat);
      if (pendingFieldUpdates.parameters) setParameters(pendingFieldUpdates.parameters);
      onFieldUpdatesApplied?.();
    }
  }, [pendingFieldUpdates, onFieldUpdatesApplied]);

  // ── Validation ──────────────────────────────────────────

  const validateBasics = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!specId.trim()) errs.specId = "Spec ID is required";
    else if (!/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*-[0-9]+$/.test(specId.trim()))
      errs.specId = "Pattern: PREFIX-NNN e.g. PERS-001, CURR-FS-001, FS-L2-IDENTITY-001";
    if (!title.trim()) errs.title = "Title is required";
    return errs;
  }, [specId, title]);

  const validateStory = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!asA.trim()) errs.asA = "Required";
    if (!iWant.trim()) errs.iWant = "Required";
    if (!soThat.trim()) errs.soThat = "Required";
    return errs;
  }, [asA, iWant, soThat]);

  const validateAll = useCallback((): boolean => {
    const basicsErrs = validateBasics();
    const storyErrs = validateStory();
    const allErrs = { ...basicsErrs, ...storyErrs };
    setErrors(allErrs);
    return Object.keys(allErrs).length === 0;
  }, [validateBasics, validateStory]);

  // ── Sub-step navigation ─────────────────────────────────

  const subStepIndex = SUB_STEPS.findIndex((s) => s.key === subStep);

  const handleNext = () => {
    // Validate current sub-step before advancing
    if (subStep === "basics") {
      const errs = validateBasics();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }
    if (subStep === "story") {
      const errs = validateStory();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }
    setErrors({});
    const next = SUB_STEPS[subStepIndex + 1];
    if (next) setSubStep(next.key);
  };

  const handlePrev = () => {
    const prev = SUB_STEPS[subStepIndex - 1];
    if (prev) setSubStep(prev.key);
  };

  // ── Create spec ─────────────────────────────────────────

  const handleCreate = async () => {
    if (!validateAll()) {
      onError(Object.values(errors));
      return;
    }

    setCreating(true);
    try {
      const payload = {
        spec: {
          id: specId.trim(),
          title: title.trim(),
          version: version.trim() || "1.0",
          status: "Draft" as const,
          domain: domain.trim() || undefined,
          specType,
          specRole: specRole || undefined,
          outputType: outputType || undefined,
          story: {
            asA: asA.trim(),
            iWant: iWant.trim(),
            soThat: soThat.trim(),
          },
          parameters: parameters.length > 0 ? parameters : undefined,
        },
        autoActivate: false, // Don't auto-activate during workflow — Activate step handles this
      };

      const res = await fetch("/api/specs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        onComplete({
          specId: data.specId,
          featureSetId: data.featureSetId,
          featureId: data.featureId || specId.trim(),
          id: specId.trim(),
          title: title.trim(),
          specRole,
          specType,
        });
      } else {
        setErrors({ submit: data.error || "Failed to create spec" });
        onError([data.error || "Failed to create spec"]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setErrors({ submit: msg });
      onError([msg]);
    } finally {
      setCreating(false);
    }
  };

  // ── Add / remove parameters ─────────────────────────────

  const addParameter = () => {
    setParameters((prev) => [
      ...prev,
      {
        id: `PARAM-${prev.length + 1}`,
        name: "",
        description: "",
        isAdjustable: true,
        targetRange: { min: 0, max: 1 },
      },
    ]);
  };

  const updateParameter = (index: number, field: keyof JsonParameter, value: string | boolean | { min: number; max: number }) => {
    setParameters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeParameter = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Styles ──────────────────────────────────────────────

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

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 6,
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--error-text)",
    margin: "4px 0 0",
  };

  // ── Render ──────────────────────────────────────────────

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
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>
        {step.description}
      </p>

      {/* Sub-step navigation pills */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {SUB_STEPS.map((ss, i) => {
          const isCurrent = ss.key === subStep;
          const isPast = i < subStepIndex;
          return (
            <button
              key={ss.key}
              onClick={() => setSubStep(ss.key)}
              style={{
                flex: 1,
                padding: "8px 4px",
                fontSize: 12,
                fontWeight: isCurrent ? 700 : 500,
                borderRadius: 8,
                border: "1px solid",
                borderColor: isCurrent ? "var(--accent-primary)" : "var(--border-default)",
                background: isCurrent
                  ? "color-mix(in srgb, var(--accent-primary) 12%, transparent)"
                  : isPast
                    ? "color-mix(in srgb, var(--success-bg) 50%, transparent)"
                    : "var(--surface-secondary)",
                color: isCurrent ? "var(--accent-primary)" : isPast ? "var(--success-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {isPast ? "\u2713 " : ""}
              {ss.label}
            </button>
          );
        })}
      </div>

      {/* ─── Basics ─── */}
      {subStep === "basics" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <label style={labelStyle}>
              Spec ID <span style={{ color: "var(--error-text)" }}>*</span>
            </label>
            <input
              type="text"
              value={specId}
              onChange={(e) => setSpecId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              placeholder="e.g., PERS-001"
              style={{ ...inputStyle, ...(errors.specId ? { borderColor: "var(--error-text)" } : {}) }}
            />
            {errors.specId && <p style={errorStyle}>{errors.specId}</p>}
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
              Pattern: PREFIX-NNN (e.g., PERS-001, CURR-FS-001)
            </p>
          </div>

          <div>
            <label style={labelStyle}>
              Title <span style={{ color: "var(--error-text)" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Food Safety L2 Tutor Identity"
              style={{ ...inputStyle, ...(errors.title ? { borderColor: "var(--error-text)" } : {}) }}
            />
            {errors.title && <p style={errorStyle}>{errors.title}</p>}
          </div>

          <div>
            <label style={labelStyle}>Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., food-safety, personality"
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* ─── Classification ─── */}
      {subStep === "classification" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
          <div>
            <label style={labelStyle}>Spec Type</label>
            <select
              value={specType}
              onChange={(e) => setSpecType(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {SPEC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Spec Role</label>
            <select
              value={specRole}
              onChange={(e) => setSpecRole(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {SPEC_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Output Type</label>
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {OUTPUT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ─── Story ─── */}
      {subStep === "story" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>
              As a... <span style={{ color: "var(--error-text)" }}>*</span>
            </label>
            <input
              type="text"
              value={asA}
              onChange={(e) => setAsA(e.target.value)}
              placeholder="e.g., Food Safety training system"
              style={{ ...inputStyle, ...(errors.asA ? { borderColor: "var(--error-text)" } : {}) }}
            />
            {errors.asA && <p style={errorStyle}>{errors.asA}</p>}
          </div>

          <div>
            <label style={labelStyle}>
              I want... <span style={{ color: "var(--error-text)" }}>*</span>
            </label>
            <textarea
              value={iWant}
              onChange={(e) => setIWant(e.target.value)}
              placeholder="e.g., to define the tutor's identity, personality, and teaching approach"
              rows={2}
              style={{ ...inputStyle, ...(errors.iWant ? { borderColor: "var(--error-text)" } : {}), resize: "vertical", fontFamily: "inherit" }}
            />
            {errors.iWant && <p style={errorStyle}>{errors.iWant}</p>}
          </div>

          <div>
            <label style={labelStyle}>
              So that... <span style={{ color: "var(--error-text)" }}>*</span>
            </label>
            <textarea
              value={soThat}
              onChange={(e) => setSoThat(e.target.value)}
              placeholder="e.g., callers receive consistent, warm, expert-level food safety tutoring"
              rows={2}
              style={{ ...inputStyle, ...(errors.soThat ? { borderColor: "var(--error-text)" } : {}), resize: "vertical", fontFamily: "inherit" }}
            />
            {errors.soThat && <p style={errorStyle}>{errors.soThat}</p>}
          </div>
        </div>
      )}

      {/* ─── Parameters ─── */}
      {subStep === "parameters" && (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Define what this spec measures or controls. Parameters are optional for non-MEASURE specs.
          </p>

          {parameters.map((param, i) => (
            <div
              key={i}
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  Parameter {i + 1}
                </span>
                <button
                  onClick={() => removeParameter(i)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    borderRadius: 6,
                    border: "1px solid var(--error-border)",
                    background: "var(--error-bg)",
                    color: "var(--error-text)",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, marginBottom: 8 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>ID</label>
                  <input
                    type="text"
                    value={param.id}
                    onChange={(e) => updateParameter(i, "id", e.target.value)}
                    placeholder="PARAM-1"
                    style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Name</label>
                  <input
                    type="text"
                    value={param.name}
                    onChange={(e) => updateParameter(i, "name", e.target.value)}
                    placeholder="e.g., Openness to Experience"
                    style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 11 }}>Description</label>
                <input
                  type="text"
                  value={param.description}
                  onChange={(e) => updateParameter(i, "description", e.target.value)}
                  placeholder="What does this parameter measure?"
                  style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                />
              </div>
            </div>
          ))}

          <button
            onClick={addParameter}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: "1px dashed var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            + Add Parameter
          </button>
        </div>
      )}

      {/* ─── Review ─── */}
      {subStep === "review" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 20,
            }}
          >
            {[
              { label: "Spec ID", value: specId },
              { label: "Title", value: title },
              { label: "Version", value: version || "1.0" },
              { label: "Domain", value: domain || "—" },
              { label: "Type", value: specType },
              { label: "Role", value: specRole || "—" },
              { label: "Output", value: outputType || "—" },
              { label: "Parameters", value: `${parameters.length} defined` },
            ].map((item) => (
              <div key={item.label}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {item.label}
                </span>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "2px 0 0" }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-default)", background: "var(--surface-secondary)" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              User Story
            </span>
            <p style={{ fontSize: 13, color: "var(--text-primary)", margin: "8px 0 0", lineHeight: 1.6 }}>
              <strong>As a</strong> {asA || "—"}, <strong>I want</strong> {iWant || "—"}, <strong>so that</strong> {soThat || "—"}.
            </p>
          </div>
        </div>
      )}

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

      {/* Navigation + Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 24 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {subStepIndex > 0 && (
            <button
              onClick={handlePrev}
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
              Back
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {/* Specs are always skippable — can be created later via /x/specs/new */}
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
            Skip — create later
          </button>

          {subStep !== "review" ? (
            <button
              onClick={handleNext}
              style={{
                padding: "10px 24px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
              }}
            >
              Next
            </button>
          ) : (
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
                  : "linear-gradient(135deg, var(--accent-primary) 0%, #6366f1 100%)",
                color: creating ? "var(--text-muted)" : "#fff",
                cursor: creating ? "default" : "pointer",
                boxShadow: creating ? "none" : "0 4px 12px rgba(99, 102, 241, 0.3)",
              }}
            >
              {creating ? "Creating..." : "Create Spec"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
