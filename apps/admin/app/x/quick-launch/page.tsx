"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────

type Persona = {
  slug: string;
  name: string;
  description: string | null;
};

type StepStatus = "pending" | "active" | "done" | "error" | "skipped";

type TimelineStep = {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
};

type LaunchResult = {
  domainId: string;
  domainSlug: string;
  domainName: string;
  callerId: string;
  callerName: string;
  assertionCount: number;
  moduleCount: number;
  goalCount: number;
  warnings: string[];
  identitySpecId?: string;
  contentSpecId?: string;
  playbookId?: string;
};

// ── Step Marker ────────────────────────────────────

function StepMarker({ number, label, active }: { number: number; label: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: active !== false ? "var(--accent, #2563eb)" : "var(--bg-tertiary, #e5e7eb)",
          color: active !== false ? "#fff" : "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 700,
          flexShrink: 0,
          transition: "all 0.2s",
        }}
      >
        {number}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary)",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Zebra Section ──────────────────────────────────

function ZebraSection({
  stripe,
  children,
}: {
  stripe: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "28px 32px",
        background: stripe
          ? "var(--bg-secondary, #f8fafc)"
          : "transparent",
        marginLeft: -32,
        marginRight: -32,
        borderTop: stripe ? "1px solid var(--border-light, rgba(0,0,0,0.04))" : "none",
        borderBottom: stripe ? "1px solid var(--border-light, rgba(0,0,0,0.04))" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────

export default function QuickLaunchPage() {
  const router = useRouter();

  // Form state
  const [subjectName, setSubjectName] = useState("");
  const [persona, setPersona] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [qualificationRef, setQualificationRef] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Personas from API
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);

  // Launch state
  const [launching, setLaunching] = useState(false);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File drop ref
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load personas ──────────────────────────────────

  useEffect(() => {
    fetch("/api/onboarding/personas")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.personas?.length > 0) {
          setPersonas(data.personas);
          setPersona(data.defaultPersona || data.personas[0].slug);
        }
      })
      .catch(() => {
        setPersonas([{ slug: "tutor", name: "Tutor", description: "Patient teaching expert" }]);
        setPersona("tutor");
      })
      .finally(() => setPersonasLoading(false));
  }, []);

  // ── Goal chips ─────────────────────────────────────

  const addGoal = useCallback(() => {
    const trimmed = goalInput.trim();
    if (trimmed && !goals.includes(trimmed)) {
      setGoals((prev) => [...prev, trimmed]);
      setGoalInput("");
    }
  }, [goalInput, goals]);

  const removeGoal = (index: number) => {
    setGoals((prev) => prev.filter((_, i) => i !== index));
  };

  // ── File handling ──────────────────────────────────

  const handleFile = (f: File | null) => {
    if (!f) return;
    const name = f.name.toLowerCase();
    const valid = [".pdf", ".txt", ".md", ".markdown", ".json"];
    if (!valid.some((ext) => name.endsWith(ext))) {
      setError(`Unsupported file type. Supported: ${valid.join(", ")}`);
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── Launch ─────────────────────────────────────────

  const canLaunch = subjectName.trim() && persona && file && !launching;

  const handleLaunch = async () => {
    if (!canLaunch) return;

    setLaunching(true);
    setError(null);
    setResult(null);
    setTimeline([]);

    const formData = new FormData();
    formData.append("subjectName", subjectName.trim());
    formData.append("persona", persona);
    formData.append("file", file!);
    if (goals.length > 0) {
      formData.append("learningGoals", JSON.stringify(goals));
    }
    if (qualificationRef.trim()) {
      formData.append("qualificationRef", qualificationRef.trim());
    }

    try {
      const response = await fetch("/api/domains/quick-launch", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const dataLine = block
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6));
            handleProgressEvent(event);
          } catch {
            // Ignore malformed events
          }
        }
      }

      if (buffer.trim()) {
        const dataLine = buffer
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (dataLine) {
          try {
            const event = JSON.parse(dataLine.slice(6));
            handleProgressEvent(event);
          } catch {
            // Ignore
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Quick Launch failed");
    } finally {
      setLaunching(false);
    }
  };

  const handleProgressEvent = (event: any) => {
    const { phase, message, detail } = event;

    if (phase === "complete" && detail) {
      setResult(detail as LaunchResult);
      setTimeline((prev) => prev.map((s) => ({ ...s, status: "done" as StepStatus })));
      return;
    }

    if (phase === "error") {
      setError(message);
      setTimeline((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, status: "error", message } : s
        )
      );
      return;
    }

    if (phase === "init") return;

    setTimeline((prev) => {
      const existing = prev.find((s) => s.id === phase);
      if (existing) {
        return prev.map((s) => {
          if (s.id === phase) {
            const isDone = message.includes("\u2713");
            const isSkipped = message.includes("skipped");
            return {
              ...s,
              status: isDone ? "done" : isSkipped ? "skipped" : "active",
              message,
            };
          }
          if (s.status === "active" && !message.includes("\u2713")) {
            return { ...s, status: "done" };
          }
          return s;
        });
      }
      const updated = prev.map((s) =>
        s.status === "active" ? { ...s, status: "done" as StepStatus } : s
      );
      return [
        ...updated,
        {
          id: phase,
          label: message,
          status: "active" as StepStatus,
          message,
        },
      ];
    });
  };

  // ── Completion percentage ──────────────────────────

  const formSteps = [
    !!subjectName.trim(),
    !!persona,
    !!file,
  ];
  const completedSteps = formSteps.filter(Boolean).length;

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 32px 64px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            marginBottom: 8,
            color: "var(--text-primary)",
            lineHeight: 1.1,
          }}
        >
          Quick Launch
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--text-secondary)",
            maxWidth: 480,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          Upload your course material and get a working AI tutor in one click.
        </p>
      </div>

      {/* ── Result Banner ── */}
      {result && (
        <div
          style={{
            padding: 32,
            borderRadius: 16,
            background: "linear-gradient(135deg, var(--bg-success, #f0fdf4), #ecfdf5)",
            border: "2px solid var(--border-success, #86efac)",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 10,
              color: "var(--color-success, #16a34a)",
            }}
          >
            Ready to test
          </div>
          <div
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            <strong>{result.domainName}</strong> domain created with{" "}
            {result.assertionCount} teaching points
            {result.moduleCount > 0 && `, ${result.moduleCount} curriculum modules`}
            {result.goalCount > 0 && `, ${result.goalCount} learning goals`}.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push(`/x/domains?selected=${result.domainId}`)}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                background: "var(--accent)",
                color: "white",
                border: "none",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "-0.01em",
              }}
            >
              View Domain
            </button>
            <button
              onClick={() => router.push(`/x/callers/${result.callerId}`)}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                background: "var(--bg-primary)",
                border: "2px solid var(--border)",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Test Caller
            </button>
            {result.identitySpecId && (
              <button
                onClick={() => router.push(`/x/specs/${result.identitySpecId}`)}
                style={{
                  padding: "12px 24px",
                  borderRadius: 10,
                  background: "var(--bg-primary)",
                  border: "2px solid var(--border)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Edit Identity
              </button>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
              {result.warnings.map((w, i) => (
                <div key={i}>Note: {w}</div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setTimeline([]);
              setFile(null);
              setSubjectName("");
              setGoals([]);
            }}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Launch Another
          </button>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && !launching && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "var(--bg-error, #fef2f2)",
            border: "2px solid var(--border-error, #fca5a5)",
            color: "var(--text-error, #dc2626)",
            fontSize: 15,
            fontWeight: 500,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Progress Timeline ── */}
      {launching && timeline.length > 0 && (
        <div
          style={{
            marginBottom: 32,
            padding: 28,
            borderRadius: 16,
            background: "var(--bg-secondary, #f8fafc)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 16,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            Building your tutor...
          </div>
          {timeline.map((step, i) => (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 0",
                borderBottom:
                  i < timeline.length - 1
                    ? "1px solid var(--border-light, rgba(0,0,0,0.06))"
                    : "none",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  background:
                    step.status === "done"
                      ? "var(--color-success, #22c55e)"
                      : step.status === "error"
                        ? "var(--color-error, #ef4444)"
                        : step.status === "active"
                          ? "var(--accent, #2563eb)"
                          : "var(--bg-tertiary, #e5e7eb)",
                  color:
                    step.status === "pending"
                      ? "var(--text-muted)"
                      : "#fff",
                }}
              >
                {step.status === "done" && "\u2713"}
                {step.status === "active" && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      height: 14,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                )}
                {step.status === "error" && "\u2717"}
                {step.status === "skipped" && "\u2014"}
                {step.status === "pending" && (i + 1)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: step.status === "active" ? 600 : 400,
                  color:
                    step.status === "active"
                      ? "var(--text-primary)"
                      : step.status === "done"
                        ? "var(--text-secondary)"
                        : "var(--text-muted)",
                }}
              >
                {step.message || step.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Form ── */}
      {!result && (
        <>
          {/* Step 1: Subject Name */}
          <ZebraSection stripe={false}>
            <StepMarker number={1} label="What are you teaching?" active={!subjectName.trim() || true} />
            <input
              id="subject"
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Food Safety Level 2, Quantum Mechanics, Financial Planning"
              disabled={launching}
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: 12,
                border: "2px solid var(--border)",
                fontSize: 17,
                fontWeight: 500,
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent, #2563eb)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </ZebraSection>

          {/* Step 2: Teaching Style */}
          <ZebraSection stripe={true}>
            <StepMarker number={2} label="Choose a teaching style" />
            {personasLoading ? (
              <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "12px 0" }}>
                Loading personas...
              </div>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {personas.map((p) => {
                  const selected = persona === p.slug;
                  return (
                    <button
                      key={p.slug}
                      onClick={() => setPersona(p.slug)}
                      disabled={launching}
                      style={{
                        padding: "14px 24px",
                        borderRadius: 12,
                        border: selected
                          ? "2px solid var(--accent, #2563eb)"
                          : "2px solid var(--border)",
                        background: selected
                          ? "var(--accent-bg, #eff6ff)"
                          : "var(--bg-primary)",
                        fontSize: 15,
                        fontWeight: selected ? 700 : 500,
                        cursor: launching ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                        textAlign: "left",
                        minWidth: 140,
                      }}
                    >
                      <div style={{ color: "var(--text-primary)" }}>{p.name}</div>
                      {p.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginTop: 4,
                            fontWeight: 400,
                          }}
                        >
                          {p.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ZebraSection>

          {/* Step 3: Learning Goals */}
          <ZebraSection stripe={false}>
            <StepMarker number={3} label="Learning goals" />
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 12,
                marginTop: -6,
              }}
            >
              Optional &mdash; what should your learners achieve?
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: goals.length > 0 ? 12 : 0 }}>
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGoal();
                  }
                }}
                placeholder="e.g. Pass the exam, Understand key concepts"
                disabled={launching}
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "2px solid var(--border)",
                  fontSize: 16,
                  fontWeight: 500,
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent, #2563eb)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                onClick={addGoal}
                disabled={!goalInput.trim() || launching}
                style={{
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: "2px solid var(--border)",
                  background: "var(--bg-primary)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: goalInput.trim() && !launching ? "pointer" : "not-allowed",
                  opacity: goalInput.trim() ? 1 : 0.4,
                  transition: "opacity 0.15s",
                }}
              >
                Add
              </button>
            </div>
            {goals.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {goals.map((g, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 20,
                      background: "var(--accent-bg, #eff6ff)",
                      border: "1px solid var(--accent, #2563eb)",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {g}
                    {!launching && (
                      <button
                        onClick={() => removeGoal(i)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 16,
                          lineHeight: 1,
                          color: "var(--text-muted)",
                          fontWeight: 700,
                        }}
                      >
                        &times;
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </ZebraSection>

          {/* Step 4: Course Material */}
          <ZebraSection stripe={true}>
            <StepMarker number={4} label="Upload course material" />
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !launching && fileInputRef.current?.click()}
              style={{
                padding: file ? "20px 24px" : "44px 24px",
                borderRadius: 16,
                border: `2px dashed ${file ? "var(--accent, #2563eb)" : "var(--border)"}`,
                background: file ? "var(--accent-bg, #eff6ff)" : "var(--bg-primary)",
                textAlign: "center",
                cursor: launching ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              {file ? (
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                    {(file.size / 1024).toFixed(0)} KB
                    {!launching && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent, #2563eb)",
                          cursor: "pointer",
                          marginLeft: 12,
                          textDecoration: "underline",
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: 40,
                      marginBottom: 8,
                      opacity: 0.25,
                    }}
                  >
                    &#8613;
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-secondary)" }}>
                    Drop a file here or click to browse
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>
                    PDF, TXT, Markdown, or JSON
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.markdown,.json"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              style={{ display: "none" }}
            />
          </ZebraSection>

          {/* Advanced Options */}
          <div style={{ padding: "16px 0 0" }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: "none",
                border: "none",
                fontSize: 14,
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 0,
                fontWeight: 500,
              }}
            >
              {showAdvanced ? "\u25BE" : "\u25B8"} Advanced options
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 12, maxWidth: 480 }}>
                <label
                  htmlFor="qualRef"
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "var(--text-secondary)",
                  }}
                >
                  Qualification reference
                </label>
                <input
                  id="qualRef"
                  type="text"
                  value={qualificationRef}
                  onChange={(e) => setQualificationRef(e.target.value)}
                  placeholder="e.g. Highfield L2 Food Safety"
                  disabled={launching}
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    borderRadius: 12,
                    border: "2px solid var(--border)",
                    fontSize: 16,
                    fontWeight: 500,
                    background: "var(--bg-primary)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Launch Button ── */}
          <div style={{ padding: "32px 0 0" }}>
            <button
              onClick={handleLaunch}
              disabled={!canLaunch}
              style={{
                width: "100%",
                padding: "18px 32px",
                borderRadius: 14,
                border: "none",
                background: canLaunch
                  ? "linear-gradient(135deg, var(--accent, #2563eb), #1d4ed8)"
                  : "var(--bg-tertiary, #e5e7eb)",
                color: canLaunch ? "#fff" : "var(--text-muted)",
                fontSize: 19,
                fontWeight: 800,
                cursor: canLaunch ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                letterSpacing: "-0.02em",
                boxShadow: canLaunch
                  ? "0 4px 14px rgba(37, 99, 235, 0.35)"
                  : "none",
              }}
            >
              {launching ? "Launching..." : "Launch"}
            </button>

            {/* Progress bar showing form completion */}
            {!launching && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  <span>{completedSteps} of 3 required</span>
                  {!canLaunch && (
                    <span>
                      {!subjectName.trim()
                        ? "Enter a subject name"
                        : !file
                          ? "Upload course material"
                          : ""}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: "var(--bg-tertiary, #e5e7eb)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(completedSteps / 3) * 100}%`,
                      borderRadius: 2,
                      background: completedSteps === 3
                        ? "var(--color-success, #22c55e)"
                        : "var(--accent, #2563eb)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}

            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-muted)",
                marginTop: 16,
                lineHeight: 1.5,
              }}
            >
              Creates domain, extracts teaching points, builds curriculum, and sets up a test caller.
            </p>
          </div>
        </>
      )}

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
