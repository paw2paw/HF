"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import { SortableList } from "@/components/shared/SortableList";
import { reorderItems } from "@/lib/sortable/reorder";
import type { DomainDetail } from "./types";

export function OnboardingTabContent({
  domain,
  onDomainRefresh,
  onPreviewPrompt,
  promptPreviewLoading,
}: {
  domain: DomainDetail;
  onDomainRefresh: () => void;
  onPreviewPrompt?: () => void;
  promptPreviewLoading?: boolean;
}) {
  // Onboarding editing state
  const [editingOnboarding, setEditingOnboarding] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({
    welcomeMessage: "",
    identitySpecId: "",
    flowPhases: "",
    defaultTargets: "",
  });
  const [flowPhasesMode, setFlowPhasesMode] = useState<"visual" | "json">("visual");
  const [defaultTargetsMode, setDefaultTargetsMode] = useState<"visual" | "json">("visual");
  const [structuredPhases, setStructuredPhases] = useState<Array<{
    _id: string;
    phase: string;
    duration: string;
    goals: string[];
    content?: Array<{ mediaId: string; instruction?: string }>;
  }>>([]);
  const [domainMedia, setDomainMedia] = useState<Array<{ id: string; title: string | null; fileName: string; mimeType: string }>>([]);
  const [structuredTargets, setStructuredTargets] = useState<Record<string, { value: number; confidence: number }>>({});
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingSaveError, setOnboardingSaveError] = useState<string | null>(null);
  const [onboardingSaveSuccess, setOnboardingSaveSuccess] = useState(false);
  const [availableSpecs, setAvailableSpecs] = useState<Array<{ id: string; slug: string; name: string }>>([]);

  // Scaffolding task tracking
  const [scaffoldingTasks, setScaffoldingTasks] = useState<Array<{
    id: string;
    status: string;
    context?: Record<string, any>;
  }>>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch scaffolding tasks in progress
  const fetchScaffoldingTasks = async () => {
    try {
      const res = await fetch("/api/tasks?status=in_progress");
      const data = await res.json();
      if (data.ok && data.tasks) {
        const tasks = data.tasks.filter((t: any) =>
          t.taskType === "scaffolding" && t.context?.domainId === domain.id
        );
        setScaffoldingTasks(tasks);

        // Stop polling if no more in-progress tasks
        if (tasks.length === 0 && pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
      }
    } catch (err) {
      console.warn("[OnboardingTab] Failed to fetch scaffolding tasks:", err);
    }
  };

  // Poll for scaffolding tasks
  useEffect(() => {
    fetchScaffoldingTasks();

    if (scaffoldingTasks.length > 0 && !pollInterval) {
      const interval = setInterval(() => {
        fetchScaffoldingTasks();
      }, 2000);
      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [domain.id]);

  // Fetch onboarding data on mount
  useEffect(() => {
    fetch(`/api/domains/${domain.id}/onboarding`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          // Notify parent to refresh domain with onboarding data
          onDomainRefresh();
        }
      })
      .catch((err) => {
        console.error("Error fetching onboarding data:", err);
      });
  }, [domain.id]);

  // Fetch available identity specs
  useEffect(() => {
    if (availableSpecs.length === 0) {
      fetch("/api/specs?role=IDENTITY")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setAvailableSpecs(data.specs || []);
          }
        })
        .catch((e) => console.warn("[Domains] Failed to load specs:", e));
    }
  }, [availableSpecs.length]);

  // Fetch domain media for onboarding phase content picker
  useEffect(() => {
    if (editingOnboarding && domain) {
      const subjectIds = ((domain as any).subjects || []).map((s: any) => s.subject?.id || s.subjectId);
      const validIds = subjectIds.filter(Boolean);
      if (validIds.length === 0) { setDomainMedia([]); return; }
      Promise.all(
        validIds.map((sid: string) =>
          fetch(`/api/subjects/${sid}/media`).then((r) => r.json())
        )
      ).then((results) => {
        const allMedia: Array<{ id: string; title: string | null; fileName: string; mimeType: string }> = [];
        const seen = new Set<string>();
        for (const result of results) {
          for (const item of result.media || []) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              allMedia.push({ id: item.id, title: item.title, fileName: item.fileName, mimeType: item.mimeType });
            }
          }
        }
        setDomainMedia(allMedia);
      }).catch(() => setDomainMedia([]));
    }
  }, [editingOnboarding, domain?.id]);

  // Populate form when entering edit mode - fetch onboarding data to get identity spec
  useEffect(() => {
    if (editingOnboarding && domain) {
      // Fetch full onboarding config including identity spec relation
      fetch(`/api/domains/${domain.id}/onboarding`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            const onboardingData = data.domain;
            const flowPhasesJson = onboardingData.onboardingFlowPhases ? JSON.stringify(onboardingData.onboardingFlowPhases, null, 2) : "";
            const defaultTargetsJson = onboardingData.onboardingDefaultTargets ? JSON.stringify(onboardingData.onboardingDefaultTargets, null, 2) : "";

            setOnboardingForm({
              welcomeMessage: onboardingData.onboardingWelcome || "",
              identitySpecId: onboardingData.onboardingIdentitySpecId || "",
              flowPhases: flowPhasesJson,
              defaultTargets: defaultTargetsJson,
            });

            // Parse structured data
            if (onboardingData.onboardingFlowPhases?.phases) {
              setStructuredPhases(onboardingData.onboardingFlowPhases.phases.map((p: any) => ({ ...p, _id: p._id || crypto.randomUUID() })));
            } else {
              setStructuredPhases([]);
            }

            if (onboardingData.onboardingDefaultTargets) {
              setStructuredTargets(onboardingData.onboardingDefaultTargets);
            } else {
              setStructuredTargets({});
            }
          }
        })
        .catch((err) => {
          console.error("Error fetching onboarding config:", err);
          // Fallback to existing domain data if fetch fails
          const flowPhasesJson = domain.onboardingFlowPhases ? JSON.stringify(domain.onboardingFlowPhases, null, 2) : "";
          const defaultTargetsJson = domain.onboardingDefaultTargets ? JSON.stringify(domain.onboardingDefaultTargets, null, 2) : "";

          setOnboardingForm({
            welcomeMessage: domain.onboardingWelcome || "",
            identitySpecId: "",
            flowPhases: flowPhasesJson,
            defaultTargets: defaultTargetsJson,
          });
        });
    }
  }, [editingOnboarding, domain?.id]);

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    setOnboardingSaveError(null);
    setOnboardingSaveSuccess(false);

    try {
      // Parse JSON fields or use structured data
      let flowPhases = null;
      let defaultTargets = null;

      if (flowPhasesMode === "visual") {
        // Use structured phases (strip transient _id before saving)
        if (structuredPhases.length > 0) {
          flowPhases = { phases: structuredPhases.map(({ _id, ...rest }) => rest) };
        }
      } else {
        // Parse JSON
        if (onboardingForm.flowPhases.trim()) {
          try {
            flowPhases = JSON.parse(onboardingForm.flowPhases);
          } catch (e) {
            throw new Error("Invalid JSON in Flow Phases");
          }
        }
      }

      if (defaultTargetsMode === "visual") {
        // Use structured targets
        if (Object.keys(structuredTargets).length > 0) {
          defaultTargets = structuredTargets;
        }
      } else {
        // Parse JSON
        if (onboardingForm.defaultTargets.trim()) {
          try {
            defaultTargets = JSON.parse(onboardingForm.defaultTargets);
          } catch (e) {
            throw new Error("Invalid JSON in Default Targets");
          }
        }
      }

      const res = await fetch(`/api/domains/${domain.id}/onboarding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingWelcome: onboardingForm.welcomeMessage || null,
          onboardingIdentitySpecId: onboardingForm.identitySpecId || null,
          onboardingFlowPhases: flowPhases,
          onboardingDefaultTargets: defaultTargets,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to save onboarding configuration");
      }

      // Refresh domain data via parent callback
      onDomainRefresh();

      setOnboardingSaveSuccess(true);
      setEditingOnboarding(false);

      // Clear success message after 3 seconds
      setTimeout(() => setOnboardingSaveSuccess(false), 3000);
    } catch (e: any) {
      setOnboardingSaveError(e.message || "Failed to save");
    } finally {
      setSavingOnboarding(false);
    }
  };

  return (
                <div>
                  {/* Scaffolding Progress */}
                  {scaffoldingTasks.length > 0 && (
                    <div style={{
                      padding: 16,
                      background: "#f0f9ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: 8,
                      marginBottom: 20,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div style={{ fontSize: 16 }}>⚙️</div>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                          Setting up curriculum
                        </h4>
                      </div>

                      {scaffoldingTasks.map(task => (
                        <div key={task.id} style={{
                          padding: 12,
                          background: "white",
                          borderRadius: 6,
                          marginBottom: 8,
                          border: "1px solid #dbeafe",
                        }}>
                          {/* Task progress */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            {task.status === "in_progress" && (
                              <div style={{
                                animation: "spin 1s linear infinite",
                                transformOrigin: "center",
                                display: "inline-block",
                              }}>
                                ⟳
                              </div>
                            )}
                            {task.status === "completed" && <div>✅</div>}
                            {task.status === "abandoned" && <div>⚠️</div>}

                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                              {task.context?.message || "Processing..."}
                            </span>
                          </div>

                          {/* Task steps */}
                          {task.status === "in_progress" && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 30 }}>
                              Step: <strong>{task.context?.step || "..."}</strong>
                            </div>
                          )}

                          {/* Completion summary */}
                          {task.status === "completed" && task.context?.summary && (
                            <div style={{
                              fontSize: 12,
                              color: "var(--text-secondary)",
                              marginLeft: 30,
                              padding: "8px 0",
                            }}>
                              <div>✓ Playbook: <strong>{task.context.summary.playbook}</strong></div>
                              <div>✓ {task.context.summary.modules} modules from {task.context.summary.assertions} points</div>
                            </div>
                          )}

                          {/* Error state */}
                          {task.status === "abandoned" && task.context?.error && (
                            <div style={{
                              fontSize: 12,
                              color: "#991b1b",
                              marginLeft: 30,
                              padding: "8px 0",
                            }}>
                              Error: {task.context.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Spinner keyframe animation */}
                  <style>{`
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}</style>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                        First-Call Onboarding Configuration
                      </h3>
                      <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
                        Customize the onboarding experience for new callers in this domain
                      </p>
                    </div>
                    {!editingOnboarding && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={onPreviewPrompt}
                          disabled={promptPreviewLoading}
                          style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            background: "transparent",
                            color: "var(--accent-primary)",
                            border: "1px solid var(--accent-primary)",
                            borderRadius: 6,
                            cursor: promptPreviewLoading ? "wait" : "pointer",
                            opacity: promptPreviewLoading ? 0.6 : 1,
                          }}
                        >
                          {promptPreviewLoading ? "Composing..." : "Preview First Prompt"}
                        </button>
                        <button
                          onClick={() => setEditingOnboarding(true)}
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
                          Edit Configuration
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Success Message */}
                  {onboardingSaveSuccess && (
                    <div style={{
                      padding: 12,
                      marginBottom: 16,
                      background: "#dcfce7",
                      color: "#166534",
                      borderRadius: 8,
                      fontSize: 14,
                    }}>
                      ✅ Onboarding configuration saved successfully
                    </div>
                  )}

                  {/* Error Message */}
                  {onboardingSaveError && (
                    <div style={{
                      padding: 12,
                      marginBottom: 16,
                      background: "var(--status-error-bg)",
                      color: "var(--status-error-text)",
                      borderRadius: 8,
                      fontSize: 14,
                    }}>
                      {onboardingSaveError}
                    </div>
                  )}

                  {editingOnboarding ? (
                    /* Edit Mode */
                    <div style={{
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      padding: 20,
                    }}>
                      {/* Welcome Message */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                          Welcome Message
                        </label>
                        <textarea
                          value={onboardingForm.welcomeMessage}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, welcomeMessage: e.target.value })}
                          placeholder="Enter the welcome message for first-time callers..."
                          style={{
                            width: "100%",
                            minHeight: 120,
                            padding: 12,
                            fontSize: 14,
                            border: "2px solid var(--border-default)",
                            borderRadius: 6,
                            fontFamily: "inherit",
                            resize: "vertical",
                          }}
                        />
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          This message is shown to new callers on their first call
                        </div>
                      </div>

                      {/* Identity Spec */}
                      <div style={{ marginBottom: 20 }}>
                        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                          Identity Spec
                        </label>
                        <select
                          value={onboardingForm.identitySpecId}
                          onChange={(e) => setOnboardingForm({ ...onboardingForm, identitySpecId: e.target.value })}
                          style={{
                            width: "100%",
                            padding: 12,
                            fontSize: 14,
                            border: "2px solid var(--border-default)",
                            borderRadius: 6,
                            background: "var(--surface-primary)",
                          }}
                        >
                          <option value="">Use default identity spec</option>
                          {availableSpecs.map((spec) => (
                            <option key={spec.id} value={spec.id}>
                              {spec.name} ({spec.slug})
                            </option>
                          ))}
                        </select>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                          Which identity/persona spec to use for onboarding
                        </div>
                      </div>

                      {/* Flow Phases */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <label style={{ fontSize: 14, fontWeight: 600 }}>
                            Flow Phases
                          </label>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => setFlowPhasesMode("visual")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: flowPhasesMode === "visual" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: flowPhasesMode === "visual" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              Visual
                            </button>
                            <button
                              onClick={() => setFlowPhasesMode("json")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: flowPhasesMode === "json" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: flowPhasesMode === "json" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              JSON
                            </button>
                          </div>
                        </div>

                        {flowPhasesMode === "visual" ? (
                          /* Visual Editor — uses shared SortableList */
                          <div>
                            <SortableList
                              items={structuredPhases}
                              getItemId={(p) => p._id}
                              onReorder={(from, to) => setStructuredPhases(reorderItems(structuredPhases, from, to))}
                              onRemove={(index) => setStructuredPhases(structuredPhases.filter((_, i) => i !== index))}
                              onAdd={() => setStructuredPhases([...structuredPhases, { _id: crypto.randomUUID(), phase: "", duration: "", goals: [] }])}
                              addLabel="+ Add Phase"
                              emptyLabel="No phases defined. Add one to configure the onboarding flow."
                              renderCard={(phase, index) => (
                                <div style={{ flex: 1 }}>
                                  {/* Phase header */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{
                                      width: 24,
                                      height: 24,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: "var(--accent-primary)",
                                      color: "white",
                                      borderRadius: "50%",
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}>
                                      {index + 1}
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                                      Phase {index + 1}
                                    </span>
                                  </div>
                                  {/* Phase Name + Duration */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 150px", gap: 10, marginBottom: 10 }}>
                                    <div>
                                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                        Phase Name
                                      </label>
                                      <input
                                        type="text"
                                        value={phase.phase}
                                        onChange={(e) => {
                                          const updated = [...structuredPhases];
                                          updated[index] = { ...updated[index], phase: e.target.value };
                                          setStructuredPhases(updated);
                                        }}
                                        placeholder="e.g., welcome, orient, discover"
                                        style={{
                                          width: "100%",
                                          padding: 10,
                                          fontSize: 14,
                                          border: "2px solid var(--border-default)",
                                          borderRadius: 6,
                                          background: "var(--surface-secondary)",
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                        Duration
                                      </label>
                                      <input
                                        type="text"
                                        value={phase.duration}
                                        onChange={(e) => {
                                          const updated = [...structuredPhases];
                                          updated[index] = { ...updated[index], duration: e.target.value };
                                          setStructuredPhases(updated);
                                        }}
                                        placeholder="e.g., 2min"
                                        style={{
                                          width: "100%",
                                          padding: 10,
                                          fontSize: 14,
                                          border: "2px solid var(--border-default)",
                                          borderRadius: 6,
                                          background: "var(--surface-secondary)",
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {/* Goals */}
                                  <div>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                      Goals (one per line)
                                    </label>
                                    <textarea
                                      value={phase.goals.join("\n")}
                                      onChange={(e) => {
                                        const updated = [...structuredPhases];
                                        updated[index] = { ...updated[index], goals: e.target.value.split("\n").filter(g => g.trim()) };
                                        setStructuredPhases(updated);
                                      }}
                                      placeholder="Enter goals for this phase..."
                                      style={{
                                        width: "100%",
                                        minHeight: 80,
                                        padding: 10,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        border: "2px solid var(--border-default)",
                                        borderRadius: 6,
                                        background: "var(--surface-secondary)",
                                        resize: "vertical",
                                      }}
                                    />
                                  </div>
                                  {/* Content to Share */}
                                  <div style={{ marginTop: 10 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                                      Content to Share
                                    </label>
                                    {(phase.content || []).map((ref, ci) => {
                                      const media = domainMedia.find(m => m.id === ref.mediaId);
                                      return (
                                        <div key={ci} style={{
                                          display: "flex", gap: 8, alignItems: "center", marginBottom: 6,
                                          padding: "6px 8px", background: "var(--surface-tertiary)", borderRadius: 6,
                                          border: "1px solid var(--border-default)",
                                        }}>
                                          <span style={{ fontSize: 14 }}>
                                            {media?.mimeType?.startsWith("image/") ? "🖼️" : media?.mimeType === "application/pdf" ? "📄" : media?.mimeType?.startsWith("audio/") ? "🔊" : "📎"}
                                          </span>
                                          <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {media?.title || media?.fileName || ref.mediaId}
                                          </span>
                                          <input
                                            type="text"
                                            value={ref.instruction || ""}
                                            onChange={(e) => {
                                              const updated = [...structuredPhases];
                                              const contentArr = [...(updated[index].content || [])];
                                              contentArr[ci] = { ...contentArr[ci], instruction: e.target.value };
                                              updated[index] = { ...updated[index], content: contentArr };
                                              setStructuredPhases(updated);
                                            }}
                                            placeholder="Instruction (e.g. Share at start of phase)"
                                            style={{
                                              flex: 2, padding: "4px 8px", fontSize: 12,
                                              border: "1px solid var(--border-default)", borderRadius: 4,
                                              background: "var(--surface-secondary)",
                                            }}
                                          />
                                          <button
                                            onClick={() => {
                                              const updated = [...structuredPhases];
                                              updated[index] = { ...updated[index], content: (updated[index].content || []).filter((_, i) => i !== ci) };
                                              setStructuredPhases(updated);
                                            }}
                                            style={{
                                              padding: "2px 8px", fontSize: 11, color: "var(--status-error-text)",
                                              background: "var(--status-error-bg)", border: "none", borderRadius: 4, cursor: "pointer",
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      );
                                    })}
                                    {domainMedia.length > 0 ? (
                                      <select
                                        value=""
                                        onChange={(e) => {
                                          if (!e.target.value) return;
                                          const updated = [...structuredPhases];
                                          const existing = updated[index].content || [];
                                          if (existing.some(c => c.mediaId === e.target.value)) return;
                                          updated[index] = { ...updated[index], content: [...existing, { mediaId: e.target.value }] };
                                          setStructuredPhases(updated);
                                        }}
                                        style={{
                                          width: "100%", padding: "6px 8px", fontSize: 12,
                                          border: "1px dashed var(--border-default)", borderRadius: 4,
                                          background: "var(--surface-secondary)", color: "var(--text-secondary)",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <option value="">+ Attach media to this phase...</option>
                                        {domainMedia
                                          .filter(m => !(phase.content || []).some(c => c.mediaId === m.id))
                                          .map(m => (
                                            <option key={m.id} value={m.id}>
                                              {m.title || m.fileName} ({m.mimeType.split("/")[1]})
                                            </option>
                                          ))
                                        }
                                      </select>
                                    ) : (
                                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                                        No media uploaded to this domain&apos;s subjects yet
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            />
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                              Define the onboarding flow phases (leave empty to use defaults)
                            </div>
                          </div>
                        ) : (
                          /* JSON Editor */
                          <div>
                            <textarea
                              value={onboardingForm.flowPhases}
                              onChange={(e) => setOnboardingForm({ ...onboardingForm, flowPhases: e.target.value })}
                              placeholder='{"phases": [{"phase": "welcome", "duration": "2min", "goals": ["..."]}]}'
                              style={{
                                width: "100%",
                                minHeight: 200,
                                padding: 12,
                                fontSize: 13,
                                fontFamily: "monospace",
                                border: "2px solid var(--border-default)",
                                borderRadius: 6,
                                resize: "vertical",
                              }}
                            />
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                              Define the onboarding flow phases in JSON format
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Default Targets */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <label style={{ fontSize: 14, fontWeight: 600 }}>
                            Default Behavior Targets
                          </label>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => setDefaultTargetsMode("visual")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: defaultTargetsMode === "visual" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: defaultTargetsMode === "visual" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              Visual
                            </button>
                            <button
                              onClick={() => setDefaultTargetsMode("json")}
                              style={{
                                padding: "4px 12px",
                                fontSize: 12,
                                fontWeight: 500,
                                background: defaultTargetsMode === "json" ? "var(--accent-primary)" : "var(--surface-secondary)",
                                color: defaultTargetsMode === "json" ? "white" : "var(--text-secondary)",
                                border: "1px solid var(--border-default)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              JSON
                            </button>
                          </div>
                        </div>

                        {defaultTargetsMode === "visual" ? (
                          /* Visual Editor with Vertical Sliders */
                          <div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                              {Object.entries(structuredTargets).map(([paramId, target]) => (
                              <div
                                key={paramId}
                                style={{
                                  padding: 16,
                                  background: "var(--surface-primary)",
                                  border: "2px solid var(--border-default)",
                                  borderRadius: 8,
                                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                {/* Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
                                    {paramId}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newTargets = { ...structuredTargets };
                                      delete newTargets[paramId];
                                      setStructuredTargets(newTargets);
                                    }}
                                    style={{
                                      padding: "2px 8px",
                                      fontSize: 10,
                                      fontWeight: 500,
                                      background: "var(--status-error-bg)",
                                      color: "var(--status-error-text)",
                                      border: "none",
                                      borderRadius: 4,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>

                                {/* Vertical Sliders Container */}
                                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", gap: 20, flex: 1 }}>
                                  {/* Value Slider */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                      Value
                                    </label>
                                    <span style={{
                                      fontSize: 15,
                                      fontWeight: 700,
                                      color: "var(--accent-primary)",
                                      fontFamily: "monospace",
                                      marginBottom: 8,
                                      minHeight: 20,
                                    }}>
                                      {target.value.toFixed(2)}
                                    </span>

                                    {/* Vertical Slider Wrapper */}
                                    <div style={{ position: "relative", height: 180, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                      {/* Scale markers */}
                                      <div style={{ position: "absolute", right: -24, top: -6, fontSize: 9, color: "var(--text-muted)" }}>1.0</div>
                                      <div style={{ position: "absolute", right: -24, top: 84, fontSize: 9, color: "var(--text-muted)" }}>0.5</div>
                                      <div style={{ position: "absolute", right: -24, bottom: -6, fontSize: 9, color: "var(--text-muted)" }}>0.0</div>

                                      {/* Vertical range input */}
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={target.value}
                                        onChange={(e) => {
                                          const newTargets = { ...structuredTargets };
                                          newTargets[paramId].value = parseFloat(e.target.value);
                                          setStructuredTargets(newTargets);
                                        }}
                                        style={{
                                          WebkitAppearance: "slider-vertical",
                                          width: 6,
                                          height: 180,
                                          borderRadius: 3,
                                          background: `linear-gradient(to top, var(--accent-primary) 0%, var(--accent-primary) ${target.value * 100}%, var(--surface-tertiary) ${target.value * 100}%, var(--surface-tertiary) 100%)`,
                                          outline: "none",
                                          cursor: "pointer",
                                          writingMode: "vertical-lr" as React.CSSProperties["writingMode"],
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Confidence Slider */}
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                      Confidence
                                    </label>
                                    <span style={{
                                      fontSize: 15,
                                      fontWeight: 700,
                                      color: "var(--accent-primary)",
                                      fontFamily: "monospace",
                                      marginBottom: 8,
                                      minHeight: 20,
                                    }}>
                                      {target.confidence.toFixed(2)}
                                    </span>

                                    {/* Vertical Slider Wrapper */}
                                    <div style={{ position: "relative", height: 180, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                      {/* Scale markers */}
                                      <div style={{ position: "absolute", left: -24, top: -6, fontSize: 9, color: "var(--text-muted)" }}>1.0</div>
                                      <div style={{ position: "absolute", left: -24, top: 84, fontSize: 9, color: "var(--text-muted)" }}>0.5</div>
                                      <div style={{ position: "absolute", left: -24, bottom: -6, fontSize: 9, color: "var(--text-muted)" }}>0.0</div>

                                      {/* Vertical range input */}
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={target.confidence}
                                        onChange={(e) => {
                                          const newTargets = { ...structuredTargets };
                                          newTargets[paramId].confidence = parseFloat(e.target.value);
                                          setStructuredTargets(newTargets);
                                        }}
                                        style={{
                                          WebkitAppearance: "slider-vertical",
                                          width: 6,
                                          height: 180,
                                          borderRadius: 3,
                                          background: `linear-gradient(to top, var(--accent-primary) 0%, var(--accent-primary) ${target.confidence * 100}%, var(--surface-tertiary) ${target.confidence * 100}%, var(--surface-tertiary) 100%)`,
                                          outline: "none",
                                          cursor: "pointer",
                                          writingMode: "vertical-lr" as React.CSSProperties["writingMode"],
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Add Parameter Section */}
                          <div style={{ marginTop: 12 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                type="text"
                                id="newParamId"
                                placeholder="Parameter ID (e.g., warmth)"
                                style={{
                                  flex: 1,
                                  padding: 10,
                                  fontSize: 14,
                                  border: "1px solid var(--border-default)",
                                  borderRadius: 6,
                                }}
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById("newParamId") as HTMLInputElement;
                                  const paramId = input.value.trim();
                                  if (paramId && !structuredTargets[paramId]) {
                                    setStructuredTargets({
                                      ...structuredTargets,
                                      [paramId]: { value: 0.5, confidence: 0.3 },
                                    });
                                    input.value = "";
                                  }
                                }}
                                style={{
                                  padding: "10px 20px",
                                  fontSize: 14,
                                  fontWeight: 500,
                                  background: "var(--accent-primary)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                }}
                              >
                                Add Parameter
                              </button>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                              Default behavior parameter values for first-time callers (leave empty to use defaults)
                            </div>
                          </div>
                          </div>
                        ) : (
                          /* JSON Editor */
                          <div>
                            <textarea
                              value={onboardingForm.defaultTargets}
                              onChange={(e) => setOnboardingForm({ ...onboardingForm, defaultTargets: e.target.value })}
                              placeholder='{"warmth": {"value": 0.7, "confidence": 0.3}, ...}'
                              style={{
                                width: "100%",
                                minHeight: 200,
                                padding: 12,
                                fontSize: 13,
                                fontFamily: "monospace",
                                border: "2px solid var(--border-default)",
                                borderRadius: 6,
                                resize: "vertical",
                              }}
                            />
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                              Default behavior parameter values in JSON format
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => {
                            setEditingOnboarding(false);
                            setOnboardingSaveError(null);
                          }}
                          disabled={savingOnboarding}
                          style={{
                            padding: "10px 20px",
                            fontSize: 14,
                            fontWeight: 500,
                            background: "var(--surface-secondary)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 6,
                            cursor: savingOnboarding ? "not-allowed" : "pointer",
                            opacity: savingOnboarding ? 0.5 : 1,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveOnboarding}
                          disabled={savingOnboarding}
                          style={{
                            padding: "10px 24px",
                            fontSize: 14,
                            fontWeight: 600,
                            background: savingOnboarding ? "#d1d5db" : "var(--accent-primary)",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: savingOnboarding ? "not-allowed" : "pointer",
                          }}
                        >
                          {savingOnboarding ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>

                  {/* Quick Stats - Dashboard Style */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16,
                    marginBottom: 24,
                  }}>
                    {/* Identity Spec Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingIdentitySpec ? "#10b981" : "#ef4444"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingIdentitySpec ? "👤" : "⚠️"}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: domain.onboardingIdentitySpec ? "#10b981" : "#ef4444",
                        textAlign: "center",
                        marginBottom: 4,
                      }}>
                        {domain.onboardingIdentitySpec?.name || "Not Set"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Identity Spec
                      </div>
                      {domain.onboardingIdentitySpec && (
                        <Link
                          href={`/x/layers?overlayId=${domain.onboardingIdentitySpec.id}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 8,
                            padding: "3px 10px",
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#6366f1",
                            background: "#e0e7ff",
                            borderRadius: 4,
                            textDecoration: "none",
                            transition: "opacity 0.15s",
                          }}
                        >
                          <Layers style={{ width: 12, height: 12 }} />
                          View Layers
                        </Link>
                      )}
                    </div>

                    {/* Welcome Message Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingWelcome ? "#10b981" : "#d1d5db"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingWelcome ? "✅" : "💬"}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: domain.onboardingWelcome ? "#10b981" : "var(--text-muted)",
                        textAlign: "center",
                        marginBottom: 4,
                      }}>
                        {domain.onboardingWelcome ? "Configured" : "Default"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Welcome Message
                      </div>
                    </div>

                    {/* Flow Phases Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingFlowPhases ? "#10b981" : "#d1d5db"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingFlowPhases ? "🔄" : "⏭️"}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: domain.onboardingFlowPhases ? "var(--button-primary-bg)" : "var(--text-muted)",
                        lineHeight: 1,
                        marginBottom: 4,
                      }}>
                        {domain.onboardingFlowPhases ?
                          (domain.onboardingFlowPhases as any).phases?.length || 0 :
                          "0"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Flow Phases
                      </div>
                    </div>

                    {/* Default Targets Card */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px 16px",
                      background: "var(--surface-primary)",
                      border: `2px solid ${domain.onboardingDefaultTargets ? "#10b981" : "#d1d5db"}`,
                      borderRadius: 12,
                      transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>
                        {domain.onboardingDefaultTargets ? "🎯" : "⚙️"}
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: domain.onboardingDefaultTargets ? "var(--button-primary-bg)" : "var(--text-muted)",
                        lineHeight: 1,
                        marginBottom: 4,
                      }}>
                        {domain.onboardingDefaultTargets ?
                          Object.keys(domain.onboardingDefaultTargets as object).length :
                          "0"}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        Default Targets
                      </div>
                    </div>
                  </div>

                  {/* Welcome Message Preview */}
                  {domain.onboardingWelcome && (
                    <div style={{
                      padding: 16,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      marginBottom: 20,
                    }}>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600 }}>
                        Welcome Message Preview
                      </h4>
                      <div style={{
                        padding: 16,
                        background: "var(--surface-tertiary)",
                        borderRadius: 6,
                        fontSize: 14,
                        lineHeight: 1.6,
                        fontStyle: "italic",
                      }}>
                        {"\u201c"}{domain.onboardingWelcome}{"\u201d"}
                      </div>
                    </div>
                  )}

                  {/* Flow Phases Visual */}
                  {domain.onboardingFlowPhases && (domain.onboardingFlowPhases as any).phases && (
                    <div style={{
                      padding: 20,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 12,
                      marginBottom: 20,
                    }}>
                      <h4 style={{
                        margin: "0 0 16px 0",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}>
                        <span style={{ fontSize: 20 }}>🔄</span>
                        Onboarding Flow Phases
                      </h4>
                      <div style={{
                        display: "flex",
                        gap: 16,
                        overflowX: "auto",
                        paddingBottom: 8,
                      }}>
                        {((domain.onboardingFlowPhases as any).phases || []).map((phase: any, idx: number) => (
                          <div key={idx} style={{
                            minWidth: 220,
                            padding: 20,
                            background: "var(--surface-primary)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 12,
                            position: "relative",
                            transition: "all 0.2s",
                          }}
                          className="phase-card">
                            <div style={{
                              position: "absolute",
                              top: 12,
                              right: 12,
                              background: "var(--button-primary-bg)",
                              color: "white",
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}>
                              {idx + 1}
                            </div>
                            <div style={{
                              fontSize: 16,
                              fontWeight: 700,
                              marginBottom: 12,
                              marginTop: 8,
                              color: "var(--button-primary-bg)",
                              textTransform: "capitalize",
                            }}>
                              {phase.phase}
                            </div>
                            <div style={{
                              fontSize: 13,
                              color: "var(--text-muted)",
                              marginBottom: 16,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 10px",
                              background: "var(--surface-secondary)",
                              borderRadius: 6,
                              fontWeight: 500,
                            }}>
                              <span>⏱️</span>
                              <span>{phase.duration}</span>
                            </div>
                            {phase.goals && phase.goals.length > 0 && (
                              <div>
                                <div style={{
                                  fontSize: 10,
                                  color: "var(--text-muted)",
                                  marginBottom: 8,
                                  fontWeight: 700,
                                  letterSpacing: "0.5px",
                                  textTransform: "uppercase",
                                }}>
                                  Goals
                                </div>
                                <ul style={{
                                  margin: 0,
                                  paddingLeft: 18,
                                  fontSize: 13,
                                  lineHeight: 1.6,
                                  color: "var(--text-secondary)",
                                }}>
                                  {phase.goals.map((goal: string, gIdx: number) => (
                                    <li key={gIdx} style={{ marginBottom: 4 }}>{goal}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {phase.content && phase.content.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <div style={{
                                  fontSize: 10, color: "var(--text-muted)", marginBottom: 6,
                                  fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                                }}>
                                  Content
                                </div>
                                {phase.content.map((ref: any, cIdx: number) => (
                                  <div key={cIdx} style={{
                                    fontSize: 12, padding: "4px 8px", background: "var(--surface-tertiary)",
                                    borderRadius: 4, marginBottom: 4, display: "flex", alignItems: "center", gap: 6,
                                  }}>
                                    <span>📎</span>
                                    <span style={{ fontWeight: 500 }}>{ref.instruction || "Media attached"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default Targets Visual */}
                  {domain.onboardingDefaultTargets && Object.keys(domain.onboardingDefaultTargets as object).length > 0 && (
                    <div style={{
                      padding: 16,
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                    }}>
                      <h4 style={{ margin: "0 0 16px 0", fontSize: 14, fontWeight: 600 }}>
                        Default Parameter Targets
                      </h4>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 12,
                      }}>
                        {Object.entries(domain.onboardingDefaultTargets as object).map(([param, data]: [string, any]) => {
                          const value = data.value ?? data;
                          const confidence = data.confidence ?? null;
                          const normalizedValue = typeof value === 'number' ? value : 0;
                          const percentage = Math.round(normalizedValue * 100);

                          return (
                            <div key={param} style={{
                              padding: 12,
                              background: "var(--surface-secondary)",
                              border: "1px solid var(--border-default)",
                              borderRadius: 6,
                            }}>
                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                marginBottom: 8,
                                color: "var(--text-primary)",
                                textTransform: "capitalize",
                              }}>
                                {param.replace(/_/g, " ")}
                              </div>
                              <div style={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 6,
                                marginBottom: 8,
                              }}>
                                <div style={{
                                  fontSize: 24,
                                  fontWeight: 700,
                                  color: "var(--accent-primary)",
                                }}>
                                  {percentage}%
                                </div>
                                <div style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                }}>
                                  ({normalizedValue.toFixed(2)})
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div style={{
                                width: "100%",
                                height: 4,
                                background: "var(--surface-tertiary)",
                                borderRadius: 2,
                                overflow: "hidden",
                                marginBottom: confidence !== null ? 8 : 0,
                              }}>
                                <div style={{
                                  width: `${percentage}%`,
                                  height: "100%",
                                  background: "var(--accent-primary)",
                                  transition: "width 0.3s ease",
                                }} />
                              </div>
                              {confidence !== null && (
                                <div style={{
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}>
                                  <span>Confidence:</span>
                                  <span style={{ fontWeight: 600 }}>
                                    {Math.round(confidence * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hover Styles for Onboarding Cards */}
                  <style>{`
                    .phase-card:hover {
                      border-color: var(--button-primary-bg) !important;
                      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.1);
                      transform: translateY(-2px);
                    }
                  `}</style>
                </div>
                  )}
                </div>
  );
}
