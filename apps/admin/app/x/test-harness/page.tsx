"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FancySelect } from "@/components/shared/FancySelect";

// =============================================================================
// TYPES
// =============================================================================

type Domain = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  callerCount: number;
};

type CallerSummary = {
  id: string;
  name: string | null;
  email: string | null;
  externalId: string | null;
  _count?: { calls: number };
};

type SSEEvent = {
  phase: string;
  message: string;
  turn?: number;
  role?: "system" | "caller";
  detail?: Record<string, any>;
};

type TranscriptLine = {
  turn: number;
  role: "system" | "caller";
  content: string;
};

// =============================================================================
// SSE HELPER
// =============================================================================

async function consumeSSE(
  url: string,
  body: Record<string, any>,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6));
          onEvent(event);
        } catch {
          // skip malformed events
        }
      }
    }
  }
}

// =============================================================================
// HORIZONTAL SLIDER
// =============================================================================

function HorizontalSlider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const calcValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, snapped)));
    },
    [min, max, step, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      calcValue(e.clientX);
    };
    const onUp = () => setIsDragging(false);
    const onTouchMove = (e: TouchEvent) => calcValue(e.touches[0].clientX);
    const onTouchEnd = () => setIsDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isDragging, calcValue]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--button-primary-bg)",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {value}
        </span>
      </div>
      <div
        ref={trackRef}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          calcValue(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          calcValue(e.touches[0].clientX);
        }}
        style={{
          position: "relative",
          height: 28,
          background: "var(--surface-secondary)",
          borderRadius: 14,
          border: "1px solid var(--border-default)",
          cursor: "pointer",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {/* Filled track */}
        <div
          style={{
            position: "absolute",
            top: 3,
            bottom: 3,
            left: 3,
            width: `calc(${pct}% - 6px)`,
            background: "var(--button-primary-bg)",
            borderRadius: 11,
            opacity: 0.2,
            transition: isDragging ? "none" : "width 0.1s ease-out",
          }}
        />
        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: 2,
            left: `calc(${pct}% - 12px)`,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "var(--button-primary-bg)",
            border: "3px solid var(--surface-primary)",
            boxShadow: isDragging
              ? "0 0 0 3px color-mix(in srgb, var(--button-primary-bg) 30%, transparent)"
              : "0 2px 6px rgba(0,0,0,0.15)",
            transition: isDragging ? "none" : "left 0.1s ease-out, box-shadow 0.2s",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--text-muted)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// =============================================================================
// ACTION CARD
// =============================================================================

function ActionCard({
  title,
  description,
  disabled,
  children,
}: {
  title: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 12,
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TestHarnessPage() {
  // Domain
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [domainsLoading, setDomainsLoading] = useState(true);

  // Callers
  const [callers, setCallers] = useState<CallerSummary[]>([]);
  const [callersLoading, setCallersLoading] = useState(false);

  // Action 1: Generate Callers
  const [callerCount, setCallerCount] = useState(5);
  const [generatingCallers, setGeneratingCallers] = useState(false);
  const [generateLog, setGenerateLog] = useState<SSEEvent[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Action 2: Onboarding Call
  const [onboardCallerId, setOnboardCallerId] = useState("");
  const [generatingOnboarding, setGeneratingOnboarding] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<Record<string, any> | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Action 3: AI Sim
  const [simCallerId, setSimCallerId] = useState("");
  const [simTurnCount, setSimTurnCount] = useState(6);
  const [runningSim, setRunningSim] = useState(false);
  const [simTranscript, setSimTranscript] = useState<TranscriptLine[]>([]);
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const [simPipelineResult, setSimPipelineResult] = useState<Record<string, any> | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ─── Load Domains ───
  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDomains(data.domains || []);
      })
      .catch((e) => console.warn("[TestHarness] Failed to load domains:", e))
      .finally(() => setDomainsLoading(false));
  }, []);

  // ─── Load Callers when domain changes ───
  const loadCallers = useCallback(async (domainId: string) => {
    if (!domainId) {
      setCallers([]);
      return;
    }
    setCallersLoading(true);
    try {
      const res = await fetch(`/api/callers?domainId=${domainId}&withCounts=true&limit=200`);
      const data = await res.json();
      if (data.ok) setCallers(data.callers || []);
    } catch {
      // ignore
    } finally {
      setCallersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCallers(selectedDomainId);
    setOnboardCallerId("");
    setSimCallerId("");
  }, [selectedDomainId, loadCallers]);

  // ─── Action 1: Generate Callers ───
  const handleGenerateCallers = useCallback(async () => {
    if (!selectedDomainId) return;
    setGeneratingCallers(true);
    setGenerateLog([]);
    setGenerateError(null);

    try {
      await consumeSSE("/api/test-harness/generate-callers", {
        domainId: selectedDomainId,
        count: callerCount,
      }, (event) => {
        setGenerateLog((prev) => [...prev, event]);
        if (event.phase === "error") {
          setGenerateError(event.message);
        }
      });
      // Refresh callers list
      await loadCallers(selectedDomainId);
    } catch (err: any) {
      setGenerateError(err.message);
    } finally {
      setGeneratingCallers(false);
    }
  }, [selectedDomainId, callerCount, loadCallers]);

  // ─── Action 2: Onboarding Call ───
  const handleOnboardingCall = useCallback(async () => {
    if (!onboardCallerId) return;
    setGeneratingOnboarding(true);
    setOnboardingResult(null);
    setOnboardingError(null);

    try {
      const res = await fetch("/api/test-harness/onboarding-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callerId: onboardCallerId, runInitialGreeting: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed");
      setOnboardingResult(data);
      await loadCallers(selectedDomainId);
    } catch (err: any) {
      setOnboardingError(err.message);
    } finally {
      setGeneratingOnboarding(false);
    }
  }, [onboardCallerId, selectedDomainId, loadCallers]);

  // ─── Action 3: Run AI Sim ───
  const handleRunSim = useCallback(async () => {
    if (!simCallerId) return;
    setRunningSim(true);
    setSimTranscript([]);
    setSimStatus("Starting simulation...");
    setSimPipelineResult(null);
    setSimError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await consumeSSE("/api/test-harness/run-sim", {
        callerId: simCallerId,
        turnCount: simTurnCount,
        runPipeline: true,
      }, (event) => {
        if (event.phase === "turn" && event.role && event.turn) {
          setSimTranscript((prev) => [
            ...prev,
            { turn: event.turn!, role: event.role!, content: event.message },
          ]);
          setSimStatus(`Turn ${event.turn}...`);
        } else if (event.phase === "pipeline") {
          setSimStatus(event.message);
        } else if (event.phase === "pipeline-result") {
          setSimPipelineResult(event.detail || null);
        } else if (event.phase === "complete") {
          setSimStatus("Complete");
        } else if (event.phase === "error") {
          setSimError(event.message);
        }
      }, controller.signal);
      await loadCallers(selectedDomainId);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setSimError(err.message);
      }
    } finally {
      setRunningSim(false);
      abortRef.current = null;
    }
  }, [simCallerId, simTurnCount, selectedDomainId, loadCallers]);

  const handleStopSim = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ─── Derived ───
  const selectedDomain = domains.find((d) => d.id === selectedDomainId);
  const domainSelected = !!selectedDomainId;
  const domainOptions = useMemo(
    () =>
      domains.map((d) => ({
        value: d.id,
        label: d.name,
        subtitle: d.slug,
        badge: `${d.callerCount} caller${d.callerCount !== 1 ? "s" : ""}`,
      })),
    [domains]
  );

  // ─── Generate log summary ───
  const lastGenEvent = generateLog[generateLog.length - 1];
  const genComplete = lastGenEvent?.phase === "complete";

  // ─── Render ───
  if (domainsLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid var(--border-default)",
            borderTopColor: "var(--button-primary-bg)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Test Harness
        </h1>

        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Generate test data and run automated AI simulations
        </p>
      </div>

      {/* Domain Selector */}
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          background: "var(--surface-primary)",
          border: "1px solid var(--border-default)",
        }}
      >
        <label
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 8 }}
        >
          Domain
        </label>
        {domains.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            No domains found. Run seed-domains first.
          </p>
        ) : (
          <FancySelect
            value={selectedDomainId}
            onChange={setSelectedDomainId}
            options={domainOptions}
            placeholder="Select a domain..."
            searchable={domains.length > 5}
            clearable
            style={{ maxWidth: 480 }}
          />
        )}
      </div>

      {/* Action Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Card 1: Generate Callers */}
        <ActionCard
          title="Generate Callers"
          description="Batch-create test callers in the selected domain"
          disabled={!domainSelected}
        >
          <HorizontalSlider
            value={callerCount}
            min={1}
            max={50}
            step={1}
            label="Callers"
            onChange={setCallerCount}
          />
          <button
            onClick={handleGenerateCallers}
            disabled={generatingCallers}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: generatingCallers ? "var(--border-default)" : "var(--button-primary-bg)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: generatingCallers ? "not-allowed" : "pointer",
            }}
          >
            {generatingCallers ? "Generating..." : `Generate ${callerCount} Callers`}
          </button>

          {/* Progress */}
          {generateLog.length > 0 && (
            <div
              style={{
                maxHeight: 160,
                overflowY: "auto",
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                color: "var(--text-secondary)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {generateLog.map((evt, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                  <span style={{ color: evt.phase === "error" ? "var(--color-error)" : "var(--color-success)" }}>
                    {evt.phase === "error" ? "✗" : evt.phase === "complete" ? "✓" : "·"}
                  </span>
                  <span>{evt.message}</span>
                </div>
              ))}
            </div>
          )}

          {generateError && (
            <div style={{ fontSize: 13, color: "var(--color-error)", padding: 8, borderRadius: 8, background: "color-mix(in srgb, var(--color-error) 8%, transparent)" }}>
              {generateError}
            </div>
          )}

          {genComplete && lastGenEvent?.detail && (
            <div style={{ fontSize: 13, color: "var(--color-success)", fontWeight: 600 }}>
              Created {lastGenEvent.detail.created} callers in {selectedDomain?.name}
            </div>
          )}
        </ActionCard>

        {/* Card 2: Onboarding Call */}
        <ActionCard
          title="Onboarding Call"
          description="Compose a prompt and create the first call for a caller"
          disabled={!domainSelected}
        >
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Caller
            </label>
            <select
              value={onboardCallerId}
              onChange={(e) => setOnboardCallerId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            >
              <option value="">Select a caller...</option>
              {callers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.externalId || c.id.slice(0, 8)} ({c._count?.calls ?? 0} calls)
                </option>
              ))}
            </select>
            {callersLoading && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading callers...</span>
            )}
          </div>

          <button
            onClick={handleOnboardingCall}
            disabled={!onboardCallerId || generatingOnboarding}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background:
                !onboardCallerId || generatingOnboarding
                  ? "var(--border-default)"
                  : "var(--button-primary-bg)",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
              cursor: !onboardCallerId || generatingOnboarding ? "not-allowed" : "pointer",
            }}
          >
            {generatingOnboarding ? "Generating..." : "Generate Onboarding Call"}
          </button>

          {onboardingResult && (
            <div
              style={{
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "var(--color-success)" }}>✓</span>
                <span>Prompt composed</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "var(--color-success)" }}>✓</span>
                <span>Call #{onboardingResult.call?.callSequence} created</span>
              </div>
              {onboardingResult.greeting && (
                <div
                  style={{
                    marginTop: 4,
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--surface-secondary)",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    borderLeft: "3px solid var(--button-primary-bg)",
                    lineHeight: 1.5,
                    maxHeight: 120,
                    overflowY: "auto",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    AI Greeting:
                  </span>
                  {onboardingResult.greeting}
                </div>
              )}
            </div>
          )}

          {onboardingError && (
            <div style={{ fontSize: 13, color: "var(--color-error)", padding: 8, borderRadius: 8, background: "color-mix(in srgb, var(--color-error) 8%, transparent)" }}>
              {onboardingError}
            </div>
          )}
        </ActionCard>

        {/* Card 3: Run AI Sim */}
        <ActionCard
          title="Run AI Sim"
          description="Fully automated call — AI plays both system and caller"
          disabled={!domainSelected}
        >
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
              Caller
            </label>
            <select
              value={simCallerId}
              onChange={(e) => setSimCallerId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
              }}
            >
              <option value="">Select a caller...</option>
              {callers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.externalId || c.id.slice(0, 8)} ({c._count?.calls ?? 0} calls)
                </option>
              ))}
            </select>
          </div>

          <HorizontalSlider
            value={simTurnCount}
            min={2}
            max={20}
            step={2}
            label="Turns"
            onChange={setSimTurnCount}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={runningSim ? handleStopSim : handleRunSim}
              disabled={!simCallerId && !runningSim}
              style={{
                flex: 1,
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background:
                  runningSim
                    ? "var(--color-error)"
                    : !simCallerId
                      ? "var(--border-default)"
                      : "var(--button-primary-bg)",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                cursor: !simCallerId && !runningSim ? "not-allowed" : "pointer",
              }}
            >
              {runningSim ? "Stop" : `Run ${simTurnCount}-Turn Sim`}
            </button>
          </div>

          {simStatus && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{simStatus}</div>
          )}

          {/* Live Transcript */}
          {simTranscript.length > 0 && (
            <div
              style={{
                maxHeight: 320,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                borderRadius: 8,
                background: "var(--surface-secondary)",
              }}
            >
              {simTranscript.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        line.role === "system"
                          ? "color-mix(in srgb, var(--button-primary-bg) 15%, transparent)"
                          : "color-mix(in srgb, var(--color-success) 15%, transparent)",
                      color:
                        line.role === "system" ? "var(--button-primary-bg)" : "var(--color-success)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {line.role === "system" ? "AI" : "Caller"}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pipeline Results */}
          {simPipelineResult && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "color-mix(in srgb, var(--color-success) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--color-success)", marginBottom: 6 }}>
                Pipeline Complete
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {simPipelineResult.scoresCreated != null && (
                  <span>Scores: {simPipelineResult.scoresCreated}</span>
                )}
                {simPipelineResult.memoriesCreated != null && (
                  <span>Memories: {simPipelineResult.memoriesCreated}</span>
                )}
                {simPipelineResult.agentMeasurements != null && (
                  <span>Measurements: {simPipelineResult.agentMeasurements}</span>
                )}
                {simPipelineResult.callTargetsCreated != null && (
                  <span>Targets: {simPipelineResult.callTargetsCreated}</span>
                )}
              </div>
            </div>
          )}

          {simError && (
            <div style={{ fontSize: 13, color: "var(--color-error)", padding: 8, borderRadius: 8, background: "color-mix(in srgb, var(--color-error) 8%, transparent)" }}>
              {simError}
            </div>
          )}
        </ActionCard>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
