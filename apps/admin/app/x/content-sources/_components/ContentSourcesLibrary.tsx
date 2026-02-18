"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";
import { ActiveJobsBanner } from "./shared/ActiveJobsBanner";
import {
  ContentSource,
  DOCUMENT_TYPES,
  TRUST_LEVELS,
  TrustBadge,
  FreshnessIndicator,
  DocumentTypeBadge,
  UsedByCell,
} from "./shared/badges";

// ── Inline Uploader (background extraction) ─────────────

type UploadPhase = "pick" | "running" | "done" | "error";

interface JobProgress {
  status: string;
  currentChunk: number;
  totalChunks: number;
  extractedCount: number;
  importedCount?: number;
  duplicatesSkipped?: number;
  warnings: string[];
  error?: string;
}

function InlineUploader({
  sourceId,
  sourceName,
  onDone,
}: {
  sourceId: string;
  sourceName: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<UploadPhase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/content-sources/${sourceId}/import?jobId=${jobId}`);
          const data = await res.json();
          if (!data.ok) return;
          const job = data.job as JobProgress;
          setProgress(job);
          if (job.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            setPhase("done");
          } else if (job.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            setError(job.error || "Extraction failed");
            setPhase("error");
          }
        } catch {
          // keep polling
        }
      }, 2000);
    },
    [sourceId]
  );

  const handleUpload = async () => {
    if (!file) return;
    setPhase("running");
    setError(null);
    setProgress(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "background");
      formData.append("maxAssertions", "500");
      const res = await fetch(`/api/content-sources/${sourceId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.ok && data.jobId) {
        setProgress({
          status: "extracting",
          currentChunk: 0,
          totalChunks: data.totalChunks || 0,
          extractedCount: 0,
          warnings: [],
        });
        startPolling(data.jobId);
      } else {
        setError(data.error || "Failed to start extraction");
        setPhase("pick");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
      setPhase("pick");
    }
  };

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  const pct =
    progress && progress.totalChunks > 0
      ? Math.round((progress.currentChunk / progress.totalChunks) * 100)
      : 0;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: "1px solid var(--border-default)",
        background: "var(--surface-secondary)",
        marginTop: 8,
      }}
    >
      {phase === "pick" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,.markdown,.json"
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--surface-primary)",
              color: "var(--text-primary)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {file ? file.name : "Choose file..."}
          </button>
          {file && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
          <button
            onClick={handleUpload}
            disabled={!file}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              background: file ? "var(--accent-primary)" : "var(--surface-tertiary)",
              color: file ? "#fff" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: file ? "pointer" : "default",
              marginLeft: "auto",
            }}
          >
            Extract &amp; Import
          </button>
          {error && <span style={{ fontSize: 12, color: "var(--status-error-text)", width: "100%" }}>{error}</span>}
        </div>
      )}

      {phase === "running" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {progress ? `Extracting — ${progress.extractedCount} assertions found` : "Starting..."}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
              {timeStr}
            </span>
          </div>
          {progress && progress.totalChunks > 0 && (
            <div style={{ height: 4, borderRadius: 2, background: "var(--surface-tertiary)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  background: "linear-gradient(90deg, var(--accent-primary), #6366f1)",
                  width: `${pct}%`,
                  transition: "width 0.5s ease-out",
                }}
              />
            </div>
          )}
          {!progress && (
            <div style={{ height: 4, borderRadius: 2, background: "var(--surface-tertiary)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 2,
                  width: "30%",
                  background: "linear-gradient(90deg, var(--accent-primary), #6366f1)",
                  animation: "indeterminate 1.5s ease-in-out infinite",
                }}
              />
              <style>{`@keyframes indeterminate { 0% { margin-left:0 } 50% { margin-left:70% } 100% { margin-left:0 } }`}</style>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {file?.name}{progress && progress.totalChunks > 0 ? ` — chunk ${progress.currentChunk}/${progress.totalChunks}` : ""}
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18 }}>{"\u2705"}</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--success-text, #16a34a)" }}>
              {progress?.importedCount ?? progress?.extractedCount ?? 0} assertions imported
            </span>
            {(progress?.duplicatesSkipped ?? 0) > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                ({progress?.duplicatesSkipped} duplicates skipped)
              </span>
            )}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href={`/x/content-sources/${sourceId}`}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid var(--accent-primary)",
                background: "transparent",
                color: "var(--accent-primary)",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Review Assertions
            </Link>
            <button
              onClick={onDone}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent-primary)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--status-error-text)", fontWeight: 600 }}>
            Failed: {error}
          </span>
          <button
            onClick={() => { setPhase("pick"); setError(null); setProgress(null); }}
            style={{
              marginLeft: "auto",
              padding: "6px 16px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Source Row ─────────────────────────────────────

function SourceRow({
  source: s,
  isUploading,
  onToggleUpload,
  onUploadDone,
  onRefresh,
}: {
  source: ContentSource;
  isUploading: boolean;
  onToggleUpload: () => void;
  onUploadDone: () => void;
  onRefresh: () => void;
}) {
  const [extracting, setExtracting] = useState(false);
  const [changingType, setChangingType] = useState(false);

  const awaiting = s._count.assertions === 0 && s.documentTypeSource?.startsWith("ai:");
  const confidence = s.documentTypeSource?.startsWith("ai:")
    ? Math.round(parseFloat(s.documentTypeSource.split(":")[1]) * 100)
    : null;

  async function handleExtract() {
    setExtracting(true);
    try {
      const res = await fetch(`/api/content-sources/${s.id}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRefresh();
    } catch {
      // Error handled by banner
    } finally {
      setExtracting(false);
    }
  }

  async function handleChangeType(newType: string) {
    setChangingType(true);
    try {
      const res = await fetch(`/api/content-sources/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: newType }),
      });
      if (!res.ok) return;
      onRefresh();
    } finally {
      setChangingType(false);
    }
  }

  const hasExpandedRow = isUploading || awaiting;

  return (
    <>
      <tr style={{
        borderBottom: hasExpandedRow ? "none" : "1px solid var(--border-subtle)",
        ...(awaiting ? { background: "color-mix(in srgb, var(--accent-primary) 3%, transparent)" } : {}),
      }}>
        <td style={{ padding: "10px 12px" }}>
          <Link href={`/x/content-sources/${s.id}`} style={{ fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>{s.name}</Link>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{s.slug}</div>
          {s.authors.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.authors.join(", ")}</div>
          )}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <DocumentTypeBadge type={s.documentType} source={s.documentTypeSource} />
        </td>
        <td style={{ padding: "10px 12px" }}>
          <TrustBadge level={s.trustLevel} />
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
          {s.qualificationRef || "-"}
          {s.accreditationRef && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.accreditationRef}</div>
          )}
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>
          {s.publisherOrg || "-"}
          {s.accreditingBody && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Accredited by: {s.accreditingBody}</div>
          )}
        </td>
        <td style={{ padding: "10px 12px" }}>
          <FreshnessIndicator validUntil={s.validUntil} />
        </td>
        <td style={{ padding: "10px 12px" }}>
          <UsedByCell subjects={s.subjects} />
        </td>
        <td style={{ padding: "10px 12px", textAlign: "right" }}>
          {s._count.assertions > 0 ? (
            <Link href={`/x/content-sources/${s.id}`} style={{ color: "var(--accent-primary)", textDecoration: "none", fontWeight: 500 }}>
              {s._count.assertions}
            </Link>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>0</span>
          )}
        </td>
        <td style={{ padding: "10px 12px", textAlign: "right" }}>
          <button
            onClick={onToggleUpload}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: isUploading ? "1px solid var(--accent-primary)" : "1px solid var(--border-default)",
              backgroundColor: isUploading ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "transparent",
              color: isUploading ? "var(--accent-primary)" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isUploading ? "Close" : "Upload"}
          </button>
        </td>
      </tr>
      {awaiting && !isUploading && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={9} style={{ padding: "0 12px 12px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
              background: "color-mix(in srgb, var(--accent-primary) 4%, transparent)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-primary)" }}>
                Classified{confidence !== null ? ` (${confidence}%)` : ""}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Type:</span>
              <select
                value={s.documentType}
                onChange={(e) => handleChangeType(e.target.value)}
                disabled={changingType}
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid var(--border-default)",
                  background: "var(--surface-primary)",
                }}
              >
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.icon} {d.label}</option>
                ))}
              </select>
              <button
                onClick={handleExtract}
                disabled={extracting}
                style={{
                  padding: "4px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent-primary)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: extracting ? "not-allowed" : "pointer",
                  opacity: extracting ? 0.6 : 1,
                }}
              >
                {extracting ? "Starting..." : "Extract Assertions"}
              </button>
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                Confirm type before extracting
              </span>
            </div>
          </td>
        </tr>
      )}
      {isUploading && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={9} style={{ padding: "0 12px 16px" }}>
            <InlineUploader sourceId={s.id} sourceName={s.name} onDone={onUploadDone} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Create Source Form ─────────────────────────────

function CreateSourceForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    slug: "", name: "", description: "", trustLevel: "UNVERIFIED", documentType: "",
    publisherOrg: "", accreditingBody: "", accreditationRef: "", authors: "",
    isbn: "", edition: "", publicationYear: "", qualificationRef: "", validFrom: "", validUntil: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intentText, setIntentText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);

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
      setForm((prev) => ({
        ...prev,
        slug: f.slug || prev.slug, name: f.name || prev.name,
        description: f.description || prev.description, trustLevel: f.trustLevel || prev.trustLevel,
        documentType: f.documentType || prev.documentType, publisherOrg: f.publisherOrg || prev.publisherOrg,
        accreditingBody: f.accreditingBody || prev.accreditingBody, accreditationRef: f.accreditationRef || prev.accreditationRef,
        authors: Array.isArray(f.authors) ? f.authors.join(", ") : prev.authors,
        isbn: f.isbn || prev.isbn, edition: f.edition || prev.edition,
        publicationYear: f.publicationYear ? String(f.publicationYear) : prev.publicationYear,
        qualificationRef: f.qualificationRef || prev.qualificationRef,
        validFrom: f.validFrom || prev.validFrom, validUntil: f.validUntil || prev.validUntil,
      }));
      if (data.interpretation) setAiInterpretation(data.interpretation);
    } catch (err: any) {
      setSuggestError(err.message || "Network error");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/content-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          documentType: form.documentType || undefined,
          authors: form.authors ? form.authors.split(",").map((a) => a.trim()) : [],
          publicationYear: form.publicationYear ? parseInt(form.publicationYear) : null,
          validFrom: form.validFrom || null, validUntil: form.validUntil || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    padding: "6px 10px", borderRadius: 4, border: "1px solid var(--border-default)",
    backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13, width: "100%",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600 as const, color: "var(--text-muted)", marginBottom: 2 };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 16, border: "1px solid var(--border-default)", borderRadius: 8, marginBottom: 16, backgroundColor: "var(--surface-secondary)" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>Add Content Source</h3>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="text" value={intentText} onChange={(e) => setIntentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && intentText.trim() && !suggesting) { e.preventDefault(); handleSuggest(); } }}
            placeholder='Describe the source... e.g. "CII R04 Insurance Syllabus 2025/26" or paste an ISBN'
            disabled={suggesting} style={{ ...inputStyle, flex: 1, padding: "8px 12px" }}
          />
          <button type="button" onClick={handleSuggest} disabled={!intentText.trim() || suggesting}
            style={{
              padding: "8px 14px", fontSize: 13, fontWeight: 500,
              background: !intentText.trim() || suggesting ? "var(--surface-secondary)" : "var(--accent-primary)",
              color: !intentText.trim() || suggesting ? "var(--text-muted)" : "#fff",
              border: "none", borderRadius: 4, cursor: !intentText.trim() || suggesting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const,
            }}
          >
            {suggesting ? (
              <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />Thinking...</>
            ) : (
              <><span style={{ fontSize: 14 }}>&#10024;</span>Fill</>
            )}
          </button>
        </div>
        {suggestError && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--status-error-text)" }}>{suggestError}</p>}
        {aiInterpretation && (
          <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 4, background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)", fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13 }}>&#10024;</span>
            {aiInterpretation}
            <button type="button" onClick={() => setAiInterpretation(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>
              &times;
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: "var(--status-error-text)", fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><div style={labelStyle}>Slug *</div><input style={inputStyle} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="e.g., cii-r04-syllabus-2025" required /></div>
        <div><div style={labelStyle}>Name *</div><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., CII R04 Syllabus 2025/26" required /></div>
        <div><div style={labelStyle}>Document Type</div>
          <select style={inputStyle} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
            <option value="">Auto-detect</option>
            {DOCUMENT_TYPES.map((d) => (<option key={d.value} value={d.value}>{d.icon} {d.label}</option>))}
          </select>
        </div>
        <div><div style={labelStyle}>Trust Level</div>
          <select style={inputStyle} value={form.trustLevel} onChange={(e) => setForm({ ...form, trustLevel: e.target.value })}>
            {TRUST_LEVELS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><div style={labelStyle}>Publisher</div><input style={inputStyle} value={form.publisherOrg} onChange={(e) => setForm({ ...form, publisherOrg: e.target.value })} placeholder="e.g., Chartered Insurance Institute" /></div>
        <div><div style={labelStyle}>Accrediting Body</div><input style={inputStyle} value={form.accreditingBody} onChange={(e) => setForm({ ...form, accreditingBody: e.target.value })} placeholder="e.g., CII, Ofqual" /></div>
        <div><div style={labelStyle}>Qualification Ref</div><input style={inputStyle} value={form.qualificationRef} onChange={(e) => setForm({ ...form, qualificationRef: e.target.value })} placeholder="e.g., CII R04" /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><div style={labelStyle}>Authors (comma-separated)</div><input style={inputStyle} value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} placeholder="e.g., Richard Sprenger" /></div>
        <div><div style={labelStyle}>ISBN</div><input style={inputStyle} value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></div>
        <div><div style={labelStyle}>Edition</div><input style={inputStyle} value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} placeholder="e.g., 37th Edition" /></div>
        <div><div style={labelStyle}>Publication Year</div><input style={inputStyle} type="number" value={form.publicationYear} onChange={(e) => setForm({ ...form, publicationYear: e.target.value })} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div><div style={labelStyle}>Valid From</div><input style={inputStyle} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></div>
        <div><div style={labelStyle}>Valid Until</div><input style={inputStyle} type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={saving}
          style={{ padding: "8px 20px", borderRadius: 6, border: "none", backgroundColor: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving..." : "Create Source"}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: "8px 20px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </form>
  );
}

// ── Main Library Component ────────────────────────

export default function ContentSourcesLibrary() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTrust, setFilterTrust] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploadSourceId, setUploadSourceId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dropStatus, setDropStatus] = useState<{ phase: "idle" | "creating" | "classifying" | "done" | "error"; message: string }>({ phase: "idle", message: "" });

  async function fetchSources() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTrust) params.set("trustLevel", filterTrust);
      const res = await fetch(`/api/content-sources?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSources(data.sources || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSources();
  }, [filterTrust]);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "txt", "md", "markdown", "json"].includes(ext || "")) {
      setDropStatus({ phase: "error", message: `Unsupported file type: .${ext}` });
      setTimeout(() => setDropStatus({ phase: "idle", message: "" }), 4000);
      return;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const name = baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    setDropStatus({ phase: "creating", message: `Creating source "${name}"...` });
    try {
      const createRes = await fetch("/api/content-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, trustLevel: "UNVERIFIED" }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create source");

      const sourceId = createData.source.id;

      setDropStatus({ phase: "classifying", message: `Classifying "${file.name}"...` });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "classify");
      const classifyRes = await fetch(`/api/content-sources/${sourceId}/import`, {
        method: "POST",
        body: formData,
      });
      const classifyData = await classifyRes.json();
      if (!classifyRes.ok) throw new Error(classifyData.error || "Failed to classify document");

      const detectedType = classifyData.classification?.documentType
        ? DOCUMENT_TYPES.find((d) => d.value === classifyData.classification.documentType)
        : null;
      const pct = classifyData.classification?.confidence
        ? Math.round(classifyData.classification.confidence * 100)
        : 0;
      const typeMsg = detectedType ? ` Classified as ${detectedType.icon} ${detectedType.label} (${pct}%).` : "";
      setDropStatus({ phase: "done", message: `Source created.${typeMsg} Review the type, then extract.` });
      fetchSources();
      setTimeout(() => setDropStatus({ phase: "idle", message: "" }), 5000);
    } catch (err: any) {
      setDropStatus({ phase: "error", message: err.message });
      setTimeout(() => setDropStatus({ phase: "idle", message: "" }), 5000);
    }
  }

  const filtered = sources.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.qualificationRef || "").toLowerCase().includes(q) ||
      (s.publisherOrg || "").toLowerCase().includes(q)
    );
  });

  const expired = sources.filter((s) => s.validUntil && new Date(s.validUntil) < new Date());
  const expiringSoon = sources.filter((s) => {
    if (!s.validUntil) return false;
    const daysUntil = Math.floor((new Date(s.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 60;
  });

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{ position: "relative" }}
    >
      <AdvancedBanner />
      {dragOver && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
          border: "2px dashed var(--accent-primary)", borderRadius: 12, pointerEvents: "none",
        }}>
          <div style={{ padding: "24px 40px", background: "var(--surface-primary)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>&#128196;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Drop to create source &amp; classify</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>PDF, TXT, MD, JSON</div>
          </div>
        </div>
      )}

      {dropStatus.phase !== "idle" && (
        <div style={{
          padding: "10px 16px", marginBottom: 16, borderRadius: 8, fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
          ...(dropStatus.phase === "error"
            ? { background: "var(--status-error-bg)", color: "var(--status-error-text)", border: "1px solid #FFCDD2" }
            : dropStatus.phase === "done"
              ? { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #C8E6C9" }
              : { background: "#EBF3FC", color: "#1565C0", border: "1px solid #BBDEFB" }),
        }}>
          {(dropStatus.phase === "creating" || dropStatus.phase === "classifying") && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", animation: "pulse 1.5s ease-in-out infinite" }} />
          )}
          {dropStatus.message}
          <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
        </div>
      )}

      <ActiveJobsBanner onJobDone={fetchSources} />

      {(expired.length > 0 || expiringSoon.length > 0) && (
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {expired.length > 0 && (
            <div style={{ padding: "8px 16px", borderRadius: 8, backgroundColor: "var(--status-error-bg)", border: "1px solid #FFCDD2", fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "var(--status-error-text)" }}>{expired.length} expired</span>
              <span style={{ color: "#C62828" }}> source{expired.length > 1 ? "s" : ""} need{expired.length === 1 ? "s" : ""} updating</span>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div style={{ padding: "8px 16px", borderRadius: 8, backgroundColor: "#FFF3E0", border: "1px solid #FFE0B2", fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#E65100" }}>{expiringSoon.length}</span>
              <span style={{ color: "#BF360C" }}> source{expiringSoon.length > 1 ? "s" : ""} expiring within 60 days</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input type="text" placeholder="Search sources..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13, width: 240 }}
        />
        <select value={filterTrust} onChange={(e) => setFilterTrust(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
          <option value="">All trust levels</option>
          {TRUST_LEVELS.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
        </select>
        <button onClick={() => setShowCreateForm(!showCreateForm)}
          style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--accent-primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Add Source
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} source{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {showCreateForm && (
        <CreateSourceForm onCreated={() => { setShowCreateForm(false); fetchSources(); }} onCancel={() => setShowCreateForm(false)} />
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading sources...</p>
      ) : error ? (
        <p style={{ color: "var(--status-error-text)" }}>Error: {error}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No content sources found. Add one to get started.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Source</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Trust Level</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Qualification</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Publisher</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Validity</th>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Used by</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Assertions</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <SourceRow
                  key={s.id}
                  source={s}
                  isUploading={uploadSourceId === s.id}
                  onToggleUpload={() => setUploadSourceId(uploadSourceId === s.id ? null : s.id)}
                  onUploadDone={() => { setUploadSourceId(null); fetchSources(); }}
                  onRefresh={fetchSources}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
