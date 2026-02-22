"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";
import { useStepFlow } from "@/contexts/StepFlowContext";
import { ProgressStepper } from "@/components/shared/ProgressStepper";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useWizardResume } from "@/hooks/useWizardResume";
import { WizardResumeBanner } from "@/components/shared/WizardResumeBanner";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { WizardSummary } from "@/components/shared/WizardSummary";
import { Building2, Users, BookOpen, ExternalLink } from "lucide-react";

interface Domain {
  id: string;
  name: string;
  slug: string;
}

interface PlaybookOption {
  id: string;
  name: string;
  description: string | null;
}

interface WizardStep {
  id: string;
  label: string;
  activeLabel: string;
  order: number;
  skippable: boolean;
  description?: string;
}

const FALLBACK_STEPS: WizardStep[] = [
  { id: "name-focus", label: "Name & Focus", activeLabel: "Setting Name & Learning Focus", order: 1, skippable: false },
  { id: "courses", label: "Courses", activeLabel: "Selecting Courses", order: 2, skippable: true },
  { id: "review", label: "Review", activeLabel: "Reviewing Classroom", order: 3, skippable: false },
  { id: "invite", label: "Invite", activeLabel: "Inviting Students", order: 4, skippable: false },
];

async function fetchApi(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    try {
      return await res.json();
    } catch {
      return { ok: false, error: `Server error (${res.status})` };
    }
  }
  return res.json();
}

export default function NewClassroomPage() {
  const router = useRouter();
  const { terms, plural, lower, lowerPlural } = useTerminology();
  const { state, isActive, startFlow, setStep: flowSetStep, setData: flowSetData, getData: flowGetData, endFlow } = useStepFlow();
  const flowInitialized = useRef(false);
  const { pendingTask, isLoading: resumeLoading } = useWizardResume("classroom_setup");

  // Derive 1-indexed step from context (0-indexed) for UI compatibility
  const step = (state?.currentStep ?? 0) + 1;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainId, setDomainId] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    joinToken: string;
  } | null>(null);
  const [error, setError] = useState("");

  // Warn on browser refresh/close when user has started filling in data
  useUnsavedGuard(name.trim().length > 0 && !created);
  // Steps are managed by StepFlowContext; FALLBACK_STEPS used as reference for labels
  const flowSteps = state?.steps || FALLBACK_STEPS;

  // Course picker state
  const [playbooks, setPlaybooks] = useState<PlaybookOption[]>([]);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<Set<string>>(new Set());
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);

  const loadClassroomSteps = async () => {
    try {
      const res = await fetch("/api/wizard-steps?wizard=classroom");
      const data = await res.json();
      if (data.ok && data.steps?.length > 0) return data.steps;
    } catch {
      // Silent — fallback already set
    }
    return FALLBACK_STEPS;
  };

  const startFreshFlow = async () => {
    const stepsToUse = await loadClassroomSteps();

    // Create a UserTask for DB-backed wizard persistence
    let taskId: string | undefined;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: "classroom_setup", currentStep: 0, context: { _wizardStep: 0 } }),
      });
      const data = await res.json();
      if (data.ok) taskId = data.taskId;
    } catch {
      // Continue without DB persistence — sessionStorage still works
    }

    startFlow({
      flowId: "create-classroom",
      steps: stepsToUse.map((s: WizardStep) => ({ id: s.id, label: s.label, activeLabel: s.activeLabel })),
      returnPath: "/x/educator/classrooms/new",
      taskType: "classroom_setup",
      taskId,
    });
  };

  const handleResume = async () => {
    if (!pendingTask) return;
    const stepsToUse = await loadClassroomSteps();
    const ctx = pendingTask.context || {};

    startFlow({
      flowId: "create-classroom",
      steps: stepsToUse.map((s: WizardStep) => ({ id: s.id, label: s.label, activeLabel: s.activeLabel })),
      returnPath: "/x/educator/classrooms/new",
      taskType: "classroom_setup",
      taskId: pendingTask.id,
      initialData: ctx,
      initialStep: ctx._wizardStep ?? 0,
    });

    // Hydrate local state from resumed context
    if (ctx.name) setName(ctx.name);
    if (ctx.description) setDescription(ctx.description);
    if (ctx.domainId) setDomainId(ctx.domainId);
    if (ctx.created) setCreated(ctx.created);
    if (ctx.selectedPlaybooks) setSelectedPlaybooks(new Set(ctx.selectedPlaybooks));
  };

  const handleDiscardResume = async () => {
    if (pendingTask) {
      try {
        await fetch(`/api/tasks?taskId=${pendingTask.id}`, { method: "DELETE" });
      } catch { /* ignore */ }
    }
    await startFreshFlow();
  };

  // Initialize StepFlowContext (load steps from ORCHESTRATE spec with hardcoded fallback)
  useEffect(() => {
    if (flowInitialized.current) return;
    // Don't auto-start if resume detection is still loading or a pending task exists
    if (resumeLoading || pendingTask) return;
    flowInitialized.current = true;

    if (isActive && state?.flowId === "create-classroom") {
      // Restore local state from context on re-entry (page refresh with sessionStorage intact)
      const savedName = flowGetData<string>("name");
      const savedDesc = flowGetData<string>("description");
      const savedDomainId = flowGetData<string>("domainId");
      const savedCreated = flowGetData<{ id: string; joinToken: string }>("created");
      const savedPlaybooks = flowGetData<string[]>("selectedPlaybooks");
      if (savedName) setName(savedName);
      if (savedDesc) setDescription(savedDesc);
      if (savedDomainId) setDomainId(savedDomainId);
      if (savedCreated) setCreated(savedCreated);
      if (savedPlaybooks) setSelectedPlaybooks(new Set(savedPlaybooks));
    } else {
      // No active flow, no pending resume — start fresh
      startFreshFlow();
    }
  }, [resumeLoading, pendingTask]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchApi("/api/domains")
      .then((res: { ok: boolean; domains?: Domain[] }) => {
        if (res?.ok && res.domains) {
          setDomains(res.domains);
          if (res.domains.length === 1) {
            setDomainId(res.domains[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Load playbooks when domain changes
  useEffect(() => {
    if (!domainId) {
      setPlaybooks([]);
      setSelectedPlaybooks(new Set());
      return;
    }
    setLoadingPlaybooks(true);
    fetchApi(`/api/educator/playbooks?domainId=${domainId}`)
      .then((res: { ok: boolean; playbooks?: PlaybookOption[] }) => {
        if (res?.ok && res.playbooks) {
          setPlaybooks(res.playbooks);
          // Pre-select all
          setSelectedPlaybooks(new Set(res.playbooks.map((p) => p.id)));
        }
      })
      .finally(() => setLoadingPlaybooks(false));
  }, [domainId]);

  const handleCreate = async () => {
    setCreating(true);
    setError("");

    try {
      const res = await fetchApi("/api/educator/classrooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          domainId,
          playbookIds: [...selectedPlaybooks],
        }),
      });

      if (res?.ok) {
        sessionStorage.removeItem("classroom-draft"); // clean up legacy
        const createdData = { id: res.classroom.id, joinToken: res.classroom.joinToken };
        setCreated(createdData);
        flowSetData("created", createdData);
        const inviteIdx = state?.steps.findIndex(s => s.id === "invite") ?? 3;
        flowSetStep(inviteIdx >= 0 ? inviteIdx : 3);
      } else {
        setError(res?.error ?? `Failed to create ${lower("cohort")}`);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setCreating(false);
    }
  };

  const joinUrl = created?.joinToken
    ? `${window.location.origin}/join/${created.joinToken}`
    : "";

  const selectedDomain = domains.find((d) => d.id === domainId);

  const inviteMessage = `You're invited to join ${name}${selectedDomain ? ` (${selectedDomain.name})` : ""}!\n\nJoin here: ${joinUrl}`;

  const { copiedKey, copy: copyText } = useCopyToClipboard();

  const copyLink = () => copyText(joinUrl, "link");
  const copyMessage = () => copyText(inviteMessage, "message");

  // Show resume banner if there's an unfinished wizard task and flow isn't active
  const showWizard = isActive && state?.flowId === "create-classroom";
  if (!showWizard && !resumeLoading && pendingTask) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 64 }}>
        <WizardResumeBanner
          task={pendingTask}
          onResume={handleResume}
          onDiscard={handleDiscardResume}
          label="Classroom Setup"
        />
      </div>
    );
  }

  if (loading || resumeLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <div className="hf-spinner" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1 className="hf-page-title flex items-center gap-2" style={{ marginBottom: 8 }}>
        Create {terms.cohort}
        <span className="hf-gf-badge">GF</span>
      </h1>
      <p className="hf-page-subtitle" style={{ marginBottom: 32 }}>
        Set up a new {lower("cohort")} for your {lowerPlural("caller")}.
      </p>

      {/* Step indicators */}
      <ProgressStepper
        steps={(state?.steps || FALLBACK_STEPS).map((s, i) => ({
          label: s.label,
          completed: i < (state?.currentStep ?? 0),
          active: i === (state?.currentStep ?? 0),
          onClick: i < (state?.currentStep ?? 0) ? () => flowSetStep(i) : undefined,
        }))}
      />

      {/* Step 1: Name & Focus */}
      {step === 1 && (
        <div className="hf-card">
          <h2 className="hf-section-title" style={{ marginBottom: 20 }}>
            {flowSteps[0]?.label ?? "Name & Focus"}
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label className="hf-label">{terms.cohort} Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Year 10 English, Tuesday Coaching Group"
              className="hf-input"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="hf-label">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`A short note about this ${lower("cohort")}...`}
              rows={3}
              className="hf-input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="hf-label">Learning Focus *</label>
            {domains.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                No institutions available.{" "}
                <span
                  style={{ color: "var(--accent-primary)", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => router.push("/x/quick-launch")}
                >
                  Create one with Quick Launch
                </span>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {domains.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDomainId(d.id)}
                    className={`hf-chip${domainId === d.id ? " hf-chip-selected" : ""}`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { endFlow(); router.push("/x/educator/classrooms"); }}
              className="hf-btn hf-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              disabled={!name.trim() || !domainId}
              onClick={() => {
                flowSetData("name", name);
                flowSetData("description", description);
                flowSetData("domainId", domainId);
                flowSetStep(1);
              }}
              className="hf-btn hf-btn-primary"
              style={{ flex: 2 }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Courses */}
      {step === 2 && (
        <div className="hf-card">
          <h2 className="hf-section-title" style={{ marginBottom: 8 }}>
            {flowSteps[1]?.label ?? "Courses"}
          </h2>
          <p className="hf-hint" style={{ marginBottom: 20 }}>
            Select which courses to include in this {lower("cohort")}. All are selected by default.
          </p>

          {loadingPlaybooks ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
              <div className="hf-spinner" />
            </div>
          ) : playbooks.length === 0 ? (
            <div className="hf-banner hf-banner-info" style={{ marginBottom: 20, textAlign: "center" }}>
              No published courses for this domain. Your {lowerPlural("caller")} can still join — courses can be added later.
            </div>
          ) : (
            <div className="flex flex-col gap-2" style={{ marginBottom: 20 }}>
              {playbooks.map((pb) => {
                const isSelected = selectedPlaybooks.has(pb.id);
                return (
                  <button
                    key={pb.id}
                    onClick={() => {
                      setSelectedPlaybooks((prev) => {
                        const next = new Set(prev);
                        if (next.has(pb.id)) next.delete(pb.id);
                        else next.add(pb.id);
                        return next;
                      });
                    }}
                    className={`hf-chip${isSelected ? " hf-chip-selected" : ""} flex items-start gap-3 text-left w-full`}
                    style={{ padding: 12, borderRadius: 8 }}
                  >
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 20, height: 20, borderRadius: 4, marginTop: 2,
                        border: `2px solid ${isSelected ? "var(--accent-primary)" : "var(--border-default)"}`,
                        background: isSelected ? "var(--accent-primary)" : "transparent",
                      }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                        {pb.name}
                      </div>
                      {pb.description && (
                        <div className="hf-hint" style={{ marginTop: 2 }}>
                          {pb.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                flowSetData("selectedPlaybooks", [...selectedPlaybooks]);
                flowSetStep(0);
              }}
              className="hf-btn hf-btn-secondary flex-1"
            >
              Back
            </button>
            <button
              onClick={() => {
                flowSetData("selectedPlaybooks", [...selectedPlaybooks]);
                flowSetStep(2);
              }}
              className="hf-btn hf-btn-primary"
              style={{ flex: 2 }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <div className="hf-card">
          <h2 className="hf-section-title" style={{ marginBottom: 20 }}>
            {flowSteps[2]?.label ?? "Review"}
          </h2>

          <div
            style={{
              padding: 16,
              background: "var(--surface-secondary)",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              {name}
            </div>
            {description && (
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
                {description}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  padding: "4px 10px",
                  background: "var(--surface-primary)",
                  borderRadius: 6,
                  display: "inline-block",
                }}
              >
                {selectedDomain?.name}
              </div>
              {selectedPlaybooks.size > 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    padding: "4px 10px",
                    background: "var(--surface-primary)",
                    borderRadius: 6,
                    display: "inline-block",
                  }}
                >
                  {selectedPlaybooks.size} course{selectedPlaybooks.size !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>

          <ErrorBanner error={error} style={{ marginBottom: 16 }} />

          <div className="flex gap-3">
            <button
              onClick={() => flowSetStep(1)}
              className="hf-btn hf-btn-secondary flex-1"
            >
              Back
            </button>
            <button
              disabled={creating}
              onClick={handleCreate}
              className="hf-btn hf-btn-primary"
              style={{ flex: 2 }}
            >
              {creating ? "Creating..." : `Create ${terms.cohort}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Invite */}
      {step === 4 && created && (
        <WizardSummary
          title={`${terms.cohort} Created!`}
          subtitle={`Invite your ${lowerPlural("caller")} to join.`}
          intent={{
            items: [
              { icon: <Users className="w-4 h-4" />, label: terms.cohort, value: name || "—" },
              ...(selectedDomain ? [{ icon: <Building2 className="w-4 h-4" />, label: terms.domain, value: selectedDomain.name }] : []),
              ...(selectedPlaybooks.size > 0 ? [{ icon: <BookOpen className="w-4 h-4" />, label: "Courses", value: `${selectedPlaybooks.size} selected` }] : []),
            ],
          }}
          created={{
            entities: [
              {
                icon: <Users className="w-5 h-5" />,
                label: terms.cohort,
                name: name || "—",
                detail: `${selectedPlaybooks.size} course${selectedPlaybooks.size !== 1 ? "s" : ""}`,
                href: `/x/educator/classrooms/${created.id}`,
              },
              ...(selectedDomain ? [{
                icon: <Building2 className="w-5 h-5" />,
                label: terms.domain,
                name: selectedDomain.name,
                href: `/x/domains?id=${selectedDomain.id}`,
              }] : []),
            ],
          }}
          primaryAction={{
            label: `Go to ${terms.cohort}`,
            href: `/x/educator/classrooms/${created.id}`,
            onClick: endFlow,
          }}
          secondaryActions={[
            {
              label: "Create Another",
              onClick: () => {
                setName("");
                setDescription("");
                setDomainId(domains.length === 1 ? domains[0].id : "");
                setCreated(null);
                setSelectedPlaybooks(new Set());
                // Clear stale bag data so the new flow starts fresh
                flowSetData("name", undefined);
                flowSetData("description", undefined);
                flowSetData("domainId", undefined);
                flowSetData("created", undefined);
                flowSetData("selectedPlaybooks", undefined);
                flowSetStep(0);
              },
            },
          ]}
        >
          {/* Join Link */}
          <div className="wiz-section">
            <div className="wiz-section-label">Join Link</div>
            <div style={{
              display: "flex", gap: 8, padding: "10px 12px",
              background: "var(--surface-secondary)", borderRadius: 8, alignItems: "center",
            }}>
              <input
                type="text"
                readOnly
                value={joinUrl}
                className="hf-input"
                style={{ flex: 1, border: "none", background: "transparent" }}
              />
              <button
                onClick={copyLink}
                className="wiz-action-primary"
                style={{
                  padding: "6px 14px", fontSize: 12, whiteSpace: "nowrap",
                  background: copiedKey === "link" ? "var(--status-success-text)" : undefined,
                }}
              >
                {copiedKey === "link" ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Invite Message */}
          <div className="wiz-section">
            <div className="wiz-section-label">Invite Message</div>
            <div style={{
              padding: 12, background: "var(--surface-secondary)", borderRadius: 8, marginBottom: 8,
            }}>
              <pre style={{
                fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap",
                wordBreak: "break-word", margin: 0, fontFamily: "inherit",
              }}>
                {inviteMessage}
              </pre>
            </div>
            <button
              onClick={copyMessage}
              className="wiz-action-secondary"
              style={{
                background: copiedKey === "message" ? "var(--status-success-text)" : undefined,
                color: copiedKey === "message" ? "white" : undefined,
                border: copiedKey === "message" ? "none" : undefined,
              }}
            >
              {copiedKey === "message" ? "Copied!" : "Copy Message"}
            </button>
          </div>
        </WizardSummary>
      )}
    </div>
  );
}
