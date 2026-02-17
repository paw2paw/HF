"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEntityContext } from "@/contexts/EntityContext";
import { DomainPill } from "@/src/components/shared/EntityPill";
import { Smartphone, User, BookMarked, PlayCircle, Brain, BarChart3, Target, BookOpen, ClipboardCheck, CheckSquare, GitBranch, MessageCircle, Gauge } from "lucide-react";
import { SectionSelector, useSectionVisibility } from "@/components/shared/SectionSelector";
import { CallerDomainSection } from "@/components/callers/CallerDomainSection";
import { SimChat } from "@/components/sim/SimChat";
import '@/app/x/sim/sim.css';
import { useAssistant, useAssistantKeyboardShortcut } from "@/hooks/useAssistant";

// Extracted sub-components
import { OverviewSection } from "./caller-detail/OverviewSection";
import { CallsSection, ProcessingNotice } from "./caller-detail/CallsTab";
import { MemoriesSection, PersonalitySection, CallerSlugsSection, CallerEnrollmentsSection } from "./caller-detail/ProfileTab";
import { ScoresSection, LearningSection, TopicsCoveredSection, ExamReadinessSection, TopLevelAgentBehaviorSection, PlanProgressSection } from "./caller-detail/ProgressTab";
import { ArtifactsSection } from "./caller-detail/ArtifactsTab";
import { UnifiedPromptSection } from "./caller-detail/PromptsSection";

// Shared types
import type { CallerData, CallerProfile, Domain, ComposedPrompt, SectionId, ParamConfig } from "./caller-detail/types";
import { CATEGORY_COLORS } from "./caller-detail/constants";

export default function CallerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const callerId = params.callerId as string;
  const { pushEntity } = useEntityContext();

  // Detect if we're in /x/ area and adjust back link accordingly
  const isInXArea = pathname?.startsWith('/x/');
  const backLink = isInXArea ? '/x/callers' : '/callers';

  // Get initial tab from URL param (e.g., ?tab=ai-call)
  // Backwards compat: map old tab IDs to new consolidated tabs
  const tabRedirects: Record<string, SectionId> = {
    memories: "profile", traits: "profile", personality: "profile", slugs: "profile",
    scores: "progress", "agent-behavior": "progress", learning: "progress", "exam-readiness": "progress",
    transcripts: "calls", prompt: "calls",
  };
  const rawTab = searchParams.get("tab");
  const validTabs: SectionId[] = ["calls", "profile", "progress", "artifacts", "ai-call"];
  const mappedTab = rawTab ? (tabRedirects[rawTab] || rawTab) as SectionId : null;
  const initialTab = mappedTab && validTabs.includes(mappedTab) ? mappedTab : null;

  const [data, setData] = useState<CallerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId | null>(initialTab);
  const [simChatMounted, setSimChatMounted] = useState(initialTab === "ai-call");
  const [callSession, setCallSession] = useState(0);
  if (activeSection === "ai-call" && !simChatMounted) setSimChatMounted(true);

  // Dynamic parameter display configuration (fetched from database)
  const [paramConfig, setParamConfig] = useState<ParamConfig>(null);

  // Section visibility for consolidated tabs (persisted to localStorage)
  const [profileVis, toggleProfileVis] = useSectionVisibility("caller-profile", {
    memories: true, traits: true, slugs: true, enrollments: true,
  });
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [progressVis, toggleProgressVis] = useSectionVisibility("caller-progress", {
    scores: true, behaviour: true, goals: true, exam: true,
  });

  // Expanded states
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [expandedMemory, setExpandedMemory] = useState<string | null>(null);
  const [activePromptExpanded, setActivePromptExpanded] = useState(false); // Active Prompt section starts collapsed

  // Prompts state
  const [composedPrompts, setComposedPrompts] = useState<ComposedPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [promptProgress, setPromptProgress] = useState("");
  const [exporting, setExporting] = useState(false);
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  // Domain state
  const [domains, setDomains] = useState<Domain[]>([]);
  const [showDomainSection, setShowDomainSection] = useState(false);
  const [editingDomain, setEditingDomain] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);

  // Copy feedback state
  const [copiedButton, setCopiedButton] = useState<string | null>(null);
  const copyToClipboard = (text: string, buttonId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedButton(buttonId);
    setTimeout(() => setCopiedButton(null), 1500);
  };

  // AI Assistant
  const assistant = useAssistant({
    defaultTab: "chat",
    layout: "popout",
    enabledTabs: ["chat", "data"],
  });

  // Keyboard shortcut for assistant
  useAssistantKeyboardShortcut(assistant.toggle);

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

    // Backfill usedPromptId for all calls that don't have it
    setPromptProgress("Backfilling usedPromptId...");
    let backfillResult = { callsUpdated: 0, callsSkipped: 0 };
    try {
      const backfillRes = await fetch("/api/ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opid: "prompt:backfill",
          settings: { callerId, verbose: false },
        }),
      });
      const backfillData = await backfillRes.json();
      if (backfillData.success && backfillData.result) {
        backfillResult = backfillData.result;
      }
    } catch (err) {
      console.error("Backfill error:", err);
    }

    setComposing(false);
    setPromptProgress("");

    // Show summary
    alert(
      `Prompt ALL complete!\n\n` +
      `Processed: ${processed} calls\n` +
      `Skipped: ${skipped}\n` +
      `Errors: ${errors}\n\n` +
      `Backfill: ${backfillResult.callsUpdated} calls linked to prompts`
    );
  };

  const fetchData = useCallback(() => {
    if (!callerId) return;

    // Fetch caller data
    fetch(`/api/callers/${callerId}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          // Map personalityProfile -> personality for backward compatibility
          setData({
            ...result,
            personality: result.personalityProfile || null,
          });
          // Register with entity context for AI Chat
          pushEntity({
            type: "caller",
            id: result.caller.id,
            label: result.caller.name || result.caller.email || "Unknown Caller",
            href: `${isInXArea ? '/x' : ''}/callers/${result.caller.id}`,
            data: {
              email: result.caller.email,
              phone: result.caller.phone,
              externalId: result.caller.externalId,
              domainId: result.caller.domainId,
              domain: result.caller.domain,
              callCount: result.counts?.calls || 0,
              memoryCount: result.counts?.memories || 0,
            },
          });
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
      .catch((e) => console.warn("[CallerDetail] Failed to load domains:", e));

    // Fetch prompts for count pill (lightweight, just need the count)
    fetch(`/api/callers/${callerId}/compose-prompt?limit=3`)
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          setComposedPrompts(result.prompts || []);
        }
      })
      .catch((e) => console.warn("[CallerDetail] Failed to load prompts:", e));

    // Fetch dynamic parameter display configuration (NO HARDCODING)
    fetch("/api/parameters/display-config")
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          setParamConfig({
            grouped: result.grouped,
            params: result.params,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to load parameter display config:", err);
      });
  }, [callerId, pushEntity, isInXArea]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Processing detection + auto-poll ──────────────
  // A call is "processing" if it's recent (< 5 min) and hasn't been analyzed yet.
  // When processing calls exist, poll every 5s to pick up pipeline results.
  const PROCESSING_WINDOW_MS = 5 * 60 * 1000;
  const processingCallIds = useMemo(() => {
    if (!data?.calls) return new Set<string>();
    const now = Date.now();
    return new Set(
      data.calls
        .filter((c) => {
          const age = now - new Date(c.createdAt).getTime();
          return age < PROCESSING_WINDOW_MS && !c.hasScores && !c.hasPrompt;
        })
        .map((c) => c.id)
    );
  }, [data?.calls]);

  const isProcessing = processingCallIds.size > 0;

  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      fetch(`/api/callers/${callerId}`)
        .then((r) => r.json())
        .then((result) => {
          if (result.ok) {
            setData({ ...result, personality: result.personalityProfile || null });
          }
        })
        .catch((e) => console.warn("[CallerDetail] Polling fetch failed:", e));
    }, 5000);
    return () => clearInterval(interval);
  }, [isProcessing, callerId]);

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

  // Fetch prompts on mount for Active Prompt section
  useEffect(() => {
    if (composedPrompts.length === 0) {
      fetchPrompts();
    }
  }, [fetchPrompts, composedPrompts.length]);

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
  // Consolidated tabs: Calls | Profile | Assess | Artifacts | Call (action)
  const sections: { id: SectionId; label: string; icon: React.ReactNode; count?: number; special?: boolean; group: "history" | "caller" | "shared" | "action" }[] = [
    { id: "calls", label: "Calls", icon: <Smartphone size={13} />, count: data.counts.calls, group: "history" },
    { id: "profile", label: "Profile", icon: <User size={13} />, count: (data.counts.memories || 0) + (data.counts.observations || 0), group: "caller" },
    { id: "progress", label: "Assess", icon: <Gauge size={13} />, count: (new Set(data.scores?.map((s: any) => s.parameterId)).size || 0) + (data.counts.targets || 0) + (data.counts.measurements || 0), group: "shared" },
    { id: "artifacts", label: "Artifacts & Actions", icon: <BookMarked size={13} />, count: (data.counts.artifacts || 0) + (data.counts.actions || 0), group: "shared" },
    { id: "ai-call", label: "Call", icon: <PlayCircle size={13} />, special: true, group: "action" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxWidth: 1920, margin: "0 auto", width: "100%" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
              {/* Domain Badge (click to expand domain section) */}
              <div
                onClick={() => {
                  setActiveSection(null); // Navigate to Overview
                  setShowDomainSection(!showDomainSection);
                }}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                title="Click to manage domain & onboarding"
              >
                {data.caller.domain ? (
                  <DomainPill label={data.caller.domain.name} size="compact" />
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 10px", background: "var(--surface-secondary)", borderRadius: 4 }}>
                    No Domain
                  </span>
                )}
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {showDomainSection ? "▼" : "▶"}
                </span>
              </div>
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
              {/* Compact Personality Profile - DYNAMIC (shows first 6 parameters) */}
              {data.personality && data.personality.parameterValues && paramConfig && (
                <div style={{ display: "flex", gap: 6, marginLeft: 8, padding: "4px 8px", background: "var(--surface-secondary)", borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>🧠</span>
                  {Object.entries(data.personality.parameterValues)
                    .slice(0, 6)
                    .map(([key, value]) => {
                      const info = paramConfig.params[key];
                      if (!info || value === undefined || value === null) return null;
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

          {/* Ask AI Button */}
          <button
            onClick={() => {
              if (data?.caller) {
                assistant.openWithCaller(data.caller);
              } else {
                assistant.open(undefined, { page: `/x/callers/${callerId}` });
              }
            }}
            title="Ask AI Assistant (Cmd+Shift+K)"
            style={{
              padding: "10px 20px",
              background: "rgba(139, 92, 246, 0.1)",
              color: "#8b5cf6",
              border: "1px solid rgba(139, 92, 246, 0.2)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ✨ Ask AI
          </button>

          {/* Export Data Button (GDPR SAR) */}
          <button
            onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch(`/api/callers/${callerId}/export`);
                const data = await res.json();
                if (!data.ok) throw new Error(data.error || "Export failed");

                const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `caller-${callerId}-export.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err: any) {
                alert(`Export failed: ${err.message}`);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            title="Export all caller data (GDPR)"
            style={{
              padding: "10px 20px",
              background: exporting ? "var(--text-placeholder)" : "rgba(59, 130, 246, 0.1)",
              color: exporting ? "var(--text-muted)" : "#3b82f6",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: exporting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {exporting ? "Exporting..." : "Export Data"}
          </button>
        </div>
      </div>

      {/* Archive Banner */}
      {data.caller.archivedAt && (
        <div style={{
          padding: "12px 24px",
          background: "var(--status-warning-bg)",
          borderBottom: "1px solid var(--status-warning-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 14,
          color: "var(--status-warning-text)",
          flexShrink: 0,
        }}>
          <span>This caller was archived on {new Date(data.caller.archivedAt).toLocaleDateString()}</span>
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/callers/${callerId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ archive: false }),
                });
                const result = await res.json();
                if (result.ok) {
                  setData({ ...data, caller: { ...data.caller, archivedAt: null } });
                }
              } catch {}
            }}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "var(--button-primary-bg)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Unarchive
          </button>
        </div>
      )}

      {/* Active Prompt Section - Shows most recent prompt for next call */}
      {composedPrompts.length > 0 && (
        <div style={{ background: "var(--surface-secondary)", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
          <button
            onClick={() => setActivePromptExpanded(!activePromptExpanded)}
            style={{
              width: "100%",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>🎯 Active Prompt</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              (Will be used for the next call)
            </span>
            {composedPrompts.length > 1 && (
              <span style={{ fontSize: 11, color: "var(--text-placeholder)", marginLeft: "auto" }}>
                +{composedPrompts.length - 1} previous prompt{composedPrompts.length > 2 ? 's' : ''}
              </span>
            )}
            <span style={{ fontSize: 12, marginLeft: composedPrompts.length === 1 ? "auto" : 0 }}>
              {activePromptExpanded ? "▼" : "▶"}
            </span>
          </button>
          {activePromptExpanded && (
            <div style={{ padding: "0 24px 16px 24px" }}>
              <UnifiedPromptSection
                prompts={composedPrompts}
                loading={promptsLoading}
                expandedPrompt={expandedPrompt}
                setExpandedPrompt={setExpandedPrompt}
                onRefresh={fetchPrompts}
                defaultExpandFirst={false}
              />
            </div>
          )}
        </div>
      )}

      {/* Processing Banner */}
      {isProcessing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 24px",
            background: "var(--status-info-bg)",
            borderBottom: "1px solid var(--status-info-border)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--status-info-text)",
            flexShrink: 0,
          }}
        >
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
          Processing {processingCallIds.size === 1 ? "latest call" : `${processingCallIds.size} calls`} — extracting scores, memories, and generating prompt...
        </div>
      )}

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border-default)", paddingBottom: 0, flexWrap: "nowrap", overflowX: "auto", alignItems: "center", position: "sticky", top: 0, background: "var(--surface-primary)", zIndex: 10, padding: "8px 24px 0 24px", marginLeft: -24, marginRight: -24, flexShrink: 0 }}>
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const isSpecial = section.special;

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
                <span style={{ display: "flex", alignItems: "center" }}>{section.icon}</span>
                {section.label}
                {section.count !== undefined && section.count > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      lineHeight: "16px",
                      minWidth: 18,
                      textAlign: "center",
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: isActive ? "color-mix(in srgb, var(--button-primary-bg) 15%, transparent)" : "var(--surface-tertiary)",
                      color: isActive ? "var(--button-primary-bg)" : "var(--text-secondary)",
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
        <>
          {/* Domain & Onboarding Section - Collapsible */}
          {showDomainSection && (
            <CallerDomainSection
              caller={{
                id: data.caller.id,
                domainId: data.caller.domainId,
                domain: data.caller.domain,
                domainSwitchCount: 0, // TODO: add to data type
                previousDomainId: null, // TODO: add to data type
              }}
              onboardingSession={null} // TODO: fetch from API
              availableDomains={domains}
              onDomainSwitched={() => {
                // Refresh the page data
                fetchData();
                setShowDomainSection(false); // Collapse after successful switch
              }}
            />
          )}

          <OverviewSection data={data} onNavigate={setActiveSection} paramConfig={paramConfig} />
        </>
      )}

      {activeSection === "calls" && (
        <CallsSection
          calls={data.calls}
          expandedCall={expandedCall}
          setExpandedCall={setExpandedCall}
          callerId={callerId}
          processingCallIds={processingCallIds}
          onCallUpdated={() => {
            // Refresh data after op runs
            fetch(`/api/callers/${callerId}`)
              .then((r) => r.json())
              .then((result) => {
                if (result.ok) {
                  // Map personalityProfile -> personality for backward compatibility
                  setData({
                    ...result,
                    personality: result.personalityProfile || null,
                  });
                }
              });
            // Refresh prompts list to show newly composed prompts
            fetchPrompts();
          }}
        />
      )}

      {activeSection === "profile" && (
        <>
          {isProcessing && !data.counts.memories && !data.counts.observations && (
            <ProcessingNotice message="Memories and personality traits will appear here once analysis completes." />
          )}
          <SectionSelector
            storageKey="caller-profile"
            sections={[
              { id: "memories", label: "Memories", icon: <MessageCircle size={13} />, count: data.counts.memories },
              { id: "traits", label: "Traits", icon: <Brain size={13} />, count: data.counts.observations },
              { id: "slugs", label: "Identity", icon: <GitBranch size={13} /> },
              { id: "enrollments", label: "Enrolled", icon: <BookMarked size={13} />, count: enrollmentCount || undefined },
            ]}
            visible={profileVis}
            onToggle={toggleProfileVis}
          >
            {/* Memory category chips inline */}
            {data.memorySummary && profileVis.memories !== false && (
              <>
                <div style={{ width: 1, height: 20, background: "var(--border-default)", margin: "0 4px", flexShrink: 0 }} />
                {[
                  { label: "Facts", count: data.memorySummary.factCount, color: CATEGORY_COLORS.FACT },
                  { label: "Prefs", count: data.memorySummary.preferenceCount, color: CATEGORY_COLORS.PREFERENCE },
                  { label: "Events", count: data.memorySummary.eventCount, color: CATEGORY_COLORS.EVENT },
                  { label: "Topics", count: data.memorySummary.topicCount, color: CATEGORY_COLORS.TOPIC },
                ].map((stat) => (
                  <span
                    key={stat.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 8px",
                      fontSize: 11,
                      background: stat.color.bg,
                      color: stat.color.text,
                      borderRadius: 12,
                      fontWeight: 500,
                    }}
                  >
                    {stat.count} {stat.label}
                  </span>
                ))}
              </>
            )}
          </SectionSelector>
          {profileVis.memories !== false && (
            <MemoriesSection
              memories={data.memories}
              summary={data.memorySummary}
              expandedMemory={expandedMemory}
              setExpandedMemory={setExpandedMemory}
              hideSummary
            />
          )}
          {profileVis.traits !== false && (
            <PersonalitySection
              personality={data.personality}
              observations={data.observations}
              paramConfig={paramConfig}
            />
          )}
          {profileVis.slugs !== false && (
            <CallerSlugsSection callerId={callerId} />
          )}
          {profileVis.enrollments !== false && (
            <CallerEnrollmentsSection callerId={callerId} domainId={data.caller?.domainId} onCountChange={setEnrollmentCount} />
          )}
        </>
      )}

      {activeSection === "progress" && (
        <>
          {isProcessing && !data.scores?.length && !data.counts.measurements && (
            <ProcessingNotice message="Scores and behaviour data will appear here once analysis completes." />
          )}
          <SectionSelector
            storageKey="caller-progress"
            sections={[
              { id: "scores", label: "Scores", icon: <BarChart3 size={13} />, count: new Set(data.scores?.map((s: any) => s.parameterId)).size || 0 },
              { id: "behaviour", label: "Behaviour", icon: <Brain size={13} />, count: (data.counts.targets || 0) + (data.counts.measurements || 0) },
              { id: "goals", label: "Goals", icon: <Target size={13} />, count: data.counts.activeGoals || 0 },
              { id: "topics", label: "Topics", icon: <BookOpen size={13} />, count: (data.memorySummary?.topicCount || 0) + (data.counts.keyFacts || 0) },
              { id: "exam", label: "Exam", icon: <ClipboardCheck size={13} /> },
              { id: "plan", label: "Plan", icon: <CheckSquare size={13} /> },
            ]}
            visible={progressVis}
            onToggle={toggleProgressVis}
          />
          {progressVis.scores !== false && <ScoresSection scores={data.scores} />}
          {progressVis.behaviour !== false && <TopLevelAgentBehaviorSection callerId={callerId} />}
          {progressVis.goals !== false && (
            <LearningSection curriculum={data.curriculum} learnerProfile={data.learnerProfile} goals={data.goals} callerId={callerId} />
          )}
          {progressVis.topics !== false && (
            <TopicsCoveredSection memorySummary={data.memorySummary} keyFactCount={data.counts.keyFacts || 0} />
          )}
          {progressVis.exam !== false && <ExamReadinessSection callerId={callerId} />}
          {progressVis.plan !== false && <PlanProgressSection callerId={callerId} calls={data.calls} domainId={data.caller?.domainId} />}
        </>
      )}

      {activeSection === "artifacts" && (
        <ArtifactsSection callerId={callerId} isProcessing={isProcessing} />
      )}

      {simChatMounted && (
        <div style={{ display: activeSection === "ai-call" ? undefined : "none" }}>
          <SimChat
            key={callSession}
            callerId={callerId}
            callerName={data.caller.name || "Caller"}
            domainName={data.caller.domain?.name}
            mode="embedded"
            onCallEnd={() => {
              fetch(`/api/callers/${callerId}`)
                .then((r) => r.json())
                .then((result) => {
                  if (result.ok) {
                    setData({
                      ...result,
                      personality: result.personalityProfile || null,
                    });
                  }
                });
              fetchPrompts();
            }}
            onNewCall={() => setCallSession(prev => prev + 1)}
          />
        </div>
      )}
      </div>
    </div>
  );
}
