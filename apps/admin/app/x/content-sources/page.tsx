"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { AdvancedBanner } from "@/components/shared/AdvancedBanner";

// ── Active Jobs Banner (survives navigation) ──────────────

type ActiveJob = {
  id: string;
  status: string;
  context: {
    sourceId?: string;
    fileName?: string;
    currentChunk?: number;
    totalChunks?: number;
    extractedCount?: number;
    importedCount?: number;
    duplicatesSkipped?: number;
    warnings?: string[];
    error?: string;
  };
  startedAt: string;
  updatedAt: string;
};

function ActiveJobsBanner({ onJobDone }: { onJobDone: () => void }) {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?status=in_progress");
      const data = await res.json();
      if (!data.ok) return;
      const extractionJobs = (data.tasks || []).filter(
        (t: any) => t.taskType === "extraction"
      );
      setJobs(extractionJobs);
      // If no active jobs, stop polling
      if (extractionJobs.length === 0 && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchActiveJobs();
    pollRef.current = setInterval(fetchActiveJobs, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchActiveJobs]);

  // Detect job completion: if a job we were tracking disappears from active list
  const prevJobIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentIds = new Set(jobs.map((j) => j.id));
    if (prevJobIds.current.size > 0 && prevJobIds.current.size > currentIds.size) {
      onJobDone();
    }
    prevJobIds.current = currentIds;
  }, [jobs, onJobDone]);

  if (jobs.length === 0) return null;

  return (
    <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {jobs.map((job) => {
        const ctx = job.context || {};
        const pct = ctx.totalChunks && ctx.totalChunks > 0
          ? Math.round(((ctx.currentChunk || 0) / ctx.totalChunks) * 100)
          : 0;
        const elapsed = Math.floor((Date.now() - new Date(job.startedAt).getTime()) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        return (
          <div
            key={job.id}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "color-mix(in srgb, var(--accent-primary) 6%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--accent-primary)",
                  animation: "activejob-pulse 1.5s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                Extracting: {ctx.fileName || "document"}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {ctx.extractedCount || 0} assertions
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                {timeStr}
              </span>
            </div>
            {ctx.totalChunks && ctx.totalChunks > 0 && (
              <div style={{ height: 3, borderRadius: 2, background: "var(--surface-tertiary)", overflow: "hidden" }}>
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
            {ctx.totalChunks && ctx.totalChunks > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                Chunk {ctx.currentChunk || 0}/{ctx.totalChunks} ({pct}%)
              </div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes activejob-pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}

type ContentSource = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  trustLevel: string;
  documentType: string;
  documentTypeSource: string | null;
  publisherOrg: string | null;
  accreditingBody: string | null;
  accreditationRef: string | null;
  authors: string[];
  isbn: string | null;
  edition: string | null;
  publicationYear: number | null;
  validFrom: string | null;
  validUntil: string | null;
  qualificationRef: string | null;
  moduleCoverage: string[];
  isActive: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  _count: { assertions: number };
  subjects?: Array<{
    subject: {
      id: string;
      name: string;
      slug: string;
      domains: Array<{
        domain: { id: string; name: string; slug: string };
      }>;
    };
  }>;
};

const DOCUMENT_TYPES = [
  { value: "TEXTBOOK", label: "Textbook", icon: "\uD83D\uDCD6" },
  { value: "CURRICULUM", label: "Curriculum", icon: "\uD83C\uDF93" },
  { value: "WORKSHEET", label: "Worksheet", icon: "\uD83D\uDCDD" },
  { value: "EXAMPLE", label: "Example", icon: "\uD83D\uDCC4" },
  { value: "ASSESSMENT", label: "Assessment", icon: "\u2705" },
  { value: "REFERENCE", label: "Reference", icon: "\uD83D\uDCD1" },
];

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory Standard", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited Material", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published Reference", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)" },
  { value: "EXPERT_CURATED", label: "L2 Expert Curated", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)" },
  { value: "AI_ASSISTED", label: "L1 AI Assisted", color: "var(--trust-l1-text)", bg: "var(--trust-l1-bg)" },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "var(--trust-l0-text)", bg: "var(--trust-l0-bg)" },
];

function TrustBadge({ level }: { level: string }) {
  const config = TRUST_LEVELS.find((t) => t.value === level) || TRUST_LEVELS[5];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
}

function FreshnessIndicator({ validUntil }: { validUntil: string | null }) {
  if (!validUntil) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No expiry</span>;
  const expiry = new Date(validUntil);
  const now = new Date();
  const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return <span style={{ color: "var(--status-error-text)", fontSize: 12, fontWeight: 600 }}>Expired {Math.abs(daysUntil)}d ago</span>;
  }
  if (daysUntil <= 60) {
    return <span style={{ color: "#FF8F00", fontSize: 12, fontWeight: 600 }}>Expires in {daysUntil}d</span>;
  }
  return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Valid until {expiry.toLocaleDateString()}</span>;
}

function DocumentTypeBadge({ type, source }: { type: string; source?: string | null }) {
  const dt = DOCUMENT_TYPES.find((d) => d.value === type) || DOCUMENT_TYPES[0];
  const isAuto = source?.startsWith("ai:");
  return (
    <span
      title={source ? `Set by: ${source}` : "Default (not classified)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        color: "var(--text-secondary)",
        backgroundColor: "var(--surface-tertiary)",
        border: `1px solid var(--border-subtle)`,
      }}
    >
      <span style={{ fontSize: 12 }}>{dt.icon}</span>
      {dt.label}
      {isAuto && (
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>auto</span>
      )}
    </span>
  );
}

function UsedByCell({ subjects }: { subjects: ContentSource["subjects"] }) {
  if (!subjects || subjects.length === 0) {
    return (
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
        Unlinked
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {subjects.map((ss) => {
        const domainNames = ss.subject.domains.map((d) => d.domain.name);
        return (
          <div key={ss.subject.id} style={{ fontSize: 12 }}>
            <Link
              href={`/x/subjects?id=${ss.subject.id}`}
              style={{ color: "var(--accent-primary)", textDecoration: "none", fontWeight: 500 }}
            >
              {ss.subject.name}
            </Link>
            {domainNames.length > 0 && (
              <span style={{ color: "var(--text-muted)" }}> ({domainNames.join(", ")})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ContentSourcesPage() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTrust, setFilterTrust] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [uploadSourceId, setUploadSourceId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dropStatus, setDropStatus] = useState<{ phase: "idle" | "creating" | "extracting" | "done" | "error"; message: string }>({ phase: "idle", message: "" });

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

    // Derive slug and name from filename
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const name = baseName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Step 1: Create the source
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

      // Step 2: Start background extraction (auto-classifies document type)
      setDropStatus({ phase: "extracting", message: `Classifying & extracting from "${file.name}"...` });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "background");
      formData.append("maxAssertions", "500");
      const uploadRes = await fetch(`/api/content-sources/${sourceId}/import`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to start extraction");

      const detectedType = uploadData.documentType
        ? DOCUMENT_TYPES.find((d) => d.value === uploadData.documentType)
        : null;
      const typeMsg = detectedType ? ` Detected as ${detectedType.icon} ${detectedType.label}.` : "";
      setDropStatus({ phase: "done", message: `Source created.${typeMsg} Extraction running in background.` });
      fetchSources();
      // Auto-expand the upload row to show progress
      setUploadSourceId(sourceId);
      setTimeout(() => setDropStatus({ phase: "idle", message: "" }), 4000);
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

  // Freshness summary
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
      {/* Full-page drop overlay */}
      {dragOver && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
          border: "2px dashed var(--accent-primary)",
          borderRadius: 12,
          pointerEvents: "none",
        }}>
          <div style={{
            padding: "24px 40px",
            background: "var(--surface-primary)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              Drop to create source & extract
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              PDF, TXT, MD, JSON
            </div>
          </div>
        </div>
      )}

      {/* Drop status banner */}
      {dropStatus.phase !== "idle" && (
        <div style={{
          padding: "10px 16px",
          marginBottom: 16,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          ...(dropStatus.phase === "error"
            ? { background: "var(--status-error-bg)", color: "var(--status-error-text)", border: "1px solid #FFCDD2" }
            : dropStatus.phase === "done"
              ? { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #C8E6C9" }
              : { background: "#EBF3FC", color: "#1565C0", border: "1px solid #BBDEFB" }),
        }}>
          {dropStatus.phase === "creating" || dropStatus.phase === "extracting" ? (
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "currentColor",
              animation: "pulse 1.5s ease-in-out infinite",
            }} />
          ) : null}
          {dropStatus.message}
          <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Content Sources
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Authoritative sources for teaching content. Drag & drop a PDF to create a source and extract assertions automatically.
        </p>
      </div>

      {/* Active extraction jobs (survives navigation) */}
      <ActiveJobsBanner onJobDone={fetchSources} />

      {/* Freshness alerts */}
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

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
            width: 240,
          }}
        />
        <select
          value={filterTrust}
          onChange={(e) => setFilterTrust(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--surface-secondary)",
            color: "var(--text-primary)",
            fontSize: 13,
          }}
        >
          <option value="">All trust levels</option>
          {TRUST_LEVELS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--accent-primary)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Source
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {filtered.length} source{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateSourceForm
          onCreated={() => { setShowCreateForm(false); fetchSources(); }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Table */}
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Source Row with expandable upload ───────────────────

function SourceRow({
  source: s,
  isUploading,
  onToggleUpload,
  onUploadDone,
}: {
  source: ContentSource;
  isUploading: boolean;
  onToggleUpload: () => void;
  onUploadDone: () => void;
}) {
  return (
    <>
      <tr style={{ borderBottom: isUploading ? "none" : "1px solid var(--border-subtle)" }}>
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
      {/* Pick file */}
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

      {/* Running */}
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

      {/* Done */}
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

      {/* Error */}
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

function CreateSourceForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "",
    trustLevel: "UNVERIFIED",
    documentType: "",
    publisherOrg: "",
    accreditingBody: "",
    accreditationRef: "",
    authors: "",
    isbn: "",
    edition: "",
    publicationYear: "",
    qualificationRef: "",
    validFrom: "",
    validUntil: "",
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
        slug: f.slug || prev.slug,
        name: f.name || prev.name,
        description: f.description || prev.description,
        trustLevel: f.trustLevel || prev.trustLevel,
        documentType: f.documentType || prev.documentType,
        publisherOrg: f.publisherOrg || prev.publisherOrg,
        accreditingBody: f.accreditingBody || prev.accreditingBody,
        accreditationRef: f.accreditationRef || prev.accreditationRef,
        authors: Array.isArray(f.authors) ? f.authors.join(", ") : prev.authors,
        isbn: f.isbn || prev.isbn,
        edition: f.edition || prev.edition,
        publicationYear: f.publicationYear ? String(f.publicationYear) : prev.publicationYear,
        qualificationRef: f.qualificationRef || prev.qualificationRef,
        validFrom: f.validFrom || prev.validFrom,
        validUntil: f.validUntil || prev.validUntil,
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
          validFrom: form.validFrom || null,
          validUntil: form.validUntil || null,
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
    padding: "6px 10px",
    borderRadius: 4,
    border: "1px solid var(--border-default)",
    backgroundColor: "var(--surface-secondary)",
    color: "var(--text-primary)",
    fontSize: 13,
    width: "100%",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600 as const,
    color: "var(--text-muted)",
    marginBottom: 2,
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: 16,
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        marginBottom: 16,
        backgroundColor: "var(--surface-secondary)",
      }}
    >
      <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600 }}>Add Content Source</h3>

      {/* Intent Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && intentText.trim() && !suggesting) {
                e.preventDefault();
                handleSuggest();
              }
            }}
            placeholder='Describe the source... e.g. "CII R04 Insurance Syllabus 2025/26" or paste an ISBN'
            disabled={suggesting}
            style={{
              ...inputStyle,
              flex: 1,
              padding: "8px 12px",
            }}
          />
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!intentText.trim() || suggesting}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 500,
              background: !intentText.trim() || suggesting ? "var(--surface-secondary)" : "var(--accent-primary)",
              color: !intentText.trim() || suggesting ? "var(--text-muted)" : "#fff",
              border: "none",
              borderRadius: 4,
              cursor: !intentText.trim() || suggesting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap" as const,
            }}
          >
            {suggesting ? (
              <>
                <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                Thinking...
              </>
            ) : (
              <>
                <span style={{ fontSize: 14 }}>✨</span>
                Fill
              </>
            )}
          </button>
        </div>
        {suggestError && (
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--status-error-text)" }}>{suggestError}</p>
        )}
        {aiInterpretation && (
          <div style={{
            marginTop: 6,
            padding: "6px 10px",
            borderRadius: 4,
            background: "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{ fontSize: 13 }}>✨</span>
            {aiInterpretation}
            <button
              type="button"
              onClick={() => setAiInterpretation(null)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: "var(--status-error-text)", fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Slug *</div>
          <input style={inputStyle} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="e.g., cii-r04-syllabus-2025" required />
        </div>
        <div>
          <div style={labelStyle}>Name *</div>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., CII R04 Syllabus 2025/26" required />
        </div>
        <div>
          <div style={labelStyle}>Document Type</div>
          <select style={inputStyle} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
            <option value="">Auto-detect</option>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.icon} {d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Trust Level</div>
          <select style={inputStyle} value={form.trustLevel} onChange={(e) => setForm({ ...form, trustLevel: e.target.value })}>
            {TRUST_LEVELS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Publisher</div>
          <input style={inputStyle} value={form.publisherOrg} onChange={(e) => setForm({ ...form, publisherOrg: e.target.value })} placeholder="e.g., Chartered Insurance Institute" />
        </div>
        <div>
          <div style={labelStyle}>Accrediting Body</div>
          <input style={inputStyle} value={form.accreditingBody} onChange={(e) => setForm({ ...form, accreditingBody: e.target.value })} placeholder="e.g., CII, Ofqual" />
        </div>
        <div>
          <div style={labelStyle}>Qualification Ref</div>
          <input style={inputStyle} value={form.qualificationRef} onChange={(e) => setForm({ ...form, qualificationRef: e.target.value })} placeholder="e.g., CII R04" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Authors (comma-separated)</div>
          <input style={inputStyle} value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} placeholder="e.g., Richard Sprenger" />
        </div>
        <div>
          <div style={labelStyle}>ISBN</div>
          <input style={inputStyle} value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
        </div>
        <div>
          <div style={labelStyle}>Edition</div>
          <input style={inputStyle} value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} placeholder="e.g., 37th Edition" />
        </div>
        <div>
          <div style={labelStyle}>Publication Year</div>
          <input style={inputStyle} type="number" value={form.publicationYear} onChange={(e) => setForm({ ...form, publicationYear: e.target.value })} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={labelStyle}>Valid From</div>
          <input style={inputStyle} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
        </div>
        <div>
          <div style={labelStyle}>Valid Until</div>
          <input style={inputStyle} type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "var(--accent-primary)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Create Source"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
