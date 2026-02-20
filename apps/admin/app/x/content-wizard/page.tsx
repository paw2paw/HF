"use client";

/**
 * @deprecated Content Wizard is deprecated — use Quick Launch (/x/quick-launch) instead.
 * Quick Launch handles creation (QUICK-LAUNCH-001) and review (COURSE-READY-001) in one flow.
 * This page is kept temporarily for backward compatibility and redirects after 3s.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBackgroundTaskQueue } from "@/components/shared/ContentJobQueue";
import { ProgressStepper } from "@/components/shared/ProgressStepper";
import { SessionCountPicker } from "@/components/shared/SessionCountPicker";
import { SortableList } from "@/components/shared/SortableList";
import { reorderItems } from "@/lib/sortable/reorder";
import { theme } from "@/lib/styles/theme";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type WizardStep = "add-content" | "extract" | "plan" | "attach";

type SubjectOption = { id: string; slug: string; name: string; _count?: { sources: number } };
type DomainOption = { id: string; slug: string; name: string };

type SourceEntry = {
  id: string;
  sourceId: string;
  tags: string[];
  source: {
    id: string;
    slug: string;
    name: string;
    documentType: string;
    documentTypeSource: string | null;
    _count: { assertions: number };
  };
};

type CurriculumModule = {
  id: string;
  title: string;
  description: string;
  learningOutcomes: string[];
  sortOrder: number;
};

const SESSION_TYPES = [
  { value: "onboarding", label: "Onboarding", color: "#6366F1" },
  { value: "introduce", label: "Introduce", color: "#059669" },
  { value: "deepen", label: "Deepen", color: "#2563EB" },
  { value: "review", label: "Review", color: "#D97706" },
  { value: "assess", label: "Assess", color: "#DC2626" },
  { value: "consolidate", label: "Consolidate", color: "#7C3AED" },
] as const;

// ------------------------------------------------------------------
// Main Wizard
// ------------------------------------------------------------------

export default function ContentWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addExtractionJob, addCurriculumJob, jobs } = useBackgroundTaskQueue();

  // Pre-populated from URL (QL handoff or resume)
  const presetSubjectId = searchParams.get("subjectId");
  const presetDomainId = searchParams.get("domainId");

  // Wizard state
  const [step, setStep] = useState<WizardStep>("add-content");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Subject + Sources
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(presetSubjectId);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Extraction
  const [totalAssertions, setTotalAssertions] = useState(0);
  const [curriculum, setCurriculum] = useState<any>(null);
  const [curriculumGenerating, setCurriculumGenerating] = useState(false);

  // Step 3: Lesson Plan
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [lessonPlan, setLessonPlan] = useState<any>(null);
  const [lessonPlanDraft, setLessonPlanDraft] = useState<any[]>([]);
  const [lessonPlanGenerating, setLessonPlanGenerating] = useState(false);
  const [lessonPlanReasoning, setLessonPlanReasoning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 4: Domains
  const [allDomains, setAllDomains] = useState<DomainOption[]>([]);
  const [linkedDomainIds, setLinkedDomainIds] = useState<Set<string>>(new Set());
  const [linkingDomain, setLinkingDomain] = useState(false);

  // ------------------------------------------------------------------
  // Data loading
  // ------------------------------------------------------------------

  useEffect(() => {
    loadSubjects();
    loadDomains();
  }, []);

  useEffect(() => {
    if (selectedSubjectId) {
      loadSubjectSources(selectedSubjectId);
      loadCurriculum(selectedSubjectId);
    }
  }, [selectedSubjectId]);

  // Track extraction jobs for current subject
  const activeExtractionJobs = jobs.filter(
    (j) => j.taskType === "extraction" && j.subjectId === selectedSubjectId && j.progress.status === "in_progress"
  );
  const activeCurriculumJob = jobs.find(
    (j) => j.taskType === "curriculum_generation" && j.subjectId === selectedSubjectId && j.progress.status === "in_progress"
  );

  async function loadSubjects() {
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json();
      setSubjects(data.subjects || []);
    } catch { /* ignore */ }
  }

  async function loadSubjectSources(subjectId: string) {
    try {
      const res = await fetch(`/api/subjects/${subjectId}`);
      const data = await res.json();
      if (data.subject) {
        setSources(data.subject.sources || []);
        const total = (data.subject.sources || []).reduce(
          (sum: number, s: any) => sum + s.source._count.assertions, 0
        );
        setTotalAssertions(total);
        // Load linked domains
        const domainIds = (data.subject.domains || []).map((d: any) => d.domain.id);
        setLinkedDomainIds(new Set(domainIds));
      }
    } catch { /* ignore */ }
  }

  async function loadCurriculum(subjectId: string) {
    try {
      const res = await fetch(`/api/subjects/${subjectId}/curriculum`);
      const data = await res.json();
      if (data.curriculum) {
        setCurriculum(data.curriculum);
        // Load lesson plan
        const lpRes = await fetch(`/api/curricula/${data.curriculum.id}/lesson-plan`);
        const lpData = await lpRes.json();
        if (lpData.ok && lpData.plan) {
          setLessonPlan(lpData.plan);
          setLessonPlanDraft(lpData.plan.entries || []);
        }
      }
    } catch { /* ignore */ }
  }

  async function loadDomains() {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      setAllDomains(data.domains || []);
      // Pre-select domain from URL
      if (presetDomainId) {
        setLinkedDomainIds((prev) => new Set([...prev, presetDomainId]));
      }
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------
  // Task tracking
  // ------------------------------------------------------------------

  async function ensureTask() {
    if (taskId) return taskId;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "content_wizard",
          context: {
            subjectId: selectedSubjectId,
            subjectName: subjects.find((s) => s.id === selectedSubjectId)?.name || newSubjectName,
            domainId: presetDomainId,
            step: "add-content",
          },
        }),
      });
      const data = await res.json();
      if (data.ok && data.taskId) {
        setTaskId(data.taskId);
        return data.taskId;
      }
    } catch { /* ignore */ }
    return null;
  }

  async function updateTask(updates: Record<string, any>) {
    if (!taskId) return;
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, updates }),
      });
    } catch { /* ignore */ }
  }

  async function completeTaskTracking() {
    if (!taskId) return;
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          updates: {
            currentStep: 4,
            completedSteps: ["add-content", "extract", "plan", "attach"],
            context: {
              step: "complete",
              summary: {
                subject: { id: selectedSubjectId, name: subjects.find((s) => s.id === selectedSubjectId)?.name },
                counts: { assertions: totalAssertions, sessions: lessonPlanDraft.length },
              },
            },
          },
        }),
      });
      // Mark complete
      await fetch(`/api/tasks?taskId=${taskId}`, { method: "DELETE" });
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------
  // Step 1: Create subject + upload
  // ------------------------------------------------------------------

  async function createSubject() {
    if (!newSubjectName.trim()) return;
    setCreatingSubject(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubjectName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedSubjectId(data.subject.id);
      setNewSubjectName("");
      loadSubjects();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingSubject(false);
    }
  }

  async function handleFiles(files: File[]) {
    if (!selectedSubjectId) return;
    const validExts = [".pdf", ".txt", ".md", ".markdown", ".json"];
    const validFiles = files.filter((f) =>
      validExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (validFiles.length === 0) {
      setError("No valid files. Supported: PDF, TXT, MD, JSON");
      return;
    }

    await ensureTask();

    for (const file of validFiles) {
      setUploading((prev) => [...prev, file.name]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("tags", "content");
        const res = await fetch(`/api/subjects/${selectedSubjectId}/upload`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Upload failed");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploading((prev) => prev.filter((n) => n !== file.name));
      }
    }
    loadSubjectSources(selectedSubjectId);
  }

  async function handleExtractSource(sourceId: string, sourceName: string) {
    if (!selectedSubjectId) return;
    setExtractingIds((prev) => new Set([...prev, sourceId]));
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: selectedSubjectId }),
      });
      const data = await res.json();
      if (data.jobId) {
        addExtractionJob(data.jobId, sourceId, sourceName, sourceName, selectedSubjectId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExtractingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
    loadSubjectSources(selectedSubjectId);
  }

  async function handleExtractAll() {
    const awaiting = sources.filter(
      (ss) => ss.source._count.assertions === 0 && ss.source.documentTypeSource?.startsWith("ai:")
    );
    for (const ss of awaiting) {
      await handleExtractSource(ss.source.id, ss.source.name);
    }
  }

  async function handleChangeSourceType(sourceId: string, newType: string) {
    try {
      await fetch(`/api/content-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: newType, documentTypeSource: "admin:manual" }),
      });
      if (selectedSubjectId) loadSubjectSources(selectedSubjectId);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Step 2: Generate curriculum
  // ------------------------------------------------------------------

  async function generateCurriculum() {
    if (!selectedSubjectId) return;
    setCurriculumGenerating(true);
    try {
      const res = await fetch(`/api/subjects/${selectedSubjectId}/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.taskId) {
        const subjectName = subjects.find((s) => s.id === selectedSubjectId)?.name || "Subject";
        addCurriculumJob(data.taskId, selectedSubjectId, subjectName);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCurriculumGenerating(false);
    }
  }

  // Watch for curriculum completion
  useEffect(() => {
    if (!activeCurriculumJob) return;
    const job = jobs.find((j) => j.taskId === activeCurriculumJob.taskId);
    if (job && job.progress.status === "completed" && selectedSubjectId) {
      loadCurriculum(selectedSubjectId);
    }
  }, [jobs, activeCurriculumJob?.taskId, selectedSubjectId]);

  // ------------------------------------------------------------------
  // Step 3: Generate lesson plan
  // ------------------------------------------------------------------

  async function generateLessonPlan() {
    if (!curriculum) return;
    setLessonPlanGenerating(true);
    setLessonPlanReasoning(null);
    try {
      const res = await fetch(`/api/curricula/${curriculum.id}/lesson-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalSessionTarget: sessionCount || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setLessonPlanDraft(data.plan);
        setLessonPlanReasoning(data.reasoning);
      } else {
        setError(data.error || "Failed to generate lesson plan");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLessonPlanGenerating(false);
  }

  async function saveLessonPlan() {
    if (!curriculum || lessonPlanDraft.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/curricula/${curriculum.id}/lesson-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: lessonPlanDraft }),
      });
      const data = await res.json();
      if (data.ok) {
        setLessonPlan(data.plan);
        updateTask({ currentStep: 3, context: { step: "plan" } });
      } else {
        setError(data.error || "Failed to save lesson plan");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  // ------------------------------------------------------------------
  // Step 4: Link domains
  // ------------------------------------------------------------------

  async function linkDomain(domainId: string) {
    if (!selectedSubjectId) return;
    setLinkingDomain(true);
    try {
      const res = await fetch(`/api/subjects/${selectedSubjectId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setLinkedDomainIds((prev) => new Set([...prev, domainId]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinkingDomain(false);
    }
  }

  async function unlinkDomain(domainId: string) {
    if (!selectedSubjectId) return;
    try {
      await fetch(`/api/subjects/${selectedSubjectId}/domains`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      setLinkedDomainIds((prev) => {
        const next = new Set(prev);
        next.delete(domainId);
        return next;
      });
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleComplete() {
    await completeTaskTracking();
    if (selectedSubjectId) {
      router.push(`/x/subjects/${selectedSubjectId}`);
    } else {
      router.push("/x/subjects");
    }
  }

  // ------------------------------------------------------------------
  // Navigation helpers
  // ------------------------------------------------------------------

  function canAdvance(): boolean {
    switch (step) {
      case "add-content": return !!selectedSubjectId && sources.length > 0;
      case "extract": return totalAssertions > 0 && !!curriculum;
      case "plan": return lessonPlanDraft.length > 0;
      case "attach": return linkedDomainIds.size > 0;
      default: return false;
    }
  }

  function nextStep() {
    const order: WizardStep[] = ["add-content", "extract", "plan", "attach"];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      setStep(next);
      updateTask({ currentStep: idx + 2, context: { step: next } });
    }
  }

  function prevStep() {
    const order: WizardStep[] = ["add-content", "extract", "plan", "attach"];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  }

  const stepIndex = ["add-content", "extract", "plan", "attach"].indexOf(step);

  // Curriculum modules
  const curriculumModules: CurriculumModule[] = curriculum?.notableInfo?.modules || [];

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div style={theme.page}>
      <button
        onClick={() => router.push("/x/subjects")}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        &larr; Subjects
      </button>

      {/* Deprecation banner */}
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "color-mix(in srgb, #f59e0b 12%, transparent)",
        border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ fontSize: 13, color: "var(--status-warning-text)" }}>
          This wizard has moved to <strong>Quick Launch</strong>, which handles creation and review in one flow.
        </span>
        <button
          onClick={() => router.push("/x/quick-launch")}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none",
            background: "var(--status-warning-text)", color: "white", fontSize: 12, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          Go to Quick Launch
        </button>
      </div>

      <h1 style={{ ...theme.h1, marginBottom: 4 }}>Content Wizard</h1>
      <p style={{ ...theme.muted, marginBottom: 24 }}>
        Turn your documents into a teaching plan, step by step.
      </p>

      {/* Error */}
      {error && (
        <div style={{ ...theme.errorAlert, fontSize: 13, marginBottom: 16 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--status-error-text)" }}>x</button>
        </div>
      )}

      {/* Stepper */}
      <ProgressStepper
        steps={[
          { label: "Add Content", completed: stepIndex > 0, active: step === "add-content" },
          { label: "Extract", completed: stepIndex > 1, active: step === "extract" },
          { label: "Plan Lessons", completed: stepIndex > 2, active: step === "plan" },
          { label: "Attach to Domains", completed: step === "attach" && linkedDomainIds.size > 0, active: step === "attach" },
        ]}
      />

      {/* === STEP 1: ADD CONTENT === */}
      {step === "add-content" && (
        <div>
          {/* Subject selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
              Subject
            </div>
            {subjects.length > 0 && (
              <select
                value={selectedSubjectId || ""}
                onChange={(e) => setSelectedSubjectId(e.target.value || null)}
                style={{ fontSize: 13, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-default)", marginBottom: 8, minWidth: 300, background: "var(--surface-primary)", color: "var(--text-primary)" }}
              >
                <option value="">Select existing subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or create new:</span>
              <input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createSubject(); }}
                placeholder="New subject name..."
                style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-default)", width: 240, background: "var(--surface-primary)", color: "var(--text-primary)" }}
              />
              <button
                onClick={createSubject}
                disabled={creatingSubject || !newSubjectName.trim()}
                style={{ ...theme.btnPrimary, fontSize: 13, opacity: creatingSubject || !newSubjectName.trim() ? 0.6 : 1 }}
              >
                {creatingSubject ? "Creating..." : "Create"}
              </button>
            </div>
          </div>

          {/* Source list */}
          {selectedSubjectId && sources.length > 0 && (() => {
            const awaitingSources = sources.filter(
              (ss) => ss.source._count.assertions === 0 && ss.source.documentTypeSource?.startsWith("ai:")
            );
            const extractedSources = sources.filter(
              (ss) => ss.source._count.assertions > 0 || !ss.source.documentTypeSource?.startsWith("ai:")
            );
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>
                  {sources.length} source{sources.length !== 1 ? "s" : ""} / {totalAssertions} teaching points
                </div>

                {/* Awaiting classification review */}
                {awaitingSources.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--status-warning-text)" }}>
                        {awaitingSources.length} awaiting review
                      </div>
                      {awaitingSources.length > 1 && (
                        <button
                          onClick={handleExtractAll}
                          style={{ ...theme.btnPrimary, fontSize: 11, padding: "4px 10px" }}
                        >
                          Extract All
                        </button>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {awaitingSources.map((ss) => {
                        const confidence = ss.source.documentTypeSource?.match(/ai:(\d+\.\d+)/)?.[1];
                        const isExtracting = extractingIds.has(ss.source.id);
                        return (
                          <div
                            key={ss.id}
                            style={{
                              ...theme.card,
                              padding: 10,
                              border: "1px solid var(--status-warning-border)",
                              background: "color-mix(in srgb, var(--status-warning-bg) 30%, var(--surface-primary))",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{ss.source.name}</span>
                              {confidence && (
                                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                  {Math.round(parseFloat(confidence) * 100)}% confidence
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <select
                                value={ss.source.documentType}
                                onChange={(e) => handleChangeSourceType(ss.source.id, e.target.value)}
                                style={{
                                  fontSize: 12, padding: "4px 8px", borderRadius: 4,
                                  border: "1px solid var(--border-default)",
                                  background: "var(--surface-primary)", color: "var(--text-primary)",
                                }}
                              >
                                {["TEXTBOOK", "CURRICULUM", "WORKSHEET", "EXAMPLE", "ASSESSMENT", "REFERENCE", "LESSON_CONTENT"].map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleExtractSource(ss.source.id, ss.source.name)}
                                disabled={isExtracting}
                                style={{
                                  ...theme.btnPrimary, fontSize: 12, padding: "4px 12px",
                                  opacity: isExtracting ? 0.6 : 1,
                                }}
                              >
                                {isExtracting ? "Extracting..." : "Extract"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Already extracted sources */}
                {extractedSources.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    {extractedSources.map((ss) => (
                      <div key={ss.id} style={{ ...theme.card, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{ss.source.name}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {ss.source._count.assertions} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Upload zone */}
          {selectedSubjectId && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border-default)",
                borderRadius: 8,
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.md,.markdown,.json"
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(Array.from(e.target.files));
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
              <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: "var(--text-primary)" }}>
                Drag documents here or click to upload
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                PDF, TXT, MD, JSON — documents are classified, then you review before extraction
              </p>
            </div>
          )}

          {/* Upload progress */}
          {uploading.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              Uploading: {uploading.join(", ")}...
            </div>
          )}

          {/* Extraction in progress */}
          {activeExtractionJobs.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 600, marginBottom: 12 }}>
              {activeExtractionJobs.length} extraction{activeExtractionJobs.length > 1 ? "s" : ""} running...
            </div>
          )}
        </div>
      )}

      {/* === STEP 2: EXTRACT === */}
      {step === "extract" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
            Teaching Points Extracted
          </div>

          <div style={{ ...theme.card, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--accent-primary)" }}>{totalAssertions}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>teaching points</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>from {sources.length} source{sources.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {/* Extraction still running */}
          {activeExtractionJobs.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 600, marginBottom: 12 }}>
              {activeExtractionJobs.length} extraction{activeExtractionJobs.length > 1 ? "s" : ""} still running — count will update automatically.
            </div>
          )}

          {/* Curriculum generation */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
              Curriculum
            </div>
            {curriculum ? (
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {curriculumModules.length} modules generated
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {curriculumModules.slice(0, 5).map((mod) => (
                    <div key={mod.id} style={{ ...theme.card, padding: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-primary)", fontFamily: "monospace", marginRight: 8 }}>{mod.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{mod.title}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                        {mod.learningOutcomes.length} LOs
                      </span>
                    </div>
                  ))}
                  {curriculumModules.length > 5 && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 10 }}>
                      +{curriculumModules.length - 5} more modules
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                  Generate a curriculum structure from the extracted teaching points.
                </p>
                <button
                  onClick={generateCurriculum}
                  disabled={curriculumGenerating || !!activeCurriculumJob || totalAssertions === 0}
                  style={{
                    ...theme.btnPrimary, fontSize: 13,
                    opacity: curriculumGenerating || !!activeCurriculumJob || totalAssertions === 0 ? 0.6 : 1,
                  }}
                >
                  {curriculumGenerating || !!activeCurriculumJob ? "Generating..." : "Generate Curriculum"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === STEP 3: PLAN LESSONS === */}
      {step === "plan" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
            Plan Your Sessions
          </div>

          <SessionCountPicker value={sessionCount} onChange={setSessionCount} />

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
            <button
              onClick={generateLessonPlan}
              disabled={lessonPlanGenerating || !curriculum}
              style={{
                ...theme.btnPrimary, fontSize: 13,
                opacity: lessonPlanGenerating || !curriculum ? 0.6 : 1,
              }}
            >
              {lessonPlanGenerating ? "Generating..." : lessonPlan ? "Regenerate Plan" : "Generate Plan"}{sessionCount ? ` (${sessionCount} sessions)` : ""}
            </button>
          </div>

          {/* AI reasoning */}
          {lessonPlanReasoning && (
            <div style={{
              padding: "8px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13,
              background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
              color: "var(--text-secondary)", fontStyle: "italic",
            }}>
              AI reasoning: {lessonPlanReasoning}
            </div>
          )}

          {/* Lesson plan editor */}
          {lessonPlanDraft.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                {lessonPlanDraft.length} sessions
              </div>
              <SortableList
                items={lessonPlanDraft}
                getItemId={(e) => `session-${e.session}-${e.label}`}
                onReorder={(from, to) => {
                  const reordered = reorderItems(lessonPlanDraft, from, to);
                  setLessonPlanDraft(reordered.map((e, i) => ({ ...e, session: i + 1 })));
                }}
                onRemove={(index) => {
                  const next = lessonPlanDraft.filter((_, i) => i !== index);
                  setLessonPlanDraft(next.map((e, i) => ({ ...e, session: i + 1 })));
                }}
                onAdd={() => {
                  setLessonPlanDraft([...lessonPlanDraft, {
                    session: lessonPlanDraft.length + 1,
                    type: "introduce",
                    moduleId: null,
                    moduleLabel: "",
                    label: "",
                  }]);
                }}
                addLabel="+ Add Session"
                emptyLabel="No sessions. Click + Add Session to begin."
                renderCard={(e, index) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 20, textAlign: "right" }}>
                      {index + 1}
                    </span>
                    <input
                      value={e.label}
                      onChange={(ev) => {
                        const next = lessonPlanDraft.map((item, i) => i === index ? { ...item, label: ev.target.value } : item);
                        setLessonPlanDraft(next);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      placeholder="Session label"
                      style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 12, flex: 1 }}
                    />
                    <select
                      value={e.type}
                      onChange={(ev) => {
                        const next = lessonPlanDraft.map((item, i) => i === index ? { ...item, type: ev.target.value } : item);
                        setLessonPlanDraft(next);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 12, width: 110 }}
                    >
                      {SESSION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={e.moduleId || ""}
                      onChange={(ev) => {
                        const mod = curriculumModules.find((m) => m.id === ev.target.value);
                        const next = lessonPlanDraft.map((item, i) => i === index ? { ...item, moduleId: ev.target.value || null, moduleLabel: mod?.title || "" } : item);
                        setLessonPlanDraft(next);
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                      style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 12, width: 160 }}
                    >
                      <option value="">No module</option>
                      {curriculumModules.map((m) => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              />

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  onClick={saveLessonPlan}
                  disabled={saving || lessonPlanDraft.length === 0}
                  style={{ ...theme.btnPrimary, fontSize: 13, opacity: saving || lessonPlanDraft.length === 0 ? 0.6 : 1 }}
                >
                  {saving ? "Saving..." : `Save Plan (${lessonPlanDraft.length} sessions)`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === STEP 4: ATTACH TO DOMAINS === */}
      {step === "attach" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "var(--text-primary)" }}>
            Attach to Domains
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Link this subject to domains so the AI tutor can teach it.
          </p>

          {/* Linked domains */}
          {linkedDomainIds.size > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {allDomains.filter((d) => linkedDomainIds.has(d.id)).map((d) => (
                <div key={d.id} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                  borderRadius: 6, border: "1px solid var(--accent-primary)",
                  background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)", fontSize: 13,
                }}>
                  <span style={{ fontWeight: 600 }}>{d.name}</span>
                  <button
                    onClick={() => unlinkDomain(d.id)}
                    style={{ background: "none", border: "none", color: "var(--status-error-text)", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Available domains */}
          {allDomains.filter((d) => !linkedDomainIds.has(d.id)).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {allDomains.filter((d) => !linkedDomainIds.has(d.id)).map((d) => (
                <button
                  key={d.id}
                  onClick={() => linkDomain(d.id)}
                  disabled={linkingDomain}
                  style={{
                    padding: "6px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-primary)",
                    fontSize: 13, cursor: "pointer",
                    opacity: linkingDomain ? 0.6 : 1,
                  }}
                >
                  + {d.name}
                </button>
              ))}
            </div>
          )}

          {allDomains.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              No domains configured yet. You can create domains from the Domains page.
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border-default)",
      }}>
        <div>
          {stepIndex > 0 && (
            <button onClick={prevStep} style={{ ...theme.btnSecondary, fontSize: 13, border: "1px solid var(--border-default)" }}>
              Back
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {step === "attach" ? (
            <button
              onClick={handleComplete}
              disabled={linkedDomainIds.size === 0}
              style={{ ...theme.btnPrimary, fontSize: 13, opacity: linkedDomainIds.size === 0 ? 0.6 : 1 }}
            >
              Complete
            </button>
          ) : (
            <button
              onClick={nextStep}
              disabled={!canAdvance()}
              style={{ ...theme.btnPrimary, fontSize: 13, opacity: !canAdvance() ? 0.6 : 1 }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
