"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useContentJobQueue } from "@/components/shared/ContentJobQueue";

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
  { value: "syllabus", label: "Syllabus", color: "#6366F1", desc: "Defines the curriculum structure / schedule" },
  { value: "content", label: "Content", color: "#059669", desc: "Teaching material the AI delivers from" },
];

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
        const c = cfg?.color || "#6B7280";
        return (
          <span key={tag} style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, color: c, backgroundColor: `${c}15`, textTransform: "uppercase" }}>
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
  const { addJob: addToGlobalQueue } = useContentJobQueue();

  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Curriculum state
  const [curriculum, setCurriculum] = useState<any>(null);
  const [generatingCurriculum, setGeneratingCurriculum] = useState(false);
  const [curriculumPreview, setCurriculumPreview] = useState<any>(null);

  // Domain linking state
  const [allDomains, setAllDomains] = useState<Array<{ id: string; slug: string; name: string }>>([]);
  const [linkingDomain, setLinkingDomain] = useState(false);

  // Editing state
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  // Load subject
  useEffect(() => {
    loadSubject();
    loadCurriculum();
    loadDomains();
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
      if (data.curriculum) setCurriculum(data.curriculum);
    } catch {}
  }

  async function loadDomains() {
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      setAllDomains(data.domains || []);
    } catch {}
  }

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

    // Upload all files in parallel — each returns immediately with a background job
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

        // Add to global job queue for background tracking
        if (data.ok && data.jobId) {
          addToGlobalQueue(
            data.jobId,
            data.source.id,
            data.source.name,
            file.name
          );
          setUploadResults((prev) => [
            ...prev,
            { fileName: file.name, ok: true, message: "Extraction started in background" },
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

    // Refresh subject data (new sources will show even before extraction completes)
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
    setGeneratingCurriculum(true);
    setCurriculumPreview(null);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurriculumPreview(data.curriculum);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingCurriculum(false);
    }
  }

  async function saveCurriculum() {
    setSaving(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "save" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCurriculum(data.curriculum);
      setCurriculumPreview(null);
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
  if (!subject) return <div style={{ padding: 24, color: "#B71C1C" }}>Subject not found</div>;

  const linkedDomainIds = new Set(subject.domains.map((d) => d.domain.id));
  const availableDomains = allDomains.filter((d) => !linkedDomainIds.has(d.id));
  const hasSyllabus = subject.sources.some((s) => s.tags?.includes("syllabus"));
  const totalAssertions = subject.sources.reduce((sum, s) => sum + s.source._count.assertions, 0);

  // Parse curriculum modules
  const curriculumModules: CurriculumModule[] = curriculum?.notableInfo?.modules || [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      {/* Back link */}
      <button
        onClick={() => router.push("/x/subjects")}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        &larr; All Subjects
      </button>

      {/* Error */}
      {error && (
        <div style={{ padding: 12, borderRadius: 6, background: "#FFEBEE", color: "#B71C1C", marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>x</button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
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
              style={{ fontSize: 24, fontWeight: 700, border: "1px solid var(--accent)", borderRadius: 4, padding: "2px 8px", width: 400 }}
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              style={{ fontSize: 24, fontWeight: 700, margin: 0, cursor: "pointer" }}
              title="Click to edit"
            >
              {subject.name}
            </h1>
          )}
          <TrustBadge level={subject.defaultTrustLevel} />
          {subject.qualificationLevel && (
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
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
            style={{ width: "100%", fontSize: 14, border: "1px solid var(--accent)", borderRadius: 4, padding: 8, resize: "vertical" }}
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

        {/* Trust level selector + stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Default trust:</span>
            <select
              value={subject.defaultTrustLevel}
              onChange={(e) => saveSubjectField("defaultTrustLevel", e.target.value)}
              style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)" }}
            >
              {TRUST_LEVELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {subject.sources.length} sources / {totalAssertions} assertions
          </span>
        </div>
      </div>

      {/* === SOURCES SECTION === */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Sources</h2>

        {/* Source cards */}
        {subject.sources.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {subject.sources.map((ss) => (
              <div
                key={ss.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                  <TagPills tags={ss.tags || []} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ss.source.name}</span>
                  <TrustBadge level={ss.trustLevelOverride || ss.source.trustLevel} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {ss.source._count.assertions} assertions
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {SOURCE_TAGS.map((tag) => {
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
                          border: `1px solid ${active ? tag.color : "var(--border)"}`,
                          background: active ? `${tag.color}15` : "transparent",
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
                    style={{ background: "none", border: "none", color: "#B71C1C", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}
                    title="Remove from subject"
                  >
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
                  background: r.ok ? "#E8F5E9" : "#FFEBEE",
                  color: r.ok ? "#2E7D32" : "#B71C1C",
                }}
              >
                {r.ok
                  ? r.message
                    ? `${r.fileName}: ${r.message}`
                    : `${r.fileName}: ${r.created} assertions extracted (${r.duplicatesSkipped} duplicates skipped)`
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
            Uploading: {uploadingFiles.join(", ")}...
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
            border: `2px dashed ${isDragging ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 8,
            padding: 32,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.15s",
            background: isDragging ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "transparent",
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
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px", color: isDragging ? "var(--accent)" : "var(--text)" }}>
            {isDragging ? "Drop files here" : "Drag documents here or click to upload"}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            PDF, TXT, MD, JSON &mdash; documents will be auto-extracted into assertions
          </p>
        </div>
      </section>

      {/* === CURRICULUM SECTION === */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Curriculum</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {totalAssertions > 0 && (
              <button
                onClick={generateCurriculum}
                disabled={generatingCurriculum}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: generatingCurriculum ? "wait" : "pointer",
                  opacity: generatingCurriculum ? 0.6 : 1,
                }}
              >
                {generatingCurriculum ? "Generating..." : hasSyllabus ? "Generate from Syllabus" : "Generate from All Sources"}
              </button>
            )}
          </div>
        </div>

        {/* Curriculum preview (unsaved) */}
        {curriculumPreview && (
          <div style={{ padding: 16, borderRadius: 8, border: "2px solid var(--accent)", marginBottom: 16, background: "color-mix(in srgb, var(--accent) 3%, transparent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--accent)" }}>Generated Preview</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={saveCurriculum}
                  disabled={saving}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >
                  {saving ? "Saving..." : "Save Curriculum"}
                </button>
                <button
                  onClick={() => setCurriculumPreview(null)}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, cursor: "pointer" }}
                >
                  Discard
                </button>
              </div>
            </div>
            <CurriculumView modules={curriculumPreview.modules || []} name={curriculumPreview.name} description={curriculumPreview.description} />
          </div>
        )}

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

      {/* === DOMAINS SECTION === */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Domains</h2>
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
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600 }}>{sd.domain.name}</span>
                <button
                  onClick={() => unlinkDomain(sd.domain.id)}
                  style={{ background: "none", border: "none", color: "#B71C1C", cursor: "pointer", fontSize: 12, padding: "0 2px" }}
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
              style={{ fontSize: 13, padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border)" }}
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
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
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
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No domains configured yet. Create domains first.</p>
        )}
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
            <div key={mod.id} style={{ padding: 12, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>{mod.id}</span>
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
                      <li key={i} style={{ marginBottom: 2, color: "var(--text)" }}>{lo}</li>
                    ))}
                  </ul>
                </div>
              )}
              {mod.keyTerms && mod.keyTerms.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {mod.keyTerms.map((t, i) => (
                    <span key={i} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
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
