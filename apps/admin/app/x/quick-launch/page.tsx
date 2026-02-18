"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReviewPanel from "./ReviewPanel";
import type { AnalysisPreview, CommitOverrides } from "@/lib/domain/quick-launch";
import { useContentJobQueue } from "@/components/shared/ContentJobQueue";

// ── Types ──────────────────────────────────────────

type Persona = {
  slug: string;
  name: string;
  description: string | null;
};

type Phase = "form" | "building" | "review" | "committing" | "result";

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
  subjectId?: string;
  sourceId?: string;
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

type CourseCheck = {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "recommended" | "optional";
  passed: boolean;
  detail: string;
  fixAction?: { label: string; href: string };
};

type ResumeTask = {
  id: string;
  context: any;
  startedAt: string;
};

// ── Step Marker ────────────────────────────────────

function StepMarker({ number, label, completed }: { number: number; label: string; completed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: completed
            ? "var(--status-success-text)"
            : "var(--accent-primary)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: completed ? 18 : 15,
          fontWeight: 700,
          flexShrink: 0,
          transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
          boxShadow: completed
            ? "0 2px 8px color-mix(in srgb, var(--status-success-text) 35%, transparent)"
            : "0 2px 8px color-mix(in srgb, var(--accent-primary) 25%, transparent)",
        }}
      >
        {completed ? "\u2713" : number}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: completed ? "var(--text-secondary)" : "var(--text-primary)",
          letterSpacing: "-0.01em",
          transition: "color 0.2s",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Fancy Select ──────────────────────────────────

type SortKey = "label" | "description";
type SortDir = "asc" | "desc";

function FancySelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  loading,
  searchable = true,
  sortable = true,
}: {
  options: { value: string; label: string; description?: string | null }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchable?: boolean;
  sortable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  const selected = options.find((o) => o.value === value);

  // Filter
  const q = query.toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false)
      )
    : options;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const aVal = (sortKey === "label" ? a.label : a.description ?? "").toLowerCase();
    const bVal = (sortKey === "label" ? b.label : b.description ?? "").toLowerCase();
    const cmp = aVal.localeCompare(bVal);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (loading) {
    return (
      <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "14px 0" }}>
        Loading...
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => { setOpen(!open); if (open) setQuery(""); }}
        style={{
          width: "100%",
          padding: "14px 20px",
          borderRadius: 12,
          border: `2px solid ${open ? "var(--accent-primary)" : "var(--input-border)"}`,
          background: "var(--input-bg)",
          fontSize: 16,
          fontWeight: 500,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          color: selected ? "var(--text-primary)" : "var(--text-placeholder)",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)" : "none",
          boxSizing: "border-box",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: selected ? "var(--text-primary)" : "var(--text-placeholder)" }}>
            {selected ? selected.label : placeholder}
          </div>
          {selected?.description && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, fontWeight: 400 }}>
              {selected.description}
            </div>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M4 6l4 4 4-4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            boxShadow: "0 8px 24px color-mix(in srgb, var(--foreground) 12%, transparent)",
            overflow: "hidden",
          }}
        >
          {/* ── Search + Sort toolbar ── */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {searchable && (
              <div style={{ flex: 1, position: "relative" }}>
                <svg
                  width="14" height="14" viewBox="0 0 16 16" fill="none"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                >
                  <circle cx="7" cy="7" r="5" stroke="var(--text-muted)" strokeWidth="1.5" />
                  <path d="M11 11l3 3" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter..."
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 30px",
                    borderRadius: 8,
                    border: "1px solid var(--border-default)",
                    fontSize: 14,
                    fontWeight: 500,
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setOpen(false); setQuery(""); }
                    if (e.key === "Enter" && sorted.length === 1) {
                      onChange(sorted[0].value);
                      setOpen(false);
                      setQuery("");
                    }
                  }}
                />
              </div>
            )}
            {sortable && (
              <div style={{ display: "flex", gap: 2 }}>
                {(["label", "description"] as SortKey[]).map((key) => {
                  const active = sortKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleSort(key)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "none",
                        background: active ? "var(--status-info-bg)" : "transparent",
                        color: active ? "var(--accent-primary)" : "var(--text-muted)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s",
                      }}
                    >
                      {key === "label" ? "Name" : "Type"}
                      {active && (
                        <span style={{ marginLeft: 2, fontSize: 10 }}>
                          {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Options list ── */}
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {sorted.length === 0 ? (
              <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>
                No matches for &ldquo;{query}&rdquo;
              </div>
            ) : (
              sorted.map((o) => {
                const isSelected = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      border: "none",
                      borderBottom: "1px solid var(--border-subtle)",
                      background: isSelected ? "var(--status-info-bg)" : "var(--surface-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--hover-bg)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface-primary)"; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: isSelected ? 700 : 500, color: "var(--text-primary)" }}>
                        {o.label}
                      </div>
                      {o.description && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontWeight: 400 }}>
                          {o.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "var(--accent-primary)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {"\u2713"}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form Card ─────────────────────────────────────

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "24px 28px",
        background: "var(--surface-primary)",
        border: "1px solid var(--border-default)",
        borderRadius: 16,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div
      style={{
        padding: "12px 24px",
        background: "var(--surface-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 24,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          border: "2px solid rgba(37, 99, 235, 0.3)",
          borderTopColor: "var(--accent-primary)",
          borderRadius: "50%",
          animation: progress < 100 ? "spin 0.8s linear infinite" : "none",
          background: progress >= 100 ? "var(--status-success-text)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#fff",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {progress >= 100 && "\u2713"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          {label}
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: "var(--surface-tertiary)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 2,
              background: progress >= 100
                ? "var(--status-success-text)"
                : "var(--accent-primary)",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────

export default function QuickLaunchPage() {
  const router = useRouter();

  // ── Phase state machine ────────────────────────────
  const [phase, setPhase] = useState<Phase>("form");
  const [taskId, setTaskId] = useState<string | null>(null);

  // Form state
  const [brief, setBrief] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [suggestedPersona, setSuggestedPersona] = useState<string | null>(null);
  const [suggestedGoals, setSuggestedGoals] = useState<string[] | null>(null);
  const [persona, setPersona] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [qualificationRef, setQualificationRef] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [launchMode, setLaunchMode] = useState<"upload" | "generate">("generate");

  // Domain picker — use existing domain or create new
  const [domains, setDomains] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");

  // Personas from API
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);

  // Progressive analysis state
  const [preview, setPreview] = useState<Partial<AnalysisPreview>>({});
  const [overrides, setOverrides] = useState<CommitOverrides>({});
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLabel, setAnalysisLabel] = useState("Starting analysis...");

  // Commit state
  const [commitTimeline, setCommitTimeline] = useState<TimelineStep[]>([]);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resume
  const [resumeTask, setResumeTask] = useState<ResumeTask | null>(null);

  // File drop ref
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosave debounce ref
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load personas + domains ────────────────────────

  useEffect(() => {
    fetch("/api/onboarding/personas")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.personas?.length > 0) {
          setPersonas(data.personas);
          setPersona(data.defaultPersona || data.personas[0].slug);
        }
      })
      .catch((e) => {
        console.warn("[QuickLaunch] Failed to load personas, using fallback:", e);
        setPersonas([{ slug: "tutor", name: "Tutor", description: "Patient teaching expert" }]);
        setPersona("tutor");
      })
      .finally(() => setPersonasLoading(false));

    // Load domains for domain picker
    fetch("/api/domains?activeOnly=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.domains) {
          setDomains(data.domains.map((d: any) => ({
            id: d.id,
            slug: d.slug,
            name: d.name,
          })));
        }
      })
      .catch(() => {});
  }, []);

  // ── Check for resumable task ──────────────────────

  useEffect(() => {
    fetch("/api/tasks?status=in_progress")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.tasks) {
          const qlTask = data.tasks.find((t: any) => t.taskType === "quick_launch");
          if (qlTask && qlTask.context) {
            setResumeTask({
              id: qlTask.id,
              context: qlTask.context,
              startedAt: qlTask.startedAt,
            });
          }
        }
      })
      .catch((e) => console.warn("[QuickLaunch] Failed to check for resumable tasks:", e));
  }, []);

  // ── Resume handler ────────────────────────────────

  const handleResume = useCallback(() => {
    if (!resumeTask?.context) return;
    const ctx = resumeTask.context;

    setTaskId(resumeTask.id);

    // Restore input state
    if (ctx.input) {
      setSubjectName(ctx.input.subjectName || "");
      setBrief(ctx.input.brief || "");
      if (ctx.input.subjectName) setNameManuallyEdited(true);
      setPersona(ctx.input.persona || "");
      setGoals(ctx.input.learningGoals || []);
      setQualificationRef(ctx.input.qualificationRef || "");
    }

    // Restore launch mode
    if (ctx.mode) {
      setLaunchMode(ctx.mode);
    }

    // Restore preview if available
    if (ctx.preview) {
      setPreview(ctx.preview);
      setAnalysisComplete(true);
      setAnalysisProgress(100);
    }

    // Restore overrides
    if (ctx.overrides) {
      setOverrides(ctx.overrides);
    }

    // If still building (extraction in progress), resume polling instead of going to form
    if (ctx.phase === "building" && ctx.sourceId && ctx.jobId) {
      setPreview({
        domainId: ctx.domainId,
        domainSlug: ctx.domainSlug,
        domainName: ctx.domainName,
        subjectId: ctx.subjectId,
        sourceId: ctx.sourceId,
      });
      setExtractionJobId(ctx.jobId);
      setExtractionSourceId(ctx.sourceId);
      setAnalysisProgress(10);
      setAnalysisLabel("Resuming extraction...");
      setPhase("review"); // Shows review panel with progress bar + skeletons
    } else if (ctx.phase === "review") {
      setPhase("review");
    } else {
      setPhase("form");
    }

    setResumeTask(null);
  }, [resumeTask]);

  // ── Autosave overrides to task ────────────────────

  const autosaveOverrides = useCallback(
    (newOverrides: CommitOverrides) => {
      if (!taskId) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId,
            updates: { context: { phase: "review", overrides: newOverrides } },
          }),
        }).catch((e) => console.warn("[QuickLaunch] Failed to save task overrides:", e));
      }, 1000);
    },
    [taskId]
  );

  const handleOverridesChange = useCallback(
    (o: CommitOverrides) => {
      setOverrides(o);
      autosaveOverrides(o);
    },
    [autosaveOverrides]
  );

  // ── AI field suggestions (fires on blur of brief textarea) ──

  const suggestAbort = useRef<AbortController | null>(null);

  const suggestFields = useCallback(
    async (text: string) => {
      if (text.trim().length < 20) return;

      // Abort any in-flight request
      suggestAbort.current?.abort();
      const controller = new AbortController();
      suggestAbort.current = controller;

      // Hard timeout — 10s max
      const timeout = setTimeout(() => controller.abort(), 10_000);

      setNameLoading(true);
      try {
        const res = await fetch("/api/domains/suggest-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: text.trim(),
            personaSlugs: personas.map((p) => p.slug),
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!data.ok) return;

        // Name: apply directly if empty, otherwise show as suggestion
        if (data.name && !nameManuallyEdited) {
          if (!subjectName.trim()) {
            setSubjectName(data.name);
          } else {
            setSuggestedName(data.name);
          }
        }

        // Persona: suggest if user hasn't picked one yet, or show chip
        if (data.persona && personas.some((p) => p.slug === data.persona)) {
          if (!persona) {
            setPersona(data.persona);
          } else if (data.persona !== persona) {
            setSuggestedPersona(data.persona);
          }
        }

        // Goals: suggest if user hasn't added any, or show chips
        if (data.goals?.length) {
          if (goals.length === 0) {
            setGoals(data.goals);
          } else {
            const newGoals = data.goals.filter(
              (g: string) => !goals.some((existing) => existing.toLowerCase() === g.toLowerCase())
            );
            if (newGoals.length > 0) {
              setSuggestedGoals(newGoals);
            }
          }
        }
      } catch {
        // Silently fail — user can fill fields manually
      } finally {
        clearTimeout(timeout);
        setNameLoading(false);
      }
    },
    [nameManuallyEdited, subjectName, persona, goals, personas]
  );

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

  // ── Global job queue ──────────────────────────────
  const { addJob: addToGlobalQueue } = useContentJobQueue();

  // Poll extraction job for completion
  const jobPollRef = useRef<NodeJS.Timeout | null>(null);
  const [extractionJobId, setExtractionJobId] = useState<string | null>(null);
  const [extractionSourceId, setExtractionSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (!extractionJobId || !extractionSourceId) return;
    if (analysisComplete) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/content-sources/${extractionSourceId}/import?jobId=${extractionJobId}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok || !data.job) return;

        const job = data.job;
        const pct =
          job.totalChunks > 0
            ? Math.round((job.currentChunk / job.totalChunks) * 80) + 10
            : 10;

        if (job.status === "extracting") {
          setAnalysisProgress(pct);
          setAnalysisLabel(
            `Extracting... ${job.extractedCount} teaching points found`
          );
        } else if (job.status === "importing") {
          setAnalysisProgress(85);
          setAnalysisLabel("Saving content...");
        } else if (job.status === "done") {
          // Extraction complete — fetch full preview from UserTask
          setAnalysisProgress(95);
          setAnalysisLabel("Finishing up...");
          if (jobPollRef.current) clearInterval(jobPollRef.current);

          // Update preview with assertion count from job
          setPreview((prev) => ({
            ...prev,
            assertionCount: job.importedCount ?? job.extractedCount ?? 0,
          }));

          // Fetch full preview from task (includes identity config + assertion summary)
          if (taskId) {
            try {
              const taskRes = await fetch(`/api/tasks?status=in_progress`);
              const taskData = await taskRes.json();
              if (taskData.ok && taskData.tasks) {
                const qlTask = taskData.tasks.find(
                  (t: any) => t.id === taskId && t.context?.preview
                );
                if (qlTask?.context?.preview) {
                  setPreview(qlTask.context.preview as Partial<AnalysisPreview>);
                }
              }
            } catch {
              // Preview from task unavailable — continue with what we have
            }
          }

          setAnalysisComplete(true);
          setAnalysisProgress(100);
          setAnalysisLabel("Analysis complete!");
        } else if (job.status === "error") {
          if (jobPollRef.current) clearInterval(jobPollRef.current);
          setError(job.error || "Content extraction failed");
        }
      } catch {
        // Keep polling
      }
    };

    jobPollRef.current = setInterval(poll, 3000);
    poll(); // Run immediately
    return () => {
      if (jobPollRef.current) clearInterval(jobPollRef.current);
    };
  }, [extractionJobId, extractionSourceId, analysisComplete, taskId]);

  // ── Build (Analyze) ─────────────────────────────

  const canLaunch = subjectName.trim() && persona && (launchMode === "generate" || !!file) && phase === "form";

  const handleBuild = async () => {
    if (!canLaunch) return;

    setPhase("building");
    setError(null);
    setPreview({});
    setOverrides({});
    setAnalysisComplete(false);
    setAnalysisProgress(5);
    setAnalysisLabel("Setting up agent...");

    const formData = new FormData();
    formData.append("subjectName", subjectName.trim());
    formData.append("persona", persona);
    formData.append("mode", launchMode);
    if (selectedDomainId) {
      formData.append("domainId", selectedDomainId);
    }
    if (brief.trim()) {
      formData.append("brief", brief.trim());
    }
    if (launchMode === "upload" && file) {
      formData.append("file", file);
    }
    if (goals.length > 0) {
      formData.append("learningGoals", JSON.stringify(goals));
    }
    if (qualificationRef.trim()) {
      formData.append("qualificationRef", qualificationRef.trim());
    }

    try {
      const response = await fetch("/api/domains/quick-launch/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      // Set scaffold data immediately
      setTaskId(data.taskId || null);
      setPreview({
        domainId: data.domainId,
        domainSlug: data.domainSlug,
        domainName: data.domainName,
        subjectId: data.subjectId,
        sourceId: data.sourceId || "",
        identityConfig: data.identityConfig || null,
        mode: launchMode,
      });

      if (launchMode === "upload" && file) {
        // Upload mode: start polling for extraction completion
        addToGlobalQueue(
          data.jobId,
          data.sourceId,
          data.domainName || subjectName.trim(),
          file.name
        );
        setExtractionJobId(data.jobId);
        setExtractionSourceId(data.sourceId);
        setAnalysisProgress(10);
        setAnalysisLabel("Extracting content...");
      } else {
        // Generate mode: no extraction needed — go straight to review
        setAnalysisComplete(true);
        setAnalysisProgress(100);
        setAnalysisLabel("Ready for review");
      }

      // Transition to review
      setPhase("review");
    } catch (err: any) {
      const msg = err.message || "Analysis failed";
      const isNetworkError = msg === "Load failed" || msg === "Failed to fetch" || msg === "NetworkError when attempting to fetch resource.";
      setError(
        isNetworkError
          ? "Connection lost — the server may have restarted. Check your tunnel and try again."
          : msg
      );
      setPhase("form");
    }
  };

  // ── Commit (Create) ──────────────────────────────

  const handleCommit = async () => {
    setPhase("committing");
    setCommitTimeline([]);
    setError(null);

    try {
      const response = await fetch("/api/domains/quick-launch/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          domainId: preview.domainId,
          preview,
          overrides,
          input: {
            subjectName: subjectName.trim(),
            brief: brief.trim() || undefined,
            persona,
            learningGoals: overrides.learningGoals ?? goals,
            qualificationRef: qualificationRef.trim() || undefined,
            mode: launchMode,
          },
        }),
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
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6));
            handleCommitEvent(event);
          } catch {
            // Ignore
          }
        }
      }

      if (buffer.trim()) {
        const dataLine = buffer.split("\n").find((l) => l.startsWith("data: "));
        if (dataLine) {
          try {
            handleCommitEvent(JSON.parse(dataLine.slice(6)));
          } catch {
            // Ignore
          }
        }
      }
    } catch (err: any) {
      const msg = err.message || "Creation failed";
      // Translate browser network errors to user-friendly messages
      const isNetworkError = msg === "Load failed" || msg === "Failed to fetch" || msg === "NetworkError when attempting to fetch resource.";
      setError(
        isNetworkError
          ? "Connection lost — the server may have restarted. Check your tunnel and try again."
          : msg
      );
      setPhase("review");
    }
  };

  const handleCommitEvent = (event: any) => {
    const { phase: evtPhase, message, detail } = event;

    if (evtPhase === "complete" && detail) {
      setResult(detail as LaunchResult);
      setPhase("result");
      return;
    }

    if (evtPhase === "error") {
      setError(message);
      setPhase("review");
      return;
    }

    if (evtPhase === "init") return;

    setCommitTimeline((prev) => {
      const existing = prev.find((s) => s.id === evtPhase);
      if (existing) {
        return prev.map((s) => {
          if (s.id === evtPhase) {
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
        { id: evtPhase, label: message, status: "active" as StepStatus, message },
      ];
    });
  };

  // ── Back to form ──────────────────────────────────

  const handleBackToForm = () => {
    setPhase("form");
    setPreview({});
    setOverrides({});
    setAnalysisComplete(false);
    setAnalysisProgress(0);
  };

  // ── Result screen state (inline editing + classroom) ──

  const [editDomainName, setEditDomainName] = useState("");
  const [editWelcome, setEditWelcome] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [classroom, setClassroom] = useState<{ cohortId: string; joinToken: string; joinUrl: string } | null>(null);
  const [creatingClassroom, setCreatingClassroom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [courseChecks, setCourseChecks] = useState<CourseCheck[]>([]);
  const [courseReady, setCourseReady] = useState(false);
  const [checksLoading, setChecksLoading] = useState(false);

  // Fetch course readiness checks + onboarding data when result screen appears
  const fetchCourseReadiness = useCallback(async () => {
    if (!result) return;
    setChecksLoading(true);
    try {
      const params = new URLSearchParams({ callerId: result.callerId });
      if (result.sourceId) params.set("sourceId", result.sourceId);
      if (result.subjectId) params.set("subjectId", result.subjectId);
      const res = await fetch(`/api/domains/${result.domainId}/course-readiness?${params}`);
      const data = await res.json();
      if (data.ok) {
        setCourseChecks(data.checks || []);
        setCourseReady(data.ready ?? false);
      }
    } catch (e) {
      console.warn("[QuickLaunch] Course readiness fetch failed:", e);
    } finally {
      setChecksLoading(false);
    }
  }, [result]);

  useEffect(() => {
    if (phase === "result" && result) {
      setEditDomainName(result.domainName);
      fetchCourseReadiness();
      fetch(`/api/domains/${result.domainId}/onboarding`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setEditWelcome(data.domain?.onboardingWelcome || "");
          }
        })
        .catch((e) => console.warn("[QuickLaunch] Failed to load domain welcome:", e));
    }
  }, [phase, result, fetchCourseReadiness]);

  // Poll readiness every 10s while on result page (admin may complete steps in other tabs)
  useEffect(() => {
    if (phase !== "result" || !result) return;
    const interval = setInterval(fetchCourseReadiness, 10_000);
    return () => clearInterval(interval);
  }, [phase, result, fetchCourseReadiness]);

  const handleSaveDomainName = async (name: string) => {
    if (!result || name === result.domainName) return;
    setSavingName(true);
    try {
      await fetch(`/api/domains/${result.domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch {
      // silent — the edit is still reflected locally
    }
    setSavingName(false);
  };

  const handleSaveWelcome = async (welcome: string) => {
    if (!result) return;
    setSavingWelcome(true);
    try {
      await fetch(`/api/domains/${result.domainId}/onboarding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingWelcome: welcome }),
      });
    } catch {
      // silent
    }
    setSavingWelcome(false);
  };

  const handleCreateClassroom = async () => {
    if (!result) return;
    setCreatingClassroom(true);
    try {
      const res = await fetch(`/api/domains/${result.domainId}/classroom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${editDomainName} Classroom` }),
      });
      const data = await res.json();
      if (data.ok) {
        setClassroom({
          cohortId: data.cohort.id,
          joinToken: data.joinToken,
          joinUrl: `${window.location.origin}/join/${data.joinToken}`,
        });
      }
    } catch {
      // silent
    }
    setCreatingClassroom(false);
  };

  const handleCopyJoinLink = () => {
    if (!classroom) return;
    navigator.clipboard.writeText(classroom.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Reset all ─────────────────────────────────────

  const handleReset = () => {
    setPhase("form");
    setResult(null);
    setCommitTimeline([]);
    setFile(null);
    setSubjectName("");
    setSuggestedName(null);
    setSuggestedPersona(null);
    setSuggestedGoals(null);
    setNameManuallyEdited(false);
    setGoals([]);
    setPreview({});
    setOverrides({});
    setAnalysisComplete(false);
    setAnalysisProgress(0);
    setTaskId(null);
    setError(null);
    setClassroom(null);
    setCopied(false);
    setEditDomainName("");
    setEditWelcome("");
  };

  // ── Form completion ───────────────────────────────

  const formSteps = [!!subjectName.trim(), !!persona, launchMode === "generate" || !!file];
  const completedSteps = formSteps.filter(Boolean).length;

  const selectedPersona = personas.find((p) => p.slug === persona);

  // ── Render ─────────────────────────────────────────

  return (
    <div style={{ maxWidth: phase === "form" || phase === "result" ? 720 : 1280, margin: "0 auto", padding: "48px 32px 64px", transition: "max-width 0.3s ease" }}>
      {/* ── Header ── */}
      <div
        style={{
          marginBottom: 32,
          textAlign: "center",
          padding: "32px 24px 28px",
          borderRadius: 20,
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, var(--surface-primary)), color-mix(in srgb, var(--accent-primary) 3%, var(--surface-primary)))",
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
            background: "linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))",
            marginBottom: 16,
            boxShadow: "0 4px 12px color-mix(in srgb, var(--accent-primary) 30%, transparent)",
          }}
        >
          <span style={{ fontSize: 24, color: "#fff" }}>&#9889;</span>
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
          Quick Launch
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
          {phase === "form" && "Describe what you want to build and launch a working AI agent in one click."}
          {phase === "building" && "Building your agent..."}
          {phase === "review" && "Review what AI created and customize before finalizing."}
          {phase === "committing" && "Creating your agent..."}
          {phase === "result" && "Your agent is ready!"}
        </p>
      </div>

      {/* ── Resume Banner ── */}
      {resumeTask && phase === "form" && (
        <div
          style={{
            padding: 20,
            borderRadius: 14,
            background: "var(--status-info-bg)",
            border: "2px solid var(--accent-primary)",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              Resume previous launch?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              You have an in-progress Quick Launch
              {resumeTask.context?.input?.subjectName &&
                ` for "${resumeTask.context.input.subjectName}"`}
              {" "}started {new Date(resumeTask.startedAt).toLocaleString()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleResume}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                background: "var(--accent-primary)",
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Resume
            </button>
            <button
              onClick={() => {
                // Abandon old task so it doesn't resurface
                if (resumeTask?.id) {
                  fetch(`/api/tasks?taskId=${resumeTask.id}`, { method: "DELETE" }).catch((e) => console.warn("[QuickLaunch] Failed to delete old task:", e));
                }
                setResumeTask(null);
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Start Fresh
            </button>
          </div>
        </div>
      )}

      {/* ── Progress Bar (building/review) ── */}
      {(phase === "building" || phase === "review") && (
        <ProgressBar progress={analysisProgress} label={analysisLabel} />
      )}

      {/* ── Error Banner ── */}
      {error && phase !== "building" && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "var(--status-error-bg)",
            border: "2px solid var(--status-error-border)",
            color: "var(--status-error-text)",
            fontSize: 15,
            fontWeight: 500,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--status-error-text)",
              padding: "0 4px",
              lineHeight: 1,
              flexShrink: 0,
              opacity: 0.7,
            }}
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Phase: Building & Review (3-column) ── */}
      {(phase === "building" || phase === "review") && (
        <ReviewPanel
          input={{
            subjectName: subjectName.trim(),
            brief: brief.trim() || undefined,
            persona,
            personaName: selectedPersona?.name,
            goals,
            fileName: file?.name,
            fileSize: file?.size,
            qualificationRef: qualificationRef.trim() || undefined,
            mode: launchMode,
          }}
          preview={preview}
          overrides={overrides}
          analysisComplete={analysisComplete}
          onOverridesChange={handleOverridesChange}
          onConfirm={handleCommit}
          onBack={handleBackToForm}
        />
      )}

      {/* ── Phase: Committing (progress timeline) ── */}
      {phase === "committing" && (
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            padding: 28,
            borderRadius: 16,
            background: "var(--surface-secondary)",
            border: "1px solid var(--border-default)",
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
            Creating your agent...
          </div>
          {commitTimeline.map((step, i) => (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "10px 0",
                borderBottom:
                  i < commitTimeline.length - 1
                    ? "1px solid var(--border-subtle)"
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
                      ? "var(--status-success-text)"
                      : step.status === "error"
                        ? "var(--status-error-text)"
                        : step.status === "active"
                          ? "var(--accent-primary)"
                          : "var(--surface-tertiary)",
                  color: step.status === "pending" ? "var(--text-muted)" : "#fff",
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

      {/* ── Phase: Result ── */}
      {phase === "result" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ── Success Banner ── */}
          <div
            style={{
              padding: 32,
              borderRadius: 16,
              background: "linear-gradient(135deg, var(--status-success-bg), #ecfdf5)",
              border: "2px solid var(--status-success-border)",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                marginBottom: 10,
                color: "var(--status-success-text)",
              }}
            >
              Ready to test
            </div>

            {/* ── Editable domain name ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>
                Agent Name {savingName && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— saving...</span>}
              </div>
              <input
                type="text"
                value={editDomainName}
                onChange={(e) => setEditDomainName(e.target.value)}
                onBlur={() => handleSaveDomainName(editDomainName)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-default)",
                  fontSize: 16,
                  fontWeight: 600,
                  background: "var(--surface-primary)",
                  color: "var(--text-primary)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
              />
            </div>

            <div
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              {result.assertionCount} teaching points
              {result.moduleCount > 0 && `, ${result.moduleCount} curriculum modules`}
              {result.goalCount > 0 && `, ${result.goalCount} learning goals`}
            </div>

            {/* ── Course Readiness Checklist (COURSE-READY-001) ── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 10 }}>
                Review Steps
              </div>
              {checksLoading && courseChecks.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>Loading checks...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {courseChecks.map((check) => (
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
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
                        background: check.passed ? "var(--status-success-text)" : check.severity === "critical" ? "var(--status-error-text)" : "var(--border-default)",
                        color: "#fff",
                      }}>
                        {check.passed ? "\u2713" : check.severity === "critical" ? "!" : "\u2022"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          {check.name}
                          {check.severity === "critical" && !check.passed && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--status-error-text)", marginLeft: 6 }}>REQUIRED</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{check.detail}</div>
                      </div>
                      {check.fixAction?.href && (
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-primary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {check.fixAction.label} &rarr;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Start Lesson (primary CTA, gated by critical checks) ── */}
            <button
              onClick={() => router.push(`/x/sim/${result.callerId}`)}
              disabled={!courseReady && courseChecks.length > 0}
              title={!courseReady && courseChecks.length > 0 ? "Complete required steps above first" : undefined}
              style={{
                width: "100%",
                padding: "14px 24px",
                borderRadius: 10,
                background: courseReady || courseChecks.length === 0 ? "var(--accent-primary)" : "var(--border-default)",
                color: courseReady || courseChecks.length === 0 ? "white" : "var(--text-muted)",
                border: "none",
                fontSize: 16,
                fontWeight: 700,
                cursor: courseReady || courseChecks.length === 0 ? "pointer" : "not-allowed",
                letterSpacing: "-0.01em",
                transition: "all 0.2s",
              }}
            >
              Start Lesson
            </button>

            {/* ── Secondary actions ── */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => router.push(`/x/domains?selected=${result.domainId}`)}
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
                View Agent
              </button>
              {result.identitySpecId && (
                <button
                  onClick={() => router.push(`/x/specs/${result.identitySpecId}`)}
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
                  Edit Identity
                </button>
              )}
              <button
                onClick={() => router.push(`/x/callers/${result.callerId}`)}
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
                View Test Caller
              </button>
            </div>

            {result.warnings.length > 0 && (
              <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
                {result.warnings.map((w, i) => (
                  <div key={i}>Note: {w}</div>
                ))}
              </div>
            )}
          </div>

          {/* ── Onboarding Welcome ── */}
          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>
              Onboarding Welcome {savingWelcome && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— saving...</span>}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
              This message is shown to learners when they join.
            </div>
            <textarea
              value={editWelcome}
              onChange={(e) => setEditWelcome(e.target.value)}
              onBlur={() => handleSaveWelcome(editWelcome)}
              placeholder="e.g. Welcome! Let's get started with your learning journey."
              rows={2}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
                fontSize: 14,
                fontWeight: 500,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
            />
          </div>

          {/* ── Get Learners In ── */}
          <div
            style={{
              padding: 24,
              borderRadius: 14,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
              Get Learners In
            </div>

            {/* 3-step visual explainer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
                padding: "14px 16px",
                background: "var(--surface-secondary)",
                borderRadius: 10,
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>&#128279;</span>
                <span>Share link</span>
              </div>
              <span style={{ color: "var(--text-muted)" }}>&rarr;</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>&#9997;</span>
                <span>They enter name</span>
              </div>
              <span style={{ color: "var(--text-muted)" }}>&rarr;</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>&#9989;</span>
                <span>They&apos;re in</span>
              </div>
            </div>

            {!classroom ? (
              <button
                onClick={handleCreateClassroom}
                disabled={creatingClassroom}
                style={{
                  padding: "12px 24px",
                  borderRadius: 10,
                  background: creatingClassroom ? "var(--border-default)" : "var(--accent-primary)",
                  color: creatingClassroom ? "var(--text-muted)" : "white",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: creatingClassroom ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                  transition: "all 0.2s",
                }}
              >
                {creatingClassroom ? "Creating..." : "Create Classroom"}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "var(--surface-secondary)",
                    borderRadius: 8,
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <code
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {classroom.joinUrl}
                  </code>
                  <button
                    onClick={handleCopyJoinLink}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      background: "var(--surface-primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: copied ? "#10b981" : "var(--text-secondary)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "color 0.2s",
                    }}
                  >
                    {copied ? "\u2713 Copied" : "Copy"}
                  </button>
                </div>
                <button
                  onClick={() => window.open(classroom.joinUrl, "_blank")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "transparent",
                    border: "1px solid var(--border-default)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    alignSelf: "flex-start",
                    transition: "border-color 0.15s",
                  }}
                >
                  Open Preview
                </button>
              </div>
            )}
          </div>

          {/* ── Launch Another ── */}
          <button
            onClick={handleReset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border-default)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            Launch Another
          </button>
        </div>
      )}

      {/* ── Phase: Form ── */}
      {phase === "form" && (
        <>
          {/* Step 1: Describe what you're building */}
          <FormCard>
            <StepMarker number={1} label="Describe what you're building" completed={!!subjectName.trim()} />

            {/* Domain picker — use existing domain or create new */}
            {domains.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Organisation / Domain
                </label>
                <select
                  value={selectedDomainId}
                  onChange={(e) => setSelectedDomainId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--input-border)",
                    fontSize: 14,
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Create new domain</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {selectedDomainId && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    A new playbook (class) will be created within this domain.
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, marginTop: -6 }}>
              Tell us what you&apos;re creating &mdash; a tutor, coach, support agent, or anything else.
            </div>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. An AI tutor for 11+ Creative Comprehension, a sales coaching agent, or a customer support assistant"
              rows={3}
              style={{
                width: "100%",
                padding: "16px 20px",
                borderRadius: 12,
                border: "2px solid var(--input-border)",
                fontSize: 16,
                fontWeight: 500,
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxSizing: "border-box",
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--accent-primary)";
                e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--input-border)";
                e.target.style.boxShadow = "none";
                suggestFields(e.target.value);
              }}
            />

            {/* Agent name — AI-suggested or manually entered */}
            <div style={{ marginTop: 16 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}>
                <label
                  htmlFor="subject"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  Agent name
                </label>
                {nameLoading && (
                  <span style={{
                    fontSize: 12,
                    color: "var(--accent-primary)",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}>
                    <span style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      border: "2px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                      borderTopColor: "var(--accent-primary)",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    Suggesting...
                  </span>
                )}
                {!nameLoading && subjectName && !nameManuallyEdited && !suggestedName && (
                  <span style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "var(--surface-secondary)",
                  }}>
                    AI suggested
                  </span>
                )}
              </div>
              <input
                id="subject"
                type="text"
                value={subjectName}
                onChange={(e) => {
                  setSubjectName(e.target.value);
                  setNameManuallyEdited(true);
                  setSuggestedName(null);
                }}
                placeholder={brief.trim().length >= 20 ? "Generating name..." : "e.g. Creative Comprehension, Sales Coaching"}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "2px solid var(--input-border)",
                  fontSize: 16,
                  fontWeight: 600,
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent-primary)";
                  e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--input-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              {suggestedName && suggestedName !== subjectName && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectName(suggestedName);
                    setSuggestedName(null);
                    setNameManuallyEdited(false);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--accent-primary)",
                    background: "var(--status-info-bg)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>Suggestion:</span>
                  {suggestedName}
                  <span style={{
                    fontSize: 11,
                    color: "var(--accent-primary)",
                    fontWeight: 600,
                    marginLeft: 4,
                  }}>
                    Use
                  </span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setSuggestedName(null); }}
                    style={{
                      fontSize: 15,
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      marginLeft: 2,
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    &times;
                  </span>
                </button>
              )}
              {!brief.trim() && !subjectName.trim() && !suggestedName && (
                <div style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  marginTop: 6,
                  fontStyle: "italic",
                }}>
                  Describe what you&apos;re building above and we&apos;ll suggest a name
                </div>
              )}
            </div>
          </FormCard>

          {/* Step 2: Persona */}
          <FormCard>
            <StepMarker number={2} label="Choose a persona" completed={!!persona} />
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, marginTop: -6 }}>
              The personality and interaction style your AI will use with callers.
            </div>
            <FancySelect
              options={personas.map((p) => ({ value: p.slug, label: p.name, description: p.description }))}
              value={persona}
              onChange={(v) => { setPersona(v); setSuggestedPersona(null); }}
              placeholder="Pick a persona..."
              loading={personasLoading}
            />
            {suggestedPersona && suggestedPersona !== persona && (() => {
              const sp = personas.find((p) => p.slug === suggestedPersona);
              if (!sp) return null;
              return (
                <button
                  type="button"
                  onClick={() => { setPersona(suggestedPersona); setSuggestedPersona(null); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--accent-primary)",
                    background: "var(--status-info-bg)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>Suggestion:</span>
                  {sp.name}
                  <span style={{ fontSize: 11, color: "var(--accent-primary)", fontWeight: 600, marginLeft: 4 }}>Use</span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setSuggestedPersona(null); }}
                    style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 700, marginLeft: 2, lineHeight: 1, cursor: "pointer" }}
                  >
                    &times;
                  </span>
                </button>
              );
            })()}
          </FormCard>

          {/* Step 3: Learning Goals */}
          <FormCard>
            <StepMarker number={3} label="Goals" completed={goals.length > 0} />
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                marginBottom: 12,
                marginTop: -6,
              }}
            >
              Optional &mdash; what should users achieve?
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
                placeholder="e.g. Pass the certification, Close more deals, Resolve tickets faster"
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "2px solid var(--input-border)",
                  fontSize: 16,
                  fontWeight: 500,
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  outline: "none",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent-primary)";
                  e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--input-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                onClick={addGoal}
                disabled={!goalInput.trim()}
                style={{
                  padding: "14px 20px",
                  borderRadius: 12,
                  border: "2px solid var(--border-default)",
                  background: "var(--surface-primary)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: goalInput.trim() ? "pointer" : "not-allowed",
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
                      background: "var(--status-info-bg)",
                      border: "1px solid var(--accent-primary)",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {g}
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
                  </span>
                ))}
              </div>
            )}
            {suggestedGoals && suggestedGoals.length > 0 && (
              <div style={{ marginTop: goals.length > 0 ? 10 : 0 }}>
                <div style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  Suggestions
                  <span
                    role="button"
                    onClick={() => setSuggestedGoals(null)}
                    style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 700, cursor: "pointer", lineHeight: 1 }}
                  >
                    &times;
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {suggestedGoals.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setGoals((prev) => [...prev, g]);
                        setSuggestedGoals((prev) => prev ? prev.filter((_, j) => j !== i) : null);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 12px",
                        borderRadius: 18,
                        border: "1px dashed var(--accent-primary)",
                        background: "var(--status-info-bg)",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        transition: "background 0.15s",
                      }}
                    >
                      + {g}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FormCard>

          {/* Step 4: Curriculum Source */}
          <FormCard>
            <StepMarker
              number={4}
              label="Content source"
              completed={launchMode === "generate" || !!file}
            />
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12, marginTop: -6 }}>
              Where the knowledge for your AI comes from &mdash; generate it or upload your own material.
            </div>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button
                onClick={() => setLaunchMode("generate")}
                style={{
                  flex: 1,
                  padding: "16px 16px 14px",
                  borderRadius: 12,
                  border: `2px solid ${launchMode === "generate" ? "var(--accent-primary)" : "var(--border-default)"}`,
                  background: launchMode === "generate" ? "var(--status-info-bg)" : "var(--surface-primary)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  Generate with AI
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  AI generates content from your description
                </div>
              </button>
              <button
                onClick={() => setLaunchMode("upload")}
                style={{
                  flex: 1,
                  padding: "16px 16px 14px",
                  borderRadius: 12,
                  border: `2px solid ${launchMode === "upload" ? "var(--accent-primary)" : "var(--border-default)"}`,
                  background: launchMode === "upload" ? "var(--status-info-bg)" : "var(--surface-primary)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  Upload Materials
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  Extract from your documents
                </div>
              </button>
            </div>

            {/* Generate mode: inline summary card */}
            {launchMode === "generate" && (
              <div
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: "var(--surface-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>
                  We&apos;ll build an agent for:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {brief.trim() && (
                    <div style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-secondary)", minWidth: 70, paddingTop: 1 }}>Brief</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.4 }}>
                        {brief.trim().length > 120 ? brief.trim().slice(0, 120) + "..." : brief.trim()}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, fontSize: 14 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)", minWidth: 70 }}>Name</span>
                    <span style={{ color: subjectName.trim() ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 500 }}>
                      {subjectName.trim() || "enter agent name above"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 14 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)", minWidth: 70 }}>Style</span>
                    <span style={{ color: selectedPersona ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 500 }}>
                      {selectedPersona?.name || "select above"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)", minWidth: 70, paddingTop: 1 }}>Goals</span>
                    {goals.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {goals.map((g, i) => (
                          <span key={i} style={{
                            padding: "3px 10px",
                            borderRadius: 8,
                            background: "var(--surface-tertiary)",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "var(--text-primary)",
                          }}>
                            {g}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontWeight: 500, fontStyle: "italic" }}>
                        none (AI will infer)
                      </span>
                    )}
                  </div>
                </div>

                {goals.length === 0 && (
                  <div style={{
                    marginTop: 14,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "color-mix(in srgb, var(--status-warning-text) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--status-warning-text) 15%, transparent)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    fontWeight: 500,
                  }}>
                    Adding goals helps AI create a more tailored experience
                  </div>
                )}
              </div>
            )}

            {/* Upload mode: file dropzone */}
            {launchMode === "upload" && (
              <>
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: file ? "20px 24px" : "44px 24px",
                    borderRadius: 16,
                    border: `2px dashed ${file ? "var(--accent-primary)" : "var(--border-default)"}`,
                    background: file ? "var(--status-info-bg)" : "var(--surface-primary)",
                    textAlign: "center",
                    cursor: "pointer",
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--accent-primary)",
                            cursor: "pointer",
                            marginLeft: 12,
                            textDecoration: "underline",
                            fontSize: 14,
                            fontWeight: 500,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.25 }}>&#8613;</div>
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
              </>
            )}
          </FormCard>

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
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    borderRadius: 12,
                    border: "2px solid var(--input-border)",
                    fontSize: 16,
                    fontWeight: 500,
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--accent-primary)";
                    e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--input-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Build Button ── */}
          <div style={{ padding: "32px 0 0" }}>
            <button
              onClick={handleBuild}
              disabled={!canLaunch}
              style={{
                width: "100%",
                padding: "18px 32px",
                borderRadius: 14,
                border: "none",
                background: canLaunch
                  ? "linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))"
                  : "var(--button-disabled-bg)",
                color: canLaunch ? "var(--accent-primary-text)" : "var(--text-muted)",
                fontSize: 18,
                fontWeight: 800,
                cursor: canLaunch ? "pointer" : "not-allowed",
                transition: "all 0.25s cubic-bezier(.4,0,.2,1)",
                letterSpacing: "-0.02em",
                boxShadow: canLaunch
                  ? "0 4px 16px color-mix(in srgb, var(--accent-primary) 35%, transparent)"
                  : "none",
              }}
            >
              Build It
            </button>

            {/* Progress bar showing form completion */}
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
                      ? "Enter an agent name"
                      : !persona
                        ? "Select a persona"
                        : launchMode === "upload" && !file
                          ? "Upload material"
                          : ""}
                  </span>
                )}
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "var(--surface-tertiary)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(completedSteps / 3) * 100}%`,
                    borderRadius: 2,
                    background: completedSteps === 3
                      ? "var(--status-success-text)"
                      : "var(--accent-primary)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-muted)",
                marginTop: 16,
                lineHeight: 1.5,
              }}
            >
              Creates an agent, extracts content, configures the persona, and sets up a test caller.
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
