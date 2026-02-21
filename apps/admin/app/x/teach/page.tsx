"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FancySelect } from "@/components/shared/FancySelect";
import type { FancySelectOption } from "@/components/shared/FancySelect";
import { useStepFlow } from "@/contexts/StepFlowContext";
import { useEntityContext } from "@/contexts/EntityContext";
import { useTerminology } from "@/contexts/TerminologyContext";
import { ChevronRight, ChevronLeft, Pencil, Trash2, Save, X, Plus, Building2, User, Target, PlayCircle } from "lucide-react";
import { WizardSummary } from "@/components/shared/WizardSummary";
import { POLL_TIMEOUT_MS } from "@/lib/tasks/constants";

// ── Types ──────────────────────────────────────────

type CourseCheck = {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "recommended" | "optional";
  passed: boolean;
  detail: string;
  fixAction?: { label: string; href: string };
};

type DomainInfo = {
  id: string;
  slug: string;
  name: string;
  isDefault: boolean;
  callerCount: number;
};

type CallerInfo = {
  id: string;
  name: string;
};

type CallerGoal = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  progress: number;
  priority: number;
};

const GOAL_TYPE_EMOJI: Record<string, string> = {
  LEARN: "📚",
  ACHIEVE: "🏆",
  CHANGE: "🔄",
  CONNECT: "🤝",
  SUPPORT: "💪",
  CREATE: "🎨",
};

// ── Step definitions ──────────────────────────────

const TEACH_STEPS = [
  { id: "domain", label: "Select Institution & Learner", activeLabel: "Selecting Institution & Learner" },
  { id: "goal", label: "Set Your Goal", activeLabel: "Setting Your Goal" },
  { id: "readiness", label: "Readiness Checks", activeLabel: "Checking Readiness" },
  { id: "launch", label: "Launch", activeLabel: "Ready to Teach" },
];

// ── Page ───────────────────────────────────────────

export default function TeachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, isActive, startFlow, setStep, setData, getData, endFlow } = useStepFlow();
  const { pushEntity } = useEntityContext();
  const { terms } = useTerminology();
  const flowInitialized = useRef(false);

  // Domain selector state
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [domainOptions, setDomainOptions] = useState<FancySelectOption[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Caller for the selected domain
  const [callers, setCallers] = useState<CallerInfo[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState("");
  const [callerOptions, setCallerOptions] = useState<FancySelectOption[]>([]);

  // Goal text
  const [goalText, setGoalText] = useState("");

  // Course readiness
  const [checks, setChecks] = useState<CourseCheck[]>([]);
  const [ready, setReady] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState<"ready" | "almost" | "incomplete">("incomplete");

  // AI goal suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const lastSuggestText = useRef("");

  // Caller goals (CRUD)
  const [callerGoals, setCallerGoals] = useState<CallerGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalName, setEditGoalName] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  const currentStep = state?.currentStep ?? 0;

  // ── Initialize step flow (load steps from ORCHESTRATE spec with hardcoded fallback) ──
  useEffect(() => {
    if (flowInitialized.current) return;
    flowInitialized.current = true;

    const initFlow = async () => {
      let stepsToUse = TEACH_STEPS;
      try {
        const res = await fetch("/api/wizard-steps?wizard=teach");
        const data = await res.json();
        if (data.ok && data.steps?.length > 0) {
          stepsToUse = data.steps.map((s: any) => ({
            id: s.id, label: s.label, activeLabel: s.activeLabel,
          }));
        }
      } catch {
        // Silent — use hardcoded fallback
      }

      if (!isActive) {
        startFlow({
          flowId: "teach",
          steps: stepsToUse,
          returnPath: "/x/teach",
        });
      } else {
        // Returning from a fix-action page — restore state from context
        const savedDomainId = getData<string>("domainId");
        const savedCallerId = getData<string>("callerId");
        const savedGoal = getData<string>("goal");
        if (savedDomainId) setSelectedDomainId(savedDomainId);
        if (savedCallerId) setSelectedCallerId(savedCallerId);
        if (savedGoal) setGoalText(savedGoal);
      }
    };
    initFlow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push flow breadcrumb for Cmd+K awareness ──
  useEffect(() => {
    if (isActive) {
      pushEntity({
        type: "flow",
        id: "teach",
        label: "Teach Flow",
        data: {
          step: currentStep,
          stepLabel: TEACH_STEPS[currentStep]?.label,
          goal: goalText,
          domainId: selectedDomainId,
          callerId: selectedCallerId,
        },
      });
    }
  }, [isActive, currentStep, goalText, selectedDomainId, selectedCallerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load domains on mount ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/domains?onlyInstitution=true");
        const data = await res.json();
        if (data.ok) {
          const list: DomainInfo[] = data.domains || [];
          setDomains(list);
          setDomainOptions(
            list.map((d) => ({
              value: d.id,
              label: d.name,
              subtitle: d.slug,
              badge: d.isDefault ? "Default" : undefined,
            })),
          );
          // Auto-select: URL param > context data > default domain > only domain
          const urlDomainId = searchParams.get("domainId");
          const ctxDomainId = getData<string>("domainId");
          if (urlDomainId && list.some((d) => d.id === urlDomainId)) {
            setSelectedDomainId(urlDomainId);
          } else if (ctxDomainId && list.some((d) => d.id === ctxDomainId)) {
            setSelectedDomainId(ctxDomainId);
          } else {
            const defaultDomain = list.find((d) => d.isDefault);
            if (defaultDomain) setSelectedDomainId(defaultDomain.id);
            else if (list.length === 1) setSelectedDomainId(list[0].id);
          }
        }
      } catch (e) {
        console.warn("[Teach] Failed to load domains:", e);
      } finally {
        setLoadingDomains(false);
      }
    })();
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load callers when domain changes ──
  useEffect(() => {
    if (!selectedDomainId) {
      setCallers([]);
      setCallerOptions([]);
      setSelectedCallerId("");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/callers?scope=ALL");
        const data = await res.json();
        if (data.ok) {
          const domainCallers = (data.callers || []).filter(
            (c: any) => c.domainId === selectedDomainId,
          );
          const list: CallerInfo[] = domainCallers.map((c: any) => ({
            id: c.id,
            name: c.name || c.email || c.id,
          }));
          setCallers(list);
          setCallerOptions(
            list.map((c) => ({
              value: c.id,
              label: c.name,
            })),
          );
          // Auto-select: URL param > context data > first caller
          const urlCallerId = searchParams.get("callerId");
          const ctxCallerId = getData<string>("callerId");
          if (urlCallerId && list.some((c) => c.id === urlCallerId)) {
            setSelectedCallerId(urlCallerId);
          } else if (ctxCallerId && list.some((c) => c.id === ctxCallerId)) {
            setSelectedCallerId(ctxCallerId);
          } else if (list.length > 0) {
            setSelectedCallerId(list[0].id);
          } else {
            setSelectedCallerId("");
          }
        }
      } catch (e) {
        console.warn("[Teach] Failed to load callers:", e);
      }
    })();
  }, [selectedDomainId, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch AI goal suggestions ──
  const fetchSuggestions = useCallback(async (forceText?: string) => {
    if (!selectedDomainId || !selectedCallerId) return;
    const text = forceText ?? goalText;
    // Skip if same text was already fetched
    if (text === lastSuggestText.current && suggestions.length > 0) return;
    lastSuggestText.current = text;
    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams({
        domainId: selectedDomainId,
        callerId: selectedCallerId,
      });
      if (text) params.set("currentGoal", text);
      const res = await fetch(`/api/demonstrate/suggest?${params}`);
      const data = await res.json();
      if (data.ok && data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch {
      // Non-critical — suggestions are optional
    } finally {
      setLoadingSuggestions(false);
    }
  }, [selectedDomainId, selectedCallerId, goalText, suggestions.length]);

  // Fetch suggestions when entering step 1 (goal) with domain+caller selected
  useEffect(() => {
    if (currentStep === 1 && selectedDomainId && selectedCallerId) {
      fetchSuggestions("");
    }
  }, [currentStep, selectedDomainId, selectedCallerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch caller goals ──
  const fetchCallerGoals = useCallback(async () => {
    if (!selectedCallerId) {
      setCallerGoals([]);
      return;
    }
    setLoadingGoals(true);
    try {
      const res = await fetch(`/api/goals?callerId=${selectedCallerId}&status=ACTIVE`);
      const data = await res.json();
      if (data.ok) {
        setCallerGoals(data.goals || []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingGoals(false);
    }
  }, [selectedCallerId]);

  // Load caller goals when entering step 1 or caller changes on step 1
  useEffect(() => {
    if (currentStep === 1 && selectedCallerId) {
      fetchCallerGoals();
    }
  }, [currentStep, selectedCallerId, fetchCallerGoals]);

  // ── Goal CRUD handlers ──
  const handleSaveAsGoal = async () => {
    if (!goalText.trim() || !selectedCallerId || savingGoal) return;
    setSavingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId: selectedCallerId,
          name: goalText.trim(),
          type: "LEARN",
        }),
      });
      const data = await res.json();
      if (data.ok && data.goal) {
        setCallerGoals((prev) => [data.goal, ...prev]);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSavingGoal(false);
    }
  };

  const handleUpdateGoal = async (goalId: string) => {
    if (!editGoalName.trim()) return;
    try {
      const res = await fetch(`/api/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editGoalName.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.goal) {
        setCallerGoals((prev) =>
          prev.map((g) => (g.id === goalId ? { ...g, name: data.goal.name } : g)),
        );
      }
    } catch {
      // Silently fail
    } finally {
      setEditingGoalId(null);
      setEditGoalName("");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setCallerGoals((prev) => prev.filter((g) => g.id !== goalId));
      }
    } catch {
      // Silently fail
    }
  };

  // ── Fetch course readiness ──
  const fetchReadiness = useCallback(async () => {
    if (!selectedDomainId) return;
    setChecksLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCallerId) params.set("callerId", selectedCallerId);
      const res = await fetch(`/api/domains/${selectedDomainId}/course-readiness?${params}`);
      const data = await res.json();
      if (data.ok) {
        setChecks(data.checks || []);
        setReady(data.ready ?? false);
        setScore(data.score ?? 0);
        setLevel(data.level ?? "incomplete");
      }
    } catch (e) {
      console.warn("[Teach] Readiness fetch failed:", e);
    } finally {
      setChecksLoading(false);
    }
  }, [selectedDomainId, selectedCallerId]);

  // Fetch readiness when entering step 2
  useEffect(() => {
    if (currentStep === 2 && selectedDomainId) fetchReadiness();
  }, [currentStep, selectedDomainId, selectedCallerId, fetchReadiness]);

  // Poll readiness every 10s while on step 2 (with timeout guard)
  useEffect(() => {
    if (currentStep !== 2 || !selectedDomainId) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      fetchReadiness();
    }, 10_000);
    return () => clearInterval(interval);
  }, [currentStep, selectedDomainId, fetchReadiness]);

  // ── Helpers ──
  const selectedDomain = domains.find((d) => d.id === selectedDomainId);

  const levelColor =
    level === "ready"
      ? "var(--status-success-text)"
      : level === "almost"
        ? "var(--status-warning-text)"
        : "var(--text-muted)";

  const levelLabel =
    level === "ready" ? "Ready" : level === "almost" ? "Almost Ready" : "Incomplete";

  // Can advance from step 0 (domain)?
  const canAdvanceFromDomain = !!selectedDomainId && !!selectedCallerId;
  // Can advance from step 1 (goal)?
  const canAdvanceFromGoal = goalText.trim().length > 0;

  const handleNext = () => {
    if (currentStep === 0) {
      setData("domainId", selectedDomainId);
      setData("callerId", selectedCallerId);
      setData("domainName", selectedDomain?.name || "");
    } else if (currentStep === 1) {
      setData("goal", goalText.trim());
    }
    setStep(currentStep + 1);
  };

  const handlePrev = () => {
    // Save context before navigating back
    if (currentStep === 1) {
      setData("goal", goalText.trim());
    } else if (currentStep >= 1) {
      setData("domainId", selectedDomainId);
      setData("callerId", selectedCallerId);
    }
    setStep(currentStep - 1);
  };

  const handleStartLesson = () => {
    if (!selectedCallerId || !ready) return;
    const goal = goalText.trim();
    const url = goal
      ? `/x/sim/${selectedCallerId}?goal=${encodeURIComponent(goal)}`
      : `/x/sim/${selectedCallerId}`;
    endFlow();
    router.push(url);
  };

  // ── Shared styles ──
  const sectionStyle: React.CSSProperties = {
    padding: 24,
    borderRadius: 14,
    background: "var(--surface-primary)",
    border: "1px solid var(--border-default)",
    marginBottom: 20,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    marginBottom: 8,
  };

  const nextBtnStyle = (enabled: boolean): React.CSSProperties => ({
    padding: "12px 28px",
    borderRadius: 10,
    background: enabled ? "var(--accent-primary)" : "var(--border-default)",
    color: enabled ? "white" : "var(--text-muted)",
    border: "none",
    fontSize: 14,
    fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  });

  const backBtnStyle: React.CSSProperties = {
    padding: "12px 20px",
    borderRadius: 10,
    background: "transparent",
    border: "1px solid var(--border-default)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--text-secondary)",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  // ── Render ───────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 64px" }}>
      {/* ── Header ── */}
      <div
        style={{
          marginBottom: 32,
          textAlign: "center",
          padding: "32px 24px 28px",
          borderRadius: 20,
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, var(--surface-primary)), color-mix(in srgb, var(--accent-primary) 3%, var(--surface-primary)))",
          border: "1px solid color-mix(in srgb, var(--accent-primary) 12%, transparent)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 14,
            background:
              "linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))",
            marginBottom: 16,
            boxShadow:
              "0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)",
          }}
        >
          <span style={{ fontSize: 24, color: "white" }}>👨‍🏫</span>
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: 8,
            color: "var(--text-primary)",
            lineHeight: 1.1,
          }}
        >
          Teach
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 480,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {TEACH_STEPS[currentStep]?.label || `Prepare and launch a live ${terms.session.toLowerCase()}.`}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* STEP 0: Select Institution & Caller                */}
      {/* ═══════════════════════════════════════════════════ */}
      {currentStep === 0 && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>{terms.domain}</div>
          {loadingDomains ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              Loading {terms.domain.toLowerCase()}s...
            </div>
          ) : domainOptions.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              No {terms.domain.toLowerCase()}s found.{" "}
              <span
                style={{ color: "var(--accent-primary)", cursor: "pointer", fontWeight: 600 }}
                onClick={() => router.push("/x/quick-launch")}
              >
                Create one with Quick Launch
              </span>
            </div>
          ) : (
            <FancySelect
              value={selectedDomainId}
              onChange={setSelectedDomainId}
              options={domainOptions}
              placeholder={`Select an ${terms.domain.toLowerCase()}...`}
              searchable={domainOptions.length > 5}
            />
          )}

          {/* Caller selector */}
          {selectedDomainId && callerOptions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionLabelStyle}>
                {callerOptions.length > 1 ? `Test ${terms.caller}` : terms.caller}
              </div>
              {callerOptions.length === 1 ? (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "4px 0" }}>
                  {callerOptions[0].label}
                </div>
              ) : (
                <FancySelect
                  value={selectedCallerId}
                  onChange={setSelectedCallerId}
                  options={callerOptions}
                  placeholder={`Select a ${terms.caller.toLowerCase()}...`}
                  searchable={callerOptions.length > 5}
                />
              )}
            </div>
          )}

          {/* Zero-callers warning */}
          {selectedDomainId && !loadingDomains && callerOptions.length === 0 && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--status-warning-text) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--status-warning-text) 20%, transparent)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 4 }}>
                No learners found
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                This {terms.domain.toLowerCase()} has no {terms.caller.toLowerCase()}s yet.{" "}
                <span
                  style={{ color: "var(--accent-primary)", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => router.push(`/x/domains?selected=${selectedDomainId}`)}
                >
                  Add a learner on the {terms.domain} page
                </span>
              </div>
            </div>
          )}

          {/* Step navigation */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
            <button
              onClick={canAdvanceFromDomain ? handleNext : undefined}
              disabled={!canAdvanceFromDomain}
              style={nextBtnStyle(canAdvanceFromDomain)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* STEP 1: Set Your Goal                               */}
      {/* ═══════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>Session Goal</div>
          <textarea
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            placeholder={`What do you want to teach? e.g., Teach ${terms.caller.toLowerCase()} about fractions using real-world examples`}
            rows={3}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--text-primary)",
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
              fontFamily: "inherit",
              outline: "none",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              // Trigger AI suggestions on tab-out when text has content
              if (goalText.trim()) {
                fetchSuggestions(goalText.trim());
              }
            }}
          />

          {/* AI suggestions */}
          {(loadingSuggestions || suggestions.length > 0) && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Suggested goals
              </div>
              {loadingSuggestions ? (
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 32,
                        width: 120 + i * 20,
                        borderRadius: 16,
                        background: "var(--surface-secondary)",
                        animation: "pulse 1.5s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setGoalText(s)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 16,
                        background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
                        color: "var(--accent-primary)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "color-mix(in srgb, var(--accent-primary) 18%, transparent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "color-mix(in srgb, var(--accent-primary) 10%, transparent)";
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save as Goal button */}
          {goalText.trim() && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={handleSaveAsGoal}
                disabled={savingGoal}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px dashed var(--border-default)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: savingGoal ? "wait" : "pointer",
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <Plus size={14} />
                {savingGoal ? "Saving..." : "Save as Goal"}
              </button>
            </div>
          )}

          {/* ── Caller Goals (CRUD) ── */}
          {(callerGoals.length > 0 || loadingGoals) && (
            <div style={{ marginTop: 20, borderTop: "1px solid var(--border-default)", paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                {terms.caller}&apos;s Goals
              </div>
              {loadingGoals ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading goals...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {callerGoals.map((goal) => (
                    <div
                      key={goal.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: goalText === goal.name
                          ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)"
                          : "var(--surface-secondary)",
                        border: `1px solid ${goalText === goal.name ? "color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "var(--border-default)"}`,
                        cursor: editingGoalId === goal.id ? "default" : "pointer",
                        transition: "all 0.15s",
                      }}
                      onClick={() => {
                        if (editingGoalId !== goal.id) {
                          setGoalText(goal.name);
                        }
                      }}
                    >
                      {/* Type emoji */}
                      <span style={{ fontSize: 14, flexShrink: 0 }}>
                        {GOAL_TYPE_EMOJI[goal.type] || "🎯"}
                      </span>

                      {/* Name (inline edit or display) */}
                      {editingGoalId === goal.id ? (
                        <input
                          value={editGoalName}
                          onChange={(e) => setEditGoalName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateGoal(goal.id);
                            if (e.key === "Escape") {
                              setEditingGoalId(null);
                              setEditGoalName("");
                            }
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            flex: 1,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid var(--accent-primary)",
                            background: "var(--surface-primary)",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            fontFamily: "inherit",
                            outline: "none",
                          }}
                        />
                      ) : (
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {goal.name}
                        </span>
                      )}

                      {/* Progress bar */}
                      {goal.progress > 0 && editingGoalId !== goal.id && (
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border-default)", flexShrink: 0 }}>
                          <div style={{ width: `${goal.progress * 100}%`, height: "100%", borderRadius: 2, background: "var(--status-success-text)" }} />
                        </div>
                      )}

                      {/* Action buttons */}
                      {editingGoalId === goal.id ? (
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleUpdateGoal(goal.id)}
                            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--status-success-text)", display: "flex" }}
                            title="Save"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => { setEditingGoalId(null); setEditGoalName(""); }}
                            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditingGoalId(goal.id);
                              setEditGoalName(goal.name);
                            }}
                            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                            title="Edit goal"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--status-error-text)", display: "flex" }}
                            title="Delete goal"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button onClick={handlePrev} style={backBtnStyle}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={canAdvanceFromGoal ? handleNext : undefined}
              disabled={!canAdvanceFromGoal}
              style={nextBtnStyle(canAdvanceFromGoal)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* STEP 2: Readiness Checks                            */}
      {/* ═══════════════════════════════════════════════════ */}
      {currentStep === 2 && selectedDomainId && (
        <div
          style={{
            ...sectionStyle,
            border: `1px solid ${level === "ready" ? "var(--status-success-border)" : "var(--border-default)"}`,
            transition: "border-color 0.3s",
          }}
        >
          {/* Status badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={sectionLabelStyle}>Course Readiness</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: levelColor,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: `color-mix(in srgb, ${levelColor} 12%, transparent)`,
                }}
              >
                {levelLabel}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                {score}%
              </div>
            </div>
          </div>

          {/* Check items */}
          {checksLoading && checks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              Loading checks...
            </div>
          ) : checks.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
              No readiness checks configured.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {checks.map((check) => (
                <div
                  key={check.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: check.passed
                      ? "color-mix(in srgb, var(--status-success-bg) 50%, transparent)"
                      : "var(--surface-secondary)",
                    border: `1px solid ${check.passed ? "var(--status-success-border)" : "var(--border-default)"}`,
                    cursor: check.fixAction?.href ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  onClick={() => {
                    if (check.fixAction?.href) router.push(check.fixAction.href);
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                      background: check.passed
                        ? "var(--status-success-text)"
                        : check.severity === "critical"
                          ? "var(--status-error-text)"
                          : "var(--border-default)",
                      color: "white",
                    }}
                  >
                    {check.passed ? "✓" : check.severity === "critical" ? "!" : "•"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {check.name}
                      {check.severity === "critical" && !check.passed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--status-error-text)",
                            marginLeft: 6,
                          }}
                        >
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {check.detail}
                    </div>
                  </div>
                  {check.fixAction?.href && (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--accent-primary)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {check.fixAction.label} →
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button onClick={handlePrev} style={backBtnStyle}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={ready ? handleNext : undefined}
              disabled={!ready}
              style={nextBtnStyle(ready)}
              title={!ready ? "Complete required checks above first" : undefined}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* STEP 3: Launch                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div style={sectionStyle}>
          <WizardSummary
            title="Ready to Go!"
            subtitle={ready ? "All checks passed. Start your session." : `${levelLabel} — ${score}% readiness`}
            intent={{
              items: [
                { icon: <Building2 className="w-4 h-4" />, label: terms.domain, value: selectedDomain?.name || "—" },
                { icon: <User className="w-4 h-4" />, label: terms.caller, value: callers.find((c) => c.id === selectedCallerId)?.name || "—" },
                ...(goalText ? [{ icon: <Target className="w-4 h-4" />, label: "Goal", value: goalText }] : []),
              ],
            }}
            stats={[
              { label: "Readiness", value: `${score}%` },
            ]}
            primaryAction={{
              label: `Start ${terms.session}`,
              icon: <PlayCircle className="w-5 h-5" />,
              onClick: handleStartLesson,
              disabled: !ready || !selectedCallerId,
            }}
            secondaryActions={[
              ...(selectedDomainId ? [{ label: `View ${terms.domain}`, href: `/x/domains?selected=${selectedDomainId}` }] : []),
              ...(selectedCallerId ? [{ label: `View ${terms.caller}`, href: `/x/callers/${selectedCallerId}` }] : []),
            ]}
            onBack={handlePrev}
          />
        </div>
      )}

      {/* ── Quick actions (visible on all steps) ── */}
      {selectedDomainId && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              endFlow();
              router.push(`/x/domains?selected=${selectedDomainId}`);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border-default)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            View {terms.domain}
          </button>
          {selectedCallerId && (
            <button
              onClick={() => {
                endFlow();
                router.push(`/x/callers/${selectedCallerId}`);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--border-default)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              View {terms.caller}
            </button>
          )}
          <button
            onClick={() => {
              endFlow();
              router.push("/x/quick-launch");
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border-default)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            Quick Launch
          </button>
        </div>
      )}
    </div>
  );
}
