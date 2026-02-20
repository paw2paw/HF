"use client";

import { useState, useEffect } from "react";
import { FancySelect } from "@/components/shared/FancySelect";
import type { FancySelectOption } from "@/components/shared/FancySelect";
import { DOCUMENT_TYPES, TRUST_LEVELS, TrustBadge, DocumentTypeBadge } from "../shared/badges";

interface StepProps {
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  onNext: () => void;
  onPrev: () => void;
  endFlow: () => void;
}

export default function SourceStep({ setData, getData, onNext }: StepProps) {
  // State
  const [intentText, setIntentText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);

  const [metadata, setMetadata] = useState<Record<string, any> | null>(null);
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [editForm, setEditForm] = useState({
    slug: "", name: "", description: "", trustLevel: "UNVERIFIED",
    documentType: "", publisherOrg: "", accreditingBody: "", qualificationRef: "",
    authors: "", isbn: "", edition: "", publicationYear: "",
  });

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<{ type: string; confidence: number } | null>(null);
  const [classifyTaskId, setClassifyTaskId] = useState<string | null>(null);

  const [sourceCreated, setSourceCreated] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(getData<string>("sourceId") || null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subject selection
  const [subjects, setSubjects] = useState<FancySelectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(getData<string>("subjectId") || "");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);

  // Load subjects
  useEffect(() => {
    fetch("/api/subjects").then((r) => r.json()).then((data) => {
      if (data.subjects) {
        setSubjects(data.subjects.map((s: any) => ({
          value: s.id,
          label: s.name,
          subtitle: s.slug,
        })));
      }
    }).catch(() => {});
  }, []);

  // Poll classification task
  useEffect(() => {
    if (!classifyTaskId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?taskId=${classifyTaskId}`);
        const data = await res.json();
        const task = data.task || data.tasks?.[0]; // Handle both response formats

        if (task?.status === "completed") {
          clearInterval(interval);
          const ctx = (task.context as Record<string, any>) || {};

          if (ctx.error) {
            setError(ctx.error);
          } else if (ctx.classification) {
            setClassificationResult({
              type: ctx.classification.documentType,
              confidence: Math.round(ctx.classification.confidence * 100),
            });
          }
          setClassifyTaskId(null);
        } else if (task?.status === "failed") {
          clearInterval(interval);
          setError("Classification failed. Please try again.");
          setClassifyTaskId(null);
        }
      } catch {
        // Silent — poll continues
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [classifyTaskId]);

  // AI Suggest from description
  async function handleSuggest() {
    if (!intentText.trim() || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    setAiInterpretation(null);
    try {
      const res = await fetch("/api/content-sources/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: intentText.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSuggestError(data.error || "Failed to generate suggestions");
        return;
      }
      const f = data.fields || {};
      const meta = {
        slug: f.slug || "", name: f.name || "", description: f.description || "",
        trustLevel: f.trustLevel || "UNVERIFIED", documentType: f.documentType || "",
        publisherOrg: f.publisherOrg || "", accreditingBody: f.accreditingBody || "",
        qualificationRef: f.qualificationRef || "",
        authors: Array.isArray(f.authors) ? f.authors.join(", ") : "",
        isbn: f.isbn || "", edition: f.edition || "",
        publicationYear: f.publicationYear ? String(f.publicationYear) : "",
      };
      setMetadata(meta);
      setEditForm(meta);
      if (data.interpretation) setAiInterpretation(data.interpretation);
    } catch (err: any) {
      setSuggestError(err.message || "Network error");
    } finally {
      setSuggesting(false);
    }
  }

  // File drop
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;
    const ext = droppedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md", "markdown", "json"].includes(ext || "")) {
      setError(`Unsupported file type: .${ext}`);
      return;
    }
    setFile(droppedFile);
    setError(null);
    // Derive name from file
    const baseName = droppedFile.name.replace(/\.[^.]+$/, "");
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const name = baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (!metadata) {
      const meta = { ...editForm, slug, name };
      setMetadata(meta);
      setEditForm(meta);
    }
  }

  // Create source + optionally classify
  async function handleCreateSource() {
    const form = editingMetadata ? editForm : (metadata || editForm);
    if (!form.slug || !form.name) {
      setError("Slug and name are required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // 1. Create source
      const createRes = await fetch("/api/content-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          documentType: form.documentType || undefined,
          authors: form.authors ? form.authors.split(",").map((a: string) => a.trim()) : [],
          publicationYear: form.publicationYear ? parseInt(form.publicationYear) : null,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create source");

      const newSourceId = createData.source.id;
      setSourceId(newSourceId);
      setData("sourceId", newSourceId);
      setData("sourceName", form.name);
      setData("hasFile", !!file);

      // 2. If file, upload + classify (async)
      if (file) {
        setClassifying(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", "classify");
        try {
          const classifyRes = await fetch(`/api/content-sources/${newSourceId}/import`, {
            method: "POST",
            body: formData,
          });
          const classifyData = await classifyRes.json();
          if (!classifyRes.ok) {
            throw new Error(classifyData.error || "Failed to start classification");
          }
          if (classifyData.taskId) {
            // Classification is async, store taskId and poll
            setClassifyTaskId(classifyData.taskId);
          }
          // Fetch source to get mediaAssetId and store it (File objects don't serialize)
          const sourceRes = await fetch(`/api/content-sources/${newSourceId}`);
          const sourceData = await sourceRes.json();
          if (sourceData.source?.mediaAssets?.[0]?.id) {
            setData("mediaAssetId", sourceData.source.mediaAssets[0].id);
          }
        } catch (uploadErr: any) {
          throw new Error(`File upload failed: ${uploadErr.message}`);
        } finally {
          setClassifying(false);
        }
      }

      // 3. Link to subject
      if (selectedSubjectId) {
        await fetch(`/api/subjects/${selectedSubjectId}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: newSourceId }),
        });
        setData("subjectId", selectedSubjectId);
        const subj = subjects.find((s) => s.value === selectedSubjectId);
        if (subj) setData("subjectName", subj.label);
      }

      setSourceCreated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // Create new subject
  async function handleCreateSubject() {
    if (!newSubjectName.trim()) return;
    setCreatingSubject(true);
    try {
      const slug = newSubjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSubjectName.trim(), slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newOpt = { value: data.subject.id, label: data.subject.name, subtitle: data.subject.slug };
      setSubjects((prev) => [...prev, newOpt]);
      setSelectedSubjectId(data.subject.id);
      setNewSubjectName("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingSubject(false);
    }
  }

  const canProceed = sourceCreated && sourceId;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
        What do you want to teach from?
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        Drop a document or describe your source. AI will fill in the details.
      </p>

      {!sourceCreated ? (
        <>
          {/* Two entry paths side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
            {/* Path A: Drop a file */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                padding: 32,
                borderRadius: 12,
                border: dragOver
                  ? "2px dashed var(--accent-primary)"
                  : file
                  ? "2px solid var(--accent-primary)"
                  : "2px dashed var(--border-default)",
                background: dragOver
                  ? "color-mix(in srgb, var(--accent-primary) 6%, transparent)"
                  : file
                  ? "color-mix(in srgb, var(--accent-primary) 4%, transparent)"
                  : "var(--surface-secondary)",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".pdf,.txt,.md,.markdown,.json";
                input.onchange = (e) => {
                  const f = (e.target as HTMLInputElement).files?.[0];
                  if (f) {
                    setFile(f);
                    const baseName = f.name.replace(/\.[^.]+$/, "");
                    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    const name = baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    if (!metadata) {
                      const meta = { ...editForm, slug, name };
                      setMetadata(meta);
                      setEditForm(meta);
                    }
                  }
                };
                input.click();
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>{file ? "\u2705" : "\uD83D\uDCC4"}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {file ? file.name : "Drop a file here"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "PDF, TXT, MD, JSON"}
              </div>
            </div>

            {/* Path B: Describe it */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                Or describe the source
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={intentText}
                  onChange={(e) => setIntentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && intentText.trim()) { e.preventDefault(); handleSuggest(); } }}
                  placeholder='e.g. "CII R04 Insurance Syllabus 2025/26" or ISBN'
                  disabled={suggesting}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 8,
                    border: "1px solid var(--border-default)", backgroundColor: "var(--surface-primary)",
                    color: "var(--text-primary)", fontSize: 14,
                  }}
                />
                <button
                  onClick={handleSuggest}
                  disabled={!intentText.trim() || suggesting}
                  style={{
                    padding: "10px 18px", borderRadius: 8, border: "none",
                    background: !intentText.trim() || suggesting ? "var(--surface-tertiary)" : "var(--accent-primary)",
                    color: !intentText.trim() || suggesting ? "var(--text-muted)" : "#fff",
                    fontSize: 14, fontWeight: 600, cursor: !intentText.trim() || suggesting ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {suggesting ? "Thinking..." : "\u2728 Fill"}
                </button>
              </div>
              {suggestError && <p style={{ fontSize: 12, color: "var(--status-error-text)", margin: 0 }}>{suggestError}</p>}
              {aiInterpretation && (
                <div style={{
                  padding: "8px 12px", borderRadius: 6,
                  background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
                  fontSize: 12, color: "var(--text-secondary)",
                }}>
                  \u2728 {aiInterpretation}
                </div>
              )}
            </div>
          </div>

          {/* Metadata card (shown after AI suggest or file drop) */}
          {metadata && (
            <div style={{
              padding: 16, borderRadius: 8, border: "1px solid var(--border-default)",
              background: "var(--surface-secondary)", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Source Details</span>
                <button
                  onClick={() => setEditingMetadata(!editingMetadata)}
                  style={{
                    padding: "4px 12px", borderRadius: 4, border: "1px solid var(--border-default)",
                    background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
                  }}
                >
                  {editingMetadata ? "Collapse" : "Edit"}
                </button>
              </div>

              {!editingMetadata ? (
                /* Compact card view */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
                  <div><span style={{ color: "var(--text-muted)" }}>Name:</span> <strong>{metadata.name}</strong></div>
                  <div><span style={{ color: "var(--text-muted)" }}>Slug:</span> <code style={{ fontSize: 11 }}>{metadata.slug}</code></div>
                  {metadata.documentType && <div><DocumentTypeBadge type={metadata.documentType} /></div>}
                  {metadata.trustLevel && <div><TrustBadge level={metadata.trustLevel} /></div>}
                  {metadata.publisherOrg && <div><span style={{ color: "var(--text-muted)" }}>Publisher:</span> {metadata.publisherOrg}</div>}
                  {metadata.qualificationRef && <div><span style={{ color: "var(--text-muted)" }}>Qualification:</span> {metadata.qualificationRef}</div>}
                </div>
              ) : (
                /* Edit form */
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    {[
                      { key: "slug", label: "Slug *" },
                      { key: "name", label: "Name *" },
                      { key: "publisherOrg", label: "Publisher" },
                      { key: "qualificationRef", label: "Qualification Ref" },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                        <input
                          value={editForm[key as keyof typeof editForm] || ""}
                          onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                          style={{
                            width: "100%", padding: "6px 10px", borderRadius: 4,
                            border: "1px solid var(--border-default)", backgroundColor: "var(--surface-primary)",
                            color: "var(--text-primary)", fontSize: 13,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>Document Type</div>
                      <select
                        value={editForm.documentType}
                        onChange={(e) => setEditForm({ ...editForm, documentType: e.target.value })}
                        style={{
                          width: "100%", padding: "6px 10px", borderRadius: 4,
                          border: "1px solid var(--border-default)", backgroundColor: "var(--surface-primary)",
                          color: "var(--text-primary)", fontSize: 13,
                        }}
                      >
                        <option value="">Auto-detect</option>
                        {DOCUMENT_TYPES.map((d) => (<option key={d.value} value={d.value}>{d.icon} {d.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>Trust Level</div>
                      <select
                        value={editForm.trustLevel}
                        onChange={(e) => setEditForm({ ...editForm, trustLevel: e.target.value })}
                        style={{
                          width: "100%", padding: "6px 10px", borderRadius: 4,
                          border: "1px solid var(--border-default)", backgroundColor: "var(--surface-primary)",
                          color: "var(--text-primary)", fontSize: 13,
                        }}
                      >
                        {TRUST_LEVELS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>Authors</div>
                      <input value={editForm.authors} onChange={(e) => setEditForm({ ...editForm, authors: e.target.value })}
                        placeholder="Comma-separated"
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-primary)", color: "var(--text-primary)", fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 }}>ISBN</div>
                      <input value={editForm.isbn} onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-primary)", color: "var(--text-primary)", fontSize: 13 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {classificationResult && (
                <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)", fontSize: 12 }}>
                  AI classified as <strong>{DOCUMENT_TYPES.find((d) => d.value === classificationResult.type)?.label || classificationResult.type}</strong> ({classificationResult.confidence}% confidence)
                </div>
              )}
            </div>
          )}

          {/* Subject selection */}
          <div style={{
            padding: 16, borderRadius: 8, border: "1px solid var(--border-default)",
            background: "var(--surface-secondary)", marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
              Which subject does this belong to?
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <FancySelect
                  options={subjects}
                  value={selectedSubjectId}
                  onChange={setSelectedSubjectId}
                  placeholder="Select a subject..."
                />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>or</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="New subject name"
                  style={{
                    padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                    backgroundColor: "var(--surface-primary)", color: "var(--text-primary)", fontSize: 13,
                  }}
                />
                <button
                  onClick={handleCreateSubject}
                  disabled={!newSubjectName.trim() || creatingSubject}
                  style={{
                    padding: "8px 16px", borderRadius: 6, border: "none",
                    background: newSubjectName.trim() ? "var(--accent-primary)" : "var(--surface-tertiary)",
                    color: newSubjectName.trim() ? "#fff" : "var(--text-muted)",
                    fontSize: 13, fontWeight: 600, cursor: newSubjectName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {creatingSubject ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 16px", borderRadius: 8, background: "var(--status-error-bg)", border: "1px solid #FFCDD2", color: "var(--status-error-text)", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Create button */}
          <button
            onClick={handleCreateSource}
            disabled={creating || classifying || !metadata?.name}
            style={{
              padding: "12px 32px", borderRadius: 8, border: "none",
              background: metadata?.name ? "var(--accent-primary)" : "var(--surface-tertiary)",
              color: metadata?.name ? "#fff" : "var(--text-muted)",
              fontSize: 15, fontWeight: 700,
              cursor: metadata?.name && !creating ? "pointer" : "not-allowed",
              opacity: creating || classifying ? 0.6 : 1,
            }}
          >
            {creating ? "Creating..." : classifying ? "Classifying..." : "Create Source & Continue"}
          </button>
        </>
      ) : (
        /* Source created — show confirmation */
        <div style={{
          padding: 24, borderRadius: 12, border: "2px solid var(--status-success-text, #16a34a)",
          background: "var(--status-success-bg, #dcfce7)", textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2705"}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            Source created: {getData<string>("sourceName")}
          </div>
          {classificationResult && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Classified as {DOCUMENT_TYPES.find((d) => d.value === classificationResult.type)?.label} ({classificationResult.confidence}%)
            </div>
          )}
          <button
            onClick={onNext}
            style={{
              padding: "12px 32px", borderRadius: 8, border: "none",
              background: "var(--accent-primary)", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            {getData<boolean>("hasFile") ? "Continue to Extract" : "Continue to Review"}
          </button>
        </div>
      )}
    </div>
  );
}
