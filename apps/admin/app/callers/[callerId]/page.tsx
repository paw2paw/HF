"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { VerticalSlider, SliderGroup } from "@/components/shared/VerticalSlider";
import { Sparkline } from "@/components/shared/Sparkline";

// Types
type Domain = {
  id: string;
  slug: string;
  name: string;
};

type CallerProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  externalId: string | null;
  createdAt: string;
  domainId: string | null;
  domain: Domain | null;
};

type PersonalityProfile = {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  confidenceScore: number | null;
  lastAggregatedAt: string | null;
  observationsUsed: number;
  preferredTone: string | null;
  preferredLength: string | null;
  technicalLevel: string | null;
};

type PersonalityObservation = {
  id: string;
  callId: string;
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  confidence: number | null;
  observedAt: string;
};

type Memory = {
  id: string;
  category: string;
  key: string;
  value: string;
  evidence: string | null;
  confidence: number;
  extractedAt: string;
  expiresAt: string | null;
};

type MemorySummary = {
  factCount: number;
  preferenceCount: number;
  eventCount: number;
  topicCount: number;
  keyFacts: { key: string; value: string; confidence: number }[];
  preferences: Record<string, string>;
  topTopics: { topic: string }[];
};

type Call = {
  id: string;
  source: string;
  externalId: string | null;
  transcript: string;
  createdAt: string;
  callSequence?: number | null;
  // Analysis status
  hasScores?: boolean;
  hasMemories?: boolean;
  hasBehaviorMeasurements?: boolean;
  hasRewardScore?: boolean;
};

type CallerIdentity = {
  id: string;
  name: string | null;
  externalId: string | null;
  nextPrompt: string | null;
  nextPromptComposedAt: string | null;
  nextPromptInputs: Record<string, any> | null;
  segmentId: string | null;
  segment: { name: string } | null;
};

type CallScore = {
  id: string;
  callId: string;
  parameterId: string;
  score: number;
  confidence: number;
  evidence: string[] | null;
  reasoning: string | null;
  scoredBy: string | null;
  scoredAt: string;
  analysisSpecId: string | null;
  createdAt: string;
  parameter: { name: string; definition: string | null };
  analysisSpec: { id: string; slug: string; name: string; outputType: string } | null;
  call: { createdAt: string };
};

type CurriculumModule = {
  id: string;
  name: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  mastery: number;
  sequence: number;
};

type CurriculumProgress = {
  name: string | null;
  hasData: boolean;
  modules: CurriculumModule[];
  nextModule: string | null;
  totalModules: number;
  completedCount: number;
  estimatedProgress: number;
};

type LearnerProfile = {
  learningStyle: string | null;
  pacePreference: string | null;
  interactionStyle: string | null;
  priorKnowledge: Record<string, string>;
  preferredModality: string | null;
  questionFrequency: string | null;
  sessionLength: string | null;
  feedbackStyle: string | null;
  lastUpdated: string | null;
};

type Goal = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  status: string;
  priority: number;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  targetDate: string | null;
  playbook: {
    id: string;
    name: string;
    version: string;
  } | null;
  contentSpec: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

type CallerData = {
  caller: CallerProfile;
  personality: PersonalityProfile | null;
  observations: PersonalityObservation[];
  memories: Memory[];
  memorySummary: MemorySummary | null;
  calls: Call[];
  identities: CallerIdentity[];
  scores: CallScore[];
  callerTargets?: any[];
  curriculum?: CurriculumProgress | null;
  learnerProfile?: LearnerProfile | null;
  goals?: Goal[];
  counts: {
    calls: number;
    memories: number;
    observations: number;
    prompts: number;
    targets: number;
    measurements: number;
    curriculumModules?: number;
    curriculumCompleted?: number;
    goals?: number;
    activeGoals?: number;
  };
};

// Memory category colors - matches MEMORY_CATEGORY_META in lib/constants.ts
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  FACT: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)" },
  PREFERENCE: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)" },
  EVENT: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)" },
  TOPIC: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-text)" },
  RELATIONSHIP: { bg: "var(--badge-pink-bg)", text: "var(--badge-pink-text)" },
  CONTEXT: { bg: "var(--surface-secondary)", text: "var(--text-secondary)" },
};

const TRAIT_INFO = {
  openness: { label: "Openness", color: "var(--trait-openness)", desc: "Curiosity, creativity, openness to new experiences" },
  conscientiousness: { label: "Conscientiousness", color: "var(--trait-conscientiousness)", desc: "Organization, dependability, self-discipline" },
  extraversion: { label: "Extraversion", color: "var(--trait-extraversion)", desc: "Sociability, assertiveness, positive emotions" },
  agreeableness: { label: "Agreeableness", color: "var(--trait-agreeableness)", desc: "Cooperation, trust, helpfulness" },
  neuroticism: { label: "Neuroticism", color: "var(--trait-neuroticism)", desc: "Emotional instability, anxiety, moodiness" },
};

type SectionId = "calls" | "transcripts" | "memories" | "personality" | "scores" | "learning" | "agent-behavior" | "prompt" | "ai-call" | "slugs";

type ComposedPrompt = {
  id: string;
  prompt: string;
  llmPrompt: Record<string, any> | null;  // LLM-friendly structured JSON version
  triggerType: string;
  triggerCallId: string | null;
  model: string | null;
  status: string;
  composedAt: string;
  inputs: Record<string, any> | null;
  triggerCall?: { id: string; createdAt: string; source: string } | null;
};

export default function CallerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const callerId = params.callerId as string;

  // Detect if we're in /x/ area and adjust back link accordingly
  const isInXArea = pathname?.startsWith('/x/');
  const backLink = isInXArea ? '/x/callers' : '/callers';

  const [data, setData] = useState<CallerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  // Expanded states
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  // Prompts state
  const [composedPrompts, setComposedPrompts] = useState<ComposedPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [promptProgress, setPromptProgress] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  // Domain editing state
  const [domains, setDomains] = useState<Domain[]>([]);
  const [editingDomain, setEditingDomain] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);

  // Fetch prompts when switching to prompts tab
  const fetchPrompts = useCallback(async () => {
    if (!callerId) return;
    setPromptsLoading(true);
    try {
      const res = await fetch(`/api/callers/${callerId}/compose-prompt?limit=3`);
      const result = await res.json();
      if (result.ok) {
        setComposedPrompts(result.prompts);
      }
    } catch (err) {
      console.error("Error fetching prompts:", err);
    } finally {
      setPromptsLoading(false);
    }
  }, [callerId]);

  // Compose a new prompt (single)
  const handleComposePrompt = async () => {
    if (!callerId || composing) return;
    setComposing(true);
    try {
      const res = await fetch(`/api/callers/${callerId}/compose-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });
      const result = await res.json();
      if (result.ok) {
        // Refresh prompts list
        await fetchPrompts();
        // Expand the new prompt
        setExpandedPrompt(result.prompt.id);
      } else {
        alert("Failed to compose prompt: " + result.error);
      }
    } catch (err: any) {
      alert("Error composing prompt: " + err.message);
    } finally {
      setComposing(false);
    }
  };

  // Process ALL calls oldest-first, generating prompts for each
  const handlePromptAll = async () => {
    if (!callerId || !data || composing) return;

    // Get all calls sorted oldest first
    const calls = data.calls || [];
    if (calls.length === 0) {
      alert("No calls to process");
      return;
    }

    const sortedCalls = [...calls].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // Count how many calls already have prompts
    const existingCount = sortedCalls.filter(call =>
      composedPrompts.some(p => p.triggerCallId === call.id)
    ).length;

    // Ask user with 3 options
    const choice = window.prompt(
      `Process ${sortedCalls.length} call(s) oldest-first.\n` +
      (existingCount > 0 ? `(${existingCount} already have prompts)\n\n` : "\n") +
      `Enter your choice:\n` +
      `  1 = Prompt ALL (replace existing)\n` +
      `  2 = Skip Existing\n` +
      `  3 = Cancel`,
      existingCount > 0 ? "2" : "1"
    );

    if (!choice || choice === "3") {
      return; // Cancelled
    }

    const replaceExisting = choice === "1";

    setComposing(true);
    setPromptProgress(`0/${sortedCalls.length}`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const call of sortedCalls) {
      // Check if this call already has a prompt (via ComposedPrompt with triggerCallId)
      const hasPrompt = composedPrompts.some(p => p.triggerCallId === call.id);

      if (hasPrompt && !replaceExisting) {
        skipped++;
        processed++;
        setPromptProgress(`${processed}/${sortedCalls.length} (${skipped} skipped)`);
        continue;
      }

      try {
        // Run the pipeline with mode="prompt" for this call
        const res = await fetch(`/api/calls/${call.id}/pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callerId,
            mode: "prompt",
            engine: "openai", // or could use a preference
          }),
        });
        const result = await res.json();
        if (!result.ok) {
          console.error(`Pipeline failed for call ${call.id}:`, result.error);
          errors++;
        }
      } catch (err: any) {
        console.error(`Error processing call ${call.id}:`, err);
        errors++;
      }

      processed++;
      setPromptProgress(`${processed}/${sortedCalls.length}${errors > 0 ? ` (${errors} errors)` : ""}`);
    }

    // Refresh prompts list
    await fetchPrompts();
    setComposing(false);
    setPromptProgress("");

    // Show summary
    alert(
      `Prompt ALL complete!\n\n` +
      `Processed: ${processed} calls\n` +
      `Skipped: ${skipped}\n` +
      `Errors: ${errors}`
    );
  };

  useEffect(() => {
    if (!callerId) return;

    // Fetch caller data
    fetch(`/api/callers/${callerId}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          setData(result);
        } else {
          setError(result.error || "Failed to load caller");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    // Fetch domains for dropdown
    fetch("/api/domains")
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          setDomains(result.domains || []);
        }
      })
      .catch(() => {});
  }, [callerId]);

  // Update caller domain
  const handleDomainChange = async (domainId: string | null) => {
    if (!data) return;
    setSavingDomain(true);
    try {
      const res = await fetch(`/api/callers/${callerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const result = await res.json();
      if (result.ok) {
        setData({
          ...data,
          caller: result.caller,
        });
        setEditingDomain(false);
      } else {
        alert("Failed to update domain: " + result.error);
      }
    } catch (err: any) {
      alert("Error updating domain: " + err.message);
    } finally {
      setSavingDomain(false);
    }
  };

  // Fetch prompts when switching to prompt tab
  useEffect(() => {
    if (activeSection === "prompt" && composedPrompts.length === 0) {
      fetchPrompts();
    }
  }, [activeSection, fetchPrompts, composedPrompts.length]);

  const getCallerLabel = (caller: CallerProfile | undefined) => {
    if (!caller) return "Unknown";
    return caller.name || caller.email || caller.phone || caller.externalId || "Unknown";
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading caller profile...</div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ padding: 20, background: "var(--status-error-bg)", color: "var(--status-error-text)", borderRadius: 8 }}>
          {error || "Caller not found"}
        </div>
        <Link href={backLink} style={{ display: "inline-block", marginTop: 16, color: "var(--button-primary-bg)" }}>
          ← Back to Callers
        </Link>
      </div>
    );
  }

  // Sections organized into logical groups:
  // - History: call recordings and transcripts
  // - Caller: who they are (personality, memories)
  // - Shared: variables for both agent and caller (slugs, scores)
  // - Behaviour: targets, measurements, prompt
  // - Action: make a call
  const sections: { id: SectionId; label: string; icon: string; count?: number; special?: boolean; group: "history" | "caller" | "shared" | "agent" | "action" }[] = [
    // History
    { id: "calls", label: "Calls", icon: "📞", count: data.counts.calls, group: "history" },
    // Caller group
    { id: "memories", label: "Mem", icon: "💭", count: data.counts.memories, group: "caller" },
    { id: "personality", label: "Person", icon: "🧠", count: data.counts.observations, group: "caller" },
    { id: "learning", label: "Goals", icon: "🎯", count: data.counts.activeGoals || 0, group: "caller" },
    // Shared group - data for both caller and agent
    { id: "slugs", label: "Slugs", icon: "🏷️", group: "shared" },
    { id: "scores", label: "Scores", icon: "📈", count: new Set(data.scores?.map((s: any) => s.parameterId)).size || 0, group: "shared" },
    // Behaviour-specific group (includes targets + measurements)
    { id: "agent-behavior", label: "Behaviour", icon: "🤖", count: (data.counts.targets || 0) + (data.counts.measurements || 0), group: "agent" },
    { id: "prompt", label: "Prompt", icon: "📝", count: data.counts.prompts, group: "agent" },
    // Action group
    { id: "ai-call", label: "Call", icon: "📞", special: true, group: "action" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 16px 24px", flexShrink: 0 }}>
        <Link href={backLink} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Back to Callers
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            👤
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{getCallerLabel(data.caller)}</h1>
              {/* Domain Badge */}
              {editingDomain ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
                    value={data.caller.domainId || ""}
                    onChange={(e) => handleDomainChange(e.target.value || null)}
                    disabled={savingDomain}
                    style={{
                      padding: "4px 8px",
                      fontSize: 12,
                      border: "1px solid var(--border-default)",
                      borderRadius: 4,
                      background: "var(--surface-primary)",
                    }}
                  >
                    <option value="">No Domain</option>
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setEditingDomain(false)}
                    style={{
                      padding: "2px 6px",
                      fontSize: 11,
                      background: "var(--surface-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingDomain(true)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 500,
                    background: data.caller.domain ? "var(--badge-blue-bg)" : "var(--surface-secondary)",
                    color: data.caller.domain ? "var(--badge-blue-text)" : "var(--text-muted)",
                    border: "1px solid transparent",
                    borderRadius: 4,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Click to change domain"
                >
                  {data.caller.domain ? data.caller.domain.name : "No Domain"}
                  <span style={{ fontSize: 10 }}>✎</span>
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
              {data.caller.phone && (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>📱 {data.caller.phone}</span>
              )}
              {data.caller.email && (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>✉️ {data.caller.email}</span>
              )}
              {data.caller.externalId && (
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-placeholder)" }}>
                  ID: {data.caller.externalId}
                </span>
              )}
              {/* Compact Personality Profile */}
              {data.personality && (
                <div style={{ display: "flex", gap: 6, marginLeft: 8, padding: "4px 8px", background: "var(--surface-secondary)", borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>🧠</span>
                  {Object.entries(TRAIT_INFO).map(([key, info]) => {
                    const value = data.personality?.[key as keyof typeof TRAIT_INFO] as number | null;
                    if (value === null) return null;
                    const level = value >= 0.7 ? "HIGH" : value <= 0.3 ? "LOW" : "MED";
                    const levelColor = level === "HIGH" ? "var(--status-success-text)" : level === "LOW" ? "var(--status-error-text)" : "var(--text-muted)";
                    return (
                      <span
                        key={key}
                        title={`${info.label}: ${(value * 100).toFixed(0)}%`}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: levelColor,
                          padding: "1px 4px",
                          background: level === "HIGH" ? "var(--status-success-bg)" : level === "LOW" ? "var(--status-error-bg)" : "var(--border-default)",
                          borderRadius: 3,
                        }}
                      >
                        {info.label.charAt(0)}{(value * 100).toFixed(0)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Analyze Button - runs analysis to extract personality & memories */}
          <button
            onClick={async (e) => {
              if (!confirm("Run analysis on this caller's calls to extract personality traits and memories?\n\nThis will:\n• Extract personality traits (Big 5)\n• Extract memories from conversations\n• Update caller profile")) return;

              const btn = e.currentTarget;
              const originalText = btn.textContent;

              try {
                btn.disabled = true;
                btn.textContent = "Analyzing...";

                // Get all calls for this caller
                const callsRes = await fetch(`/api/calls?callerId=${callerId}`);
                const callsData = await callsRes.json();

                if (!callsData.ok || !callsData.calls?.length) {
                  alert("No calls found for this caller");
                  return;
                }

                // Analyze each call
                let analyzed = 0;
                for (const call of callsData.calls) {
                  btn.textContent = `Analyzing ${++analyzed}/${callsData.calls.length}...`;

                  await fetch(`/api/analysis/run`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      transcript: call.transcript,
                      callId: call.id,
                      callerId: callerId,
                      outputTypes: ["MEASURE", "LEARN"],
                      storeResults: true
                    })
                  });
                }

                alert(`✅ Analysis complete!\n\nAnalyzed ${analyzed} call(s)\nRefreshing page to show results...`);
                window.location.reload();
              } catch (err: any) {
                alert(`❌ Error: ${err.message}`);
                btn.disabled = false;
                btn.textContent = originalText || "🧠 Analyze";
              }
            }}
            title="Run personality & memory analysis on this caller's calls"
            style={{
              padding: "10px 20px",
              background: "var(--button-success-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🧠 Analyze
          </button>

          {/* Prompt ALL Button - processes all calls oldest-first */}
          <button
            onClick={handlePromptAll}
            disabled={composing}
            title="Generate prompts for all calls without prompts (oldest first)"
            style={{
              padding: "10px 20px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: composing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {composing ? `Prompting... ${promptProgress}` : "Prompt ALL"}
          </button>
        </div>
      </div>

      {/* Section Tabs - Grouped: History | Caller | Agent | Action */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border-default)", paddingBottom: 0, flexWrap: "nowrap", overflowX: "auto", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-primary)", zIndex: 10, padding: "8px 24px 0 24px", marginLeft: -24, marginRight: -24, flexShrink: 0 }}>
        {sections.map((section, index) => {
          const isActive = activeSection === section.id;
          const isSpecial = section.special;
          const prevSection = index > 0 ? sections[index - 1] : null;
          const showGroupSeparator = prevSection && prevSection.group !== section.group;

          // Special styling for the Call tab (green background)
          const specialStyles = isSpecial ? {
            background: isActive ? "var(--button-success-bg)" : "var(--status-success-bg)",
            color: isActive ? "var(--text-on-dark)" : "var(--status-success-text)",
            borderRadius: 6,
            marginLeft: 8,
            borderBottom: "2px solid transparent",
          } : {};

          return (
            <span key={section.id} style={{ display: "contents" }}>
              {/* Group Separator */}
              {showGroupSeparator && (
                <div
                  style={{
                    width: 1,
                    height: 24,
                    background: "var(--button-disabled-bg)",
                    margin: "0 6px",
                    flexShrink: 0,
                  }}
                />
              )}
              <button
                onClick={() => setActiveSection(section.id)}
                style={{
                  padding: "10px 12px",
                  border: "none",
                  background: "none",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--button-primary-bg)" : "var(--text-muted)",
                  cursor: "pointer",
                  borderBottom: isActive ? "2px solid var(--button-primary-bg)" : "2px solid transparent",
                  marginBottom: -1,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                  ...specialStyles,
                }}
              >
                <span style={{ fontSize: 12 }}>{section.icon}</span>
                {section.label}
                {section.count !== undefined && section.count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      background: isActive ? "var(--status-info-bg)" : "var(--surface-secondary)",
                      color: isActive ? "var(--button-primary-bg)" : "var(--text-muted)",
                      padding: "1px 5px",
                      borderRadius: 10,
                    }}
                  >
                    {section.count}
                  </span>
                )}
              </button>
            </span>
          );
        })}
      </div>

      {/* Section Content - Scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px 24px" }}>
      {activeSection === null && (
        <OverviewSection data={data} onNavigate={setActiveSection} />
      )}

      {activeSection === "calls" && (
        <CallsSection
          calls={data.calls}
          expandedCall={expandedCall}
          setExpandedCall={setExpandedCall}
          callerId={callerId}
          onCallUpdated={() => {
            // Refresh data after op runs
            fetch(`/api/callers/${callerId}`)
              .then((r) => r.json())
              .then((result) => {
                if (result.ok) setData(result);
              });
            // Refresh prompts list to show newly composed prompts
            fetchPrompts();
          }}
        />
      )}

      {activeSection === "transcripts" && (
        <TranscriptsSection calls={data.calls} />
      )}

      {activeSection === "memories" && (
        <MemoriesSection
          memories={data.memories}
          summary={data.memorySummary}
          expandedMemory={expandedMemory}
          setExpandedMemory={setExpandedMemory}
        />
      )}

      {activeSection === "personality" && (
        <PersonalitySection
          personality={data.personality}
          observations={data.observations}
        />
      )}

      {activeSection === "scores" && <ScoresSection scores={data.scores} />}

      {activeSection === "learning" && (
        <LearningSection curriculum={data.curriculum} learnerProfile={data.learnerProfile} goals={data.goals} callerId={callerId} />
      )}

      {activeSection === "agent-behavior" && (
        <TopLevelAgentBehaviorSection callerId={callerId} />
      )}

      {activeSection === "slugs" && (
        <CallerSlugsSection callerId={callerId} />
      )}

      {activeSection === "prompt" && (
        <UnifiedPromptSection
          prompts={composedPrompts}
          loading={promptsLoading}
          composing={composing}
          expandedPrompt={expandedPrompt}
          setExpandedPrompt={setExpandedPrompt}
          onCompose={handleComposePrompt}
          onRefresh={fetchPrompts}
        />
      )}

      {activeSection === "ai-call" && (
        <AICallSection
          callerId={callerId}
          callerName={data.caller.name || "Caller"}
          calls={data.calls}
          onCallEnded={() => {
            // Refresh data after call ends
            fetch(`/api/callers/${callerId}`)
              .then((r) => r.json())
              .then((result) => {
                if (result.ok) setData(result);
              });
            // Refresh prompts
            fetchPrompts();
          }}
        />
      )}
      </div>
    </div>
  );
}

// Overview Section
function OverviewSection({
  data,
  onNavigate,
}: {
  data: CallerData;
  onNavigate: (section: SectionId | null) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
      {/* Quick Stats */}
      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Quick Stats</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <StatCard label="Total Calls" value={data.counts.calls} icon="📞" onClick={() => onNavigate("calls")} />
          <StatCard label="Memories" value={data.counts.memories} icon="💭" onClick={() => onNavigate("memories")} />
          <StatCard label="Observations" value={data.counts.observations} icon="👁️" onClick={() => onNavigate("personality")} />
          <StatCard
            label="Confidence"
            value={data.personality?.confidenceScore ? `${(data.personality.confidenceScore * 100).toFixed(0)}%` : "—"}
            icon="📊"
          />
        </div>
      </div>

      {/* Personality Summary */}
      {data.personality && (
        <div
          style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20, cursor: "pointer" }}
          onClick={() => onNavigate("personality")}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Personality Profile</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(TRAIT_INFO).map(([key, info]) => {
              const value = data.personality?.[key as keyof typeof TRAIT_INFO] as number | null;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", width: 100 }}>{info.label}</span>
                  <div style={{ flex: 1, height: 8, background: "var(--border-default)", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(value || 0) * 100}%`,
                        background: info.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", width: 40, textAlign: "right" }}>
                    {value !== null ? (value * 100).toFixed(0) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Facts */}
      {data.memorySummary && data.memorySummary.keyFacts.length > 0 && (
        <div
          style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20, cursor: "pointer" }}
          onClick={() => onNavigate("memories")}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Key Facts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.memorySummary.keyFacts.slice(0, 5).map((fact, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>{fact.key}</span>
                <span style={{ fontWeight: 500 }}>{fact.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preferences */}
      {data.memorySummary && Object.keys(data.memorySummary.preferences).length > 0 && (
        <div
          style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20, cursor: "pointer" }}
          onClick={() => onNavigate("memories")}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Preferences</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(data.memorySummary.preferences).slice(0, 6).map(([key, value]) => (
              <span
                key={key}
                style={{
                  padding: "4px 10px",
                  background: CATEGORY_COLORS.PREFERENCE.bg,
                  color: CATEGORY_COLORS.PREFERENCE.text,
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {key}: {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Calls */}
      <div
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20, cursor: "pointer" }}
        onClick={() => onNavigate("calls")}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Recent Calls</h3>
        {data.calls.length === 0 ? (
          <div style={{ color: "var(--text-placeholder)", fontSize: 13 }}>No calls yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.calls.slice(0, 3).map((call) => (
              <div key={call.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>{call.source}</span>
                <span style={{ color: "var(--text-placeholder)" }}>{new Date(call.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        background: "var(--background)",
        borderRadius: 8,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span>{icon}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

// Op Pill Component
type OpStatus = "ready" | "running" | "success" | "error" | "disabled";

type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
};

type OpResult = {
  ok: boolean;
  opId: string;
  logs: LogEntry[];
  duration: number;
  error?: string;
  data?: {
    scoresCreated?: number;
    memoriesCreated?: number;
    agentMeasurements?: number;
    playbookUsed?: string | null;
  };
};

type OpDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  prereqs: string[]; // Which other ops must be done first
};

// Legacy OPS (kept for reference, but UI now uses pipeline)
const OPS: OpDefinition[] = [
  { id: "measure", label: "Measure Caller", shortLabel: "MEASURE", prereqs: [] },
  { id: "learn", label: "Extract Memories", shortLabel: "LEARN", prereqs: [] },
  { id: "measure-agent", label: "Measure Behaviour", shortLabel: "BEHAVIOUR", prereqs: [] },
  { id: "reward", label: "Compute Reward", shortLabel: "REWARD", prereqs: ["measure-agent"] },
  { id: "adapt", label: "Update Targets", shortLabel: "ADAPT", prereqs: ["reward"] },
];

// Simplified pipeline modes
type PipelineMode = "prep" | "prompt";
type PipelineStatus = "ready" | "running" | "success" | "error";

function OpPill({
  op,
  status,
  onClick,
  disabled,
  hasLogs,
  onShowLogs,
}: {
  op: OpDefinition;
  status: OpStatus;
  onClick: () => void;
  disabled: boolean;
  hasLogs?: boolean;
  onShowLogs?: () => void;
}) {
  const colors: Record<OpStatus, { bg: string; text: string; border: string }> = {
    ready: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", border: "var(--status-info-border)" },
    running: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" },
    success: { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
    error: { bg: "var(--status-error-bg)", text: "var(--status-error-text)", border: "var(--status-error-border)" },
    disabled: { bg: "var(--surface-secondary)", text: "var(--text-placeholder)", border: "var(--border-default)" },
  };

  const style = colors[disabled ? "disabled" : status];

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        // If has logs and not ready, show logs on click. Otherwise run op.
        if (hasLogs && status !== "ready" && status !== "running" && onShowLogs) {
          onShowLogs();
        } else if (!disabled && status !== "running") {
          onClick();
        }
      }}
      disabled={disabled || status === "running"}
      title={disabled ? `Requires: ${op.prereqs.join(", ")}` : hasLogs ? `${op.label} (click to view logs)` : op.label}
      style={{
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 600,
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        borderRadius: 4,
        cursor: disabled || status === "running" ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {status === "running" && <span style={{ animation: "spin 1s linear infinite" }}>⏳</span>}
      {status === "success" && <span>✓</span>}
      {status === "error" && <span>✗</span>}
      {op.shortLabel}
    </button>
  );
}

// Logs Panel Component
function LogsPanel({
  result,
  opId,
  onClose,
}: {
  result: OpResult | undefined;
  opId: string;
  onClose: () => void;
}) {
  const logLevel = getLogLevel();

  if (!result) {
    return (
      <div style={{ padding: 16, borderTop: "1px solid var(--border-default)", background: "var(--background)" }}>
        <div style={{ color: "var(--text-placeholder)", fontSize: 13 }}>No logs available for this operation</div>
      </div>
    );
  }

  const opName = OPS.find((o) => o.id === opId)?.label || opId;
  const filteredLogs = filterLogs(result.logs, logLevel);
  const hiddenCount = result.logs.length - filteredLogs.length;

  return (
    <div style={{ borderTop: "1px solid var(--border-default)", background: "var(--surface-dark)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-dark)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-on-dark)" }}>{opName}</span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: result.ok ? "var(--terminal-success-bg)" : "var(--terminal-error-bg)",
              color: result.ok ? "var(--terminal-success-text)" : "var(--terminal-error-text)",
            }}
          >
            {result.ok ? "SUCCESS" : "ERROR"}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>{result.duration}ms</span>
          {hiddenCount > 0 && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              ({hiddenCount} hidden, level: {logLevel})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-placeholder)",
            cursor: "pointer",
            padding: 4,
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>

      {/* Logs */}
      <div
        style={{
          maxHeight: 300,
          overflow: "auto",
          padding: "8px 0",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
        }}
      >
        {logLevel === "off" ? (
          <div style={{ padding: "8px 16px", color: "var(--text-muted)" }}>
            Logging is off. Change in Cockpit settings to see logs.
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: "8px 16px", color: "var(--text-muted)" }}>No log entries</div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                padding: "4px 16px",
                borderLeft: `3px solid ${
                  log.level === "error" ? "var(--status-error-text)" : log.level === "warn" ? "var(--status-warning-text)" : log.level === "debug" ? "var(--text-muted)" : "var(--status-info-text)"
                }`,
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <span style={{ color: "var(--text-muted)", width: 80, flexShrink: 0 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                style={{
                  width: 50,
                  flexShrink: 0,
                  fontWeight: 600,
                  color:
                    log.level === "error"
                      ? "var(--terminal-error-text)"
                      : log.level === "warn"
                      ? "var(--terminal-warning-text)"
                      : log.level === "debug"
                      ? "var(--text-placeholder)"
                      : "var(--terminal-info-text)",
                }}
              >
                {log.level.toUpperCase()}
              </span>
              <span style={{ color: "var(--text-on-dark)", flex: 1 }}>
                {log.message}
                {log.data && (
                  <span style={{ color: "var(--text-placeholder)", marginLeft: 8 }}>
                    {typeof log.data === "object" ? JSON.stringify(log.data) : String(log.data)}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Error message if present */}
      {result.error && (
        <div style={{ padding: "8px 16px", background: "var(--terminal-error-bg)", color: "var(--terminal-error-text)", fontSize: 12 }}>
          Error: {result.error}
        </div>
      )}
    </div>
  );
}

// Pipeline Logs Panel - for new pipeline modes
function PipelineLogsPanel({
  result,
  mode,
  onClose,
}: {
  result: OpResult | undefined;
  mode: PipelineMode;
  onClose: () => void;
}) {
  const logLevel = getLogLevel();

  if (!result) {
    return (
      <div style={{ padding: 16, borderTop: "1px solid var(--border-default)", background: "var(--background)" }}>
        <div style={{ color: "var(--text-placeholder)", fontSize: 13 }}>No logs available for this operation</div>
      </div>
    );
  }

  const modeName = mode === "prep" ? "Prep (Analysis)" : "Prompt (Full Pipeline)";
  const filteredLogs = filterLogs(result.logs, logLevel);
  const hiddenCount = result.logs.length - filteredLogs.length;

  // Check if this was a "success" with zero results (potential config issue)
  const isZeroResults = result.ok && result.data &&
    (result.data.scoresCreated || 0) + (result.data.agentMeasurements || 0) === 0;

  return (
    <div style={{ borderTop: "1px solid var(--border-default)", background: "var(--surface-dark)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-dark)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-on-dark)" }}>{modeName}</span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: isZeroResults ? "var(--terminal-warning-bg)" : result.ok ? "var(--terminal-success-bg)" : "var(--terminal-error-bg)",
              color: isZeroResults ? "var(--terminal-warning-text)" : result.ok ? "var(--terminal-success-text)" : "var(--terminal-error-text)",
            }}
          >
            {isZeroResults ? "⚠️ 0 RESULTS" : result.ok ? "SUCCESS" : "ERROR"}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>{result.duration}ms</span>
          {hiddenCount > 0 && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              ({hiddenCount} hidden, level: {logLevel})
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-placeholder)",
            cursor: "pointer",
            padding: 4,
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>

      {/* Summary - show key counts for quick visibility */}
      {result.data && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "6px 16px",
            borderBottom: "1px solid var(--border-dark)",
            background: "var(--surface-dark)",
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--text-placeholder)" }}>
            📊 Scores: <strong style={{ color: (result.data.scoresCreated || 0) > 0 ? "var(--terminal-success-text)" : "var(--terminal-error-text)" }}>{result.data.scoresCreated || 0}</strong>
          </span>
          <span style={{ color: "var(--text-placeholder)" }}>
            🤖 Behaviour: <strong style={{ color: (result.data.agentMeasurements || 0) > 0 ? "var(--terminal-success-text)" : "var(--terminal-error-text)" }}>{result.data.agentMeasurements || 0}</strong>
          </span>
          <span style={{ color: "var(--text-placeholder)" }}>
            💾 Memories: <strong style={{ color: "var(--terminal-info-text)" }}>{result.data.memoriesCreated || 0}</strong>
          </span>
          {result.data.playbookUsed && (
            <span style={{ color: "var(--text-placeholder)" }}>
              📋 Playbook: <strong style={{ color: "var(--terminal-purple-text)" }}>{result.data.playbookUsed}</strong>
            </span>
          )}
        </div>
      )}

      {/* Logs */}
      <div
        style={{
          maxHeight: 300,
          overflow: "auto",
          padding: "8px 0",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
        }}
      >
        {logLevel === "off" ? (
          <div style={{ padding: "8px 16px", color: "var(--text-muted)" }}>
            Logging is off. Change in Cockpit settings to see logs.
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: "8px 16px", color: "var(--text-muted)" }}>No log entries</div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                padding: "4px 16px",
                borderLeft: `3px solid ${
                  log.level === "error" ? "var(--status-error-text)" : log.level === "warn" ? "var(--status-warning-text)" : log.level === "debug" ? "var(--text-muted)" : "var(--status-info-text)"
                }`,
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <span style={{ color: "var(--text-muted)", width: 80, flexShrink: 0 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                style={{
                  width: 50,
                  flexShrink: 0,
                  fontWeight: 600,
                  color:
                    log.level === "error"
                      ? "var(--terminal-error-text)"
                      : log.level === "warn"
                      ? "var(--terminal-warning-text)"
                      : log.level === "debug"
                      ? "var(--text-placeholder)"
                      : "var(--terminal-info-text)",
                }}
              >
                {log.level.toUpperCase()}
              </span>
              <span style={{ color: "var(--text-on-dark)", flex: 1 }}>
                {log.message}
                {log.data && (
                  <span style={{ color: "var(--text-placeholder)", marginLeft: 8 }}>
                    {typeof log.data === "object" ? JSON.stringify(log.data) : String(log.data)}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Error message if present */}
      {result.error && (
        <div style={{ padding: "8px 16px", background: "var(--terminal-error-bg)", color: "var(--terminal-error-text)", fontSize: 12 }}>
          Error: {result.error}
        </div>
      )}
    </div>
  );
}

// Log Level Colors
const LOG_LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  info: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)" },
  warn: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
  error: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  debug: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
};

// Get logging level from localStorage
function getLogLevel(): "full" | "med" | "off" {
  if (typeof window === "undefined") return "full";
  const stored = localStorage.getItem("hf_log_level");
  if (stored === "full" || stored === "med" || stored === "off") return stored;
  return "full";
}

// Filter logs based on level
function filterLogs(logs: LogEntry[], level: "full" | "med" | "off"): LogEntry[] {
  if (level === "off") return [];
  if (level === "med") return logs.filter((log) => log.level !== "debug");
  return logs;
}

// Get AI engine setting from localStorage
function getAIEngine(): "mock" | "claude" | "openai" {
  if (typeof window === "undefined") return "mock";
  const stored = localStorage.getItem("hf_ai_engine");
  if (stored === "mock" || stored === "claude" || stored === "openai") return stored;
  return "mock";
}

// Calls Section
function CallsSection({
  calls,
  expandedCall,
  setExpandedCall,
  callerId,
  onCallUpdated,
}: {
  calls: Call[];
  expandedCall: string | null;
  setExpandedCall: (id: string | null) => void;
  callerId: string;
  onCallUpdated?: () => void;
}) {
  // Pipeline state (simplified: just prep and prompt)
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, Record<PipelineMode, PipelineStatus>>>({});
  const [pipelineResults, setPipelineResults] = useState<Record<string, Record<PipelineMode, OpResult>>>({});
  const [logsPanel, setLogsPanel] = useState<{ callId: string; mode: PipelineMode } | null>(null);

  // Legacy op statuses (kept for pipeline result tracking)
  const [opStatuses, setOpStatuses] = useState<Record<string, Record<string, OpStatus>>>({});
  const [opResults, setOpResults] = useState<Record<string, Record<string, OpResult>>>({});

  // Initialize statuses from call data
  useEffect(() => {
    const initial: Record<string, Record<string, OpStatus>> = {};
    const pipelineInitial: Record<string, Record<PipelineMode, PipelineStatus>> = {};
    for (const call of calls) {
      initial[call.id] = {
        measure: call.hasScores ? "success" : "ready",
        learn: call.hasMemories ? "success" : "ready",
        "measure-agent": call.hasBehaviorMeasurements ? "success" : "ready",
        reward: call.hasRewardScore ? "success" : "ready",
        adapt: "ready",
      };
      // Pipeline status based on what's done
      const prepDone = call.hasScores && call.hasMemories && call.hasBehaviorMeasurements && call.hasRewardScore;
      pipelineInitial[call.id] = {
        prep: prepDone ? "success" : "ready",
        prompt: "ready", // We don't track this yet
      };
    }
    setOpStatuses(initial);
    setPipelineStatus(pipelineInitial);
  }, [calls]);

  // Track which calls have details loaded
  const [callDetails, setCallDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Load call details when expanded
  const loadCallDetails = async (callId: string) => {
    if (callDetails[callId] || loadingDetails[callId]) return;

    setLoadingDetails((prev) => ({ ...prev, [callId]: true }));
    try {
      const response = await fetch(`/api/calls/${callId}`);
      const result = await response.json();
      if (result.ok) {
        setCallDetails((prev) => ({ ...prev, [callId]: result }));
      }
    } catch (error) {
      console.error("Failed to load call details:", error);
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [callId]: false }));
    }
  };

  // Expand/collapse all
  const [allExpanded, setAllExpanded] = useState(false);
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCall(null);
    } else {
      // Expand first call and load its details
      if (calls.length > 0) {
        setExpandedCall(calls[0].id);
        loadCallDetails(calls[0].id);
      }
    }
    setAllExpanded(!allExpanded);
  };

  // Load details when a call is expanded
  useEffect(() => {
    if (expandedCall) {
      loadCallDetails(expandedCall);
    }
  }, [expandedCall]);

  // Bulk operation state
  const [bulkRunning, setBulkRunning] = useState<PipelineMode | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; callId?: string } | null>(null);
  // Per-call pipeline state
  const [runningOnCall, setRunningOnCall] = useState<{ callId: string; mode: PipelineMode } | null>(null);

  // Run pipeline on a single call
  const runPipeline = async (callId: string, mode: PipelineMode): Promise<boolean> => {
    setPipelineStatus((prev) => ({
      ...prev,
      [callId]: { ...prev[callId], [mode]: "running" },
    }));

    try {
      const engine = getAIEngine();
      const response = await fetch(`/api/calls/${callId}/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerId, mode, engine }),
      });

      const result = await response.json();

      setPipelineResults((prev) => ({
        ...prev,
        [callId]: {
          ...prev[callId],
          [mode]: {
            ok: result.ok,
            opId: mode,
            logs: result.logs || [],
            duration: result.duration || 0,
            error: result.error,
            data: result.data, // Include summary data for visibility
          },
        },
      }));

      setPipelineStatus((prev) => ({
        ...prev,
        [callId]: { ...prev[callId], [mode]: result.ok ? "success" : "error" },
      }));

      // Also update legacy op statuses for UI
      if (result.ok) {
        setOpStatuses((prev) => ({
          ...prev,
          [callId]: {
            measure: "success",
            learn: "success",
            "measure-agent": "success",
            reward: "success",
            adapt: "success",
          },
        }));
      }

      if (!result.ok) {
        setLogsPanel({ callId, mode });
      }

      return result.ok;
    } catch (error: any) {
      setPipelineResults((prev) => ({
        ...prev,
        [callId]: {
          ...prev[callId],
          [mode]: {
            ok: false,
            opId: mode,
            logs: [{ timestamp: new Date().toISOString(), level: "error", message: error.message || "Network error" }],
            duration: 0,
            error: error.message,
          },
        },
      }));

      setPipelineStatus((prev) => ({
        ...prev,
        [callId]: { ...prev[callId], [mode]: "error" },
      }));

      setLogsPanel({ callId, mode });
      return false;
    }
  };

  // Run pipeline on single call (standalone button)
  const runPipelineOnCall = async (callId: string, mode: PipelineMode) => {
    setRunningOnCall({ callId, mode });
    await runPipeline(callId, mode);
    setRunningOnCall(null);
    if (onCallUpdated) onCallUpdated();
  };

  // Run pipeline on ALL calls (oldest first for proper chronological processing)
  const runPipelineOnAllCalls = async (mode: PipelineMode, replaceExisting = false) => {
    // Sort calls by createdAt ascending (oldest first)
    const sortedCalls = [...calls].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // For prompt mode, check if there are existing prompts
    if (mode === "prompt" && !replaceExisting) {
      const existingCount = sortedCalls.filter(c => pipelineStatus[c.id]?.prompt === "success").length;
      if (existingCount > 0) {
        const shouldReplace = window.confirm(
          `${existingCount} call(s) already have prompts generated.\n\n` +
          `Click OK to replace ALL existing prompts (oldest call first).\n` +
          `Click Cancel to skip calls with existing prompts.`
        );
        if (!shouldReplace) {
          // Filter to only calls without prompts
          const callsToProcess = sortedCalls.filter(c => pipelineStatus[c.id]?.prompt !== "success");
          if (callsToProcess.length === 0) {
            alert("All calls already have prompts. Nothing to do.");
            return;
          }
          setBulkRunning(mode);
          setBulkProgress({ current: 0, total: callsToProcess.length });

          for (let i = 0; i < callsToProcess.length; i++) {
            const call = callsToProcess[i];
            setBulkProgress({ current: i + 1, total: callsToProcess.length, callId: call.id });
            await runPipeline(call.id, mode);
          }

          setBulkRunning(null);
          setBulkProgress(null);
          if (onCallUpdated) onCallUpdated();
          return;
        }
      }
    }

    setBulkRunning(mode);
    setBulkProgress({ current: 0, total: sortedCalls.length });

    for (let i = 0; i < sortedCalls.length; i++) {
      const call = sortedCalls[i];
      setBulkProgress({ current: i + 1, total: sortedCalls.length, callId: call.id });
      await runPipeline(call.id, mode);
    }

    setBulkRunning(null);
    setBulkProgress(null);
    if (onCallUpdated) onCallUpdated();
  };

  if (calls.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No calls yet</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {calls.map((call) => {
        const isExpanded = expandedCall === call.id;
        const callPipelineStatus = pipelineStatus[call.id] || { prep: "ready", prompt: "ready" };
        const callPipelineResults = pipelineResults[call.id] || {};
        const hasAnyLogs = Object.keys(callPipelineResults).length > 0;
        const showingLogs = logsPanel?.callId === call.id;
        const isRunningOnThisCall = runningOnCall?.callId === call.id;

        // Get status color for pipeline mode - show warning if success but 0 results
        const getStatusStyle = (status: PipelineStatus, mode?: PipelineMode) => {
          // Check if this was a "success" with zero results (potential bug)
          const result = mode ? callPipelineResults[mode] : null;
          const isZeroResults = result?.ok && result?.data &&
            (result.data.scoresCreated || 0) + (result.data.agentMeasurements || 0) === 0;

          const colors: Record<PipelineStatus | "warning", { bg: string; text: string; border: string }> = {
            ready: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", border: "var(--status-info-border)" },
            running: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" },
            success: { bg: "var(--status-success-bg)", text: "var(--status-success-text)", border: "var(--status-success-border)" },
            error: { bg: "var(--status-error-bg)", text: "var(--status-error-text)", border: "var(--status-error-border)" },
            warning: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)", border: "var(--status-warning-border)" }, // Amber for zero results
          };

          if (status === "success" && isZeroResults) {
            return colors.warning;
          }
          return colors[status];
        };

        return (
          <div key={call.id} style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: isExpanded ? "var(--background)" : "var(--surface-primary)",
              }}
            >
              {/* Left: Call info */}
              <button
                onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 14 }}>📞</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{call.source}</span>
                {call.externalId && (
                  <span style={{ fontSize: 11, color: "var(--text-placeholder)", fontFamily: "monospace" }}>{call.externalId}</span>
                )}
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(call.createdAt).toLocaleString()}</span>
              </button>

              {/* Right: Prep + Prompt buttons + Logs */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Prep button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (callPipelineStatus.prep === "success" && callPipelineResults.prep) {
                      // Show logs if already done
                      setLogsPanel(showingLogs && logsPanel?.mode === "prep" ? null : { callId: call.id, mode: "prep" });
                    } else {
                      runPipelineOnCall(call.id, "prep");
                    }
                  }}
                  disabled={isRunningOnThisCall || bulkRunning !== null}
                  title={callPipelineStatus.prep === "success" ? "View prep logs" : "Run analysis pipeline (measure, learn, agent, reward, adapt)"}
                  style={{
                    padding: "3px 10px",
                    fontSize: 10,
                    fontWeight: 600,
                    ...getStatusStyle(callPipelineStatus.prep, "prep"),
                    border: `1px solid ${getStatusStyle(callPipelineStatus.prep, "prep").border}`,
                    borderRadius: 4,
                    cursor: isRunningOnThisCall || bulkRunning ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    opacity: isRunningOnThisCall || bulkRunning ? 0.6 : 1,
                  }}
                >
                  {callPipelineStatus.prep === "running" ? "⏳" : callPipelineStatus.prep === "success" ? "✓" : callPipelineStatus.prep === "error" ? "✗" : "📊"} PREP
                  {callPipelineStatus.prep === "success" && callPipelineResults.prep?.data && (
                    <span style={{ fontSize: 9, opacity: 0.8 }}>
                      {(callPipelineResults.prep.data.scoresCreated || 0) + (callPipelineResults.prep.data.agentMeasurements || 0)}
                    </span>
                  )}
                </button>

                {/* Prompt button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (callPipelineStatus.prompt === "success" && callPipelineResults.prompt) {
                      // Show logs if already done
                      setLogsPanel(showingLogs && logsPanel?.mode === "prompt" ? null : { callId: call.id, mode: "prompt" });
                    } else {
                      runPipelineOnCall(call.id, "prompt");
                    }
                  }}
                  disabled={isRunningOnThisCall || bulkRunning !== null}
                  title={callPipelineStatus.prompt === "success" ? "View prompt logs" : "Run full pipeline + compose prompt"}
                  style={{
                    padding: "3px 10px",
                    fontSize: 10,
                    fontWeight: 600,
                    ...getStatusStyle(callPipelineStatus.prompt, "prompt"),
                    border: callPipelineStatus.prompt === "ready" ? "none" : `1px solid ${getStatusStyle(callPipelineStatus.prompt, "prompt").border}`,
                    background: callPipelineStatus.prompt === "ready" ? "var(--button-primary-bg)" : getStatusStyle(callPipelineStatus.prompt, "prompt").bg,
                    color: callPipelineStatus.prompt === "ready" ? "var(--text-on-dark)" : getStatusStyle(callPipelineStatus.prompt, "prompt").text,
                    borderRadius: 4,
                    cursor: isRunningOnThisCall || bulkRunning ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    opacity: isRunningOnThisCall || bulkRunning ? 0.6 : 1,
                  }}
                >
                  {callPipelineStatus.prompt === "running" ? "⏳" : callPipelineStatus.prompt === "success" ? "✓" : callPipelineStatus.prompt === "error" ? "✗" : "📝"} PROMPT
                  {callPipelineStatus.prompt === "success" && callPipelineResults.prompt?.data && (
                    <span style={{ fontSize: 9, opacity: 0.8 }}>
                      {(callPipelineResults.prompt.data.scoresCreated || 0) + (callPipelineResults.prompt.data.agentMeasurements || 0)}
                    </span>
                  )}
                </button>

                {/* Logs toggle */}
                {hasAnyLogs && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showingLogs) {
                        setLogsPanel(null);
                      } else {
                        // Show most recent logs (prompt > prep)
                        const mode = callPipelineResults.prompt ? "prompt" : "prep";
                        setLogsPanel({ callId: call.id, mode });
                      }
                    }}
                    title="View logs"
                    style={{
                      padding: "3px 8px",
                      fontSize: 10,
                      fontWeight: 600,
                      background: showingLogs ? "var(--surface-dark)" : "var(--surface-secondary)",
                      color: showingLogs ? "var(--text-on-dark)" : "var(--text-muted)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 4,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    📋
                  </button>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    color: "var(--text-placeholder)",
                  }}
                >
                  {isExpanded ? "▼" : "▶"}
                </button>
              </div>
            </div>

            {/* Logs Panel */}
            {showingLogs && logsPanel && (
              <PipelineLogsPanel
                result={callPipelineResults[logsPanel.mode]}
                mode={logsPanel.mode}
                onClose={() => setLogsPanel(null)}
              />
            )}

            {isExpanded && (
              <CallDetailPanel
                call={call}
                details={callDetails[call.id]}
                loading={loadingDetails[call.id]}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Call Detail Panel - shows scores, memories, measurements when expanded
function CallDetailPanel({
  call,
  details,
  loading,
}: {
  call: Call;
  details: any;
  loading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"transcript" | "memories" | "scores" | "measurements" | "prompt">("transcript");

  if (loading) {
    return (
      <div style={{ padding: 24, borderTop: "1px solid var(--border-default)", background: "var(--background)", textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading analysis data...</div>
      </div>
    );
  }

  const scores = details?.scores || [];
  const memories = details?.memories || [];
  const measurements = details?.measurements || [];
  const rewardScore = details?.rewardScore;
  const triggeredPrompts = details?.triggeredPrompts || [];
  const effectiveTargets = details?.effectiveTargets || [];
  const personalityObservation = details?.personalityObservation;

  const tabs = [
    // Transcript first
    { id: "transcript", label: "Trans", icon: "📄", count: null, tooltip: "View the full call transcript" },
    // Caller group
    { id: "memories", label: "Mem", icon: "💭", count: memories.length, tooltip: "Memories extracted from the caller" },
    // Shared group
    { id: "scores", label: "Scores", icon: "📊", count: scores.length, tooltip: "Behavior and caller scores" },
    // Behaviour group (targets + measurements combined)
    { id: "measurements", label: "Behaviour", icon: "🤖", count: effectiveTargets.length + measurements.length, tooltip: "Targets and behavioral measurements" },
    { id: "prompt", label: "Prompt", icon: "📝", count: null, tooltip: "Composed prompt sent to the AI" }, // 1-1 with call, count not needed
  ];

  return (
    <div style={{ borderTop: "1px solid var(--border-default)", background: "var(--background)" }}>
      {/* Tabs - matching header tab styling */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border-default)", background: "var(--surface-primary)", paddingBottom: 0 }}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              title={tab.tooltip}
              style={{
                padding: "10px 12px",
                border: "none",
                background: "none",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--button-primary-bg)" : "var(--text-muted)",
                cursor: "pointer",
                borderBottom: isActive ? "2px solid var(--button-primary-bg)" : "2px solid transparent",
                marginBottom: -1,
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 12 }}>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    background: isActive ? "var(--status-info-bg)" : "var(--surface-secondary)",
                    color: isActive ? "var(--button-primary-bg)" : "var(--text-muted)",
                    padding: "1px 5px",
                    borderRadius: 10,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Reward score badge */}
        {rewardScore && (
          <div style={{ marginLeft: "auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Reward:</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: rewardScore.overallScore >= 0.7 ? "var(--status-success-text)" : rewardScore.overallScore >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
              }}
            >
              {(rewardScore.overallScore * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {activeTab === "transcript" && (
          <TranscriptTab transcript={call.transcript} />
        )}

        {activeTab === "memories" && (
          <MemoriesTab memories={memories} />
        )}

        {activeTab === "scores" && (
          <ScoresTab scores={scores} />
        )}

        {activeTab === "measurements" && (
          <MeasurementsTab
            callerTargets={details?.callerTargets || []}
            behaviorTargets={effectiveTargets}
            measurements={measurements}
            rewardScore={rewardScore}
          />
        )}

        {activeTab === "prompt" && (
          <UnifiedDetailPromptTab prompts={triggeredPrompts} />
        )}
      </div>
    </div>
  );
}

// Prompt Tab - shows prompts triggered by this call
function PromptTab({ prompts }: { prompts: any[] }) {
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  if (prompts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No prompt generated after this call. Run the Prompt pipeline step to generate one.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {prompts.map((prompt: any) => {
        const isExpanded = expandedPrompt === prompt.id;
        return (
          <div
            key={prompt.id}
            style={{
              background: "var(--surface-primary)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              onClick={() => setExpandedPrompt(isExpanded ? null : prompt.id)}
              style={{
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                borderBottom: isExpanded ? "1px solid var(--border-default)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    background: prompt.status === "SUCCESS" ? "var(--status-success-bg)" : "var(--status-warning-bg)",
                    color: prompt.status === "SUCCESS" ? "var(--status-success-text)" : "var(--status-warning-text)",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {prompt.status || "COMPOSED"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(prompt.composedAt).toLocaleString()}
                </span>
                {prompt.model && (
                  <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>
                    via {prompt.model}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>
                  {prompt.prompt?.length || 0} chars
                </span>
                <span style={{ color: "var(--text-muted)" }}>{isExpanded ? "▼" : "▶"}</span>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: 12 }}>
                {/* Prompt text */}
                <div
                  style={{
                    background: "var(--surface-dark)",
                    color: "var(--text-on-dark)",
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    maxHeight: 400,
                    overflowY: "auto",
                    border: "1px solid var(--border-dark)",
                  }}
                >
                  {prompt.prompt || "No prompt content"}
                </div>

                {/* Inputs used */}
                {prompt.inputs && Object.keys(prompt.inputs).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                      Inputs Used:
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {Object.entries(prompt.inputs).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 2 }}>
                          <span style={{ fontWeight: 500 }}>{key}:</span>{" "}
                          <span style={{ color: "var(--text-muted)" }}>
                            {typeof value === "object" ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 100)}
                            {String(value).length > 100 ? "..." : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Copy button */}
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(prompt.prompt || "");
                      alert("Prompt copied to clipboard!");
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      background: "var(--button-primary-bg)",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Copy Prompt
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Unified Detail Prompt Tab - combines human-readable and LLM-friendly views
// Matches the layout of UnifiedPromptSection in the header
function UnifiedDetailPromptTab({ prompts }: { prompts: any[] }) {
  const [viewMode, setViewMode] = useState<"human" | "llm">("human");
  const [llmViewMode, setLlmViewMode] = useState<"pretty" | "raw">("pretty");

  if (prompts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No prompt generated after this call. Run the Prompt pipeline step to generate one.
      </div>
    );
  }

  const latestPrompt = prompts[0];
  const llm = latestPrompt?.llmPrompt;
  const inputs = latestPrompt?.inputs || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header with toggle - matches UnifiedPromptSection */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: latestPrompt.status === "SUCCESS" ? "var(--status-success-bg)" : "var(--status-warning-bg)",
              color: latestPrompt.status === "SUCCESS" ? "var(--status-success-text)" : "var(--status-warning-text)",
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            {latestPrompt.status || "COMPOSED"}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {new Date(latestPrompt.composedAt).toLocaleString()}
          </span>
          {latestPrompt.model && (
            <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>via {latestPrompt.model}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <button
              onClick={() => setViewMode("human")}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 500,
                background: viewMode === "human" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "human" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              📖 Human-Readable
            </button>
            <button
              onClick={() => setViewMode("llm")}
              style={{
                padding: "6px 12px",
                fontSize: 11,
                fontWeight: 500,
                background: viewMode === "llm" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "llm" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              🤖 LLM-Friendly
            </button>
          </div>
        </div>
      </div>

      {/* Human-Readable View */}
      {viewMode === "human" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: "var(--surface-dark)",
              color: "var(--text-on-dark)",
              padding: 16,
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, monospace",
              maxHeight: 400,
              overflowY: "auto",
              border: "1px solid var(--border-dark)",
            }}
          >
            {latestPrompt.prompt || "No prompt content"}
          </div>

          {/* Inputs used */}
          {inputs && Object.keys(inputs).length > 0 && (
            <div style={{ padding: 12, background: "var(--status-warning-bg)", borderRadius: 8, border: "1px solid var(--status-warning-border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 8 }}>
                Composition Inputs
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--status-warning-text)" }}>
                {inputs.memoriesCount !== undefined && <span>Memories: {inputs.memoriesCount}</span>}
                {inputs.personalityAvailable !== undefined && <span>Personality: {inputs.personalityAvailable ? "Yes" : "No"}</span>}
                {inputs.recentCallsCount !== undefined && <span>Recent Calls: {inputs.recentCallsCount}</span>}
                {inputs.behaviorTargetsCount !== undefined && <span>Behavior Targets: {inputs.behaviorTargetsCount}</span>}
              </div>
            </div>
          )}

          {/* Copy button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(latestPrompt.prompt || "");
              alert("Copied to clipboard!");
            }}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              background: "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            📋 Copy Prompt
          </button>
        </div>
      )}

      {/* LLM-Friendly View - matches UnifiedPromptSection with Pretty/Raw toggle */}
      {viewMode === "llm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!llm ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-placeholder)", background: "var(--background)", borderRadius: 8 }}>
              No LLM-friendly JSON available for this prompt.
            </div>
          ) : (
            <>
              {/* Pretty/Raw Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Structured JSON for AI agent consumption</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
                    <button
                      onClick={() => setLlmViewMode("pretty")}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: llmViewMode === "pretty" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                        color: llmViewMode === "pretty" ? "var(--text-on-dark)" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setLlmViewMode("raw")}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: llmViewMode === "raw" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                        color: llmViewMode === "raw" ? "var(--text-on-dark)" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Raw JSON
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(llm, null, 2));
                      alert("Copied JSON to clipboard!");
                    }}
                    style={{
                      padding: "4px 10px",
                      background: "var(--surface-secondary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    📋 Copy JSON
                  </button>
                </div>
              </div>

              {llmViewMode === "raw" ? (
                <div
                  style={{
                    background: "var(--surface-dark)",
                    color: "var(--text-on-dark-muted)",
                    padding: 16,
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    whiteSpace: "pre-wrap",
                    maxHeight: 500,
                    overflowY: "auto",
                    border: "1px solid var(--border-dark)",
                  }}
                >
                  {JSON.stringify(llm, null, 2)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Memories */}
                  {llm.memories && llm.memories.totalCount > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--badge-cyan-text)" }}>
                        💭 Memories ({llm.memories.totalCount})
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {llm.memories.byCategory && Object.entries(llm.memories.byCategory).slice(0, 3).map(([category, items]: [string, any]) => (
                          <div key={category}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: CATEGORY_COLORS[category]?.text || "var(--text-muted)", marginBottom: 4 }}>
                              {category}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {items.slice(0, 2).map((m: any, i: number) => (
                                <div
                                  key={i}
                                  style={{
                                    padding: 6,
                                    background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                                    borderRadius: 4,
                                    fontSize: 11,
                                  }}
                                >
                                  <span style={{ fontWeight: 500 }}>{m.key}:</span> {m.value}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Behavior Targets */}
                  {llm.behaviorTargets && llm.behaviorTargets.totalCount > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--status-success-text)" }}>
                        🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                        {llm.behaviorTargets.all?.slice(0, 6).map((t: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              padding: 8,
                              background: t.targetLevel === "HIGH" ? "var(--status-success-bg)" : t.targetLevel === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                              borderRadius: 4,
                            }}
                          >
                            <div style={{ fontSize: 10, fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: t.targetLevel === "HIGH" ? "var(--status-success-text)" : t.targetLevel === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                              }}
                            >
                              {t.targetLevel}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Instructions */}
                  {llm.instructions && (
                    <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 8, padding: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--status-warning-text)" }}>
                        📋 AI Instructions
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: "var(--status-warning-text)" }}>
                        {llm.instructions.use_memories && (
                          <div><strong>Memories:</strong> {llm.instructions.use_memories}</div>
                        )}
                        {llm.instructions.personality_adaptation?.length > 0 && (
                          <div>
                            <strong>Personality Adaptation:</strong>
                            <ul style={{ margin: "2px 0 0 14px", padding: 0 }}>
                              {llm.instructions.personality_adaptation.slice(0, 3).map((tip: string, i: number) => (
                                <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Personality Observation Tab - shows personality data observed from this call
function PersonalityObservationTab({ observation }: { observation: any }) {
  if (!observation) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No personality observation for this call. Run the Personality analysis to generate one.
      </div>
    );
  }

  const traits = [
    { key: "openness", label: "Openness", color: "var(--trait-openness)", desc: "Curiosity, creativity, openness to new experiences" },
    { key: "conscientiousness", label: "Conscientiousness", color: "var(--trait-conscientiousness)", desc: "Organization, dependability, self-discipline" },
    { key: "extraversion", label: "Extraversion", color: "var(--trait-extraversion)", desc: "Sociability, assertiveness, positive emotions" },
    { key: "agreeableness", label: "Agreeableness", color: "var(--trait-agreeableness)", desc: "Cooperation, trust, helpfulness" },
    { key: "neuroticism", label: "Neuroticism", color: "var(--trait-neuroticism)", desc: "Emotional instability, anxiety, moodiness" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header with confidence and metadata */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Personality Observation</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Observed {new Date(observation.observedAt).toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Confidence</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: observation.confidence >= 0.7 ? "var(--status-success-text)" : observation.confidence >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
            }}
          >
            {(observation.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Trait scores */}
      <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>Big Five Traits</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {traits.map((trait) => {
            const value = observation[trait.key];
            if (value === null || value === undefined) return null;

            return (
              <div key={trait.key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{trait.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-placeholder)", marginLeft: 8 }}>{trait.desc}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: value >= 0.7 ? "var(--status-success-text)" : value >= 0.3 ? "var(--status-warning-text)" : "var(--text-muted)",
                    }}
                  >
                    {(value * 100).toFixed(0)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 8, background: "var(--surface-secondary)", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${value * 100}%`,
                      background: trait.color,
                      borderRadius: 4,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Decay factor info */}
      {observation.decayFactor !== undefined && observation.decayFactor < 1 && (
        <div style={{ fontSize: 11, color: "var(--text-placeholder)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>Decay factor:</span>
          <span style={{ fontWeight: 500 }}>{observation.decayFactor.toFixed(2)}</span>
          <span>(older observations have less weight)</span>
        </div>
      )}
    </div>
  );
}

// Prompt Prep Tab - shows inputs that went into prompt composition
function PromptPrepTab({ prompts }: { prompts: any[] }) {
  const [expandedSection, setExpandedSection] = useState<string | null>("caller");
  const [viewMode, setViewMode] = useState<"human" | "llm">("llm"); // Default to LLM-friendly view

  if (prompts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No prompt composition data available. Run the Prompt pipeline step to generate one.
      </div>
    );
  }

  // Get the most recent prompt's inputs
  const latestPrompt = prompts[0];
  const inputs = latestPrompt?.inputs || {};
  const llmPrompt = latestPrompt?.llmPrompt;

  // Parse callerContext to extract sections
  const callerContext = inputs.callerContext || "";
  const sections: Record<string, string[]> = {};
  let currentSection = "";

  for (const line of callerContext.split("\n")) {
    if (line.startsWith("## ")) {
      currentSection = line.replace("## ", "").trim();
      sections[currentSection] = [];
    } else if (line.startsWith("### ")) {
      currentSection = line.replace("### ", "").trim();
      sections[currentSection] = [];
    } else if (currentSection && line.trim()) {
      sections[currentSection].push(line.trim());
    }
  }

  const sectionStyles = {
    header: {
      padding: "10px 12px",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--background)",
    },
    content: {
      padding: 12,
      fontSize: 13,
      lineHeight: 1.6,
    },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Format Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Prompt Format:</div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-secondary)", borderRadius: 6, padding: 2 }}>
          <button
            onClick={() => setViewMode("human")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 500,
              background: viewMode === "human" ? "var(--surface-primary)" : "transparent",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              color: viewMode === "human" ? "var(--button-primary-bg)" : "var(--text-muted)",
              boxShadow: viewMode === "human" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Human-Readable
          </button>
          <button
            onClick={() => setViewMode("llm")}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 500,
              background: viewMode === "llm" ? "var(--surface-primary)" : "transparent",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              color: viewMode === "llm" ? "var(--status-success-text)" : "var(--text-muted)",
              boxShadow: viewMode === "llm" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
          >
            LLM-Friendly (JSON)
          </button>
        </div>
      </div>

      {viewMode === "llm" ? (
        // LLM-Friendly JSON View
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {llmPrompt ? (
            <>
              {/* Instructions Summary */}
              {llmPrompt.instructions && (
                <div style={{ background: "var(--status-success-bg)", borderRadius: 8, border: "1px solid var(--status-success-border)", padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--status-success-text)", textTransform: "uppercase", marginBottom: 8 }}>
                    AI Instructions
                  </div>
                  <div style={{ fontSize: 12, color: "var(--status-success-text)" }}>
                    <div style={{ marginBottom: 6 }}><strong>Memories:</strong> {llmPrompt.instructions.use_memories}</div>
                    <div style={{ marginBottom: 6 }}><strong>Preferences:</strong> {llmPrompt.instructions.use_preferences}</div>
                    <div style={{ marginBottom: 6 }}><strong>Topics:</strong> {llmPrompt.instructions.use_topics}</div>
                    {llmPrompt.instructions.personality_adaptation?.length > 0 && (
                      <div>
                        <strong>Personality:</strong>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          {llmPrompt.instructions.personality_adaptation.map((item: string, i: number) => (
                            <li key={i} style={{ marginBottom: 2 }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Caller Data */}
              <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedSection(expandedSection === "llm-caller" ? null : "llm-caller")}
                  style={sectionStyles.header as any}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Caller Data</span>
                  <span style={{ color: "var(--text-muted)" }}>{expandedSection === "llm-caller" ? "−" : "+"}</span>
                </div>
                {expandedSection === "llm-caller" && (
                  <div style={sectionStyles.content}>
                    <pre style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(llmPrompt.caller, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Personality */}
              {llmPrompt.personality && (
                <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandedSection(expandedSection === "llm-personality" ? null : "llm-personality")}
                    style={sectionStyles.header as any}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Personality Profile</span>
                    <span style={{ color: "var(--text-muted)" }}>{expandedSection === "llm-personality" ? "−" : "+"}</span>
                  </div>
                  {expandedSection === "llm-personality" && (
                    <div style={sectionStyles.content}>
                      <pre style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(llmPrompt.personality, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Memories */}
              <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedSection(expandedSection === "llm-memories" ? null : "llm-memories")}
                  style={sectionStyles.header as any}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Memories ({llmPrompt.memories?.totalCount || 0})
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{expandedSection === "llm-memories" ? "−" : "+"}</span>
                </div>
                {expandedSection === "llm-memories" && (
                  <div style={sectionStyles.content}>
                    <pre style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(llmPrompt.memories, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Behavior Targets */}
              <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedSection(expandedSection === "llm-targets" ? null : "llm-targets")}
                  style={sectionStyles.header as any}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Behavior Targets ({llmPrompt.behaviorTargets?.totalCount || 0})
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{expandedSection === "llm-targets" ? "−" : "+"}</span>
                </div>
                {expandedSection === "llm-targets" && (
                  <div style={sectionStyles.content}>
                    <pre style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(llmPrompt.behaviorTargets, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Call History */}
              <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedSection(expandedSection === "llm-history" ? null : "llm-history")}
                  style={sectionStyles.header as any}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Call History ({llmPrompt.callHistory?.totalCalls || 0})
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{expandedSection === "llm-history" ? "−" : "+"}</span>
                </div>
                {expandedSection === "llm-history" && (
                  <div style={sectionStyles.content}>
                    <pre style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {JSON.stringify(llmPrompt.callHistory, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Full JSON */}
              <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
                <div
                  onClick={() => setExpandedSection(expandedSection === "llm-full" ? null : "llm-full")}
                  style={sectionStyles.header as any}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Full LLM Prompt JSON</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(JSON.stringify(llmPrompt, null, 2));
                        alert("LLM Prompt JSON copied to clipboard!");
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: 10,
                        background: "var(--button-success-bg)",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Copy JSON
                    </button>
                    <span style={{ color: "var(--text-muted)" }}>{expandedSection === "llm-full" ? "−" : "+"}</span>
                  </div>
                </div>
                {expandedSection === "llm-full" && (
                  <div style={sectionStyles.content}>
                    <pre style={{
                      margin: 0,
                      fontSize: 10,
                      color: "var(--text-on-dark)",
                      background: "var(--surface-dark)",
                      padding: 12,
                      borderRadius: 6,
                      whiteSpace: "pre-wrap",
                      maxHeight: 500,
                      overflowY: "auto",
                    }}>
                      {JSON.stringify(llmPrompt, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-placeholder)", background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>No LLM-friendly prompt available</div>
              <div style={{ fontSize: 12 }}>Re-compose the prompt to generate the JSON version</div>
            </div>
          )}
        </div>
      ) : (
        // Human-Readable View (original)
        <>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 12, background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Memories</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{inputs.memoriesCount || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Recent Calls</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{inputs.recentCallsCount || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Behavior Targets</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{inputs.behaviorTargetsCount || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Personality</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: inputs.personalityAvailable ? "var(--status-success-text)" : "var(--status-error-text)" }}>
                {inputs.personalityAvailable ? "Yes" : "No"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Spec Used</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--button-primary-bg)" }}>{inputs.specUsed || "defaults"}</div>
            </div>
          </div>

          {/* Spec Config */}
          {inputs.specConfig && (
            <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
              <div
                onClick={() => setExpandedSection(expandedSection === "config" ? null : "config")}
                style={sectionStyles.header as any}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Spec Configuration</span>
                <span style={{ color: "var(--text-muted)" }}>{expandedSection === "config" ? "−" : "+"}</span>
              </div>
              {expandedSection === "config" && (
                <div style={sectionStyles.content}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
                    {Object.entries(inputs.specConfig).map(([key, value]) => (
                      <div key={key}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>{key}</div>
                        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Caller Context Sections */}
          {Object.entries(sections).map(([sectionName, lines]) => (
            <div key={sectionName} style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
              <div
                onClick={() => setExpandedSection(expandedSection === sectionName ? null : sectionName)}
                style={sectionStyles.header as any}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{sectionName}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-placeholder)" }}>{lines.length} items</span>
                  <span style={{ color: "var(--text-muted)" }}>{expandedSection === sectionName ? "−" : "+"}</span>
                </div>
              </div>
              {expandedSection === sectionName && (
                <div style={sectionStyles.content}>
                  {lines.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {lines.map((line, i) => (
                        <li key={i} style={{ marginBottom: 4, color: "var(--text-secondary)" }}>
                          {line.replace(/^- /, "")}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ color: "var(--text-placeholder)", fontStyle: "italic" }}>No data</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Raw Context (collapsed by default) */}
          <div style={{ background: "var(--surface-primary)", borderRadius: 8, border: "1px solid var(--border-default)", overflow: "hidden" }}>
            <div
              onClick={() => setExpandedSection(expandedSection === "raw" ? null : "raw")}
              style={sectionStyles.header as any}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Raw Context</span>
              <span style={{ color: "var(--text-muted)" }}>{expandedSection === "raw" ? "−" : "+"}</span>
            </div>
            {expandedSection === "raw" && (
              <div style={sectionStyles.content}>
                <pre style={{
                  background: "var(--surface-dark)",
                  color: "var(--text-on-dark)",
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 11,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  maxHeight: 400,
                  overflowY: "auto",
                  margin: 0,
                }}>
                  {callerContext || "No caller context available"}
                </pre>
              </div>
            )}
          </div>
        </>
      )}

      {/* Timestamp */}
      <div style={{ fontSize: 11, color: "var(--text-placeholder)", textAlign: "right" }}>
        Composed: {latestPrompt.composedAt ? new Date(latestPrompt.composedAt).toLocaleString() : "Unknown"}
      </div>
    </div>
  );
}

// Shared Two-Column Targets Display Component
function TwoColumnTargetsDisplay({
  callerTargets,
  behaviorTargets,
  measurements = [],
  historyByParameter = {},
}: {
  callerTargets: any[];
  behaviorTargets: any[];
  measurements?: any[];
  historyByParameter?: Record<string, number[]>;
}) {
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null);

  // Create measurement lookup
  const measurementMap = new Map(measurements.map((m: any) => [m.parameterId, m.actualValue]));

  const scopeColors: Record<string, { bg: string; text: string }> = {
    SYSTEM: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
    PLAYBOOK: { bg: "var(--status-info-bg)", text: "var(--button-primary-bg)" },
    SEGMENT: { bg: "var(--status-warning-bg)", text: "var(--status-warning-text)" },
    CALLER: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
  };

  // Group targets by domainGroup
  const groupTargets = (targets: any[]) => {
    const grouped: Record<string, any[]> = {};
    for (const t of targets) {
      const group = t.parameter?.domainGroup || "Other";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(t);
    }
    return grouped;
  };

  const groupedCallerTargets = groupTargets(callerTargets);
  const groupedBehaviorTargets = groupTargets(behaviorTargets);

  const renderTargetCard = (target: any, prefix: string) => {
    const isExpanded = expandedTarget === `${prefix}-${target.parameterId}`;
    const actual = measurementMap.get(target.parameterId);
    const history = historyByParameter[target.parameterId] || [];
    const targetValue = target.targetValue;
    const delta = actual !== undefined ? actual - targetValue : null;

    // Map scope to slider colors
    const getScopeColor = (scope: string) => {
      const colorMap: Record<string, { primary: string; glow: string }> = {
        SYSTEM: { primary: "var(--text-placeholder)", glow: "var(--text-muted)" },
        PLAYBOOK: { primary: "var(--badge-indigo-text)", glow: "var(--button-primary-bg)" },
        SEGMENT: { primary: "var(--status-warning-border)", glow: "var(--status-warning-text)" },
        CALLER: { primary: "var(--status-success-text)", glow: "var(--status-success-text)" },
      };
      return colorMap[scope] || { primary: "var(--text-placeholder)", glow: "var(--text-muted)" };
    };

    const sliderColor = getScopeColor(target.effectiveScope);
    const scopeColor = scopeColors[target.effectiveScope]?.text || "var(--text-muted)";

    // Build tooltip text
    const historyInfo = history.length >= 2
      ? `\n\nHistory: ${history.length} calls\nRange: ${(Math.min(...history) * 100).toFixed(0)}% - ${(Math.max(...history) * 100).toFixed(0)}%`
      : "";
    const tooltipText = actual !== undefined
      ? `${target.parameter?.name || target.parameterId}\n\nTarget: ${(targetValue * 100).toFixed(0)}% (left bar)\nActual: ${(actual * 100).toFixed(0)}% (right bar)\nDelta: ${delta! >= 0 ? "+" : ""}${(delta! * 100).toFixed(0)}%${historyInfo}\n\n${target.parameter?.definition || ""}\n\nClick to view layer cascade and interpretation`
      : `${target.parameter?.name || target.parameterId}\n\nTarget: ${(targetValue * 100).toFixed(0)}%${historyInfo}\n\n${target.parameter?.definition || ""}\n\nClick to view layer cascade and interpretation`;

    return (
      <div
        key={`${prefix}-${target.parameterId}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* Use shared VerticalSlider component */}
        <VerticalSlider
          value={targetValue}
          secondaryValue={actual}
          color={sliderColor}
          onClick={() => setExpandedTarget(isExpanded ? null : `${prefix}-${target.parameterId}`)}
          isActive={isExpanded}
          tooltip={tooltipText}
          width={56}
          height={140}
          showGauge={false}
          historyPoints={history}
        />

        {/* Label */}
        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            fontWeight: 500,
            color: isExpanded ? scopeColor : "var(--text-muted)",
            textAlign: "center",
            maxWidth: 70,
            lineHeight: 1.2,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
            cursor: "pointer",
          }}
          onClick={() => setExpandedTarget(isExpanded ? null : `${prefix}-${target.parameterId}`)}
        >
          {target.parameter?.name?.replace("BEH-", "").replace(/-/g, " ") || target.parameterId}
        </div>

        {/* Scope indicator */}
        <div
          title={
            target.effectiveScope === "SYSTEM"
              ? "SYSTEM: Default value from system configuration"
              : target.effectiveScope === "PLAYBOOK"
              ? "PLAYBOOK: Value set by the playbook for this domain"
              : target.effectiveScope === "CALLER"
              ? "CALLER: Personalized value adjusted for this individual caller"
              : target.effectiveScope === "SEGMENT"
              ? "SEGMENT: Value adjusted for this caller's segment"
              : "Effective scope for this target value"
          }
          style={{
            marginTop: 4,
            fontSize: 8,
            padding: "1px 4px",
            borderRadius: 3,
            background: scopeColors[target.effectiveScope]?.bg || "var(--surface-secondary)",
            color: scopeColors[target.effectiveScope]?.text || "var(--text-muted)",
            fontWeight: 500,
            cursor: "help",
          }}
        >
          {target.effectiveScope}
        </div>

        {/* Expanded: show layer cascade below */}
        {isExpanded && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginTop: 8,
              background: "var(--surface-primary)",
              border: `2px solid ${scopeColor}`,
              borderRadius: 8,
              padding: 12,
              zIndex: 10,
              minWidth: 280,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
              Layer Cascade
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {target.layers?.map((layer: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 6,
                    background: "var(--background)",
                    borderRadius: 4,
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: scopeColors[layer.scope]?.bg || "var(--surface-secondary)",
                      color: scopeColors[layer.scope]?.text || "var(--text-muted)",
                      fontWeight: 500,
                      minWidth: 60,
                      textAlign: "center",
                    }}
                  >
                    {layer.scope}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {(layer.value * 100).toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
                    ({layer.source})
                  </span>
                  {idx === target.layers?.length - 1 && (
                    <span style={{ fontSize: 9, color: "var(--status-success-text)", fontWeight: 500 }}>
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Interpretation hints */}
            {(target.parameter?.interpretationHigh || target.parameter?.interpretationLow) && (
              <div style={{ marginTop: 12, fontSize: 10, borderTop: "1px solid var(--border-default)", paddingTop: 8 }}>
                <div style={{ color: "var(--text-muted)", marginBottom: 4, fontWeight: 500 }}>Interpretation:</div>
                {target.parameter?.interpretationHigh && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, color: "var(--status-success-text)" }}>High:</span>{" "}
                    <span style={{ color: "var(--text-muted)" }}>{target.parameter.interpretationHigh}</span>
                  </div>
                )}
                {target.parameter?.interpretationLow && (
                  <div>
                    <span style={{ fontWeight: 500, color: "var(--status-error-text)" }}>Low:</span>{" "}
                    <span style={{ color: "var(--text-muted)" }}>{target.parameter.interpretationLow}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderColumn = (targets: Record<string, any[]>, prefix: string, emptyMessage: string) => {
    if (Object.keys(targets).length === 0) {
      return (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-placeholder)", fontSize: 12 }}>
          {emptyMessage}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {Object.entries(targets).map(([group, groupTargets]) => (
          <div
            key={`${prefix}-${group}`}
            style={{
              flex: "0 0 auto",
              background: "var(--surface-secondary)",
              borderRadius: 12,
              padding: "12px 16px 16px",
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              title={`${group} parameters - ${groupTargets.length} target${groupTargets.length !== 1 ? "s" : ""}\n\nThese sliders show target values (left bar) and actual measured values (right bar) for behavior parameters in the ${group} category.\n\nClick any slider to see the layer cascade showing how SYSTEM → PLAYBOOK → CALLER targets combine.`}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 12,
                cursor: "help",
                display: "inline-block",
              }}
            >
              {group} ({groupTargets.length})
            </div>
            {/* Flex layout for vertical sliders - keeps group together */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "nowrap",
              }}
            >
              {groupTargets.map((target: any) => renderTargetCard(target, prefix))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (callerTargets.length === 0 && behaviorTargets.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No behaviour configuration</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Behaviour is configured via playbook. Personalized adjustments are computed by ADAPT specs after calls.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--status-info-bg)", border: "1px solid var(--status-info-border)", borderRadius: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-info-text)", marginBottom: 4 }}>
          🤖 Behaviour Configuration
        </div>
        <div style={{ fontSize: 12, color: "var(--status-info-text)" }}>
          Defines how the AI agent behaves in conversations with this caller
        </div>
      </div>

      {/* Legend */}
      <div
        title="Layer Cascade Explanation\n\nTarget values follow a cascade system where later layers override earlier ones:\n\n1. SYSTEM (gray) - Default values from system configuration\n2. PLAYBOOK (blue) - Domain-specific values from the playbook\n3. CALLER (green) - Personalized adjustments for this individual\n\nExample: If SYSTEM sets warmth to 60%, PLAYBOOK raises it to 75%, and CALLER adjusts to 85%, the effective value is 85%.\n\nClick any slider to see the complete cascade for that parameter."
        style={{
          display: "flex",
          gap: 12,
          fontSize: 11,
          color: "var(--text-muted)",
          flexWrap: "wrap",
          marginBottom: 16,
          cursor: "help",
        }}
      >
        <span style={{ fontWeight: 600 }}>Layer cascade:</span>
        {["SYSTEM", "PLAYBOOK", "CALLER"].map((scope) => (
          <span
            key={scope}
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: scopeColors[scope].bg,
              color: scopeColors[scope].text,
              fontWeight: 500,
            }}
          >
            {scope}
          </span>
        ))}
        <span style={{ color: "var(--text-placeholder)" }}>(later overrides earlier)</span>
      </div>

      {/* Two-column layout - flex for responsiveness */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {/* Personalized Adjustments Column */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <div
            title="Personalized Adjustments\n\nThese are behavior targets that have been automatically adjusted for this specific caller based on their interactions and preferences.\n\nADAPT specs analyze each call and fine-tune these parameters to optimize the AI's behavior for this individual.\n\nLeft bar: Target value\nRight bar: Most recent actual value from call analysis\n\nThese override the base playbook configuration."
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              background: "var(--status-success-bg)",
              borderRadius: 6,
              cursor: "help",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-success-text)" }}>
              ✨ Personalized Adjustments ({callerTargets.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--status-success-text)", marginTop: 2 }}>
              How behaviour adapts for this caller
            </div>
          </div>
          {renderColumn(groupedCallerTargets, "caller", "No personalized adjustments yet")}
        </div>

        {/* Base Configuration Column */}
        <div style={{ flex: "1 1 400px", minWidth: 0 }}>
          <div
            title="Base Configuration\n\nThese are the baseline behavior targets defined by the playbook for this domain.\n\nThey provide the starting point before any personalization occurs.\n\nLeft bar: Target value\nRight bar: Most recent actual value from call analysis\n\nCaller-specific adjustments (left column) will override these base values."
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              background: "var(--badge-blue-bg)",
              borderRadius: 6,
              cursor: "help",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--status-info-text)" }}>
              ⚙️ Base Configuration ({behaviorTargets.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--status-info-text)", marginTop: 2 }}>
              Behaviour baseline from playbook
            </div>
          </div>
          {renderColumn(groupedBehaviorTargets, "behavior", "No base configuration")}
        </div>
      </div>
    </div>
  );
}

// Targets Tab - uses shared TwoColumnTargetsDisplay
// Scores Tab - per-call scores (agent behavior has its own Behaviour tab via BehaviorMeasurement)
function ScoresTab({ scores }: { scores: any[] }) {
  const [expandedScore, setExpandedScore] = useState<string | null>(null);

  const renderScoreCard = (score: any) => {
    const isExpanded = expandedScore === score.id;

    return (
      <div
        key={score.id}
        style={{
          background: "var(--surface-primary)",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          onClick={() => setExpandedScore(isExpanded ? null : score.id)}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            padding: 12,
            cursor: "pointer",
          }}
        >
          {/* Score gauge */}
          <div style={{ width: 60, textAlign: "center" }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: score.score >= 0.7 ? "var(--status-success-text)" : score.score >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
              }}
            >
              {(score.score * 100).toFixed(0)}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
              {(score.confidence * 100).toFixed(0)}% conf
            </div>
          </div>

          {/* Details */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {score.parameter?.name || score.parameterId}
            </div>
            {score.parameter?.definition && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                {score.parameter.definition}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 10, color: "var(--text-placeholder)", flexWrap: "wrap" }}>
              <span>Scored by {score.scoredBy || "unknown"}</span>
              {score.analysisSpec && (
                <>
                  <span>•</span>
                  <span style={{ background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>
                    {score.analysisSpec.slug || score.analysisSpec.name}
                  </span>
                </>
              )}
              {(score.reasoning || (score.evidence && score.evidence.length > 0)) && (
                <span style={{ color: "var(--button-primary-bg)" }}>{isExpanded ? "▼ less" : "▶ more"}</span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded: show reasoning and evidence */}
        {isExpanded && (
          <div style={{ borderTop: "1px solid var(--border-default)", padding: 12, background: "var(--background)" }}>
            {/* Source Spec info */}
            {score.analysisSpec && (
              <div style={{ marginBottom: 12, padding: 8, background: "var(--badge-purple-bg)", borderRadius: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--badge-purple-text)", marginBottom: 4 }}>
                  Source Spec
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  <strong>{score.analysisSpec.name}</strong> ({score.analysisSpec.slug})
                </div>
              </div>
            )}

            {/* Reasoning */}
            {score.reasoning && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Reasoning
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {score.reasoning}
                </div>
              </div>
            )}

            {/* Evidence */}
            {score.evidence && score.evidence.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Evidence ({score.evidence.length} excerpt{score.evidence.length > 1 ? "s" : ""})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {score.evidence.map((e: string, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                        padding: 8,
                        background: "var(--surface-primary)",
                        borderRadius: 4,
                        borderLeft: "3px solid var(--status-info-border)",
                      }}
                    >
                      "{e}"
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (scores.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No scores yet. Run MEASURE to analyze this call.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {scores.map(renderScoreCard)}
    </div>
  );
}

// Memories Tab - enhanced with expandable source/evidence info
function MemoriesTab({ memories }: { memories: any[] }) {
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);

  if (memories.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No memories extracted. Run LEARN to extract memories from this call.
      </div>
    );
  }

  const categoryColors: Record<string, { bg: string; text: string }> = {
    FACT: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)" },
    PREFERENCE: { bg: "var(--badge-yellow-bg)", text: "var(--badge-yellow-text)" },
    EVENT: { bg: "var(--badge-green-bg)", text: "var(--badge-green-text)" },
    TOPIC: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-text)" },
    CONTEXT: { bg: "var(--surface-secondary)", text: "var(--text-secondary)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {memories.map((memory: any) => {
        const style = categoryColors[memory.category] || categoryColors.CONTEXT;
        const isExpanded = expandedMemory === memory.id;

        return (
          <div
            key={memory.id}
            style={{
              background: "var(--surface-primary)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              overflow: "hidden",
            }}
          >
            {/* Header row - clickable */}
            <button
              onClick={() => setExpandedMemory(isExpanded ? null : memory.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 10,
                background: isExpanded ? "var(--background)" : "var(--surface-primary)",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  background: style.bg,
                  color: style.text,
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {memory.category}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{memory.key}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>= "{memory.value}"</span>
              <span style={{ fontSize: 10, color: "var(--text-placeholder)", flexShrink: 0 }}>
                {(memory.confidence * 100).toFixed(0)}% conf
              </span>
              <span style={{ fontSize: 12, color: "var(--text-placeholder)", flexShrink: 0 }}>
                {isExpanded ? "▼" : "▶"}
              </span>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "var(--background)",
                  borderTop: "1px solid var(--border-default)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Source spec/extractor */}
                {memory.extractedBy && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      EXTRACTED BY
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        padding: "6px 10px",
                        background: "var(--badge-purple-bg)",
                        color: "var(--badge-purple-text)",
                        borderRadius: 4,
                        display: "inline-block",
                      }}
                    >
                      {memory.extractedBy}
                    </div>
                  </div>
                )}

                {/* Evidence */}
                {memory.evidence && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      EVIDENCE
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        background: "var(--surface-primary)",
                        padding: 10,
                        borderRadius: 4,
                        border: "1px solid var(--border-default)",
                        fontStyle: "italic",
                        lineHeight: 1.5,
                      }}
                    >
                      "{memory.evidence}"
                    </div>
                  </div>
                )}

                {/* Extraction timestamp */}
                {memory.extractedAt && (
                  <div style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
                    Extracted: {new Date(memory.extractedAt).toLocaleString()}
                    {memory.expiresAt && (
                      <span> · Expires: {new Date(memory.expiresAt).toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Measurements Tab - Now uses slider visualization for consistency with Targets tab
function MeasurementsTab({ callerTargets = [], behaviorTargets = [], measurements, rewardScore }: { callerTargets?: any[]; behaviorTargets?: any[]; measurements: any[]; rewardScore: any }) {
  if (measurements.length === 0 && behaviorTargets.length === 0 && callerTargets.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No behaviour data. Run BEHAVIOUR to measure behaviour.
      </div>
    );
  }

  // Format measurements for the display
  const formattedMeasurements = measurements.map((m: any) => ({
    parameterId: m.parameterId,
    actualValue: m.actualValue,
  }));

  // If we have explicit behavior targets, use them directly
  // Otherwise fall back to synthesizing from measurements
  const effectiveBehaviorTargets = behaviorTargets.length > 0
    ? behaviorTargets
    : measurements.map((m: any) => ({
        parameterId: m.parameterId,
        targetValue: m.targetValue || 0.5,
        effectiveScope: "MEASUREMENT" as any,
        parameter: m.parameter,
      }));

  return <TwoColumnTargetsDisplay callerTargets={callerTargets} behaviorTargets={effectiveBehaviorTargets} measurements={formattedMeasurements} />;
}

// Legacy card-based measurements view (kept for reference, can be removed later)
function MeasurementsTabLegacy({ measurements, rewardScore }: { measurements: any[]; rewardScore: any }) {
  const [expandedMeasurement, setExpandedMeasurement] = useState<string | null>(null);

  if (measurements.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 20, color: "var(--text-placeholder)" }}>
        No behaviour measurements. Run BEHAVIOUR to measure behaviour.
      </div>
    );
  }

  // Parse parameter diffs from reward score
  const diffs = (rewardScore?.parameterDiffs || []) as any[];
  const diffMap = new Map(diffs.map((d: any) => [d.parameterId, d]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {measurements.map((m: any) => {
        const diff = diffMap.get(m.parameterId);
        const isExpanded = expandedMeasurement === m.id;

        return (
          <div
            key={m.id}
            style={{
              background: "var(--surface-primary)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              overflow: "hidden",
            }}
          >
            {/* Row header - clickable */}
            <button
              onClick={() => setExpandedMeasurement(isExpanded ? null : m.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 12,
                background: isExpanded ? "var(--background)" : "var(--surface-primary)",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {/* Actual value */}
              <div style={{ width: 60, textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {(m.actualValue * 100).toFixed(0)}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-placeholder)" }}>actual</div>
              </div>

              {/* Target comparison if available */}
              {diff && (
                <div style={{ width: 60, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>
                    {(diff.target * 100).toFixed(0)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-placeholder)" }}>target</div>
                </div>
              )}

              {/* Delta indicator */}
              {diff && (
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: diff.diff < 0.1 ? "var(--status-success-bg)" : diff.diff < 0.3 ? "var(--status-warning-bg)" : "var(--status-error-bg)",
                    color: diff.diff < 0.1 ? "var(--status-success-text)" : diff.diff < 0.3 ? "var(--status-warning-text)" : "var(--status-error-text)",
                  }}
                >
                  {diff.diff < 0.1 ? "On Target" : diff.diff < 0.3 ? "Close" : "Off Target"}
                </div>
              )}

              {/* Parameter name */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {m.parameter?.name || m.parameterId}
                </div>
                {m.evidence && m.evidence.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {m.evidence[0]}
                  </div>
                )}
              </div>

              {/* Expand indicator */}
              <span style={{ color: "var(--text-placeholder)", fontSize: 12 }}>{isExpanded ? "▼" : "▶"}</span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--border-default)", background: "var(--background)" }}>
                {/* Parameter definition */}
                {m.parameter?.definition && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Definition</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.parameter.definition}</div>
                  </div>
                )}

                {/* All evidence items */}
                {m.evidence && m.evidence.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Evidence</div>
                    {m.evidence.map((e: string, i: number) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 0", borderLeft: "2px solid var(--border-default)", paddingLeft: 8, marginBottom: 4 }}>
                        {e}
                      </div>
                    ))}
                  </div>
                )}

                {/* Target comparison details */}
                {diff && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Target Comparison</div>
                    <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Actual: </span>
                        <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{(diff.actual * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Target: </span>
                        <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{(diff.target * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Difference: </span>
                        <span style={{
                          fontWeight: 600,
                          color: diff.diff < 0.1 ? "var(--status-success-text)" : diff.diff < 0.3 ? "var(--status-warning-text)" : "var(--status-error-text)"
                        }}>
                          {(diff.diff * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confidence */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Confidence</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, maxWidth: 200, height: 6, background: "var(--border-default)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${(m.confidence || 0.75) * 100}%`,
                          height: "100%",
                          background: m.confidence >= 0.8 ? "var(--status-success-text)" : m.confidence >= 0.6 ? "var(--status-warning-text)" : "var(--status-error-text)",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                      {((m.confidence || 0.75) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--text-placeholder)" }}>
                  <span>Parameter ID: {m.parameterId}</span>
                  <span>Measurement ID: {m.id?.slice(0, 8)}...</span>
                  {m.createdAt && <span>Measured: {new Date(m.createdAt).toLocaleString()}</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Transcript Tab
function TranscriptTab({ transcript }: { transcript: string }) {
  return (
    <pre
      style={{
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        fontFamily: "ui-monospace, monospace",
        color: "var(--text-secondary)",
        maxHeight: 400,
        overflow: "auto",
        background: "var(--surface-primary)",
        padding: 12,
        borderRadius: 6,
        border: "1px solid var(--border-default)",
      }}
    >
      {transcript}
    </pre>
  );
}

// Memories Section
function MemoriesSection({
  memories,
  summary,
  expandedMemory,
  setExpandedMemory,
}: {
  memories: Memory[];
  summary: MemorySummary | null;
  expandedMemory: string | null;
  setExpandedMemory: (id: string | null) => void;
}) {
  return (
    <div>
      {/* Summary Cards */}
      {summary && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Facts", count: summary.factCount, color: CATEGORY_COLORS.FACT },
            { label: "Preferences", count: summary.preferenceCount, color: CATEGORY_COLORS.PREFERENCE },
            { label: "Events", count: summary.eventCount, color: CATEGORY_COLORS.EVENT },
            { label: "Topics", count: summary.topicCount, color: CATEGORY_COLORS.TOPIC },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "10px 16px",
                background: stat.color.bg,
                borderRadius: 8,
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, color: stat.color.text }}>{stat.count}</div>
              <div style={{ fontSize: 11, color: stat.color.text }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Memories List */}
      {memories.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No memories extracted yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Run the Memory Extractor agent</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {memories.map((memory) => {
            const isExpanded = expandedMemory === memory.id;
            const categoryStyle = CATEGORY_COLORS[memory.category] || CATEGORY_COLORS.FACT;
            return (
              <div key={memory.id} style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedMemory(isExpanded ? null : memory.id)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: isExpanded ? "var(--background)" : "var(--surface-primary)",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        background: categoryStyle.bg,
                        color: categoryStyle.text,
                        borderRadius: 4,
                      }}
                    >
                      {memory.category}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{memory.key}</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>= "{memory.value}"</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>{(memory.confidence * 100).toFixed(0)}%</span>
                    <span style={{ fontSize: 12, color: "var(--text-placeholder)" }}>{isExpanded ? "▼" : "▶"}</span>
                  </div>
                </button>
                {isExpanded && memory.evidence && (
                  <div style={{ padding: 16, borderTop: "1px solid var(--border-default)", background: "var(--background)", fontSize: 13 }}>
                    <div style={{ fontWeight: 500, color: "var(--text-muted)", marginBottom: 4 }}>Evidence:</div>
                    <div style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>"{memory.evidence}"</div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-placeholder)" }}>
                      Extracted {new Date(memory.extractedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Personality Section
function PersonalitySection({
  personality,
  observations,
}: {
  personality: PersonalityProfile | null;
  observations: PersonalityObservation[];
}) {
  if (!personality && observations.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No personality data yet</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Run the Personality Analyzer agent</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Aggregated Profile */}
      {personality && (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>
            Aggregated Profile
            {personality.confidenceScore !== null && (
              <span style={{ fontWeight: 400, color: "var(--text-placeholder)", marginLeft: 8 }}>
                ({(personality.confidenceScore * 100).toFixed(0)}% confidence)
              </span>
            )}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(TRAIT_INFO).map(([key, info]) => {
              const value = personality[key as keyof typeof TRAIT_INFO] as number | null;
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{info.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{value !== null ? (value * 100).toFixed(0) : "—"}</span>
                  </div>
                  <div style={{ height: 10, background: "var(--border-default)", borderRadius: 5, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(value || 0) * 100}%`,
                        background: info.color,
                        borderRadius: 5,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-placeholder)", marginTop: 4 }}>{info.desc}</div>
                </div>
              );
            })}
          </div>
          {personality.lastAggregatedAt && (
            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-placeholder)" }}>
              Last updated: {new Date(personality.lastAggregatedAt).toLocaleString()} ({personality.observationsUsed} observations)
            </div>
          )}
        </div>
      )}

      {/* Communication Preferences */}
      {personality && (personality.preferredTone || personality.preferredLength || personality.technicalLevel) && (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>Communication Preferences</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {personality.preferredTone && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Preferred Tone</span>
                <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{personality.preferredTone}</span>
              </div>
            )}
            {personality.preferredLength && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Response Length</span>
                <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{personality.preferredLength}</span>
              </div>
            )}
            {personality.technicalLevel && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Technical Level</span>
                <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{personality.technicalLevel}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Observations Timeline */}
      {observations.length > 0 && (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>
            Observation History ({observations.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {observations.slice(0, 10).map((obs) => (
              <div key={obs.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-placeholder)", width: 140 }}>{new Date(obs.observedAt).toLocaleString()}</span>
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  {Object.entries(TRAIT_INFO).map(([key, info]) => {
                    const value = obs[key as keyof typeof TRAIT_INFO] as number | null;
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>{info.label.charAt(0)}</span>
                        <div style={{ width: 40, height: 6, background: "var(--border-default)", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${(value || 0) * 100}%`,
                              background: info.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
                  {obs.confidence !== null ? `${(obs.confidence * 100).toFixed(0)}% conf` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Scores Section - slider-based display with click-to-expand details
function ScoresSection({ scores }: { scores: CallScore[] }) {
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [expandedScore, setExpandedScore] = useState<string | null>(null);

  if (!scores || scores.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No scores yet</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Run analysis to generate parameter scores</div>
      </div>
    );
  }

  // Group all scores by parameter (agent behavior has its own Behaviour tab via BehaviorMeasurement)
  const groupByParameter = (scoreList: CallScore[]) => {
    const grouped: Record<string, CallScore[]> = {};
    for (const score of scoreList) {
      const key = score.parameterId;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(score);
    }
    return grouped;
  };

  const allGrouped = groupByParameter(scores);

  // Score color helper
  const scoreColor = (v: number) => ({
    primary: v >= 0.7 ? "var(--status-success-text)" : v >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
    glow: v >= 0.7 ? "var(--status-success-text)" : v >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
  });


  // Render a group of score sliders
  const renderScoreSliders = (grouped: Record<string, CallScore[]>, groupColor: { primary: string; glow: string }, groupTitle: string, emptyMessage: string) => {
    const entries = Object.entries(grouped);
    if (entries.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-placeholder)", fontSize: 12 }}>
          {emptyMessage}
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {entries.map(([parameterId, paramScores]) => {
            const avg = paramScores.reduce((sum, s) => sum + s.score, 0) / paramScores.length;
            const paramName = paramScores[0]?.parameter?.name || parameterId;
            const isExpanded = expandedParam === parameterId;
            const color = scoreColor(avg);

            // Build history sorted oldest→newest
            const history = [...paramScores]
              .sort((a, b) => new Date(a.call.createdAt).getTime() - new Date(b.call.createdAt).getTime())
              .map(s => s.score);

            const historyInfo = history.length >= 2
              ? `\n\nHistory: ${history.length} calls\nRange: ${(Math.min(...history) * 100).toFixed(0)}% - ${(Math.max(...history) * 100).toFixed(0)}%`
              : "";
            const tooltip = `${paramName}\n\nAverage: ${(avg * 100).toFixed(0)}% (${paramScores.length} scores)${historyInfo}\n\n${paramScores[0]?.parameter?.definition || ""}\n\nClick for details`;

            return (
              <div key={parameterId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <VerticalSlider
                  value={avg}
                  color={color}
                  onClick={() => setExpandedParam(isExpanded ? null : parameterId)}
                  isActive={isExpanded}
                  tooltip={tooltip}
                  width={56}
                  height={140}
                  showGauge={false}
                  historyPoints={history}
                />

                {/* Label */}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 9,
                    fontWeight: 500,
                    color: isExpanded ? color.primary : "var(--text-muted)",
                    textAlign: "center",
                    maxWidth: 70,
                    lineHeight: 1.2,
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedParam(isExpanded ? null : parameterId)}
                >
                  {paramName}
                </div>

                {/* Sparkline - now handled automatically by VerticalSlider when historyPoints is provided */}
              </div>
            );
          })}
        </div>

        {/* Expanded detail panel */}
        {expandedParam && grouped[expandedParam] && (() => {
          const paramScores = grouped[expandedParam];
          const paramName = paramScores[0]?.parameter?.name || expandedParam;
          const avg = paramScores.reduce((sum, s) => sum + s.score, 0) / paramScores.length;
          const sorted = [...paramScores].sort((a, b) => new Date(b.call.createdAt).getTime() - new Date(a.call.createdAt).getTime());

          return (
            <div style={{
              marginTop: 16,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{paramName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{paramScores[0]?.parameter?.definition || ""}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(avg).primary }}>
                  {(avg * 100).toFixed(0)}% <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-placeholder)" }}>avg of {paramScores.length}</span>
                </div>
              </div>

              {/* Individual scores */}
              {sorted.map((s) => {
                const isScoreExpanded = expandedScore === s.id;
                return (
                  <div key={s.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <button
                      onClick={() => setExpandedScore(isScoreExpanded ? null : s.id)}
                      style={{
                        width: "100%",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: isScoreExpanded ? "var(--background)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 44,
                        padding: "3px 6px",
                        textAlign: "center",
                        background: s.score >= 0.7 ? "var(--status-success-bg)" : s.score >= 0.4 ? "var(--status-warning-bg)" : "var(--status-error-bg)",
                        color: s.score >= 0.7 ? "var(--status-success-text)" : s.score >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                      }}>
                        {(s.score * 100).toFixed(0)}
                      </div>
                      <div style={{ width: 50, fontSize: 11, color: "var(--text-muted)" }}>
                        {(s.confidence * 100).toFixed(0)}% conf
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(s.call.createdAt).toLocaleString()}
                      </div>
                      {s.analysisSpec && (
                        <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", borderRadius: 4, fontWeight: 500 }}>
                          {s.analysisSpec.slug || s.analysisSpec.name}
                        </span>
                      )}
                      <span style={{ color: "var(--text-placeholder)", fontSize: 12 }}>{isScoreExpanded ? "▼" : "▶"}</span>
                    </button>

                    {isScoreExpanded && (
                      <div style={{ padding: "8px 16px 12px", background: "var(--background)", marginLeft: 56 }}>
                        {s.evidence && s.evidence.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Evidence</div>
                            {s.evidence.map((e: string, i: number) => (
                              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "3px 0", borderLeft: "2px solid var(--border-default)", paddingLeft: 8, marginBottom: 3 }}>
                                {e}
                              </div>
                            ))}
                          </div>
                        )}
                        {s.reasoning && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Reasoning</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>{s.reasoning}</div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--text-placeholder)" }}>
                          <span>Call ID: {s.callId?.slice(0, 8)}...</span>
                          <span>Scored: {new Date(s.scoredAt).toLocaleString()}</span>
                          {s.analysisSpecId && <span>Spec: {s.analysisSpecId.slice(0, 8)}...</span>}
                          {s.scoredBy && <span>By: {s.scoredBy}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <SliderGroup
      title={`Caller Scores (${Object.keys(allGrouped).length})`}
      color={{ primary: "var(--button-primary-bg)", glow: "var(--button-primary-bg)" }}
    >
      {renderScoreSliders(allGrouped, { primary: "var(--button-primary-bg)", glow: "var(--button-primary-bg)" }, "Scores", "No scores yet")}
    </SliderGroup>
  );
}

// Learning Section - displays goals, curriculum progress and learner profile
function ProgressRing({ progress, size = 64, strokeWidth = 5, color }: { progress: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-default)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.3s ease" }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" style={{ transform: "rotate(90deg)", transformOrigin: "center", fontSize: size * 0.22, fontWeight: 700, fill: color, fontFamily: "ui-monospace, monospace" }}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

function LearningSection({
  curriculum,
  learnerProfile,
  goals,
  callerId
}: {
  curriculum: CurriculumProgress | null | undefined;
  learnerProfile: LearnerProfile | null | undefined;
  goals: Goal[] | undefined;
  callerId: string;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const hasCurriculum = curriculum && curriculum.hasData;
  const hasProfile = learnerProfile && (
    learnerProfile.learningStyle ||
    learnerProfile.pacePreference ||
    learnerProfile.interactionStyle ||
    learnerProfile.preferredModality ||
    learnerProfile.questionFrequency ||
    learnerProfile.feedbackStyle ||
    Object.keys(learnerProfile.priorKnowledge).length > 0
  );
  const hasGoals = goals && goals.length > 0;

  if (!hasCurriculum && !hasProfile && !hasGoals) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", background: "var(--background)", borderRadius: "12px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎯</div>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>No goals yet</div>
        <div style={{ fontSize: "14px", marginTop: "4px" }}>Goals are created automatically when a caller is assigned to a domain</div>
      </div>
    );
  }

  const GOAL_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; glow: string }> = {
    LEARN: { label: "Learn", icon: "📚", color: "#22c55e", glow: "#16a34a" },
    ACHIEVE: { label: "Achieve", icon: "🏆", color: "#f59e0b", glow: "#d97706" },
    CHANGE: { label: "Change", icon: "🔄", color: "#8b5cf6", glow: "#7c3aed" },
    CONNECT: { label: "Connect", icon: "🤝", color: "#06b6d4", glow: "#0891b2" },
    SUPPORT: { label: "Support", icon: "💚", color: "#10b981", glow: "#059669" },
    CREATE: { label: "Create", icon: "🎨", color: "#ec4899", glow: "#db2777" },
  };

  const MODULE_STATUS_COLORS: Record<string, { primary: string; glow: string }> = {
    completed: { primary: "#22c55e", glow: "#16a34a" },
    in_progress: { primary: "#3b82f6", glow: "#2563eb" },
    not_started: { primary: "#64748b", glow: "#475569" },
  };

  const activeGoals = goals?.filter(g => g.status === 'ACTIVE' || g.status === 'PAUSED') || [];
  const archivedGoals = goals?.filter(g => g.status === 'ARCHIVED' || g.status === 'COMPLETED') || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Active Goals — each as a visual card */}
      {activeGoals.map((goal) => {
        const typeConfig = GOAL_TYPE_CONFIG[goal.type] || { label: goal.type, icon: "🎯", color: "#64748b", glow: "#475569" };
        const isLearn = goal.type === 'LEARN' && hasCurriculum && curriculum;

        return (
          <div key={goal.id}>
            {isLearn ? (
              /* LEARN goal: SliderGroup with curriculum modules as sliders */
              <SliderGroup
                title={`${typeConfig.icon} ${goal.name} — ${Math.round(goal.progress * 100)}% — ${curriculum.completedCount}/${curriculum.totalModules} modules`}
                color={{ primary: typeConfig.color, glow: typeConfig.glow }}
              >
                {/* Goal metadata strip */}
                <div style={{ width: "100%", display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", marginBottom: 4, flexWrap: "wrap" }}>
                  {goal.description && <span>{goal.description}</span>}
                  {goal.playbook && <span style={{ opacity: 0.7 }}>{goal.playbook.name} v{goal.playbook.version}</span>}
                  {goal.startedAt && <span style={{ opacity: 0.7 }}>Started {new Date(goal.startedAt).toLocaleDateString()}</span>}
                  {curriculum.nextModule && (
                    <span style={{ color: "#22c55e", fontWeight: 600 }}>
                      Next: {curriculum.modules.find(m => m.id === curriculum.nextModule)?.name || curriculum.nextModule}
                    </span>
                  )}
                </div>
                {/* One slider per curriculum module */}
                {curriculum.modules.map((mod) => {
                  const modColor = MODULE_STATUS_COLORS[mod.status] || MODULE_STATUS_COLORS.not_started;
                  const isCurrent = mod.id === curriculum.nextModule;
                  return (
                    <VerticalSlider
                      key={mod.id}
                      value={mod.mastery}
                      targetValue={0.8}
                      color={modColor}
                      label={mod.name}
                      tooltip={`${mod.name}\nStatus: ${mod.status}\nMastery: ${Math.round(mod.mastery * 100)}%\n${mod.description}`}
                      width={56}
                      height={120}
                      isActive={isCurrent}
                      showSparkline={false}
                    />
                  );
                })}
              </SliderGroup>
            ) : (
              /* Non-LEARN goal: Progress ring card */
              <div style={{
                background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
                borderRadius: 16,
                padding: 20,
                border: "1px solid var(--border-default)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ProgressRing progress={goal.progress} size={72} color={typeConfig.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{typeConfig.icon}</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", background: `${typeConfig.color}22`, color: typeConfig.color, borderRadius: 4, fontWeight: 600 }}>
                        {typeConfig.label}
                      </span>
                      <span style={{ fontSize: 10, padding: "2px 8px", background: goal.status === 'ACTIVE' ? "#22c55e22" : "#f59e0b22", color: goal.status === 'ACTIVE' ? "#22c55e" : "#f59e0b", borderRadius: 4, fontWeight: 600 }}>
                        {goal.status === 'ACTIVE' ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{goal.name}</div>
                    {goal.description && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{goal.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", marginTop: 8, flexWrap: "wrap" }}>
                      {goal.playbook && <span>{goal.playbook.name} v{goal.playbook.version}</span>}
                      {goal.startedAt && <span>Started {new Date(goal.startedAt).toLocaleDateString()}</span>}
                      {goal.targetDate && <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Learner Profile — compact chips */}
      {hasProfile && learnerProfile && (
        <div style={{
          background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
          borderRadius: 16,
          padding: 20,
          border: "1px solid var(--border-default)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 8px #7c3aed" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.5px" }}>Learner Profile</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {learnerProfile.learningStyle && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Style:</strong> {learnerProfile.learningStyle}
              </span>
            )}
            {learnerProfile.pacePreference && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Pace:</strong> {learnerProfile.pacePreference}
              </span>
            )}
            {learnerProfile.interactionStyle && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Interaction:</strong> {learnerProfile.interactionStyle}
              </span>
            )}
            {learnerProfile.preferredModality && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Modality:</strong> {learnerProfile.preferredModality}
              </span>
            )}
            {learnerProfile.questionFrequency && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Questions:</strong> {learnerProfile.questionFrequency}
              </span>
            )}
            {learnerProfile.feedbackStyle && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Feedback:</strong> {learnerProfile.feedbackStyle}
              </span>
            )}
            {Object.entries(learnerProfile.priorKnowledge).map(([domain, level]) => (
              <span key={domain} style={{ fontSize: 11, padding: "4px 10px", background: "var(--status-info-bg)", border: "1px solid var(--status-info-border)", borderRadius: 6, color: "var(--status-info-text)" }}>
                <strong>{domain}:</strong> {level}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Archived Goals — collapsed by default */}
      {archivedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ transform: showArchived ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>&#9654;</span>
            {archivedGoals.length} archived goal{archivedGoals.length > 1 ? "s" : ""}
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {archivedGoals.map((goal) => {
                const typeConfig = GOAL_TYPE_CONFIG[goal.type] || { label: goal.type, icon: "🎯", color: "#64748b", glow: "#475569" };
                return (
                  <div
                    key={goal.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      opacity: 0.7,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{typeConfig.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", flex: 1 }}>{goal.name}</span>
                    <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: typeConfig.color, fontWeight: 600 }}>
                      {Math.round(goal.progress * 100)}%
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--background)", borderRadius: 4, color: "var(--text-muted)" }}>
                      {goal.status === 'COMPLETED' ? 'Completed' : 'Archived'}
                    </span>
                    {goal.playbook && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{goal.playbook.name}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Unified Prompt Section - combines Human-Readable and LLM-Friendly views
function UnifiedPromptSection({
  prompts,
  loading,
  composing,
  expandedPrompt,
  setExpandedPrompt,
  onCompose,
  onRefresh,
}: {
  prompts: ComposedPrompt[];
  loading: boolean;
  composing: boolean;
  expandedPrompt: string | null;
  setExpandedPrompt: (id: string | null) => void;
  onCompose: () => void;
  onRefresh: () => void;
}) {
  const [viewMode, setViewMode] = useState<"human" | "llm">("human");
  const [llmViewMode, setLlmViewMode] = useState<"pretty" | "raw">("pretty");

  // Get the most recent active prompt
  const activePrompt = prompts.find((p) => p.status === "active") || prompts[0];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading prompts...</div>
    );
  }

  if (!activePrompt) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--background)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No Prompt Available</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
            Compose a prompt to generate personalized next-call guidance for this caller.
          </div>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>
    );
  }

  const llm = activePrompt.llmPrompt;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with View Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Next Prompt</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Generated {new Date(activePrompt.composedAt).toLocaleString()} • {activePrompt.status.toUpperCase()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Main View Toggle: Human vs LLM */}
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <button
              onClick={() => setViewMode("human")}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                background: viewMode === "human" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "human" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              📖 Human-Readable
            </button>
            <button
              onClick={() => setViewMode("llm")}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 500,
                background: viewMode === "llm" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "llm" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              🤖 LLM-Friendly
            </button>
          </div>
          <button
            onClick={onRefresh}
            style={{
              padding: "8px 12px",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            ↻
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              padding: "8px 16px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "..." : "Compose New"}
          </button>
        </div>
      </div>

      {/* Human-Readable View */}
      {viewMode === "human" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Prompt Content */}
          <div
            style={{
              background: "var(--surface-dark)",
              color: "var(--text-on-dark)",
              padding: 20,
              borderRadius: 12,
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, monospace",
              maxHeight: 500,
              overflowY: "auto",
              border: "1px solid var(--border-dark)",
            }}
          >
            {activePrompt.prompt}
          </div>

          {/* Composition Inputs */}
          {activePrompt.inputs && (
            <div style={{ padding: 12, background: "var(--status-warning-bg)", borderRadius: 8, border: "1px solid var(--status-warning-border)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 8 }}>
                Composition Inputs
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {activePrompt.inputs.memoriesCount !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Memories: {activePrompt.inputs.memoriesCount}
                  </span>
                )}
                {activePrompt.inputs.personalityAvailable !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Personality: {activePrompt.inputs.personalityAvailable ? "Yes" : "No"}
                  </span>
                )}
                {activePrompt.inputs.recentCallsCount !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Recent Calls: {activePrompt.inputs.recentCallsCount}
                  </span>
                )}
                {activePrompt.inputs.behaviorTargetsCount !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                    Behavior Targets: {activePrompt.inputs.behaviorTargetsCount}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Copy Button */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activePrompt.prompt);
                alert("Copied to clipboard!");
              }}
              style={{
                padding: "8px 16px",
                background: "var(--button-primary-bg)",
                color: "var(--text-on-dark)",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              📋 Copy Prompt
            </button>
          </div>

          {/* Prompt History */}
          {prompts.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                Prompt History ({prompts.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prompts.slice(1, 5).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setExpandedPrompt(expandedPrompt === p.id ? null : p.id)}
                    style={{
                      padding: 12,
                      background: "var(--background)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 6px",
                            background: p.status === "active" ? "var(--status-success-bg)" : "var(--border-default)",
                            color: p.status === "active" ? "var(--status-success-text)" : "var(--text-muted)",
                            borderRadius: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          {p.status}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {new Date(p.composedAt).toLocaleString()}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-placeholder)" }}>{expandedPrompt === p.id ? "−" : "+"}</span>
                    </div>
                    {expandedPrompt === p.id && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "var(--surface-dark)",
                          color: "var(--text-on-dark)",
                          borderRadius: 6,
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                          maxHeight: 200,
                          overflowY: "auto",
                        }}
                      >
                        {p.prompt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LLM-Friendly View */}
      {viewMode === "llm" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!llm ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                background: "var(--background)",
                borderRadius: 12,
                border: "1px dashed var(--border-default)",
              }}
            >
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                No structured LLM data available for this prompt. Compose a new prompt to generate.
              </div>
            </div>
          ) : (
            <>
              {/* Pretty/Raw Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Structured JSON for AI agent consumption</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
                    <button
                      onClick={() => setLlmViewMode("pretty")}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: llmViewMode === "pretty" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                        color: llmViewMode === "pretty" ? "var(--text-on-dark)" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setLlmViewMode("raw")}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        background: llmViewMode === "raw" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                        color: llmViewMode === "raw" ? "var(--text-on-dark)" : "var(--text-secondary)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Raw JSON
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(llm, null, 2));
                      alert("Copied JSON to clipboard!");
                    }}
                    style={{
                      padding: "4px 10px",
                      background: "var(--surface-secondary)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    📋 Copy JSON
                  </button>
                </div>
              </div>

              {llmViewMode === "raw" ? (
                <div
                  style={{
                    background: "var(--surface-dark)",
                    color: "var(--text-on-dark-muted)",
                    padding: 20,
                    borderRadius: 12,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                    whiteSpace: "pre-wrap",
                    maxHeight: 600,
                    overflowY: "auto",
                    border: "1px solid var(--border-dark)",
                  }}
                >
                  {JSON.stringify(llm, null, 2)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Memories */}
                  {llm.memories && llm.memories.totalCount > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--badge-cyan-text)" }}>
                        💭 Memories ({llm.memories.totalCount})
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {llm.memories.byCategory && Object.entries(llm.memories.byCategory).map(([category, items]: [string, any]) => (
                          <div key={category}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[category]?.text || "var(--text-muted)", marginBottom: 6 }}>
                              {category}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {items.slice(0, 3).map((m: any, i: number) => (
                                <div
                                  key={i}
                                  style={{
                                    padding: 8,
                                    background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                                    borderRadius: 6,
                                    fontSize: 12,
                                  }}
                                >
                                  <span style={{ fontWeight: 500 }}>{m.key}:</span> {m.value}
                                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-placeholder)" }}>
                                    ({(m.confidence * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Behavior Targets */}
                  {llm.behaviorTargets && llm.behaviorTargets.totalCount > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-success-text)" }}>
                        🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {llm.behaviorTargets.all?.slice(0, 9).map((t: any, i: number) => (
                          <div
                            key={i}
                            style={{
                              padding: 10,
                              background: t.targetLevel === "HIGH" ? "var(--status-success-bg)" : t.targetLevel === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                              borderRadius: 6,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: t.targetLevel === "HIGH" ? "var(--status-success-text)" : t.targetLevel === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                              }}
                            >
                              {t.targetLevel}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {(t.targetValue * 100).toFixed(0)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Call History Summary */}
                  {llm.callHistory && llm.callHistory.totalCalls > 0 && (
                    <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--badge-indigo-text)" }}>
                        📞 Call History ({llm.callHistory.totalCalls} calls)
                      </h4>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Recent calls included in prompt context
                      </div>
                    </div>
                  )}

                  {/* AI Instructions */}
                  {llm.instructions && (
                    <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 12, padding: 16 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-warning-text)" }}>
                        📋 AI Instructions
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--status-warning-text)" }}>
                        {llm.instructions.use_memories && (
                          <div><strong>Memories:</strong> {llm.instructions.use_memories}</div>
                        )}
                        {llm.instructions.use_preferences && (
                          <div><strong>Preferences:</strong> {llm.instructions.use_preferences}</div>
                        )}
                        {llm.instructions.personality_adaptation?.length > 0 && (
                          <div>
                            <strong>Personality Adaptation:</strong>
                            <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                              {llm.instructions.personality_adaptation.map((tip: string, i: number) => (
                                <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Prompts Section (AI-composed prompts history) - kept for reference
function PromptsSection({
  prompts,
  loading,
  composing,
  expandedPrompt,
  setExpandedPrompt,
  onCompose,
  onRefresh,
}: {
  prompts: ComposedPrompt[];
  loading: boolean;
  composing: boolean;
  expandedPrompt: string | null;
  setExpandedPrompt: (id: string | null) => void;
  onCompose: () => void;
  onRefresh: () => void;
}) {
  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
    superseded: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
    expired: { bg: "var(--status-error-bg)", text: "var(--status-error-text)" },
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading prompts...</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header with actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Composed Prompts</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            AI-generated next-call guidance prompts for this caller
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onRefresh}
            style={{
              padding: "8px 16px",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              padding: "8px 16px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>

      {prompts.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--background)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>No prompts composed yet</div>
          <div style={{ fontSize: 13, color: "var(--text-placeholder)", marginTop: 4 }}>
            Click "Compose New Prompt" to generate a personalized next-call guidance prompt using AI
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prompts.map((prompt) => {
            const isExpanded = expandedPrompt === prompt.id;
            const statusColors = STATUS_COLORS[prompt.status] || STATUS_COLORS.superseded;

            return (
              <div
                key={prompt.id}
                style={{
                  background: "var(--surface-primary)",
                  border: prompt.status === "active" ? "2px solid var(--button-primary-bg)" : "1px solid var(--border-default)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Prompt Header */}
                <div
                  onClick={() => setExpandedPrompt(isExpanded ? null : prompt.id)}
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: prompt.status === "active" ? "var(--status-info-bg)" : "var(--surface-primary)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        background: statusColors.bg,
                        color: statusColors.text,
                        borderRadius: 4,
                        fontWeight: 500,
                        textTransform: "uppercase",
                      }}
                    >
                      {prompt.status}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                      {new Date(prompt.composedAt).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      via {prompt.triggerType}
                    </span>
                    {prompt.model && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          background: "var(--status-info-bg)",
                          color: "var(--badge-indigo-text)",
                          borderRadius: 4,
                          fontFamily: "monospace",
                        }}
                      >
                        {prompt.model}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 16, color: "var(--text-muted)" }}>{isExpanded ? "−" : "+"}</span>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: 16, borderTop: "1px solid var(--border-default)", background: "var(--surface-primary)" }}>
                    {/* Prompt Preview */}
                    <div
                      style={{
                        background: "var(--surface-dark)",
                        color: "var(--text-on-dark)",
                        padding: 16,
                        borderRadius: 8,
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        fontFamily: "monospace",
                        maxHeight: 400,
                        overflowY: "auto",
                        border: "1px solid var(--border-dark)",
                      }}
                    >
                      {prompt.prompt}
                    </div>

                    {/* Metadata */}
                    {prompt.inputs && (
                      <div style={{ marginTop: 16, padding: 12, background: "var(--status-warning-bg)", borderRadius: 8, border: "1px solid var(--status-warning-border)" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--status-warning-text)", marginBottom: 8 }}>
                          Composition Inputs
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                          {prompt.inputs.memoriesCount !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Memories: {prompt.inputs.memoriesCount}
                            </span>
                          )}
                          {prompt.inputs.personalityAvailable !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Personality: {prompt.inputs.personalityAvailable ? "Yes" : "No"}
                            </span>
                          )}
                          {prompt.inputs.recentCallsCount !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Recent Calls: {prompt.inputs.recentCallsCount}
                            </span>
                          )}
                          {prompt.inputs.behaviorTargetsCount !== undefined && (
                            <span style={{ fontSize: 12, color: "var(--status-warning-text)" }}>
                              Behavior Targets: {prompt.inputs.behaviorTargetsCount}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trigger Call Link */}
                    {prompt.triggerCall && (
                      <div style={{ marginTop: 12 }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          Triggered by call on {new Date(prompt.triggerCall.createdAt).toLocaleDateString()} ({prompt.triggerCall.source})
                        </span>
                      </div>
                    )}

                    {/* Copy Button */}
                    <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(prompt.prompt);
                          alert("Copied to clipboard!");
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "var(--button-primary-bg)",
                          color: "var(--text-on-dark)",
                          border: "none",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Copy to Clipboard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// LLM Prompt Section - displays the structured JSON prompt for AI consumption
function LlmPromptSection({
  prompts,
  loading,
  composing,
  onCompose,
  onRefresh,
}: {
  prompts: ComposedPrompt[];
  loading: boolean;
  composing: boolean;
  onCompose: () => void;
  onRefresh: () => void;
}) {
  const [viewMode, setViewMode] = useState<"pretty" | "raw">("pretty");

  // Get the most recent active prompt
  const activePrompt = prompts.find((p) => p.status === "active") || prompts[0];

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading LLM prompt...</div>
    );
  }

  if (!activePrompt || !activePrompt.llmPrompt) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "var(--background)",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No LLM Prompt Available</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, maxWidth: 400, margin: "8px auto 0" }}>
            {!activePrompt
              ? "Compose a prompt first to generate structured LLM data."
              : "This prompt was created before the llmPrompt feature. Compose a new prompt to get structured JSON data."}
          </div>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "Composing..." : "Compose New Prompt"}
          </button>
        </div>
      </div>
    );
  }

  const llm = activePrompt.llmPrompt;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>LLM-Friendly Prompt Data</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Structured JSON for AI agent consumption • Generated {new Date(activePrompt.composedAt).toLocaleString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border-default)" }}>
            <button
              onClick={() => setViewMode("pretty")}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: viewMode === "pretty" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "pretty" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Pretty
            </button>
            <button
              onClick={() => setViewMode("raw")}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                background: viewMode === "raw" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: viewMode === "raw" ? "var(--text-on-dark)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Raw JSON
            </button>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(llm, null, 2));
              alert("Copied JSON to clipboard!");
            }}
            style={{
              padding: "6px 12px",
              background: "var(--surface-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            📋 Copy JSON
          </button>
          <button
            onClick={onCompose}
            disabled={composing}
            style={{
              padding: "6px 12px",
              background: composing ? "var(--text-placeholder)" : "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: composing ? "not-allowed" : "pointer",
            }}
          >
            {composing ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {viewMode === "raw" ? (
        /* Raw JSON View */
        <div
          style={{
            background: "var(--surface-dark)",
            color: "var(--text-on-dark-muted)",
            padding: 20,
            borderRadius: 12,
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "pre-wrap",
            maxHeight: 600,
            overflowY: "auto",
            border: "1px solid var(--border-dark)",
          }}
        >
          {JSON.stringify(llm, null, 2)}
        </div>
      ) : (
        /* Pretty View - structured sections */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Caller Info */}
          {llm.caller && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--button-primary-bg)" }}>
                👤 Caller
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {llm.caller.name && (
                  <div style={{ padding: 10, background: "var(--status-info-bg)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Name</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{llm.caller.name}</div>
                  </div>
                )}
                {llm.caller.contactInfo?.email && (
                  <div style={{ padding: 10, background: "var(--status-info-bg)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Email</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{llm.caller.contactInfo.email}</div>
                  </div>
                )}
                {llm.caller.contactInfo?.phone && (
                  <div style={{ padding: 10, background: "var(--status-info-bg)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Phone</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{llm.caller.contactInfo.phone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Personality */}
          {llm.personality && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--trait-neuroticism)" }}>
                🧠 Personality Profile
              </h4>
              {llm.personality.traits && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                  {Object.entries(llm.personality.traits).map(([trait, data]: [string, any]) => (
                    <div
                      key={trait}
                      style={{
                        padding: 10,
                        background: data.level === "HIGH" ? "var(--status-success-bg)" : data.level === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                        borderRadius: 6,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>
                        {trait}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: data.level === "HIGH" ? "var(--status-success-text)" : data.level === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                        }}
                      >
                        {data.level || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                        {data.score !== null ? `${(data.score * 100).toFixed(0)}%` : "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {llm.personality.preferences && Object.values(llm.personality.preferences).some((v) => v) && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {llm.personality.preferences.tone && (
                    <span style={{ fontSize: 11, padding: "4px 8px", background: "var(--status-info-bg)", color: "var(--badge-indigo-text)", borderRadius: 4 }}>
                      Tone: {llm.personality.preferences.tone}
                    </span>
                  )}
                  {llm.personality.preferences.responseLength && (
                    <span style={{ fontSize: 11, padding: "4px 8px", background: "var(--status-warning-bg)", color: "var(--status-warning-text)", borderRadius: 4 }}>
                      Length: {llm.personality.preferences.responseLength}
                    </span>
                  )}
                  {llm.personality.preferences.technicalLevel && (
                    <span style={{ fontSize: 11, padding: "4px 8px", background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", borderRadius: 4 }}>
                      Tech: {llm.personality.preferences.technicalLevel}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Memories */}
          {llm.memories && llm.memories.totalCount > 0 && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--badge-cyan-text)" }}>
                💭 Memories ({llm.memories.totalCount})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {llm.memories.byCategory && Object.entries(llm.memories.byCategory).map(([category, items]: [string, any]) => (
                  <div key={category}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLORS[category]?.text || "var(--text-muted)", marginBottom: 6 }}>
                      {category}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {items.slice(0, 3).map((m: any, i: number) => (
                        <div
                          key={i}
                          style={{
                            padding: 8,
                            background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{m.key}:</span> {m.value}
                          <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-placeholder)" }}>
                            ({(m.confidence * 100).toFixed(0)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Behavior Targets */}
          {llm.behaviorTargets && llm.behaviorTargets.totalCount > 0 && (
            <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-success-text)" }}>
                🎯 Behavior Targets ({llm.behaviorTargets.totalCount})
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {llm.behaviorTargets.all?.slice(0, 9).map((t: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      background: t.targetLevel === "HIGH" ? "var(--status-success-bg)" : t.targetLevel === "LOW" ? "var(--status-error-bg)" : "var(--surface-secondary)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: t.targetLevel === "HIGH" ? "var(--status-success-text)" : t.targetLevel === "LOW" ? "var(--status-error-text)" : "var(--text-muted)",
                      }}
                    >
                      {t.targetLevel}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {(t.targetValue * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions Summary */}
          {llm.instructions && (
            <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 12, padding: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--status-warning-text)" }}>
                📋 AI Instructions
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--status-warning-text)" }}>
                {llm.instructions.use_memories && (
                  <div><strong>Memories:</strong> {llm.instructions.use_memories}</div>
                )}
                {llm.instructions.use_preferences && (
                  <div><strong>Preferences:</strong> {llm.instructions.use_preferences}</div>
                )}
                {llm.instructions.use_topics && (
                  <div><strong>Topics:</strong> {llm.instructions.use_topics}</div>
                )}
                {llm.instructions.personality_adaptation?.length > 0 && (
                  <div>
                    <strong>Personality Adaptation:</strong>
                    <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                      {llm.instructions.personality_adaptation.map((tip: string, i: number) => (
                        <li key={i} style={{ marginBottom: 2 }}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Prompt Prep Section (deprecated - keeping for backward compatibility)
function PromptSection({ identities, caller, memories }: { identities: CallerIdentity[]; caller: CallerProfile; memories: Memory[] }) {
  const [selectedIdentity, setSelectedIdentity] = useState<CallerIdentity | null>(
    identities.find((i) => i.nextPrompt) || identities[0] || null
  );

  // Group memories by category for display
  const memoriesByCategory = memories.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, Memory[]>);

  if (!identities || identities.length === 0) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {/* Caller Info Card */}
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Caller Identification</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {caller.phone && (
              <div style={{ padding: 12, background: "var(--status-success-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--status-success-text)", fontWeight: 500 }}>Phone</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-success-text)", marginTop: 4 }}>{caller.phone}</div>
              </div>
            )}
            {caller.email && (
              <div style={{ padding: 12, background: "var(--status-info-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--status-info-text)", fontWeight: 500 }}>Email</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-info-text)", marginTop: 4 }}>{caller.email}</div>
              </div>
            )}
            {caller.externalId && (
              <div style={{ padding: 12, background: "var(--badge-purple-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--badge-purple-text)", fontWeight: 500 }}>External ID</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--badge-purple-text)", marginTop: 4 }}>{caller.externalId}</div>
              </div>
            )}
            {caller.name && (
              <div style={{ padding: 12, background: "var(--status-warning-bg)", borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: "var(--status-warning-text)", fontWeight: 500 }}>Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-warning-text)", marginTop: 4 }}>{caller.name}</div>
              </div>
            )}
          </div>
        </div>

        {/* Key Memories for Prompt Composition */}
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Key Memories ({memories.length})</h4>
          {memories.length === 0 ? (
            <div style={{ color: "var(--text-placeholder)", fontSize: 13, padding: 20, textAlign: "center" }}>
              No memories extracted yet. Run analysis on calls to extract memories.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {Object.entries(memoriesByCategory).map(([category, mems]) => (
                <div key={category}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: CATEGORY_COLORS[category]?.text || "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    {category} ({mems.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {mems.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: 10,
                          background: CATEGORY_COLORS[category]?.bg || "var(--surface-secondary)",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{m.key}</div>
                        <div style={{ color: "var(--text-secondary)" }}>{m.value}</div>
                      </div>
                    ))}
                    {mems.length > 5 && (
                      <div style={{ fontSize: 11, color: "var(--text-placeholder)", padding: "4px 10px" }}>
                        + {mems.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Composition Notice */}
        <div style={{ background: "var(--status-warning-bg)", border: "1px solid var(--status-warning-border)", borderRadius: 12, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-warning-text)" }}>No composed prompt yet</div>
              <div style={{ fontSize: 13, color: "var(--status-warning-text)", marginTop: 4 }}>
                To compose a personalized prompt for this caller, run the <code>prompt:compose-next</code> operation from the Ops page.
                This will combine their personality profile, memories, and behavior targets into a ready-to-use prompt.
              </div>
              <Link
                href="/ops"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  padding: "8px 16px",
                  background: "var(--button-primary-bg)",
                  color: "var(--text-on-dark)",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 13,
                }}
              >
                Go to Ops →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
      {/* Identity List */}
      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Identities ({identities.length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {identities.map((identity) => (
            <button
              key={identity.id}
              onClick={() => setSelectedIdentity(identity)}
              style={{
                padding: 10,
                background: selectedIdentity?.id === identity.id ? "var(--status-info-bg)" : "var(--background)",
                border: `1px solid ${selectedIdentity?.id === identity.id ? "var(--status-info-border)" : "var(--border-default)"}`,
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {identity.name || identity.externalId || identity.id.slice(0, 8)}
              </div>
              {identity.segment && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {identity.segment.name}
                </div>
              )}
              <div style={{ fontSize: 10, marginTop: 4, color: identity.nextPrompt ? "var(--status-success-text)" : "var(--text-placeholder)" }}>
                {identity.nextPrompt ? "✓ Prompt ready" : "No prompt"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Display */}
      <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20 }}>
        {!selectedIdentity?.nextPrompt ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No prompt composed</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
              Run prompt composition to generate a personalized prompt for this identity
            </div>
            <Link
              href="/ops"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--text-on-dark)",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Go to Ops →
            </Link>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Composed Prompt</h3>
                <div style={{ fontSize: 12, color: "var(--text-placeholder)", marginTop: 2 }}>
                  {selectedIdentity.nextPromptComposedAt
                    ? `Composed ${new Date(selectedIdentity.nextPromptComposedAt).toLocaleString()}`
                    : ""}
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(selectedIdentity.nextPrompt || "")}
                style={{
                  padding: "8px 16px",
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--input-border)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                📋 Copy
              </button>
            </div>

            {selectedIdentity.nextPromptInputs && (
              <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: 12, background: "var(--status-success-bg)", borderRadius: 8, fontSize: 12 }}>
                <span>🎯 {selectedIdentity.nextPromptInputs.targetCount || 0} targets</span>
                <span>💭 {selectedIdentity.nextPromptInputs.memoryCount || 0} memories</span>
              </div>
            )}

            <div
              style={{
                background: "var(--background)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                padding: 20,
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                maxHeight: 500,
                overflow: "auto",
              }}
            >
              {selectedIdentity.nextPrompt}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Transcripts Section - shows all transcripts for this caller
function TranscriptsSection({ calls }: { calls: Call[] }) {
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);

  if (!calls || calls.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No transcripts</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>No calls have been recorded for this caller</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {calls.map((call) => {
        const isExpanded = expandedTranscript === call.id;
        const wordCount = call.transcript?.split(/\s+/).length || 0;

        return (
          <div
            key={call.id}
            style={{
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedTranscript(isExpanded ? null : call.id)}
              style={{
                width: "100%",
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>📞</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {new Date(call.createdAt).toLocaleDateString()} at {new Date(call.createdAt).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {call.source} • {wordCount} words
                    {call.externalId && ` • ${call.externalId}`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Analysis badges */}
                <div style={{ display: "flex", gap: 4 }}>
                  {call.hasScores && (
                    <span style={{ padding: "2px 6px", fontSize: 10, background: "var(--status-success-bg)", color: "var(--status-success-text)", borderRadius: 4 }}>
                      Scored
                    </span>
                  )}
                  {call.hasMemories && (
                    <span style={{ padding: "2px 6px", fontSize: 10, background: "var(--badge-blue-bg)", color: "var(--status-info-text)", borderRadius: 4 }}>
                      Memories
                    </span>
                  )}
                </div>
                <span style={{ color: "var(--text-placeholder)" }}>{isExpanded ? "▼" : "▶"}</span>
              </div>
            </button>

            {/* Transcript content */}
            {isExpanded && (
              <div style={{ borderTop: "1px solid var(--border-default)", padding: 16 }}>
                <div
                  style={{
                    background: "var(--surface-dark)",
                    color: "var(--text-on-dark)",
                    padding: 16,
                    borderRadius: 8,
                    fontSize: 13,
                    lineHeight: 1.8,
                    whiteSpace: "pre-wrap",
                    fontFamily: "ui-monospace, monospace",
                    maxHeight: 500,
                    overflowY: "auto",
                  }}
                >
                  {call.transcript || "No transcript content"}
                </div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(call.transcript || "");
                      alert("Transcript copied!");
                    }}
                    style={{
                      padding: "8px 16px",
                      fontSize: 12,
                      background: "var(--button-primary-bg)",
                      color: "var(--text-on-dark)",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Copy Transcript
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Top-Level Targets Section - shows behavior targets for this caller
// Top-Level Behaviour Section - shows targets + measurements across all calls
function TopLevelAgentBehaviorSection({ callerId }: { callerId: string }) {
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [callerTargets, setCallerTargets] = useState<any[]>([]);
  const [behaviorTargets, setBehaviorTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [callerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch caller data and calls
      const res = await fetch(`/api/callers/${callerId}`);
      const data = await res.json();

      if (data.ok) {
        // CallerTargets - personalized adjustments computed by ADAPT specs
        setCallerTargets(data.callerTargets || []);

        if (data.calls.length > 0) {
          // Fetch measurements from each call
          const allMeasurements: any[] = [];
          for (const call of data.calls.slice(0, 10)) {
            const callRes = await fetch(`/api/calls/${call.id}`);
            const callData = await callRes.json();
            if (callData.ok && callData.measurements) {
              allMeasurements.push(
                ...callData.measurements.map((m: any) => ({
                  ...m,
                  callCreatedAt: call.createdAt,
                }))
              );
            }
          }
          setMeasurements(allMeasurements);

          // Fetch behavior targets from the most recent call
          const mostRecentCall = data.calls[0];
          const callDetailRes = await fetch(`/api/calls/${mostRecentCall.id}`);
          const callDetail = await callDetailRes.json();
          if (callDetail.ok) {
            setBehaviorTargets(callDetail.effectiveTargets || []);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching behaviour data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading behaviour data...</div>
      </div>
    );
  }

  if (measurements.length === 0 && behaviorTargets.length === 0 && callerTargets.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No behaviour data</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Targets and measurements will appear here after calls are analyzed
        </div>
      </div>
    );
  }

  // Group measurements by parameter and calculate averages
  const grouped: Record<string, any[]> = {};
  for (const m of measurements) {
    const key = m.parameterId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  // Transform measurements into format for TwoColumnTargetsDisplay
  // We show average measurements as the primary value
  const avgMeasurements = Object.entries(grouped).map(([parameterId, paramMeasurements]) => {
    const avg = paramMeasurements.reduce((sum, m) => sum + m.actualValue, 0) / paramMeasurements.length;
    return {
      parameterId,
      actualValue: avg,
    };
  });

  // Build per-parameter history arrays sorted oldest-to-newest for sparklines
  const historyByParameter: Record<string, number[]> = {};
  for (const [parameterId, paramMeasurements] of Object.entries(grouped)) {
    const sorted = [...paramMeasurements].sort(
      (a, b) => new Date(a.callCreatedAt).getTime() - new Date(b.callCreatedAt).getTime()
    );
    historyByParameter[parameterId] = sorted.map((m: any) => m.actualValue);
  }

  return <TwoColumnTargetsDisplay callerTargets={callerTargets} behaviorTargets={behaviorTargets} measurements={avgMeasurements} historyByParameter={historyByParameter} />;
}

// =====================================================
// CALLER SLUGS SECTION - Shows all resolved template variables
// =====================================================

type SlugNode = {
  id: string;
  type: "category" | "spec" | "variable" | "value";
  name: string;
  path?: string;
  value?: string | number | boolean | null;
  specId?: string;
  specSlug?: string;
  children?: SlugNode[];
  meta?: Record<string, any>;
};

function CallerSlugsSection({ callerId }: { callerId: string }) {
  const [slugsData, setSlugsData] = useState<{
    caller: { id: string; name: string; domain: string | null };
    playbook: { id: string; name: string; status: string } | null;
    tree: SlugNode[];
    counts: { memories: number; scores: number; targets: number; available: number; total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSlugs();
  }, [callerId]);

  const fetchSlugs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/callers/${callerId}/slugs`);
      const result = await res.json();
      if (result.ok) {
        setSlugsData(result);
        // Auto-expand top-level categories
        const topLevel = new Set<string>();
        result.tree.forEach((node: SlugNode) => topLevel.add(node.id));
        setExpandedNodes(topLevel);
      }
    } catch (err) {
      console.error("Error fetching slugs:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading slugs...</div>
      </div>
    );
  }

  if (!slugsData || slugsData.tree.length === 0) {
    const hasAvailableVars = (slugsData?.counts?.available ?? 0) > 0;
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏷️</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>
          {hasAvailableVars ? "No values yet" : "No template variables"}
        </div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          {hasAvailableVars
            ? `${slugsData!.counts.available} template variables are defined but awaiting values.`
            : "This caller has no memories, scores, or personalized targets yet."}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-placeholder)", marginTop: 8 }}>
          Process calls through the pipeline to populate slug values.
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, string> = {
    IDENTITY: "🎭",
    MEMORIES: "🧠",
    SCORES: "📊",
    "PERSONALIZED TARGETS": "🎯",
    "AVAILABLE VARIABLES": "📋",
  };

  const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
    IDENTITY: { bg: "var(--status-success-bg)", border: "var(--status-success-border)", text: "var(--status-success-text)" },
    MEMORIES: { bg: "var(--status-warning-bg)", border: "var(--status-warning-border)", text: "var(--status-warning-text)" },
    SCORES: { bg: "var(--badge-blue-bg)", border: "var(--status-info-border)", text: "var(--badge-blue-text)" },
    "PERSONALIZED TARGETS": { bg: "var(--badge-pink-bg)", border: "var(--badge-pink-border)", text: "var(--badge-pink-text)" },
    "AVAILABLE VARIABLES": { bg: "var(--surface-secondary)", border: "var(--input-border)", text: "var(--text-muted)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header with context */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        background: "var(--background)",
        borderRadius: 8,
        border: "1px solid var(--border-default)",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
            Caller Template Variables
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {slugsData.counts.total} with values: {slugsData.counts.memories} memories, {slugsData.counts.scores} scores, {slugsData.counts.targets} targets
            {slugsData.counts.available > 0 && (
              <span style={{ color: "var(--text-placeholder)", marginLeft: 8 }}>
                • {slugsData.counts.available} available in templates
              </span>
            )}
          </div>
        </div>
        {slugsData.playbook && (
          <Link
            href={`/x/playbooks/${slugsData.playbook.id}`}
            style={{
              fontSize: 11,
              padding: "4px 8px",
              background: "var(--status-info-bg)",
              color: "var(--button-primary-bg)",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            📚 {slugsData.playbook.name}
          </Link>
        )}
      </div>

      {/* Tree view */}
      <div style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {slugsData.tree.map((category) => {
          const isExpanded = expandedNodes.has(category.id);
          const colors = categoryColors[category.name] || { bg: "var(--surface-secondary)", border: "var(--border-default)", text: "var(--text-secondary)" };
          const icon = categoryIcons[category.name] || "📁";

          return (
            <div key={category.id}>
              {/* Category header */}
              <div
                onClick={() => toggleNode(category.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  background: colors.bg,
                  borderBottom: `1px solid ${colors.border}`,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontWeight: 600, color: colors.text }}>{category.name}</span>
                {category.meta?.count !== undefined && (
                  <span style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    background: colors.text,
                    color: "var(--text-on-dark)",
                    borderRadius: 4,
                  }}>
                    {category.meta.count}
                  </span>
                )}
              </div>

              {/* Category children */}
              {isExpanded && category.children && (
                <div style={{ borderBottom: "1px solid var(--border-default)" }}>
                  {category.children.map((spec) => (
                    <SlugSpecNode
                      key={spec.id}
                      spec={spec}
                      expandedNodes={expandedNodes}
                      onToggle={toggleNode}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Spec node component for caller slugs
function SlugSpecNode({
  spec,
  expandedNodes,
  onToggle,
}: {
  spec: SlugNode;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isExpanded = expandedNodes.has(spec.id);
  const hasChildren = spec.children && spec.children.length > 0;

  return (
    <div>
      <div
        onClick={() => hasChildren && onToggle(spec.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px 8px 32px",
          background: isExpanded ? "var(--background)" : "var(--surface-primary)",
          borderBottom: "1px solid var(--border-subtle)",
          cursor: hasChildren ? "pointer" : "default",
        }}
      >
        {hasChildren ? (
          <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
            {isExpanded ? "▼" : "▶"}
          </span>
        ) : (
          <span style={{ width: 10 }} />
        )}
        <span style={{ fontSize: 12 }}>📄</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
          {spec.name}
        </span>
        {spec.specSlug && (
          <Link
            href={`/analysis-specs?slug=${spec.specSlug}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            ({spec.specSlug})
          </Link>
        )}
        {spec.meta?.count !== undefined && (
          <span style={{ fontSize: 10, color: "var(--text-placeholder)" }}>
            ({spec.meta.count} items)
          </span>
        )}
      </div>

      {/* Variables */}
      {isExpanded && spec.children && (
        <div>
          {spec.children.map((variable) => (
            <SlugVariableNode key={variable.id} variable={variable} />
          ))}
        </div>
      )}
    </div>
  );
}

// Variable node component for caller slugs
function SlugVariableNode({ variable }: { variable: SlugNode }) {
  const [showFull, setShowFull] = useState(false);
  const valueStr = variable.value !== undefined && variable.value !== null
    ? String(variable.value)
    : "—";
  const isLong = valueStr.length > 60;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 16px 6px 56px",
        background: "var(--background)",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 12,
      }}
    >
      <code style={{
        padding: "2px 6px",
        background: "var(--border-default)",
        borderRadius: 4,
        fontFamily: "monospace",
        fontSize: 11,
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}>
        {variable.path || variable.name}
      </code>
      <span style={{ color: "var(--text-placeholder)" }}>=</span>
      <span
        style={{
          flex: 1,
          color: "var(--text-secondary)",
          wordBreak: "break-word",
          cursor: isLong ? "pointer" : "default",
        }}
        onClick={() => isLong && setShowFull(!showFull)}
        title={isLong ? "Click to expand" : undefined}
      >
        {showFull || !isLong ? valueStr : `${valueStr.substring(0, 60)}...`}
      </span>
      {variable.meta?.confidence !== undefined && (
        <span style={{
          fontSize: 10,
          padding: "1px 4px",
          background: variable.meta.confidence > 0.7 ? "var(--status-success-bg)" : "var(--status-warning-bg)",
          color: variable.meta.confidence > 0.7 ? "var(--status-success-text)" : "var(--status-warning-text)",
          borderRadius: 3,
        }}>
          {(variable.meta.confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

// =====================================================
// AI CALL SECTION - Simulates a real voice call
// =====================================================

type CallState = "idle" | "active" | "ended" | "processing";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function AICallSection({
  callerId,
  callerName,
  calls,
  onCallEnded,
}: {
  callerId: string;
  callerName: string;
  calls: Call[];
  onCallEnded: () => void;
}) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [pipelineStatus, setPipelineStatus] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when call becomes active
  useEffect(() => {
    if (callState === "active") {
      inputRef.current?.focus();
    }
  }, [callState]);

  // Get next call sequence number
  const nextCallSequence = calls.length > 0
    ? Math.max(...calls.map((c) => c.callSequence || 0)) + 1
    : 1;

  // Start call - create a new call record and fetch the composed prompt
  const handleStartCall = async () => {
    setCallState("active");
    setMessages([]);
    setTranscript("");
    setPipelineStatus("");

    try {
      // Create a new call record
      const createRes = await fetch(`/api/callers/${callerId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "ai-simulation",
          callSequence: nextCallSequence,
        }),
      });
      const createData = await createRes.json();
      if (createData.ok && createData.call?.id) {
        setCurrentCallId(createData.call.id);
      }

      // AI greets the user first
      const greetingPrompt = `The user just picked up the phone. Greet ${callerName} warmly and naturally, as if this is a real phone call. Keep it short (1-2 sentences).`;

      await streamAIResponse(greetingPrompt, []);
    } catch (err) {
      console.error("Error starting call:", err);
      setCallState("idle");
    }
  };

  // Stream AI response
  const streamAIResponse = async (userMessage: string, history: ChatMessage[]) => {
    setIsStreaming(true);

    // Use random suffix to avoid duplicate keys when user and assistant messages created in same millisecond
    const assistantMsgId = `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          mode: "CALL",
          entityContext: [{ type: "caller", id: callerId, label: callerName }],
          conversationHistory: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error("Chat API failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullContent += chunk;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: fullContent } : m
            )
          );
        }
      }

      // Update transcript
      setTranscript((prev) => prev + (prev ? "\n" : "") + `AI: ${fullContent}`);

    } catch (err) {
      console.error("Error streaming response:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: "Sorry, I had trouble responding. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  // Handle user message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming || callState !== "active") return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTranscript((prev) => prev + (prev ? "\n" : "") + `User: ${userMsg.content}`);
    setInputValue("");

    await streamAIResponse(userMsg.content, [...messages, userMsg]);
  };

  // End call - save transcript and run pipeline
  const handleEndCall = async () => {
    if (callState !== "active") return;

    setCallState("processing");
    setPipelineStatus("Saving transcript...");

    try {
      if (!currentCallId) {
        setPipelineStatus("Error: No call ID - call was not created properly");
        setCallState("ended");
        return;
      }

      if (messages.length === 0) {
        setPipelineStatus("Error: No messages to save");
        setCallState("ended");
        return;
      }

      // Save messages as JSON transcript to the call
      // The /end endpoint expects JSON array of {role, content, timestamp}
      const messagesJson = JSON.stringify(
        messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        }))
      );

      await fetch(`/api/calls/${currentCallId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: messagesJson }),
      });

      setPipelineStatus("Running analysis pipeline...");

      // Use the proper /end endpoint which formats transcript and runs pipeline
      const endRes = await fetch(`/api/calls/${currentCallId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine: "claude" }),
      });

      const endData = await endRes.json();
      if (endData.ok) {
        setPipelineStatus(
          `Pipeline complete: ${endData.pipeline?.scoresCreated || 0} scores, ` +
          `${endData.pipeline?.memoriesCreated || 0} memories extracted`
        );
      } else {
        setPipelineStatus(`Pipeline error: ${endData.error}`);
      }

      setCallState("ended");
      onCallEnded();
    } catch (err: any) {
      setPipelineStatus(`Error: ${err.message}`);
      setCallState("ended");
    }
  };

  // Reset for new call
  const handleNewCall = () => {
    setCallState("idle");
    setMessages([]);
    setCurrentCallId(null);
    setTranscript("");
    setPipelineStatus("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 300px)", minHeight: 500 }}>
      {/* Call Header */}
      <div
        style={{
          padding: "16px 20px",
          background: callState === "active" ? "var(--status-success-bg)" : callState === "processing" ? "var(--status-warning-bg)" : "var(--background)",
          borderRadius: "12px 12px 0 0",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: callState === "active" ? "var(--button-success-bg)" : "var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            {callState === "active" ? "📞" : callState === "processing" ? "⏳" : "📱"}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{callerName}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {callState === "idle" && "Ready to call"}
              {callState === "active" && "Call in progress..."}
              {callState === "processing" && "Processing call..."}
              {callState === "ended" && "Call ended"}
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div style={{ display: "flex", gap: 8 }}>
          {callState === "idle" && (
            <button
              onClick={handleStartCall}
              style={{
                padding: "12px 24px",
                background: "var(--button-success-bg)",
                color: "white",
                border: "none",
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📞</span>
              Start Call
            </button>
          )}
          {callState === "active" && (
            <button
              onClick={handleEndCall}
              style={{
                padding: "12px 24px",
                background: "var(--button-destructive-bg)",
                color: "white",
                border: "none",
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>📵</span>
              End Call
            </button>
          )}
          {(callState === "ended" || callState === "processing") && (
            <button
              onClick={handleNewCall}
              disabled={callState === "processing"}
              style={{
                padding: "12px 24px",
                background: callState === "processing" ? "var(--text-placeholder)" : "var(--button-primary-bg)",
                color: "white",
                border: "none",
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 600,
                cursor: callState === "processing" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>🔄</span>
              New Call
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
          background: callState === "active" ? "var(--status-success-bg)" : "var(--surface-primary)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {callState === "idle" && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 64 }}>📱</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Ready to Simulate Call</div>
            <div style={{ fontSize: 14, textAlign: "center", maxWidth: 400 }}>
              Click "Start Call" to begin a simulated voice conversation with {callerName}.
              The AI will use the composed prompt and remember this caller's history.
            </div>
            <div style={{ fontSize: 12, color: "var(--text-placeholder)", marginTop: 8 }}>
              Call #{nextCallSequence} for this caller
            </div>
          </div>
        )}

        {callState !== "idle" && messages.length === 0 && !isStreaming && (
          <div style={{ color: "var(--text-placeholder)", textAlign: "center", padding: 20 }}>
            Starting call...
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.role === "user" ? "var(--button-primary-bg)" : "var(--surface-primary)",
                color: msg.role === "user" ? "white" : "var(--text-primary)",
                border: msg.role === "user" ? "none" : "1px solid var(--border-default)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize: 10, color: msg.role === "user" ? "rgba(255,255,255,0.7)" : "var(--text-placeholder)", marginBottom: 4 }}>
                {msg.role === "user" ? "You" : "AI"}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {msg.content || (isStreaming ? "..." : "")}
              </div>
            </div>
          </div>
        ))}

        {/* Pipeline Status */}
        {pipelineStatus && (
          <div
            style={{
              padding: 12,
              background: callState === "ended" ? "var(--status-success-bg)" : "var(--status-warning-bg)",
              borderRadius: 8,
              fontSize: 13,
              color: callState === "ended" ? "var(--status-success-text)" : "var(--status-warning-text)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {callState === "processing" && <span style={{ animation: "spin 1s linear infinite" }}>⏳</span>}
            {callState === "ended" && <span>✅</span>}
            {pipelineStatus}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {callState === "active" && (
        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--border-default)",
            background: "var(--status-success-bg)",
            borderRadius: "0 0 12px 12px",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              placeholder="Type your message..."
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "1px solid var(--input-border)",
                borderRadius: 24,
                fontSize: 14,
                outline: "none",
                background: "var(--surface-primary)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={isStreaming || !inputValue.trim()}
              style={{
                padding: "12px 20px",
                background: isStreaming || !inputValue.trim() ? "var(--button-disabled-bg)" : "var(--button-primary-bg)",
                color: "white",
                border: "none",
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 600,
                cursor: isStreaming || !inputValue.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isStreaming ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {/* Call Summary after ended */}
      {callState === "ended" && messages.length > 0 && (
        <div
          style={{
            padding: 16,
            borderTop: "1px solid var(--border-default)",
            background: "var(--background)",
            borderRadius: "0 0 12px 12px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Call Summary</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {messages.filter((m) => m.role === "user").length} user messages,{" "}
            {messages.filter((m) => m.role === "assistant").length} AI responses
          </div>
        </div>
      )}
    </div>
  );
}
