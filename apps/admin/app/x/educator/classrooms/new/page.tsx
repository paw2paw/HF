"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";
import { useStepFlow } from "@/contexts/StepFlowContext";
import { ProgressStepper } from "@/components/shared/ProgressStepper";
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
  // Steps are managed by StepFlowContext; FALLBACK_STEPS used as reference for labels
  const flowSteps = state?.steps || FALLBACK_STEPS;

  // Course picker state
  const [playbooks, setPlaybooks] = useState<PlaybookOption[]>([]);
  const [selectedPlaybooks, setSelectedPlaybooks] = useState<Set<string>>(new Set());
  const [loadingPlaybooks, setLoadingPlaybooks] = useState(false);

  // Initialize StepFlowContext (load steps from ORCHESTRATE spec with hardcoded fallback)
  useEffect(() => {
    if (flowInitialized.current) return;
    flowInitialized.current = true;

    const init = async () => {
      let stepsToUse = FALLBACK_STEPS;
      try {
        const res = await fetch("/api/wizard-steps?wizard=classroom");
        const data = await res.json();
        if (data.ok && data.steps?.length > 0) stepsToUse = data.steps;
      } catch {
        // Silent — fallback already set
      }

      if (!isActive || state?.flowId !== "create-classroom") {
        startFlow({
          flowId: "create-classroom",
          steps: stepsToUse.map((s) => ({ id: s.id, label: s.label, activeLabel: s.activeLabel })),
          returnPath: "/x/educator/classrooms/new",
        });
      } else {
        // Restore from context on re-entry (page refresh)
        const savedName = flowGetData<string>("name");
        const savedDesc = flowGetData<string>("description");
        const savedDomainId = flowGetData<string>("domainId");
        if (savedName) setName(savedName);
        if (savedDesc) setDescription(savedDesc);
        if (savedDomainId) setDomainId(savedDomainId);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        setCreated({
          id: res.classroom.id,
          joinToken: res.classroom.joinToken,
        });
        flowSetStep(3);
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

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: 15, color: "var(--text-muted)" }}>Loading...</div>
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
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
              Loading courses...
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
              onClick={() => flowSetStep(0)}
              className="hf-btn hf-btn-secondary flex-1"
            >
              Back
            </button>
            <button
              onClick={() => flowSetStep(2)}
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

          {error && (
            <div className="hf-banner hf-banner-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

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
                  background: copiedLink ? "var(--status-success-text)" : undefined,
                }}
              >
                {copiedLink ? "Copied!" : "Copy Link"}
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
                background: copiedMessage ? "var(--status-success-text)" : undefined,
                color: copiedMessage ? "white" : undefined,
                border: copiedMessage ? "none" : undefined,
              }}
            >
              {copiedMessage ? "Copied!" : "Copy Message"}
            </button>
          </div>
        </WizardSummary>
      )}
    </div>
  );
}
