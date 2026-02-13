"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory", color: "#D4AF37", bg: "#FDF6E3" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited", color: "#8B8B8B", bg: "#F5F5F5" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published", color: "#4A90D9", bg: "#EBF3FC" },
  { value: "EXPERT_CURATED", label: "L2 Expert", color: "#2E7D32", bg: "#E8F5E9" },
  { value: "AI_ASSISTED", label: "L1 AI Assisted", color: "#FF8F00", bg: "#FFF3E0" },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "#B71C1C", bg: "#FFEBEE" },
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
        border: `1px solid ${config.color}33`,
      }}
    >
      {config.label}
    </span>
  );
}

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
  _count: { sources: number; domains: number; curricula: number };
  domains: Array<{ domain: { id: string; name: string; slug: string } }>;
};

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTrustLevel, setNewTrustLevel] = useState("UNVERIFIED");
  const [newQualBody, setNewQualBody] = useState("");
  const [newQualRef, setNewQualRef] = useState("");
  const [newQualLevel, setNewQualLevel] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    try {
      setLoading(true);
      const res = await fetch("/api/subjects");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSubjects(data.subjects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug || autoSlug(newName),
          name: newName.trim(),
          description: newDescription.trim() || null,
          defaultTrustLevel: newTrustLevel,
          qualificationBody: newQualBody.trim() || null,
          qualificationRef: newQualRef.trim() || null,
          qualificationLevel: newQualLevel.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Navigate to new subject
      router.push(`/x/subjects/${data.subject.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Subjects</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "4px 0 0" }}>
            Group content sources under teaching topics. Upload documents, set trust, generate curricula.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: showCreate ? "var(--bg-secondary)" : "var(--accent)",
            color: showCreate ? "var(--text)" : "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showCreate ? "Cancel" : "+ New Subject"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 6, background: "#FFEBEE", color: "#B71C1C", marginBottom: 16, fontSize: 13 }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>x</button>
        </div>
      )}

      {showCreate && (
        <div style={{ padding: 16, borderRadius: 8, border: "1px solid var(--border)", marginBottom: 24, background: "var(--bg-secondary)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>Create Subject</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Name *</label>
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug || newSlug === autoSlug(newName)) setNewSlug(autoSlug(e.target.value));
                }}
                placeholder="Food Safety Level 2"
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Slug</label>
              <input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="food-safety-l2"
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this subject covers..."
                rows={2}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)", resize: "vertical" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Default Trust Level</label>
              <select
                value={newTrustLevel}
                onChange={(e) => setNewTrustLevel(e.target.value)}
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
              >
                {TRUST_LEVELS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Qualification Level</label>
              <input
                value={newQualLevel}
                onChange={(e) => setNewQualLevel(e.target.value)}
                placeholder="Level 2"
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Qualification Body</label>
              <input
                value={newQualBody}
                onChange={(e) => setNewQualBody(e.target.value)}
                placeholder="Highfield, CII"
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Qualification Ref</label>
              <input
                value={newQualRef}
                onChange={(e) => setNewQualRef(e.target.value)}
                placeholder="Highfield L2 Food Safety"
                style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg)" }}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                cursor: creating ? "wait" : "pointer",
                opacity: creating || !newName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? "Creating..." : "Create & Open"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading subjects...</p>
      ) : subjects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No subjects yet</p>
          <p style={{ fontSize: 14 }}>Create a subject to start grouping your content sources.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {subjects.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/x/subjects/${s.id}`)}
              style={{
                padding: 16,
                borderRadius: 8,
                border: "1px solid var(--border)",
                cursor: "pointer",
                transition: "border-color 0.15s",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</span>
                  <TrustBadge level={s.defaultTrustLevel} />
                  {s.qualificationLevel && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "2px 6px", background: "var(--bg-secondary)", borderRadius: 3 }}>
                      {s.qualificationLevel}
                    </span>
                  )}
                </div>
                {s.description && (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", maxWidth: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.description}
                  </p>
                )}
                {s.domains.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    {s.domains.map((d) => (
                      <span
                        key={d.domain.id}
                        style={{ fontSize: 11, padding: "2px 6px", borderRadius: 3, background: "var(--bg-secondary)", color: "var(--text-muted)" }}
                      >
                        {d.domain.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{s._count.sources}</div>
                  <div>sources</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>{s._count.curricula}</div>
                  <div>curricula</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
