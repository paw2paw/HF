"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FancySelect } from "@/components/shared/FancySelect";
import "./test-harness.css";

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
    <div className="th-slider-wrap">
      <div className="th-slider-header">
        <span className="th-slider-label">{label}</span>
        <span className="th-slider-value">{value}</span>
      </div>
      <div
        ref={trackRef}
        className="th-slider-track"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          calcValue(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          calcValue(e.touches[0].clientX);
        }}
      >
        {/* Filled track */}
        <div
          className="th-slider-fill"
          style={{
            width: `calc(${pct}% - 6px)`,
            transition: isDragging ? "none" : "width 0.1s ease-out",
          }}
        />
        {/* Thumb */}
        <div
          className={`th-slider-thumb${isDragging ? " th-slider-thumb-dragging" : ""}`}
          style={{
            left: `calc(${pct}% - 12px)`,
            transition: isDragging ? "none" : undefined,
          }}
        />
      </div>
      <div className="th-slider-range">
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
    <div className={`th-action-card${disabled ? " th-action-card-disabled" : ""}`}>
      <div>
        <h2 className="th-action-card-title">{title}</h2>
        <p className="th-action-card-desc">{description}</p>
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
      <div className="th-loading-wrap">
        <div className="th-loading-spinner" />
      </div>
    );
  }

  return (
    <div className="th-page">
      {/* Header */}
      <div>
        <a href="/x/settings" className="th-back-link">&larr; Back to Settings</a>
        <h1 className="hf-page-title hf-mt-xs">
          Test Harness
        </h1>

        <p className="th-subtitle">
          Generate test data and run automated AI simulations
        </p>
      </div>

      {/* Domain Selector */}
      <div className="th-domain-selector">
        <label className="th-domain-label">Domain</label>
        {domains.length === 0 ? (
          <p className="th-no-domains">
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
      <div className="th-cards-grid">
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
            className="th-action-btn"
            onClick={handleGenerateCallers}
            disabled={generatingCallers}
          >
            {generatingCallers ? "Generating..." : `Generate ${callerCount} Callers`}
          </button>

          {/* Progress */}
          {generateLog.length > 0 && (
            <div className="th-progress-log">
              {generateLog.map((evt, i) => (
                <div key={i} className="th-progress-row">
                  <span className={evt.phase === "error" ? "th-progress-icon-error" : "th-progress-icon-success"}>
                    {evt.phase === "error" ? "✗" : evt.phase === "complete" ? "✓" : "·"}
                  </span>
                  <span>{evt.message}</span>
                </div>
              ))}
            </div>
          )}

          {generateError && (
            <div className="th-error">{generateError}</div>
          )}

          {genComplete && lastGenEvent?.detail && (
            <div className="th-success-msg">
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
            <label className="th-select-label">Caller</label>
            <select
              className="th-select"
              value={onboardCallerId}
              onChange={(e) => setOnboardCallerId(e.target.value)}
            >
              <option value="">Select a caller...</option>
              {callers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.externalId || c.id.slice(0, 8)} ({c._count?.calls ?? 0} calls)
                </option>
              ))}
            </select>
            {callersLoading && (
              <span className="th-callers-loading">Loading callers...</span>
            )}
          </div>

          <button
            className="th-action-btn"
            onClick={handleOnboardingCall}
            disabled={!onboardCallerId || generatingOnboarding}
          >
            {generatingOnboarding ? "Generating..." : "Generate Onboarding Call"}
          </button>

          {onboardingResult && (
            <div className="th-onboarding-result">
              <div className="th-check-row">
                <span className="th-check-icon">✓</span>
                <span>Prompt composed</span>
              </div>
              <div className="th-check-row">
                <span className="th-check-icon">✓</span>
                <span>Call #{onboardingResult.call?.callSequence} created</span>
              </div>
              {onboardingResult.greeting && (
                <div className="th-greeting-box">
                  <span className="th-greeting-label">AI Greeting:</span>
                  {onboardingResult.greeting}
                </div>
              )}
            </div>
          )}

          {onboardingError && (
            <div className="th-error">{onboardingError}</div>
          )}
        </ActionCard>

        {/* Card 3: Run AI Sim */}
        <ActionCard
          title="Run AI Sim"
          description="Fully automated call — AI plays both system and caller"
          disabled={!domainSelected}
        >
          <div>
            <label className="th-select-label">Caller</label>
            <select
              className="th-select"
              value={simCallerId}
              onChange={(e) => setSimCallerId(e.target.value)}
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

          <div className="th-sim-btn-row">
            <button
              className={`th-action-btn hf-flex-1${runningSim ? " th-action-btn-stop" : ""}`}
              onClick={runningSim ? handleStopSim : handleRunSim}
              disabled={!simCallerId && !runningSim}
            >
              {runningSim ? "Stop" : `Run ${simTurnCount}-Turn Sim`}
            </button>
          </div>

          {simStatus && (
            <div className="th-sim-status">{simStatus}</div>
          )}

          {/* Live Transcript */}
          {simTranscript.length > 0 && (
            <div className="th-transcript">
              {simTranscript.map((line, i) => (
                <div key={i} className="th-transcript-line">
                  <span
                    className={`th-role-badge ${line.role === "system" ? "th-role-badge-system" : "th-role-badge-caller"}`}
                  >
                    {line.role === "system" ? "AI" : "Caller"}
                  </span>
                  <span className="th-transcript-content">
                    {line.content}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pipeline Results */}
          {simPipelineResult && (
            <div className="th-pipeline-result">
              <div className="th-pipeline-title">Pipeline Complete</div>
              <div className="th-pipeline-grid">
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
            <div className="th-error">{simError}</div>
          )}
        </ActionCard>
      </div>

    </div>
  );
}
