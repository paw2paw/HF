"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";
import { useBackgroundTaskQueue } from "@/components/shared/ContentJobQueue";
import { useViewMode } from "@/contexts/ViewModeContext";
import { AdvancedSection } from "@/components/shared/AdvancedSection";
import { SortableList } from "@/components/shared/SortableList";
import { reorderItems } from "@/lib/sortable/reorder";
import { theme } from "@/lib/styles/theme";
import { SessionCountPicker } from "@/components/shared/SessionCountPicker";
import { ProgressStepper } from "@/components/shared/ProgressStepper";

// ------------------------------------------------------------------
// Media types
// ------------------------------------------------------------------

type MediaAsset = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  title: string | null;
  tags: string[];
  trustLevel: string;
  createdAt: string;
};

// ------------------------------------------------------------------
// Trust level config
// ------------------------------------------------------------------

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)" },
  { value: "EXPERT_CURATED", label: "L2 Expert", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)" },
  { value: "AI_ASSISTED", label: "L1 AI Assisted", color: "var(--trust-l1-text)", bg: "var(--trust-l1-bg)" },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "var(--trust-l0-text)", bg: "var(--trust-l0-bg)" },
];

const SOURCE_TAGS = [
  { value: "syllabus", label: "Syllabus", color: "var(--accent-primary)", desc: "Defines the curriculum structure / schedule" },
  { value: "content", label: "Content", color: "var(--status-success-text)", desc: "Teaching material the AI delivers from" },
];

const DOCUMENT_TYPES = [
  { value: "CURRICULUM", label: "Curriculum", color: "var(--badge-indigo-text)", desc: "Formal syllabus with LOs/ACs" },
  { value: "TEXTBOOK", label: "Textbook", color: "var(--status-success-text)", desc: "Dense reference material" },
  { value: "WORKSHEET", label: "Worksheet", color: "var(--badge-yellow-text)", desc: "Learner activity sheet" },
  { value: "EXAMPLE", label: "Example", color: "var(--badge-purple-text)", desc: "Illustrative document" },
  { value: "ASSESSMENT", label: "Assessment", color: "var(--status-error-text)", desc: "Test/quiz material" },
  { value: "REFERENCE", label: "Reference", color: "var(--text-muted)", desc: "Quick reference/glossary" },
] as const;

function TrustBadge({ level }: { level: string }) {
  const config = TRUST_LEVELS.find((t) => t.value === level) || TRUST_LEVELS[5];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: config.color, backgroundColor: config.bg, border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)` }}>
      {config.label}
    </span>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {tags.map((tag) => {
        const cfg = SOURCE_TAGS.find((t) => t.value === tag);
        const c = cfg?.color || "var(--text-muted)";
        return (
          <span key={tag} style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, color: c, backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`, textTransform: "uppercase" }}>
            {cfg?.label || tag}
          </span>
        );
      })}
      {tags.length === 0 && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>no tags</span>
      )}
    </span>
  );
}

function DocumentTypeBadge({ type, source: typeSource }: { type: string; source?: string | null }) {
  const cfg = DOCUMENT_TYPES.find((t) => t.value === type) || DOCUMENT_TYPES[1];
  const isAiSuggested = typeSource?.startsWith("ai:");
  const confidence = isAiSuggested ? Math.round(parseFloat(typeSource!.split(":")[1]) * 100) : null;
  return (
    <span
      title={`${cfg.desc}${confidence !== null ? ` (AI: ${confidence}%)` : typeSource === "admin:manual" ? " (manually set)" : ""}`}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)`,
      }}
    >
      {cfg.label}
      {confidence !== null && (
        <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.7 }}>{confidence}%</span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type SubjectSource = {
  id: string;
  sourceId: string;
  tags: string[];
  trustLevelOverride: string | null;
  sortOrder: number;
  source: {
    id: string;
    slug: string;
    name: string;
    trustLevel: string;
    documentType: string;
    documentTypeSource: string | null;
    _count: { assertions: number };
  };
};

type SubjectDomain = {
  id: string;
  domain: { id: string; slug: string; name: string; isActive?: boolean };
};

type Subject = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  defaultTrustLevel: string;
  qualificationBody: string | null;
  qualificationRef: string | null;
  qualificationLevel: string | null;
  isActive: boolean;
  sources: SubjectSource[];
  domains: SubjectDomain[];
  curricula: any[];
};

type CurriculumModule = {
  id: string;
  title: string;
  description: string;
  learningOutcomes: string[];
  assessmentCriteria?: string[];
  keyTerms?: string[];
  estimatedDurationMinutes?: number;
  sortOrder: number;
};

// ------------------------------------------------------------------
// Main Page
// ------------------------------------------------------------------

export default function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const router = useRouter();
  const { addExtractionJob, addCurriculumJob, jobs } = useBackgroundTaskQueue();
  const { isAdvanced } = useViewMode();
  const { plural } = useTerminology();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [extractingSourceIds, setExtractingSourceIds] = useState<Set<string>>(new Set());

  // Curriculum state
  const [curriculum, setCurriculum] = useState<any>(null);
  const [curriculumTaskId, setCurriculumTaskId] = useState<string | null>(null);
  const [curriculumPreview, setCurriculumPreview] = useState<any>(null);

  // Lesson plan state
  const [lessonPlan, setLessonPlan] = useState<any>(null);
  const [lessonPlanLoading, setLessonPlanLoading] = useState(false);
  const [lessonPlanEditing, setLessonPlanEditing] = useState(false);
  const [lessonPlanGenerating, setLessonPlanGenerating] = useState(false);
  const [lessonPlanDraft, setLessonPlanDraft] = useState<any[]>([]);
  const [lessonPlanReasoning, setLessonPlanReasoning] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  // Derived: check if there's an active curriculum generation for this subject
  const activeCurriculumJob = jobs.find(
    (j) => j.taskType === "curriculum_generation" && j.subjectId === subjectId && j.progress.status === "in_progress"
  );
  const activeExtractionJobs = jobs.filter(
    (j) => j.taskType === "extraction" && j.subjectId === subjectId && j.progress.status === "in_progress"
  );
  const generatingCurriculum = !!activeCurriculumJob;

  // Domain linking state
  const [allDomains, setAllDomains] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [linkingDomain, setLinkingDomain] = useState(false);

  // Editing state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  // Media library state
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaDragging, setMediaDragging] = useState(false);
  const mediaFileRef = useRef<HTMLInputElement>(null);

  // Load subject
  useEffect(() => {
    loadSubject();
    loadCurriculum();
    loadDomains();
    loadMedia();
  }, [subjectId]);

  async function loadSubject() {
    try {
      setLoading(true);
      const res = await fetch(`/api/subjects/${subjectId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSubject(data.subject);
      setEditName(data.subject.name);
      setEditDesc(data.subject.description || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurriculum() {
    try {
      const res = await fetch(`/api/subjects/${subjectId}/curriculum`);
      const data = await res.json();
      if (data.curriculum) {
        setCurriculum(data.curriculum);
        // Load lesson plan for this curriculum
        loadLessonPlan(data.curriculum.id);
      }
    } catch (err) { console.error("[subjects] Failed to load subject:", err); }
  }

  async function loadLessonPlan(curriculumId: string) {
    setLessonPlanLoading(true);
    try {
      const res = await fetch(`/api/curricula/${curriculumId}/lesson-plan`);
      const data = await res.json();
      if (data.ok && data.plan) {
        setLessonPlan(data.plan);
      }
    } catch (err) { console.error("[subjects] Failed to load lesson plan:", err); }
    setLessonPlanLoading(false);
  }

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
        setLessonPlanEditing(true);
      } else {
        setError(data.error || "Failed to generate lesson plan");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLessonPlanGenerating(false);
  }

  async function saveLessonPlan(entries: any[]) {
    if (!curriculum) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/curricula/${curriculum.id}/lesson-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (data.ok) {
        setLessonPlan(data.plan);
        setLessonPlanEditing(false);
        setLessonPlanDraft([]);
        setLessonPlanReasoning(null);
      } else {
        setError(data.error || "Failed to save lesson plan");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function loadDomains() {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      setAllDomains(data.domains || []);
    } catch (err) { console.error("[subjects] Failed to load domains:", err); }
  }

  // ------------------------------------------------------------------
  // Media library
  // ------------------------------------------------------------------

  async function loadMedia() {
    setMediaLoading(true);
    try {
      const typeParam = mediaTypeFilter !== "all" ? `&type=${mediaTypeFilter}` : "";
      const res = await fetch(`/api/subjects/${subjectId}/media?limit=100${typeParam}`);
      const data = await res.json();
      if (data.ok) setMediaAssets(data.media || []);
    } catch (err) { console.error("[subjects] Failed to load media:", err); } finally {
      setMediaLoading(false);
    }
  }

  async function handleMediaUpload(files: File[]) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/mpeg", "audio/wav", "audio/ogg"];
    const valid = files.filter((f) => allowed.includes(f.type));
    if (valid.length === 0) {
      setError("No valid files. Supported: JPG, PNG, WebP, PDF, MP3, WAV, OGG");
      return;
    }
    setMediaUploading(true);
    try {
      for (const file of valid) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("subjectId", subjectId);
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.ok) setError(`Upload failed: ${data.error}`);
      }
      loadMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMediaUploading(false);
    }
  }

  async function unlinkMedia(mediaId: string) {
    try {
      await fetch(`/api/subjects/${subjectId}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      setMediaAssets((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Reload media when filter changes
  useEffect(() => {
    if (subjectId) loadMedia();
  }, [mediaTypeFilter]);

  // ------------------------------------------------------------------
  // Subject editing
  // ------------------------------------------------------------------

  async function saveSubjectField(field: string, value: any) {
    setSaving(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubject((prev) => prev ? { ...prev, [field]: value } : prev);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------------
  // Drag-and-drop file upload
  // ------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    },
    [subjectId]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(Array.from(e.target.files));
    }
  };

  async function handleFiles(files: File[]) {
    const validExts = [".pdf", ".txt", ".md", ".markdown", ".json"];
    const validFiles = files.filter((f) =>
      validExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    if (validFiles.length === 0) {
      setError("No valid files. Supported: PDF, TXT, MD, JSON");
      return;
    }

    setUploadResults([]);

    // Upload all files in parallel — classify only, no extraction yet
    const uploads = validFiles.map(async (file) => {
      setUploadingFiles((prev) => [...prev, file.name]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("tags", "content");

        const res = await fetch(`/api/subjects/${subjectId}/upload`, {
          method: "POST",
          body: fd,
        });
        const data = await res.json();

        if (data.ok && data.source) {
          const conf = data.classification;
          const pct = conf ? Math.round(conf.confidence * 100) : 0;
          const typeLabel = DOCUMENT_TYPES.find((t) => t.value === conf?.documentType)?.label || conf?.documentType;
          setUploadResults((prev) => [
            ...prev,
            {
              fileName: file.name,
              ok: true,
              sourceId: data.source.id,
              documentType: conf?.documentType,
              confidence: pct,
              reasoning: conf?.reasoning,
              message: `Classified as ${typeLabel} (${pct}%) — confirm type to extract`,
            },
          ]);
        } else {
          setUploadResults((prev) => [...prev, { fileName: file.name, ...data }]);
        }
      } catch (err: any) {
        setUploadResults((prev) => [...prev, { fileName: file.name, ok: false, error: err.message }]);
      } finally {
        setUploadingFiles((prev) => prev.filter((n) => n !== file.name));
      }
    });

    await Promise.all(uploads);

    // Refresh subject data (new sources will show with classified type)
    loadSubject();
  }

  // ------------------------------------------------------------------
  // Source management
  // ------------------------------------------------------------------

  async function toggleSourceTag(sourceId: string, currentTags: string[], tag: string) {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    // Delete and recreate with new tags
    try {
      await fetch(`/api/subjects/${subjectId}/sources`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      await fetch(`/api/subjects/${subjectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, tags: newTags }),
      });
      loadSubject();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeSource(sourceId: string) {
    try {
      await fetch(`/api/subjects/${subjectId}/sources`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      loadSubject();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function changeDocumentType(sourceId: string, documentType: string) {
    try {
      const res = await fetch(`/api/content-sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadSubject();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function triggerExtraction(sourceId: string, sourceName: string) {
    setExtractingSourceIds((prev) => new Set([...prev, sourceId]));
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Add to background job queue
      if (data.jobId) {
        addExtractionJob(data.jobId, sourceId, sourceName, sourceName, subjectId);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExtractingSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  }

  // ------------------------------------------------------------------
  // Domain linking
  // ------------------------------------------------------------------

  async function linkDomain(domainId: string) {
    setLinkingDomain(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      loadSubject();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLinkingDomain(false);
    }
  }

  async function unlinkDomain(domainId: string) {
    try {
      await fetch(`/api/subjects/${subjectId}/domains`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      loadSubject();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Curriculum generation
  // ------------------------------------------------------------------

  async function generateCurriculum() {
    setCurriculumPreview(null);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Async — add to background queue and poll for completion
      if (data.taskId) {
        setCurriculumTaskId(data.taskId);
        addCurriculumJob(data.taskId, subjectId, subject?.name || "Subject");
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Poll for curriculum task completion
  useEffect(() => {
    const taskId = curriculumTaskId || activeCurriculumJob?.taskId;
    if (!taskId) return;

    // Check if the task just completed in the job queue
    const job = jobs.find((j) => j.taskId === taskId);
    if (job && job.progress.status === "completed") {
      // Fetch the preview
      fetch(`/api/subjects/${subjectId}/curriculum/preview?taskId=${taskId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ok && data.curriculum) {
            setCurriculumPreview(data.curriculum);
            setCurriculumTaskId(null);
          }
        })
        .catch((err) => console.error("[subjects] Failed to fetch curriculum preview:", err));
    }
  }, [jobs, curriculumTaskId, activeCurriculumJob?.taskId, subjectId]);

  async function saveCurriculum() {
    setSaving(true);
    try {
      const taskId = curriculumTaskId || activeCurriculumJob?.taskId;
      const res = await fetch(`/api/subjects/${subjectId}/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "save",
          taskId,
          curriculum: curriculumPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurriculum(data.curriculum);
      setCurriculumPreview(null);
      setCurriculumTaskId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (loading) return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading...</div>;
  if (!subject) return <div style={{ padding: 24, color: "var(--status-error-text)" }}>Subject not found</div>;

  const linkedDomainIds = new Set(subject.domains.map((d) => d.domain.id));
  const availableDomains = allDomains.filter((d) => !linkedDomainIds.has(d.id));
  const hasSyllabus = subject.sources.some((s) => s.tags?.includes("syllabus"));
  const totalAssertions = subject.sources.reduce((sum, s) => sum + s.source._count.assertions, 0);

  // Parse curriculum modules
  const curriculumModules: CurriculumModule[] = curriculum?.notableInfo?.modules || [];

  return (
    <div style={theme.page}>
      {/* Back link */}
      <button
        onClick={() => router.push("/x/subjects")}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        &larr; All Subjects
      </button>

      {/* Error */}
      {error && (
        <div style={{ ...theme.errorAlert, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--status-error-text)" }}>x</button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          {editingName ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                if (editName.trim() && editName !== subject.name) saveSubjectField("name", editName.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setEditName(subject.name); setEditingName(false); }
              }}
              autoFocus
              style={{ fontSize: 28, fontWeight: 700, border: "1px solid var(--accent-primary)", borderRadius: 6, padding: "2px 8px", width: 400, background: "var(--surface-primary)", color: "var(--text-primary)" }}
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              style={{ ...theme.h1, cursor: "pointer" }}
              title="Click to edit"
            >
              {subject.name}
            </h1>
          )}
          <TrustBadge level={subject.defaultTrustLevel} />
          {subject.qualificationLevel && (
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--surface-secondary)", color: "var(--text-muted)" }}>
              {subject.qualificationLevel}
            </span>
          )}
        </div>

        {/* Editable description */}
        {editingDesc ? (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            onBlur={() => {
              setEditingDesc(false);
              if (editDesc !== (subject.description || "")) saveSubjectField("description", editDesc.trim() || null);
            }}
            autoFocus
            rows={2}
            style={{ width: "100%", fontSize: 14, border: "1px solid var(--accent-primary)", borderRadius: 4, padding: 8, resize: "vertical" }}
          />
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", cursor: "pointer" }}
            title="Click to edit"
          >
            {subject.description || "Click to add description..."}
          </p>
        )}

        {/* Trust level selector + stats + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Default trust:</span>
            <select
              value={subject.defaultTrustLevel}
              onChange={(e) => saveSubjectField("defaultTrustLevel", e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border-default)" }}
            >
              {TRUST_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {subject.sources.length} sources / {totalAssertions} assertions
          </span>
          <button
            onClick={() => {
              router.push(`/x/content-sources`);
            }}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)",
              color: "var(--accent-primary)",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Content Wizard
          </button>
        </div>
      </div>

      {/* === PROGRESS STEPPER === */}
      <ProgressStepper
        steps={[
          {
            label: "Sources",
            completed: subject.sources.length > 0,
            active: subject.sources.length === 0,
            onClick: () => document.getElementById("section-sources")?.scrollIntoView({ behavior: "smooth" }),
          },
          {
            label: "Curriculum",
            completed: !!curriculum,
            active: subject.sources.length > 0 && !curriculum,
            onClick: () => document.getElementById("section-curriculum")?.scrollIntoView({ behavior: "smooth" }),
          },
          {
            label: "Lesson Plan",
            completed: !!lessonPlan,
            active: !!curriculum && !lessonPlan,
            onClick: () => document.getElementById("section-lesson-plan")?.scrollIntoView({ behavior: "smooth" }),
          },
          {
            label: "Domains",
            completed: subject.domains.length > 0,
            active: !!lessonPlan && subject.domains.length === 0,
            onClick: () => document.getElementById("section-domains")?.scrollIntoView({ behavior: "smooth" }),
          },
        ]}
      />

      {/* === SOURCES SECTION === */}
      <section id="section-sources" style={{ marginBottom: 32 }}>
        <h2 style={{ ...theme.h2, marginBottom: 12 }}>Sources</h2>

        {/* Source cards — unclassified (0 assertions + ai:*) float to top */}
        {subject.sources.length > 0 && (() => {
          const sorted = [...subject.sources].sort((a, b) => {
            const aAwaiting = a.source._count.assertions === 0 && a.source.documentTypeSource?.startsWith("ai:") ? 0 : 1;
            const bAwaiting = b.source._count.assertions === 0 && b.source.documentTypeSource?.startsWith("ai:") ? 0 : 1;
            return aAwaiting - bAwaiting;
          });
          return (
            <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
              {sorted.map((ss) => {
                const awaiting = ss.source._count.assertions === 0 && ss.source.documentTypeSource?.startsWith("ai:");
                const isExtracting = extractingSourceIds.has(ss.sourceId);
                return (
                  <div
                    key={ss.id}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      border: awaiting
                        ? "1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent)"
                        : "1px solid var(--border-default)",
                      background: awaiting
                        ? "color-mix(in srgb, var(--accent-primary) 3%, var(--surface-primary))"
                        : "var(--surface-primary)",
                    }}
                  >
                    {/* Row 1: badges + name + stats */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                        <TagPills tags={ss.tags || []} />
                        <DocumentTypeBadge type={ss.source.documentType} source={ss.source.documentTypeSource} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{ss.source.name}</span>
                        <TrustBadge level={ss.trustLevelOverride || ss.source.trustLevel} />
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {ss.source._count.assertions} assertions
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isAdvanced && SOURCE_TAGS.map((tag) => {
                          const active = ss.tags?.includes(tag.value);
                          return (
                            <button
                              key={tag.value}
                              onClick={() => toggleSourceTag(ss.sourceId, ss.tags || [], tag.value)}
                              title={tag.desc}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: 4,
                                border: `1px solid ${active ? tag.color : "var(--border-default)"}`,
                                background: active ? `color-mix(in srgb, ${tag.color} 12%, transparent)` : "transparent",
                                color: active ? tag.color : "var(--text-muted)",
                                cursor: "pointer",
                                textTransform: "uppercase",
                                opacity: active ? 1 : 0.5,
                              }}
                            >
                              {tag.label}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => removeSource(ss.sourceId)}
                          style={{ background: "none", border: "none", color: "var(--status-error-text)", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}
                          title="Remove from subject"
                        >
                          x
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Classification actions (awaiting sources — file stored, ready to extract) */}
                    {isAdvanced && awaiting && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, paddingTop: 8, borderTop: "1px solid color-mix(in srgb, var(--border-default) 50%, transparent)" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Type:</span>
                        <select
                          value={ss.source.documentType}
                          onChange={(e) => changeDocumentType(ss.sourceId, e.target.value)}
                          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border-default)" }}
                        >
                          {DOCUMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => triggerExtraction(ss.sourceId, ss.source.name)}
                          disabled={isExtracting}
                          style={{
                            ...theme.btnSmall,
                            background: "var(--accent-primary)",
                            color: "var(--accent-primary-text)",
                            fontWeight: 600,
                            cursor: isExtracting ? "wait" : "pointer",
                            opacity: isExtracting ? 0.6 : 1,
                          }}
                        >
                          {isExtracting ? "Extracting..." : "Extract"}
                        </button>
                        <button
                          onClick={() => loadSubject()}
                          style={{
                            ...theme.btnSmall,
                            border: "1px solid var(--border-default)",
                          }}
                          title="Keep this document for lesson use without extracting assertions"
                        >
                          Store for Lessons
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Upload results */}
        {uploadResults.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {uploadResults.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  marginBottom: 4,
                  fontSize: 13,
                  background: r.ok ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)" : "var(--status-error-bg)",
                  color: r.ok ? "var(--text-primary)" : "var(--status-error-text)",
                }}
              >
                {r.ok
                  ? `${r.fileName}: ${r.message}`
                  : `${r.fileName}: ${r.error}`}
              </div>
            ))}
            <button
              onClick={() => setUploadResults([])}
              style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Currently uploading */}
        {uploadingFiles.length > 0 && (
          <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-muted)" }}>
            Uploading &amp; classifying: {uploadingFiles.join(", ")}...
          </div>
        )}

        {/* DRAG-AND-DROP ZONE */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "var(--accent-primary)" : "var(--border-default)"}`,
            borderRadius: 8,
            padding: 32,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s",
            background: isDragging ? "color-mix(in srgb, var(--accent-primary) 5%, transparent)" : "transparent",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.md,.markdown,.json"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 28, marginBottom: 8 }}>{isDragging ? "+" : ""}</div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: isDragging ? "var(--accent-primary)" : "var(--text-primary)" }}>
            {isDragging ? "Drop files here" : "Drag documents here or click to upload"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            PDF, TXT, MD, JSON &mdash; documents will be auto-classified, then extracted after you confirm the type
          </p>
        </div>
      </section>

      {/* === CURRICULUM SECTION === */}
      <section id="section-curriculum" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ ...theme.h2 }}>Curriculum</h2>
          {isAdvanced && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {generatingCurriculum && (
                <span style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600 }}>
                  Generating in background...
                </span>
              )}
              {totalAssertions > 0 && (
                <button
                  onClick={generateCurriculum}
                  disabled={generatingCurriculum}
                  style={{
                    ...theme.btnSecondary, fontSize: 13, fontWeight: 600,
                    border: "1px solid var(--border-default)",
                    cursor: generatingCurriculum ? "not-allowed" : "pointer",
                    opacity: generatingCurriculum ? 0.6 : 1,
                  }}
                >
                  {generatingCurriculum
                    ? "Generating..."
                    : curriculum
                    ? "Regenerate"
                    : hasSyllabus
                    ? "Generate from Syllabus"
                    : "Generate from All Sources"}
                </button>
              )}
            </div>
          )}
        </div>

        <AdvancedSection label="Curriculum generation">
          {/* Auto-trigger notice */}
          {activeExtractionJobs.length > 0 && !generatingCurriculum && (
            <div style={{
              ...theme.infoPanel,
              background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
              marginBottom: 12,
            }}>
              {activeExtractionJobs.length} extraction{activeExtractionJobs.length > 1 ? "s" : ""} running &mdash; curriculum will generate automatically when complete.
            </div>
          )}

          {/* Curriculum preview (unsaved) */}
          {curriculumPreview && (
            <div style={{ ...theme.cardHighlight, marginBottom: 16, background: "color-mix(in srgb, var(--accent-primary) 3%, transparent)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--accent-primary)" }}>Generated Preview</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={saveCurriculum}
                    disabled={saving}
                    style={{ ...theme.btnPrimary, fontSize: 13 }}
                  >
                    {saving ? "Saving..." : "Save Curriculum"}
                  </button>
                  <button
                    onClick={() => setCurriculumPreview(null)}
                    style={{ ...theme.btnSecondary, fontSize: 13, border: "1px solid var(--border-default)" }}
                  >
                    Discard
                  </button>
                </div>
              </div>
              <CurriculumView modules={curriculumPreview.modules || []} name={curriculumPreview.name} description={curriculumPreview.description} />
            </div>
          )}
        </AdvancedSection>

        {/* Saved curriculum */}
        {curriculum && !curriculumPreview && (
          <CurriculumView modules={curriculumModules} name={curriculum.name} description={curriculum.description} />
        )}

        {/* No curriculum yet */}
        {!curriculum && !curriculumPreview && totalAssertions === 0 && (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Upload documents first, then generate a curriculum from the extracted content.
          </p>
        )}
        {!curriculum && !curriculumPreview && totalAssertions > 0 && (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {totalAssertions} assertions ready. Click &quot;Generate&quot; to create a curriculum structure.
          </p>
        )}
      </section>

      {/* === LESSON PLAN SECTION === */}
      {curriculum && (
        <section id="section-lesson-plan" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ ...theme.h2 }}>Lesson Plan</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {lessonPlanGenerating && (
                <span style={{ fontSize: 12, color: "var(--accent-primary)", fontWeight: 600 }}>
                  Generating...
                </span>
              )}
            </div>
          </div>

          {/* Session count picker */}
          {!lessonPlanEditing && (
            <SessionCountPicker value={sessionCount} onChange={setSessionCount} />
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <button
                onClick={generateLessonPlan}
                disabled={lessonPlanGenerating}
                style={{
                  ...theme.btnSecondary, fontSize: 13, fontWeight: 600,
                  border: "1px solid var(--border-default)",
                  cursor: lessonPlanGenerating ? "not-allowed" : "pointer",
                  opacity: lessonPlanGenerating ? 0.6 : 1,
                }}
              >
                {lessonPlan ? "Regenerate Plan" : "Generate Plan"}{sessionCount ? ` (${sessionCount} sessions)` : ""}
              </button>
              {lessonPlan && !lessonPlanEditing && (
                <button
                  onClick={() => {
                    setLessonPlanDraft(lessonPlan.entries || []);
                    setLessonPlanEditing(true);
                  }}
                  style={{
                    ...theme.btnSecondary, fontSize: 13,
                    border: "1px solid var(--border-default)",
                  }}
                >
                  Edit
                </button>
              )}
          </div>

          {/* AI reasoning */}
          {lessonPlanReasoning && lessonPlanEditing && (
            <div style={{
              ...theme.infoPanel, marginBottom: 12,
              background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
              fontStyle: "italic",
            }}>
              AI reasoning: {lessonPlanReasoning}
            </div>
          )}

          {/* Edit mode */}
          {lessonPlanEditing && (
            <LessonPlanEditor
              entries={lessonPlanDraft}
              modules={curriculumModules}
              onChange={setLessonPlanDraft}
              onSave={() => saveLessonPlan(lessonPlanDraft)}
              onCancel={() => { setLessonPlanEditing(false); setLessonPlanDraft([]); setLessonPlanReasoning(null); }}
              saving={saving}
            />
          )}

          {/* Read-only view */}
          {!lessonPlanEditing && lessonPlan && (
            <LessonPlanView entries={lessonPlan.entries || []} />
          )}

          {/* No plan yet */}
          {!lessonPlanEditing && !lessonPlan && !lessonPlanLoading && (
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              No lesson plan yet. Click &quot;Generate Plan&quot; to create one from the curriculum.
            </p>
          )}
          {lessonPlanLoading && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading plan...</p>
          )}
        </section>
      )}

      {/* === DOMAINS SECTION === */}
      <section id="section-domains" style={{ marginBottom: 32 }}>
        <h2 style={{ ...theme.h2, marginBottom: 12 }}>Domains</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8, marginBottom: 12 }}>
          Link this subject to domains so the AI tutor can teach it to callers in those domains.
        </p>

        {/* Linked domains */}
        {subject.domains.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {subject.domains.map((sd) => (
              <div
                key={sd.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-secondary)",
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600 }}>{sd.domain.name}</span>
                <button
                  onClick={() => unlinkDomain(sd.domain.id)}
                  style={{ background: "none", border: "none", color: "var(--status-error-text)", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
                  title="Unlink domain"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add domain */}
        {availableDomains.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              id="link-domain-select"
              defaultValue=""
              style={{ fontSize: 13, padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border-default)" }}
            >
              <option value="" disabled>Select domain...</option>
              {availableDomains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const sel = document.getElementById("link-domain-select") as HTMLSelectElement;
                if (sel?.value) linkDomain(sel.value);
              }}
              disabled={linkingDomain}
              style={{
                ...theme.btnSecondary, fontSize: 13, fontWeight: 600,
                border: "1px solid var(--border-default)",
              }}
            >
              {linkingDomain ? "Linking..." : "Link"}
            </button>
          </div>
        )}

        {availableDomains.length === 0 && subject.domains.length > 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>All domains are linked.</p>
        )}
        {allDomains.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{`No ${plural("domain").toLowerCase()} configured yet. Create ${plural("domain").toLowerCase()} first.`}</p>
        )}
      </section>

      {/* === MEDIA LIBRARY SECTION === */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ ...theme.h2 }}>Media Library</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Type filter */}
            {["all", "image", "pdf", "audio"].map((f) => (
              <button
                key={f}
                onClick={() => setMediaTypeFilter(f)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: `1px solid ${mediaTypeFilter === f ? "var(--accent-primary)" : "var(--border-default)"}`,
                  background: mediaTypeFilter === f ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "transparent",
                  color: mediaTypeFilter === f ? "var(--accent-primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8, marginBottom: 12 }}>
          Images, PDFs, and audio files that the AI tutor can share with learners during conversations.
        </p>

        {/* Media grid */}
        {mediaLoading && mediaAssets.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading media...</p>
        ) : mediaAssets.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            {mediaAssets.map((m) => {
              const isImage = m.mimeType.startsWith("image/");
              const isPdf = m.mimeType === "application/pdf";
              const isAudio = m.mimeType.startsWith("audio/");
              const sizeKB = Math.round(m.fileSize / 1024);
              const sizeLabel = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`;
              return (
                <div
                  key={m.id}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-primary)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {/* Preview */}
                  <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-secondary)" }}>
                    {isImage ? (
                      <img
                        src={`/api/media/${m.id}`}
                        alt={m.title || m.fileName}
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
                      />
                    ) : isPdf ? (
                      <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 32 }}>PDF</div>
                        <div style={{ fontSize: 11 }}>{sizeLabel}</div>
                      </div>
                    ) : isAudio ? (
                      <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 32 }}>AUD</div>
                        <div style={{ fontSize: 11 }}>{sizeLabel}</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 32 }}>FILE</div>
                        <div style={{ fontSize: 11 }}>{sizeLabel}</div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.fileName}>
                      {m.title || m.fileName}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <TrustBadge level={m.trustLevel} />
                      <button
                        onClick={() => unlinkMedia(m.id)}
                        style={{ background: "none", border: "none", color: "var(--status-error-text)", cursor: "pointer", fontSize: 11, padding: "2px 4px" }}
                        title="Remove from subject"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            No media files yet. Upload images, PDFs, or audio below.
          </p>
        )}

        {/* Media upload drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setMediaDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setMediaDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setMediaDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMediaDragging(false);
            if (e.dataTransfer.files?.length) handleMediaUpload(Array.from(e.dataTransfer.files));
          }}
          onClick={() => mediaFileRef.current?.click()}
          style={{
            border: `2px dashed ${mediaDragging ? "var(--accent-primary)" : "var(--border-default)"}`,
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
            cursor: mediaUploading ? "wait" : "pointer",
            transition: "all 0.15s",
            background: mediaDragging ? "color-mix(in srgb, var(--accent-primary) 5%, transparent)" : "transparent",
            opacity: mediaUploading ? 0.6 : 1,
          }}
        >
          <input
            ref={mediaFileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/wav,audio/ogg"
            onChange={(e) => {
              if (e.target.files?.length) handleMediaUpload(Array.from(e.target.files));
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: mediaDragging ? "var(--accent-primary)" : "var(--text-primary)" }}>
            {mediaUploading ? "Uploading..." : mediaDragging ? "Drop media here" : "Drag media files here or click to upload"}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            JPG, PNG, WebP, PDF, MP3, WAV, OGG &mdash; files the AI can share in conversations
          </p>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------
// Curriculum display component
// ------------------------------------------------------------------

function CurriculumView({ modules, name, description }: { modules: CurriculumModule[]; name?: string; description?: string }) {
  return (
    <div>
      {name && <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 4 }}>{name}</h3>}
      {description && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>{description}</p>}

      {modules.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No modules defined.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {modules.map((mod) => (
            <div key={mod.id} style={{ ...theme.card }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-primary)", fontFamily: "monospace" }}>{mod.id}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{mod.title}</span>
                {mod.estimatedDurationMinutes && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{mod.estimatedDurationMinutes}min</span>
                )}
              </div>
              {mod.description && (
                <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--text-muted)" }}>{mod.description}</p>
              )}
              {mod.learningOutcomes.length > 0 && (
                <div style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                    Learning Outcomes
                  </span>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                    {mod.learningOutcomes.map((lo, i) => (
                      <li key={i} style={{ marginBottom: 2, color: "var(--text-primary)" }}>{lo}</li>
                    ))}
                  </ul>
                </div>
              )}
              {mod.keyTerms && mod.keyTerms.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {mod.keyTerms.map((t, i) => (
                    <span key={i} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--surface-secondary)", color: "var(--text-muted)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Lesson Plan components
// ------------------------------------------------------------------

const SESSION_TYPES = [
  { value: "onboarding", label: "Onboarding", color: "var(--accent-primary)" },
  { value: "introduce", label: "Introduce", color: "var(--status-success-text)" },
  { value: "deepen", label: "Deepen", color: "var(--accent-primary)" },
  { value: "review", label: "Review", color: "var(--badge-yellow-text)" },
  { value: "assess", label: "Assess", color: "var(--status-error-text)" },
  { value: "consolidate", label: "Consolidate", color: "var(--badge-purple-text)" },
] as const;

function SessionTypeBadge({ type }: { type: string }) {
  const cfg = SESSION_TYPES.find((t) => t.value === type);
  const color = cfg?.color || "var(--text-muted)";
  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 10,
      fontWeight: 600, color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      textTransform: "uppercase", minWidth: 70, textAlign: "center",
    }}>
      {cfg?.label || type}
    </span>
  );
}

function LessonPlanView({ entries }: { entries: any[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
        {entries.length} sessions planned
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {entries.map((e: any) => (
          <div key={e.session} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "6px 10px",
            borderRadius: 6, background: "var(--surface-primary)",
            border: "1px solid var(--border-subtle)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", minWidth: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {e.session}.
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
              {e.label}
            </span>
            <SessionTypeBadge type={e.type} />
            {e.moduleLabel && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {e.moduleLabel}
              </span>
            )}
            {e.assertionCount != null && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {e.assertionCount} pts
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonPlanEditor({
  entries,
  modules,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  entries: any[];
  modules: CurriculumModule[];
  onChange: (entries: any[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const renumber = (list: any[]) => list.map((e, i) => ({ ...e, session: i + 1 }));

  const updateEntry = (index: number, patch: any) => {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    onChange(next);
  };

  const inputStyle: React.CSSProperties = {
    padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border-default)",
    backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 12,
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <SortableList
          items={entries}
          getItemId={(e) => `session-${e.session}-${e.label}`}
          onReorder={(from, to) => {
            const reordered = reorderItems(entries, from, to);
            onChange(renumber(reordered));
          }}
          onRemove={(index) => {
            const next = entries.filter((_, i) => i !== index);
            onChange(renumber(next));
          }}
          onAdd={() => {
            onChange([...entries, {
              session: entries.length + 1,
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
                onChange={(ev) => updateEntry(index, { label: ev.target.value })}
                onClick={(ev) => ev.stopPropagation()}
                placeholder="Session label"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={e.type}
                onChange={(ev) => updateEntry(index, { type: ev.target.value })}
                onClick={(ev) => ev.stopPropagation()}
                style={{ ...inputStyle, width: 110 }}
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={e.moduleId || ""}
                onChange={(ev) => {
                  const mod = modules.find((m) => m.id === ev.target.value);
                  updateEntry(index, {
                    moduleId: ev.target.value || null,
                    moduleLabel: mod?.title || "",
                  });
                }}
                onClick={(ev) => ev.stopPropagation()}
                style={{ ...inputStyle, width: 160 }}
              >
                <option value="">No module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}
        />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{
          ...theme.btnSecondary, fontSize: 13, border: "1px solid var(--border-default)",
        }}>
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || entries.length === 0}
          style={{
            ...theme.btnPrimary, fontSize: 13,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving || entries.length === 0 ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : `Save Plan (${entries.length} sessions)`}
        </button>
      </div>
    </div>
  );
}
