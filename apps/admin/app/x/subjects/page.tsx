"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SourcePageHeader } from "@/components/shared/SourcePageHeader";
import { FancySelect } from "@/components/shared/FancySelect";
import { DomainPill } from "@/src/components/shared/EntityPill";
import { useSession } from "next-auth/react";
import "./subjects.css";

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
      className="subj-trust-badge"
      style={{
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
    <div className="hf-page-container">
      <SourcePageHeader
        title="Subjects"
        description="Group content sources under teaching topics. Upload documents, set trust, generate curricula."
        count={subjects.length}
      />

      {/* Error */}
      {error && (
        <div className="subj-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="subj-error-dismiss">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="subj-filter-bar">
        <input
          ref={searchRef}
          type="text"
          placeholder="Search subjects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="subj-search-input"
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

        <div className="subj-spacer" />

        {isOperator && (
          <button onClick={() => setShowCreateModal(true)} className="subj-create-btn">
            + New Subject
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="subj-loading">Loading...</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="subj-empty">
          <div className="subj-empty-title">
            {search || selectedDomain ? "No subjects match your filters" : "No subjects yet"}
          </div>
          <div className="subj-empty-desc">
            {search || selectedDomain
              ? "Try different search terms or filters"
              : "Create a subject to start grouping your content sources."}
          </div>
        </div>
      ) : (
        <div className="subj-grid">
          {filteredAndSorted.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/x/subjects/${s.id}`)}
              className="subj-card"
            >
              {/* Name + Trust Badge */}
              <div className="subj-card-header">
                <span className="subj-card-name">
                  {s.name}
                </span>
                <TrustBadge level={s.defaultTrustLevel} />
              </div>

              {/* Qualification info */}
              {s.qualificationLevel && (
                <div className="subj-card-qual">
                  {s.qualificationLevel}
                  {s.qualificationBody && ` \u2014 ${s.qualificationBody}`}
                </div>
              )}

              {/* Description */}
              {s.description && (
                <p className="subj-card-desc">
                  {s.description}
                </p>
              )}

              {/* Domain pills */}
              {s.domains.length > 0 && (
                <div className="subj-card-domains">
                  {s.domains.map((d) => (
                    <DomainPill key={d.domain.id} label={d.domain.name} size="compact" />
                  ))}
                </div>
              )}

              {/* Stats row */}
              <div className="subj-card-stats">
                <span><strong>{s._count.sources}</strong> sources</span>
                <span><strong>{s._count.curricula}</strong> curricula</span>
                {s.lessonPlanSessions > 0 && (
                  <span><strong>{s.lessonPlanSessions}</strong> sessions</span>
                )}
              </div>

              {/* Deactivate action */}
              {isOperator && s.isActive && (
                <div
                  className="subj-card-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {confirmDeactivateId === s.id ? (
                    <div className="subj-deactivate-confirm">
                      <span className="subj-deactivate-label">Deactivate?</span>
                      <button
                        onClick={() => handleDeactivate(s.id)}
                        disabled={deactivating}
                        className="hf-btn hf-btn-destructive subj-deactivate-yes"
                      >
                        {deactivating ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeactivateId(null)}
                        className="hf-btn hf-btn-secondary subj-deactivate-cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeactivateId(s.id)}
                      className="hf-btn-ghost subj-deactivate-trigger"
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
          className="subj-modal-overlay"
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            className="subj-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="subj-modal-title">
              New Subject
            </h3>
            <p className="subj-modal-desc">
              Create a new teaching subject
            </p>

            <div className="subj-modal-grid">
              <div>
                <label className="subj-modal-label">Name *</label>
                <input
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug || newSlug === autoSlug(newName)) setNewSlug(autoSlug(e.target.value));
                  }}
                  placeholder="Food Safety Level 2"
                  className="subj-modal-input"
                />
              </div>
              <div>
                <label className="subj-modal-label">Slug</label>
                <input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="food-safety-l2"
                  className="subj-modal-input"
                />
              </div>
              <div className="subj-modal-full">
                <label className="subj-modal-label">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this subject covers..."
                  rows={2}
                  className="subj-modal-textarea"
                />
              </div>
              <div>
                <label className="subj-modal-label">Default Trust Level</label>
                <select
                  value={newTrustLevel}
                  onChange={(e) => setNewTrustLevel(e.target.value)}
                  className="subj-modal-select"
                >
                  {TRUST_LEVELS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="subj-modal-label">Qualification Level</label>
                <input
                  value={newQualLevel}
                  onChange={(e) => setNewQualLevel(e.target.value)}
                  placeholder="Level 2"
                  className="subj-modal-input"
                />
              </div>
              <div>
                <label className="subj-modal-label">Qualification Body</label>
                <input
                  value={newQualBody}
                  onChange={(e) => setNewQualBody(e.target.value)}
                  placeholder="Highfield, CII"
                  className="subj-modal-input"
                />
              </div>
              <div>
                <label className="subj-modal-label">Qualification Ref</label>
                <input
                  value={newQualRef}
                  onChange={(e) => setNewQualRef(e.target.value)}
                  placeholder="Highfield L2 Food Safety"
                  className="subj-modal-input"
                />
              </div>
            </div>

            <div className="subj-modal-footer">
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                disabled={creating}
                className="subj-modal-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className={`subj-modal-submit${creating ? " subj-modal-submit-creating" : ""}`}
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
