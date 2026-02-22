"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";
import { FancySelect } from "@/components/shared/FancySelect";
import { DomainPill } from "@/src/components/shared/EntityPill";
import { useSession } from "next-auth/react";

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)" },
  { value: "EXPERT_CURATED", label: "L2 Expert", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)" },
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
  lessonPlanSessions: number;
};

type Domain = { id: string; slug: string; name: string };
type SortOption = "name" | "sources" | "curricula";

export default function SubjectsPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/Sort/Search
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // RBAC
  const { data: session } = useSession();
  const isOperator = ["OPERATOR", "EDUCATOR", "ADMIN", "SUPERADMIN"].includes((session?.user?.role as string) || "");
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const handleDeactivate = async (id: string) => {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to deactivate");
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to deactivate");
    } finally {
      setDeactivating(false);
      setConfirmDeactivateId(null);
    }
  };

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDomains(data.domains || []);
      })
      .catch((e) => console.warn("[Subjects] Failed to load domains:", e));
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

  function resetCreateForm() {
    setNewName("");
    setNewSlug("");
    setNewDescription("");
    setNewTrustLevel("UNVERIFIED");
    setNewQualBody("");
    setNewQualRef("");
    setNewQualLevel("");
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
      setShowCreateModal(false);
      resetCreateForm();
      router.push(`/x/subjects/${data.subject.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  // Filtering and sorting
  const sortOptions = [
    { value: "name-asc", label: "Name A-Z" },
    { value: "name-desc", label: "Name Z-A" },
    { value: "sources-desc", label: "Most sources" },
    { value: "sources-asc", label: "Fewest sources" },
    { value: "curricula-desc", label: "Most curricula" },
    { value: "curricula-asc", label: "Fewest curricula" },
  ];

  const filteredAndSorted = useMemo(() => {
    let result = subjects.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.qualificationBody?.toLowerCase().includes(q) ||
          s.qualificationLevel?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (selectedDomain) {
        if (!s.domains.some((d) => d.domain.id === selectedDomain)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "sources":
          cmp = a._count.sources - b._count.sources;
          break;
        case "curricula":
          cmp = a._count.curricula - b._count.curricula;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [subjects, search, selectedDomain, sortBy, sortDir]);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <SourcePageHeader
        title="Subjects"
        description="Group content sources under teaching topics. Upload documents, set trust, generate curricula."
        count={subjects.length}
      />

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px",
          background: "var(--status-error-bg)",
          color: "var(--status-error-text)",
          borderRadius: 8,
          marginBottom: 20,
          border: "1px solid var(--status-error-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", textDecoration: "underline" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search subjects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            fontSize: 13,
            width: 260,
            background: "var(--surface-primary)",
            color: "var(--text-primary)",
          }}
        />

        <FancySelect
          value={selectedDomain}
          onChange={setSelectedDomain}
          placeholder="All domains"
          searchable={domains.length > 5}
          clearable={!!selectedDomain}
          style={{ minWidth: 160 }}
          options={[
            { value: "", label: "All domains" },
            ...domains.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />

        <FancySelect
          value={`${sortBy}-${sortDir}`}
          onChange={(v) => {
            const parts = v.split("-");
            const newDir = parts.pop() as "asc" | "desc";
            const newSort = parts.join("-") as SortOption;
            setSortBy(newSort);
            setSortDir(newDir);
          }}
          searchable={false}
          style={{ minWidth: 150 }}
          options={sortOptions}
        />

        <div style={{ flex: 1 }} />

        {isOperator && (
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              background: "var(--button-primary-bg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            + New Subject
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading...</div>
      ) : filteredAndSorted.length === 0 ? (
        <div style={{
          padding: 40,
          textAlign: "center",
          borderRadius: 12,
          border: "1px solid var(--border-default)",
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
            {search || selectedDomain ? "No subjects match your filters" : "No subjects yet"}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {search || selectedDomain
              ? "Try different search terms or filters"
              : "Create a subject to start grouping your content sources."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {filteredAndSorted.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/x/subjects/${s.id}`)}
              style={{
                background: "var(--surface-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                padding: 12,
                cursor: "pointer",
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--button-primary-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            >
              {/* Name + Trust Badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                }}>
                  {s.name}
                </span>
                <TrustBadge level={s.defaultTrustLevel} />
              </div>

              {/* Qualification info */}
              {s.qualificationLevel && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  {s.qualificationLevel}
                  {s.qualificationBody && ` \u2014 ${s.qualificationBody}`}
                </div>
              )}

              {/* Description */}
              {s.description && (
                <p style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {s.description}
                </p>
              )}

              {/* Domain pills */}
              {s.domains.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {s.domains.map((d) => (
                    <DomainPill key={d.domain.id} label={d.domain.name} size="compact" />
                  ))}
                </div>
              )}

              {/* Stats row */}
              <div style={{
                display: "flex",
                gap: 12,
                paddingTop: 8,
                borderTop: "1px solid var(--border-default)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}>
                <span><strong style={{ color: "var(--text-primary)" }}>{s._count.sources}</strong> sources</span>
                <span><strong style={{ color: "var(--text-primary)" }}>{s._count.curricula}</strong> curricula</span>
                {s.lessonPlanSessions > 0 && (
                  <span><strong style={{ color: "var(--text-primary)" }}>{s.lessonPlanSessions}</strong> sessions</span>
                )}
              </div>

              {/* Deactivate action */}
              {isOperator && s.isActive && (
                <div
                  style={{ paddingTop: 8, marginTop: 8, borderTop: "1px solid var(--border-default)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {confirmDeactivateId === s.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ color: "var(--status-error-text)" }}>Deactivate?</span>
                      <button
                        onClick={() => handleDeactivate(s.id)}
                        disabled={deactivating}
                        className="hf-btn hf-btn-destructive"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        {deactivating ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeactivateId(null)}
                        className="hf-btn hf-btn-secondary"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeactivateId(s.id)}
                      className="hf-btn-ghost"
                      style={{ padding: 0, fontSize: 11 }}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Subject Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            style={{
              background: "var(--surface-primary)",
              borderRadius: 12,
              padding: 24,
              width: 500,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
              New Subject
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "var(--text-muted)" }}>
              Create a new teaching subject
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Name *</label>
                <input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug || newSlug === autoSlug(newName)) setNewSlug(autoSlug(e.target.value));
                  }}
                  placeholder="Food Safety Level 2"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Slug</label>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="food-safety-l2"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)",
                  }}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this subject covers..."
                  rows={2}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)", resize: "vertical",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Default Trust Level</label>
                <select
                  value={newTrustLevel}
                  onChange={(e) => setNewTrustLevel(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)",
                  }}
                >
                  {TRUST_LEVELS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Qualification Level</label>
                <input
                  value={newQualLevel}
                  onChange={(e) => setNewQualLevel(e.target.value)}
                  placeholder="Level 2"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Qualification Body</label>
                <input
                  value={newQualBody}
                  onChange={(e) => setNewQualBody(e.target.value)}
                  placeholder="Highfield, CII"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Qualification Ref</label>
                <input
                  value={newQualRef}
                  onChange={(e) => setNewQualRef(e.target.value)}
                  placeholder="Highfield L2 Food Safety"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default)", fontSize: 14,
                    background: "var(--surface-primary)", color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                disabled={creating}
                style={{
                  padding: "10px 20px", borderRadius: 6,
                  border: "1px solid var(--border-default)", background: "var(--surface-secondary)",
                  color: "var(--text-primary)", fontWeight: 500, cursor: "pointer", fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                style={{
                  padding: "10px 20px", borderRadius: 6,
                  border: "none", background: "var(--button-primary-bg)",
                  color: "white", fontWeight: 600, cursor: creating ? "wait" : "pointer",
                  opacity: creating || !newName.trim() ? 0.5 : 1, fontSize: 14,
                }}
              >
                {creating ? "Creating..." : "Create & Open"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
