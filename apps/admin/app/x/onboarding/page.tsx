"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type DefaultTarget = {
  value: number;
  confidence: number;
  rationale?: string;
};

type Phase = {
  phase: string;
  duration: string;
  priority: string;
  goals: string[];
  avoid: string[];
  instructionSlug?: string;
};

type PersonaColor = { bg: string; border: string; text: string };

type PersonaSummary = {
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: PersonaColor;
};

type OnboardingData = {
  source: string;
  spec: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    updatedAt: string;
  } | null;
  selectedPersona: string;
  availablePersonas: string[];
  personasList: PersonaSummary[];
  personaName: string;
  personaDescription: string | null;
  personaIcon: string;
  personaColor: PersonaColor;
  defaultTargets: Record<string, DefaultTarget>;
  firstCallFlow: {
    phases: Phase[];
    successMetrics?: string[];
  };
  welcomeTemplate: string;
  welcomeSlug: string | null;
  welcomeTemplates: Record<string, string>;
};

const priorityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#fee2e2", text: "#991b1b" },
  high: { bg: "#fef3c7", text: "#92400e" },
  medium: { bg: "#dbeafe", text: "#1e40af" },
  low: { bg: "#e5e7eb", text: "#4b5563" },
};

const phaseIcons: Record<string, string> = {
  welcome: "👋",
  orient: "🧭",
  discover: "🔍",
  sample: "✨",
  close: "🎯",
};

// Default fallback for unknown personas
const defaultPersonaColor: PersonaColor = { bg: "#e5e7eb", border: "#6b7280", text: "#374151" };

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const personaParam = searchParams.get("persona");

  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [editingWelcome, setEditingWelcome] = useState(false);
  const [welcomeDraft, setWelcomeDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Create Persona modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPersonaSlug, setNewPersonaSlug] = useState("");
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaDescription, setNewPersonaDescription] = useState("");
  const [newPersonaIcon, setNewPersonaIcon] = useState("🎭");
  const [creatingPersona, setCreatingPersona] = useState(false);

  const fetchData = useCallback(async (persona?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = persona ? `/api/onboarding?persona=${persona}` : "/api/onboarding";
      const res = await fetch(url);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to fetch");
      setData(json);
      setWelcomeDraft(json.welcomeTemplate || "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(personaParam || undefined);
  }, [personaParam, fetchData]);

  const selectPersona = (persona: string) => {
    router.push(`/x/onboarding?persona=${persona}`);
  };

  const saveWelcome = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/onboarding/personas/${data.selectedPersona}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ welcomeTemplate: welcomeDraft }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setEditingWelcome(false);
      fetchData(data.selectedPersona);
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const createPersona = async () => {
    if (!newPersonaSlug.trim() || !newPersonaName.trim()) return;
    setCreatingPersona(true);
    try {
      const res = await fetch("/api/onboarding/personas/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newPersonaSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          name: newPersonaName.trim(),
          description: newPersonaDescription.trim() || null,
          icon: newPersonaIcon || "🎭",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      // Close modal and navigate to the new persona
      setShowCreateModal(false);
      setNewPersonaSlug("");
      setNewPersonaName("");
      setNewPersonaDescription("");
      setNewPersonaIcon("🎭");
      router.push(`/x/onboarding?persona=${newPersonaSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`);
    } catch (e: any) {
      alert("Failed to create: " + e.message);
    } finally {
      setCreatingPersona(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading INIT-001 onboarding spec...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ padding: 16, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { source, spec, selectedPersona, personasList, personaName, personaDescription, personaIcon, personaColor, defaultTargets, firstCallFlow, welcomeTemplate, welcomeSlug } = data;
  const colors = personaColor || defaultPersonaColor;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🚀</span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            First Call Onboarding
          </h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          INIT-001: Configure the first-call experience for new callers by persona
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <span style={{
            padding: "4px 10px",
            background: source === "database" ? "#dcfce7" : "#fef3c7",
            color: source === "database" ? "#14532d" : "#78350f",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 500,
          }}>
            {source === "database" ? "✓ Loaded from DB" : "⚠ Using hardcoded defaults"}
          </span>
          {spec && (
            <span style={{ padding: "4px 10px", background: "var(--surface-secondary)", borderRadius: 12, fontSize: 12, color: "var(--text-secondary)" }}>
              {spec.slug}
            </span>
          )}
        </div>
      </div>

      {/* Persona Tabs */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 24,
        borderBottom: "2px solid var(--border-default)",
        paddingBottom: 0,
      }}>
        {personasList.map((persona) => {
          const isActive = persona.slug === selectedPersona;
          const pc = persona.color || defaultPersonaColor;
          return (
            <button
              key={persona.slug}
              onClick={() => selectPersona(persona.slug)}
              style={{
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 600,
                background: isActive ? pc.bg : "transparent",
                color: isActive ? pc.text : "var(--text-secondary)",
                border: "none",
                borderBottom: isActive ? `3px solid ${pc.border}` : "3px solid transparent",
                borderRadius: "8px 8px 0 0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
                marginBottom: -2,
              }}
            >
              <span style={{ fontSize: 20 }}>{persona.icon || "🎭"}</span>
              <span>{persona.name}</span>
            </button>
          );
        })}
        {/* + Persona Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: "12px 20px",
            fontSize: 14,
            fontWeight: 500,
            background: "transparent",
            color: "var(--text-muted)",
            border: "2px dashed var(--border-default)",
            borderBottom: "none",
            borderRadius: "8px 8px 0 0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s",
            marginBottom: -2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--surface-secondary)";
            e.currentTarget.style.borderColor = "var(--accent-primary)";
            e.currentTarget.style.color = "var(--accent-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <span style={{ fontSize: 16 }}>+</span>
          <span>Persona</span>
        </button>
      </div>

      {/* Persona Header */}
      <div style={{
        marginBottom: 24,
        padding: 20,
        background: colors.bg,
        borderRadius: 12,
        border: `1px solid ${colors.border}40`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 40 }}>{personaIcon || "🎭"}</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.text }}>
              {personaName} Persona
            </h2>
            {personaDescription && (
              <p style={{ margin: "4px 0 0 0", fontSize: 14, color: colors.text, opacity: 0.8 }}>
                {personaDescription}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Welcome Message - Prominent */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span>💬</span> Welcome Message
          </h2>
          {!editingWelcome ? (
            <button
              onClick={() => setEditingWelcome(true)}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 500,
                background: "var(--accent-primary)",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setEditingWelcome(false); setWelcomeDraft(welcomeTemplate); }}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  background: "var(--surface-secondary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveWelcome}
                disabled={saving}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: saving ? "wait" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
        {welcomeSlug && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            Slug: <code style={{ background: "var(--surface-secondary)", padding: "2px 6px", borderRadius: 4 }}>{welcomeSlug}</code>
          </p>
        )}
        {editingWelcome ? (
          <textarea
            value={welcomeDraft}
            onChange={(e) => setWelcomeDraft(e.target.value)}
            style={{
              width: "100%",
              minHeight: 120,
              padding: 16,
              fontSize: 14,
              lineHeight: 1.6,
              border: `2px solid ${colors.border}`,
              borderRadius: 12,
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              resize: "vertical",
            }}
          />
        ) : (
          <div style={{
            padding: 20,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--text-primary)",
            fontStyle: "italic",
          }}>
            "{welcomeTemplate}"
          </div>
        )}
      </section>

      {/* First Call Flow Timeline */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span>📋</span> First Call Flow
        </h2>

        {/* Timeline */}
        <div style={{ display: "flex", gap: 0, position: "relative", marginBottom: 24 }}>
          {/* Connection line */}
          <div style={{
            position: "absolute",
            top: 28,
            left: 40,
            right: 40,
            height: 3,
            background: `linear-gradient(90deg, ${colors.border}, #f472b6)`,
            borderRadius: 2,
            zIndex: 0,
          }} />

          {firstCallFlow.phases?.map((phase) => {
            const isExpanded = expandedPhase === phase.phase;
            const pColors = priorityColors[phase.priority] || priorityColors.medium;

            return (
              <div
                key={phase.phase}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}
              >
                {/* Phase circle */}
                <button
                  onClick={() => setExpandedPhase(isExpanded ? null : phase.phase)}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: isExpanded ? colors.border : "var(--surface-primary)",
                    border: `3px solid ${isExpanded ? colors.border : pColors.bg}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: isExpanded ? `0 4px 12px ${colors.border}40` : "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {phaseIcons[phase.phase] || "📌"}
                </button>

                {/* Phase label */}
                <div style={{ marginTop: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>
                    {phase.phase}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {phase.duration}
                  </div>
                  <span style={{
                    display: "inline-block",
                    marginTop: 4,
                    padding: "2px 8px",
                    background: pColors.bg,
                    color: pColors.text,
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                  }}>
                    {phase.priority}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Expanded phase details */}
        {expandedPhase && (
          <div style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 20,
            marginTop: 16,
          }}>
            {(() => {
              const phase = firstCallFlow.phases?.find(p => p.phase === expandedPhase);
              if (!phase) return null;

              return (
                <>
                  {phase.instructionSlug && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                      Instruction slug: <code style={{ background: "var(--surface-secondary)", padding: "2px 6px", borderRadius: 4 }}>{phase.instructionSlug}</code>
                    </p>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: "#166534", marginBottom: 8, textTransform: "uppercase" }}>
                        ✓ Goals
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-primary)", fontSize: 14, lineHeight: 1.6 }}>
                        {phase.goals.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 8, textTransform: "uppercase" }}>
                        ✗ Avoid
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                        {phase.avoid.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Success metrics */}
        {firstCallFlow.successMetrics && firstCallFlow.successMetrics.length > 0 && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
          }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: "#166534", marginBottom: 8 }}>
              🎯 Success Metrics
            </h4>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {firstCallFlow.successMetrics.map((m, i) => (
                <span key={i} style={{
                  padding: "4px 12px",
                  background: "#dcfce7",
                  color: "#14532d",
                  borderRadius: 16,
                  fontSize: 13,
                }}>
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Default Behavior Targets */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🎚️</span> Default Behavior Targets
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Initial values for {personaName.toLowerCase()} callers. Persona-specific overrides are highlighted.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
        }}>
          {Object.entries(defaultTargets).map(([paramId, target]) => {
            const displayName = paramId.replace("BEH-", "").replace(/-/g, " ");
            const percentage = Math.round(target.value * 100);
            const confidenceLevel = target.confidence < 0.4 ? "Learning" : target.confidence < 0.7 ? "Moderate" : "Confident";

            return (
              <div
                key={paramId}
                style={{
                  background: "var(--surface-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>
                    {displayName}
                  </span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: percentage >= 60 ? "#059669" : percentage <= 40 ? "#dc2626" : "var(--text-primary)",
                  }}>
                    {percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: 6,
                  background: "var(--surface-tertiary)",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 6,
                }}>
                  <div style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: `linear-gradient(90deg, ${colors.border}, ${percentage >= 60 ? "#34d399" : percentage <= 40 ? "#f87171" : "#fbbf24"})`,
                    borderRadius: 3,
                    transition: "width 0.3s",
                  }} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    background: target.confidence < 0.4 ? "#fef3c7" : target.confidence < 0.7 ? "#dbeafe" : "#dcfce7",
                    color: target.confidence < 0.4 ? "#92400e" : target.confidence < 0.7 ? "#1e40af" : "#166534",
                    borderRadius: 6,
                  }}>
                    {confidenceLevel} ({Math.round(target.confidence * 100)}%)
                  </span>
                </div>

                {target.rationale && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.4 }}>
                    {target.rationale}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Seed Instructions */}
      {source !== "database" && (
        <section style={{
          padding: 20,
          background: "#fef3c7",
          border: "1px solid #fcd34d",
          borderRadius: 12,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
            ⚠️ INIT-001 Not Seeded
          </h3>
          <p style={{ fontSize: 13, color: "#78350f", marginBottom: 12 }}>
            The onboarding spec is not in the database yet. Run the seed command to load it:
          </p>
          <code style={{
            display: "block",
            padding: 12,
            background: "#451a03",
            color: "#fef3c7",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
          }}>
            cd apps/admin && npm run db:seed
          </code>
        </section>
      )}

      {/* Create Persona Modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface-primary)",
              borderRadius: 16,
              padding: 28,
              width: 440,
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: 32 }}>🎭</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
                  Create New Persona
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  Add a new onboarding persona to INIT-001
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                {/* Icon Picker */}
                <div style={{ flexShrink: 0 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)" }}>
                    Icon
                  </label>
                  <input
                    type="text"
                    value={newPersonaIcon}
                    onChange={(e) => setNewPersonaIcon(e.target.value)}
                    maxLength={2}
                    style={{
                      width: 56,
                      height: 56,
                      padding: 0,
                      fontSize: 32,
                      textAlign: "center",
                      border: "2px solid var(--border-default)",
                      borderRadius: 12,
                      background: "var(--surface-secondary)",
                    }}
                  />
                </div>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)" }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newPersonaName}
                    onChange={(e) => {
                      setNewPersonaName(e.target.value);
                      // Auto-generate slug from name
                      if (!newPersonaSlug || newPersonaSlug === newPersonaName.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
                        setNewPersonaSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                      }
                    }}
                    placeholder="e.g., Mentor"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      fontSize: 15,
                      border: "2px solid var(--border-default)",
                      borderRadius: 8,
                      background: "var(--surface-primary)",
                    }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Slug */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)" }}>
                  Slug *
                </label>
                <input
                  type="text"
                  value={newPersonaSlug}
                  onChange={(e) => setNewPersonaSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="e.g., mentor"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 14,
                    fontFamily: "monospace",
                    border: "2px solid var(--border-default)",
                    borderRadius: 8,
                    background: "var(--surface-secondary)",
                  }}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  value={newPersonaDescription}
                  onChange={(e) => setNewPersonaDescription(e.target.value)}
                  placeholder="Brief description of this persona's purpose..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: 14,
                    border: "2px solid var(--border-default)",
                    borderRadius: 8,
                    background: "var(--surface-primary)",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPersonaSlug("");
                  setNewPersonaName("");
                  setNewPersonaDescription("");
                  setNewPersonaIcon("🎭");
                }}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "var(--surface-secondary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createPersona}
                disabled={!newPersonaSlug.trim() || !newPersonaName.trim() || creatingPersona}
                style={{
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: newPersonaSlug.trim() && newPersonaName.trim() ? "var(--accent-primary)" : "#d1d5db",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: newPersonaSlug.trim() && newPersonaName.trim() && !creatingPersona ? "pointer" : "not-allowed",
                  opacity: creatingPersona ? 0.7 : 1,
                }}
              >
                {creatingPersona ? "Creating..." : "Create Persona"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
