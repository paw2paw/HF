"use client";

import { useState, useEffect, useCallback } from "react";
import type { StepFormProps } from "@/lib/workflow/types";
import "./spec-step-form.css";

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

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="hf-card">
      <h3 className="ssf-title">
        {step.title}
      </h3>
      <p className="ssf-desc">
        {step.description}
      </p>

      {/* Sub-step navigation pills */}
      <div className="ssf-pills">
        {SUB_STEPS.map((ss, i) => {
          const isCurrent = ss.key === subStep;
          const isPast = i < subStepIndex;
          return (
            <button
              key={ss.key}
              onClick={() => setSubStep(ss.key)}
              className={`ssf-pill${isCurrent ? " ssf-pill-current" : isPast ? " ssf-pill-past" : ""}`}
            >
              {isPast ? "\u2713 " : ""}
              {ss.label}
            </button>
          );
        })}
      </div>

      {/* ─── Basics ─── */}
      {subStep === "basics" && (
        <div className="ssf-grid-2col">
          <div>
            <label className="hf-label">
              Spec ID <span className="ssf-required">*</span>
            </label>
            <input
              type="text"
              value={specId}
              onChange={(e) => setSpecId(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              placeholder="e.g., PERS-001"
              className={`hf-input${errors.specId ? " ssf-input-error" : ""}`}
            />
            {errors.specId && <p className="ssf-error-text">{errors.specId}</p>}
            <p className="ssf-hint">
              Pattern: PREFIX-NNN (e.g., PERS-001, CURR-FS-001)
            </p>
          </div>

          <div>
            <label className="hf-label">
              Title <span className="ssf-required">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Food Safety L2 Tutor Identity"
              className={`hf-input${errors.title ? " ssf-input-error" : ""}`}
            />
            {errors.title && <p className="ssf-error-text">{errors.title}</p>}
          </div>

          <div>
            <label className="hf-label">Version</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              className="hf-input"
            />
          </div>

          <div>
            <label className="hf-label">Institution</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., food-safety, personality"
              className="hf-input"
            />
          </div>
        </div>
      )}

      {/* ─── Classification ─── */}
      {subStep === "classification" && (
        <div className="ssf-grid-3col">
          <div>
            <label className="hf-label">Spec Type</label>
            <select
              value={specType}
              onChange={(e) => setSpecType(e.target.value)}
              className="hf-input ssf-select"
            >
              {SPEC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="hf-label">Spec Role</label>
            <select
              value={specRole}
              onChange={(e) => setSpecRole(e.target.value)}
              className="hf-input ssf-select"
            >
              {SPEC_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="hf-label">Output Type</label>
            <select
              value={outputType}
              onChange={(e) => setOutputType(e.target.value)}
              className="hf-input ssf-select"
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
        <div className="ssf-flex-col">
          <div>
            <label className="hf-label">
              As a... <span className="ssf-required">*</span>
            </label>
            <input
              type="text"
              value={asA}
              onChange={(e) => setAsA(e.target.value)}
              placeholder="e.g., Food Safety training system"
              className={`hf-input${errors.asA ? " ssf-input-error" : ""}`}
            />
            {errors.asA && <p className="ssf-error-text">{errors.asA}</p>}
          </div>

          <div>
            <label className="hf-label">
              I want... <span className="ssf-required">*</span>
            </label>
            <textarea
              value={iWant}
              onChange={(e) => setIWant(e.target.value)}
              placeholder="e.g., to define the tutor's identity, personality, and teaching approach"
              rows={2}
              className={`hf-input ssf-textarea${errors.iWant ? " ssf-input-error" : ""}`}
            />
            {errors.iWant && <p className="ssf-error-text">{errors.iWant}</p>}
          </div>

          <div>
            <label className="hf-label">
              So that... <span className="ssf-required">*</span>
            </label>
            <textarea
              value={soThat}
              onChange={(e) => setSoThat(e.target.value)}
              placeholder="e.g., callers receive consistent, warm, expert-level food safety tutoring"
              rows={2}
              className={`hf-input ssf-textarea${errors.soThat ? " ssf-input-error" : ""}`}
            />
            {errors.soThat && <p className="ssf-error-text">{errors.soThat}</p>}
          </div>
        </div>
      )}

      {/* ─── Parameters ─── */}
      {subStep === "parameters" && (
        <div>
          <p className="ssf-param-intro">
            Define what this spec measures or controls. Parameters are optional for non-MEASURE specs.
          </p>

          {parameters.map((param, i) => (
            <div key={i} className="ssf-param-card">
              <div className="ssf-param-header">
                <span className="ssf-param-title">
                  Parameter {i + 1}
                </span>
                <button
                  onClick={() => removeParameter(i)}
                  className="ssf-btn-remove-param"
                >
                  Remove
                </button>
              </div>

              <div className="ssf-param-grid">
                <div>
                  <label className="ssf-label-sm">ID</label>
                  <input
                    type="text"
                    value={param.id}
                    onChange={(e) => updateParameter(i, "id", e.target.value)}
                    placeholder="PARAM-1"
                    className="ssf-input-sm"
                  />
                </div>
                <div>
                  <label className="ssf-label-sm">Name</label>
                  <input
                    type="text"
                    value={param.name}
                    onChange={(e) => updateParameter(i, "name", e.target.value)}
                    placeholder="e.g., Openness to Experience"
                    className="ssf-input-sm"
                  />
                </div>
              </div>

              <div>
                <label className="ssf-label-sm">Description</label>
                <input
                  type="text"
                  value={param.description}
                  onChange={(e) => updateParameter(i, "description", e.target.value)}
                  placeholder="What does this parameter measure?"
                  className="ssf-input-sm"
                />
              </div>
            </div>
          ))}

          <button
            onClick={addParameter}
            className="ssf-btn-add-param"
          >
            + Add Parameter
          </button>
        </div>
      )}

      {/* ─── Review ─── */}
      {subStep === "review" && (
        <div>
          <div className="ssf-review-grid">
            {[
              { label: "Spec ID", value: specId },
              { label: "Title", value: title },
              { label: "Version", value: version || "1.0" },
              { label: "Institution", value: domain || "\u2014" },
              { label: "Type", value: specType },
              { label: "Role", value: specRole || "\u2014" },
              { label: "Output", value: outputType || "\u2014" },
              { label: "Parameters", value: `${parameters.length} defined` },
            ].map((item) => (
              <div key={item.label}>
                <span className="ssf-review-label">
                  {item.label}
                </span>
                <p className="ssf-review-value">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="ssf-story-card">
            <span className="ssf-review-label">
              User Story
            </span>
            <p className="ssf-story-text">
              <strong>As a</strong> {asA || "\u2014"}, <strong>I want</strong> {iWant || "\u2014"}, <strong>so that</strong> {soThat || "\u2014"}.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errors.submit && (
        <div className="hf-banner hf-banner-error ssf-error-banner">
          {errors.submit}
        </div>
      )}

      {/* Navigation + Actions */}
      <div className="ssf-nav-bar">
        <div className="ssf-nav-group">
          {subStepIndex > 0 && (
            <button
              onClick={handlePrev}
              className="hf-btn hf-btn-secondary ssf-btn-nav"
            >
              Back
            </button>
          )}
        </div>

        <div className="ssf-nav-group">
          {/* Specs are always skippable — can be created later via /x/specs/new */}
          <button
            onClick={onSkip}
            className="hf-btn hf-btn-secondary ssf-btn-nav"
          >
            Skip — create later
          </button>

          {subStep !== "review" ? (
            <button
              onClick={handleNext}
              className="hf-btn hf-btn-gradient-primary ssf-btn-action"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className={`hf-btn ssf-btn-action${creating ? " ssf-btn-creating" : " hf-btn-gradient-primary"}`}
            >
              {creating ? "Creating..." : "Create Spec"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
