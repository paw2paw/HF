"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DraggableTabs, type TabDefinition } from "@/components/shared/DraggableTabs";
import { ReviewTabBadge } from "./_components/ReviewTabBadge";
import QuestionsPanel from "./_components/QuestionsPanel";
import VocabularyPanel from "./_components/VocabularyPanel";

// ── Types ──────────────────────────────────────────────

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
  isActive: boolean;
  createdAt: string;
  assertionCount: number;
  questionCount: number;
  vocabularyCount: number;
  questionReviewedCount: number;
  vocabularyReviewedCount: number;
  freshnessStatus: "valid" | "expiring" | "expired" | "unknown";
};

type Assertion = {
  id: string;
  assertion: string;
  category: string;
  tags: string[];
  chapter: string | null;
  section: string | null;
  pageRef: string | null;
  validFrom: string | null;
  validUntil: string | null;
  taxYear: string | null;
  examRelevance: number | null;
  learningOutcomeRef: string | null;
  depth: number | null;
  topicSlug: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewer: { id: string; name: string | null; email: string } | null;
  _count: { children: number };
};

// ── Constants ──────────────────────────────────────────

const TRUST_LEVELS = [
  { value: "REGULATORY_STANDARD", label: "L5 Regulatory Standard", color: "var(--trust-l5-text)", bg: "var(--trust-l5-bg)" },
  { value: "ACCREDITED_MATERIAL", label: "L4 Accredited Material", color: "var(--trust-l4-text)", bg: "var(--trust-l4-bg)" },
  { value: "PUBLISHED_REFERENCE", label: "L3 Published Reference", color: "var(--trust-l3-text)", bg: "var(--trust-l3-bg)" },
  { value: "EXPERT_CURATED", label: "L2 Expert Curated", color: "var(--trust-l2-text)", bg: "var(--trust-l2-bg)" },
  { value: "AI_ASSISTED", label: "L1 AI Assisted", color: "var(--trust-l1-text)", bg: "var(--trust-l1-bg)" },
  { value: "UNVERIFIED", label: "L0 Unverified", color: "var(--trust-l0-text)", bg: "var(--trust-l0-bg)" },
];

const CATEGORIES = [
  // Textbook categories
  { value: "fact", label: "Fact", color: "#2563EB", icon: "\u2139\uFE0F" },
  { value: "definition", label: "Definition", color: "#7C3AED", icon: "\uD83D\uDCD6" },
  { value: "threshold", label: "Threshold", color: "#D97706", icon: "\uD83D\uDCCF" },
  { value: "rule", label: "Rule", color: "#DC2626", icon: "\u26A0\uFE0F" },
  { value: "process", label: "Process", color: "#059669", icon: "\u2699\uFE0F" },
  { value: "example", label: "Example", color: "#6B7280", icon: "\uD83D\uDCC4" },
  // Worksheet categories
  { value: "question", label: "Question", color: "#2563EB", icon: "\u2753" },
  { value: "true_false", label: "True/False", color: "#0891B2", icon: "\u2696\uFE0F" },
  { value: "matching_exercise", label: "Matching", color: "#7C3AED", icon: "\uD83D\uDD17" },
  { value: "vocabulary_exercise", label: "Vocabulary", color: "#9333EA", icon: "\uD83D\uDCDA" },
  { value: "discussion_prompt", label: "Discussion", color: "#DB2777", icon: "\uD83D\uDCAC" },
  { value: "activity", label: "Activity", color: "#059669", icon: "\u270D\uFE0F" },
  { value: "information", label: "Information", color: "#6366F1", icon: "\uD83D\uDCD6" },
  { value: "reference", label: "Reference", color: "#D97706", icon: "\uD83D\uDCD1" },
  { value: "answer_key_item", label: "Answer Key", color: "#16A34A", icon: "\uD83D\uDD11" },
  // Curriculum categories
  { value: "learning_outcome", label: "Learning Outcome", color: "#2563EB", icon: "\uD83C\uDFAF" },
  { value: "assessment_criterion", label: "Assessment Criterion", color: "#059669", icon: "\uD83D\uDCCB" },
  { value: "range", label: "Range/Scope", color: "#D97706", icon: "\uD83D\uDCCF" },
  // Assessment categories
  { value: "answer", label: "Answer", color: "#16A34A", icon: "\u2705" },
  { value: "matching_item", label: "Matching Item", color: "#7C3AED", icon: "\uD83D\uDD17" },
  { value: "misconception", label: "Misconception", color: "#DC2626", icon: "\u274C" },
  { value: "mark_scheme", label: "Mark Scheme", color: "#EA580C", icon: "\uD83D\uDCDD" },
  // Example categories
  { value: "concept", label: "Concept", color: "#2563EB", icon: "\uD83D\uDCA1" },
  { value: "observation", label: "Observation", color: "#059669", icon: "\uD83D\uDC41\uFE0F" },
  { value: "discussion_point", label: "Discussion Point", color: "#7C3AED", icon: "\uD83D\uDCAC" },
  { value: "context", label: "Context", color: "#6B7280", icon: "\uD83D\uDCCC" },
];

const DOCUMENT_TYPES: Record<string, { label: string; icon: string }> = {
  TEXTBOOK: { label: "Textbook", icon: "\uD83D\uDCD6" },
  CURRICULUM: { label: "Curriculum", icon: "\uD83C\uDF93" },
  WORKSHEET: { label: "Worksheet", icon: "\uD83D\uDCDD" },
  COMPREHENSION: { label: "Comprehension", icon: "\uD83D\uDCDA" },
  EXAMPLE: { label: "Example", icon: "\uD83D\uDCC4" },
  ASSESSMENT: { label: "Assessment", icon: "\u2705" },
  REFERENCE: { label: "Reference", icon: "\uD83D\uDCD1" },
  LESSON_PLAN: { label: "Lesson Plan", icon: "\uD83D\uDCCB" },
  POLICY_DOCUMENT: { label: "Policy Document", icon: "\uD83C\uDFDB\uFE0F" },
};

const PAGE_SIZE = 50;

// ── Small Components ───────────────────────────────────

function TrustBadge({ level }: { level: string }) {
  const cfg = TRUST_LEVELS.find((t) => t.value === level) || TRUST_LEVELS[5];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: cfg.color, backgroundColor: cfg.bg, border: `1px solid color-mix(in srgb, ${cfg.color} 20%, transparent)` }}>
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORIES.find((c) => c.value === category);
  const color = cfg?.color || "#6B7280";
  const icon = cfg?.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, textTransform: "uppercase" }}>
      {icon && <span style={{ fontSize: 11, lineHeight: 1 }}>{icon}</span>}
      {cfg?.label || category}
    </span>
  );
}

function ReviewBadge({ reviewed }: { reviewed: boolean }) {
  return reviewed ? (
    <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Reviewed</span>
  ) : (
    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pending</span>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function SourceDetailPage() {
  const { sourceId } = useParams<{ sourceId: string }>();
  const router = useRouter();

  // Source data
  const [source, setSource] = useState<ContentSource | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);

  // Assertions data
  const [assertions, setAssertions] = useState<Assertion[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [assertionsLoading, setAssertionsLoading] = useState(true);

  // Filters + pagination
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterReview, setFilterReview] = useState("");
  const [sortBy, setSortBy] = useState("chapter");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  // Selection for bulk actions
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Expanded row + edit mode
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  // Error / success feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState("assertions");
  const [qTotal, setQTotal] = useState(0);
  const [qReviewed, setQReviewed] = useState(0);
  const [vTotal, setVTotal] = useState(0);
  const [vReviewed, setVReviewed] = useState(0);

  // ── Fetch source detail ──
  const fetchSource = useCallback(async () => {
    try {
      const res = await fetch(`/api/content-sources/${sourceId}`);
      const data = await res.json();
      if (data.ok) setSource(data.source);
    } catch {
      // silent
    } finally {
      setSourceLoading(false);
    }
  }, [sourceId]);

  // ── Fetch assertions ──
  const fetchAssertions = useCallback(async () => {
    setAssertionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterCategory) params.set("category", filterCategory);
      if (filterReview) params.set("reviewed", filterReview);
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/content-sources/${sourceId}/assertions?${params}`);
      const data = await res.json();
      if (data.ok) {
        setAssertions(data.assertions);
        setTotal(data.total);
        setReviewedCount(data.reviewed);
        setReviewProgress(data.reviewProgress);
      }
    } catch {
      // silent
    } finally {
      setAssertionsLoading(false);
    }
  }, [sourceId, search, filterCategory, filterReview, sortBy, sortDir, page]);

  useEffect(() => { fetchSource(); }, [fetchSource]);
  useEffect(() => { fetchAssertions(); }, [fetchAssertions]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, filterCategory, filterReview, sortBy, sortDir]);

  // Clear feedback after delay
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // ── Bulk review ──
  const handleBulkReview = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/assertions/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assertionIds: [...selected] }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({ type: "success", message: `${data.updated} assertion${data.updated !== 1 ? "s" : ""} marked as reviewed` });
        setSelected(new Set());
        fetchAssertions();
      } else {
        setFeedback({ type: "error", message: data.error || "Bulk review failed" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Select all on current page ──
  const allOnPageSelected = assertions.length > 0 && assertions.every((a) => selected.has(a.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      assertions.forEach((a) => next.delete(a.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      assertions.forEach((a) => next.add(a.id));
      setSelected(next);
    }
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  // ── Sort toggle ──
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (sourceLoading) {
    return <p style={{ color: "var(--text-muted)", padding: 24 }}>Loading...</p>;
  }

  if (!source) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--status-error-text)" }}>Source not found</p>
        <Link href="/x/content-sources" style={{ color: "var(--accent-primary)", fontSize: 13 }}>Back to Content Sources</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/x/content-sources"
        style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}
      >
        <span style={{ fontSize: 16 }}>&larr;</span> Back to Content Sources
      </Link>

      {/* Source header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {source.name}
          </h1>
          <TrustBadge level={source.trustLevel} />
          {source.documentType && DOCUMENT_TYPES[source.documentType] && (
            <span
              title={source.documentTypeSource ? `Classified by: ${source.documentTypeSource}` : "Default"}
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
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: 12 }}>{DOCUMENT_TYPES[source.documentType].icon}</span>
              {DOCUMENT_TYPES[source.documentType].label}
              {source.documentTypeSource?.startsWith("ai:") && (
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>auto</span>
              )}
            </span>
          )}
          {!source.isActive && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--status-error-text)", padding: "2px 8px", borderRadius: 4, backgroundColor: "var(--status-error-bg)" }}>
              Inactive
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ fontFamily: "monospace" }}>{source.slug}</span>
          {source.publisherOrg && <span>{source.publisherOrg}</span>}
          {source.edition && <span>{source.edition}</span>}
          {source.publicationYear && <span>{source.publicationYear}</span>}
          <span>Created {new Date(source.createdAt).toLocaleDateString()}</span>
        </div>
        {source.description && (
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, maxWidth: 700 }}>
            {source.description}
          </p>
        )}

        {/* Aggregate review progress */}
        {(() => {
          const totalItems = (source.assertionCount || 0) + (qTotal || source.questionCount || 0) + (vTotal || source.vocabularyCount || 0);
          const totalReviewed = reviewedCount + (qReviewed || source.questionReviewedCount || 0) + (vReviewed || source.vocabularyReviewedCount || 0);
          const aggPct = totalItems > 0 ? Math.round((totalReviewed / totalItems) * 100) : 0;
          return (
            <div style={{ marginTop: 12, maxWidth: 500 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Review Progress
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {reviewedCount}/{source.assertionCount} points
                  {(source.questionCount || 0) > 0 && <> &middot; {qReviewed || source.questionReviewedCount || 0}/{qTotal || source.questionCount || 0} questions</>}
                  {(source.vocabularyCount || 0) > 0 && <> &middot; {vReviewed || source.vocabularyReviewedCount || 0}/{vTotal || source.vocabularyCount || 0} vocab</>}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface-tertiary)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  borderRadius: 3,
                  background: aggPct === 100
                    ? "#16a34a"
                    : "linear-gradient(90deg, var(--accent-primary), #6366f1)",
                  width: `${aggPct}%`,
                  transition: "width 0.5s ease-out",
                }} />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          padding: "8px 16px",
          marginBottom: 12,
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          ...(feedback.type === "error"
            ? { background: "var(--status-error-bg)", color: "var(--status-error-text)", border: "1px solid #FFCDD2" }
            : { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #C8E6C9" }),
        }}>
          {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <DraggableTabs
        storageKey="source-detail-tabs"
        tabs={[
          {
            id: "assertions",
            label: <span>Teaching Points <ReviewTabBadge reviewed={reviewedCount} total={total} /></span>,
            count: source.assertionCount || null,
          },
          ...((source.questionCount || 0) > 0 ? [{
            id: "questions",
            label: <span>Questions <ReviewTabBadge reviewed={qReviewed || source.questionReviewedCount || 0} total={qTotal || source.questionCount || 0} /></span>,
            count: source.questionCount || null,
          }] : []),
          ...((source.vocabularyCount || 0) > 0 ? [{
            id: "vocabulary",
            label: <span>Vocabulary <ReviewTabBadge reviewed={vReviewed || source.vocabularyReviewedCount || 0} total={vTotal || source.vocabularyCount || 0} /></span>,
            count: source.vocabularyCount || null,
          }] : []),
        ] as TabDefinition[]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        containerStyle={{ marginBottom: 16 }}
      />

      {/* ── Assertions Tab ── */}
      {activeTab === "assertions" && (
        <>
          {/* Controls row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search assertions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13, width: 220,
              }}
            />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13,
              }}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select
              value={filterReview}
              onChange={(e) => setFilterReview(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)",
                backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13,
              }}
            >
              <option value="">All review status</option>
              <option value="true">Reviewed</option>
              <option value="false">Pending review</option>
            </select>

            {/* Bulk action */}
            {selected.size > 0 && (
              <button
                onClick={handleBulkReview}
                disabled={bulkLoading}
                style={{
                  padding: "7px 14px", borderRadius: 6, border: "none",
                  background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 600,
                  cursor: bulkLoading ? "not-allowed" : "pointer",
                  opacity: bulkLoading ? 0.6 : 1,
                }}
              >
                {bulkLoading ? "Reviewing..." : `Mark ${selected.size} Reviewed`}
              </button>
            )}

            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
              {total} assertion{total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Assertions table */}
          {assertionsLoading && assertions.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading assertions...</p>
          ) : assertions.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {search || filterCategory || filterReview ? "No assertions match your filters." : "No assertions extracted yet."}
            </p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                      <th style={{ width: 36, padding: "8px 4px 8px 8px" }}>
                        <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                      </th>
                      <th style={thStyle}>Assertion</th>
                      <SortTh field="category" current={sortBy} dir={sortDir} onClick={handleSort}>Category</SortTh>
                      <SortTh field="chapter" current={sortBy} dir={sortDir} onClick={handleSort}>Location</SortTh>
                      <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assertions.map((a) => (
                      <AssertionRow
                        key={a.id}
                        assertion={a}
                        sourceId={sourceId}
                        isSelected={selected.has(a.id)}
                        isExpanded={expandedId === a.id}
                        isEditing={editId === a.id}
                        onToggleSelect={() => toggleSelect(a.id)}
                        onToggleExpand={() => {
                          setExpandedId(expandedId === a.id ? null : a.id);
                          if (editId === a.id) setEditId(null);
                        }}
                        onStartEdit={() => setEditId(a.id)}
                        onCancelEdit={() => setEditId(null)}
                        onSaved={() => {
                          setEditId(null);
                          setFeedback({ type: "success", message: "Assertion updated" });
                          fetchAssertions();
                        }}
                        onDeleted={() => {
                          setExpandedId(null);
                          setEditId(null);
                          setFeedback({ type: "success", message: "Assertion deleted" });
                          fetchAssertions();
                        }}
                        onReviewed={() => {
                          setFeedback({ type: "success", message: "Marked as reviewed" });
                          fetchAssertions();
                        }}
                        onError={(msg) => setFeedback({ type: "error", message: msg })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    style={paginationBtnStyle(page === 0)}
                  >
                    Prev
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    style={paginationBtnStyle(page >= totalPages - 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Questions Tab ── */}
      {activeTab === "questions" && (
        <QuestionsPanel
          sourceId={sourceId}
          onCountChange={(t, r) => { setQTotal(t); setQReviewed(r); }}
        />
      )}

      {/* ── Vocabulary Tab ── */}
      {activeTab === "vocabulary" && (
        <VocabularyPanel
          sourceId={sourceId}
          onCountChange={(t, r) => { setVTotal(t); setVReviewed(r); }}
        />
      )}
    </div>
  );
}

// ── Sortable Table Header ──────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  color: "var(--text-muted)",
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: "nowrap",
};

function SortTh({
  field,
  current,
  dir,
  onClick,
  children,
}: {
  field: string;
  current: string;
  dir: "asc" | "desc";
  onClick: (field: string) => void;
  children: React.ReactNode;
}) {
  const isActive = current === field;
  return (
    <th
      onClick={() => onClick(field)}
      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
    >
      {children}
      {isActive && <span style={{ marginLeft: 4 }}>{dir === "asc" ? "\u25B2" : "\u25BC"}</span>}
    </th>
  );
}

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid var(--border-default)",
    background: disabled ? "transparent" : "var(--surface-primary)",
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    fontSize: 12,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

// ── Assertion Row ──────────────────────────────────────

function AssertionRow({
  assertion: a,
  sourceId,
  isSelected,
  isExpanded,
  isEditing,
  onToggleSelect,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
  onReviewed,
  onError,
}: {
  assertion: Assertion;
  sourceId: string;
  isSelected: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onReviewed: () => void;
  onError: (msg: string) => void;
}) {
  const isReviewed = !!a.reviewedAt;
  const truncated = a.assertion.length > 120 ? a.assertion.slice(0, 120) + "..." : a.assertion;
  const location = [a.chapter, a.section, a.pageRef].filter(Boolean).join(" / ");

  return (
    <>
      <tr
        onClick={(e) => {
          // Don't toggle if clicking checkbox or buttons
          if ((e.target as HTMLElement).closest("input, button")) return;
          onToggleExpand();
        }}
        style={{
          borderBottom: isExpanded ? "none" : "1px solid var(--border-subtle)",
          cursor: "pointer",
          background: isSelected
            ? "color-mix(in srgb, var(--accent-primary) 6%, transparent)"
            : isExpanded
              ? "color-mix(in srgb, var(--accent-primary) 3%, transparent)"
              : "transparent",
        }}
      >
        <td style={{ padding: "8px 4px 8px 8px", width: 36 }}>
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </td>
        <td style={{ padding: "8px 10px", color: "var(--text-primary)", lineHeight: 1.4 }}>
          {truncated}
          {a.tags.length > 0 && (
            <span style={{ marginLeft: 8, display: "inline-flex", gap: 3 }}>
              {a.tags.slice(0, 3).map((tag) => (
                <span key={tag} style={{ fontSize: 10, padding: "1px 4px", borderRadius: 3, background: "var(--surface-tertiary)", color: "var(--text-muted)" }}>
                  {tag}
                </span>
              ))}
              {a.tags.length > 3 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{a.tags.length - 3}</span>}
            </span>
          )}
        </td>
        <td style={{ padding: "8px 10px" }}>
          <CategoryBadge category={a.category} />
        </td>
        <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {location || "-"}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "center" }}>
          <ReviewBadge reviewed={isReviewed} />
        </td>
      </tr>

      {/* Expanded detail / edit */}
      {isExpanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={5} style={{ padding: "0 10px 16px 46px" }}>
            {isEditing ? (
              <EditForm
                assertion={a}
                sourceId={sourceId}
                onSaved={onSaved}
                onCancel={onCancelEdit}
                onDeleted={onDeleted}
                onError={onError}
              />
            ) : (
              <DetailView
                assertion={a}
                sourceId={sourceId}
                onEdit={onStartEdit}
                onReviewed={onReviewed}
                onError={onError}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Detail View (expanded, read-only) ──────────────────

function DetailView({
  assertion: a,
  sourceId,
  onEdit,
  onReviewed,
  onError,
}: {
  assertion: Assertion;
  sourceId: string;
  onEdit: () => void;
  onReviewed: () => void;
  onError: (msg: string) => void;
}) {
  const [reviewing, setReviewing] = useState(false);

  const handleMarkReviewed = async () => {
    setReviewing(true);
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/assertions/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markReviewed: true }),
      });
      const data = await res.json();
      if (data.ok) {
        onReviewed();
      } else {
        onError(data.error || "Failed to mark reviewed");
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-primary)" };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Full assertion text */}
      <div style={{ ...valueStyle, lineHeight: 1.5, marginBottom: 12, whiteSpace: "pre-wrap" }}>
        {a.assertion}
      </div>

      {/* Metadata grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px 20px", marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Category</div>
          <CategoryBadge category={a.category} />
        </div>
        <div>
          <div style={labelStyle}>Tags</div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {a.tags.length > 0
              ? a.tags.map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, background: "var(--surface-tertiary)", color: "var(--text-secondary)" }}>
                    {t}
                  </span>
                ))
              : <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>none</span>
            }
          </div>
        </div>
        {(a.chapter || a.section || a.pageRef) && (
          <div>
            <div style={labelStyle}>Location</div>
            <div style={valueStyle}>{[a.chapter, a.section, a.pageRef].filter(Boolean).join(" / ")}</div>
          </div>
        )}
        {a.taxYear && (
          <div>
            <div style={labelStyle}>Tax Year</div>
            <div style={valueStyle}>{a.taxYear}</div>
          </div>
        )}
        {a.examRelevance !== null && (
          <div>
            <div style={labelStyle}>Exam Relevance</div>
            <div style={valueStyle}>{Math.round(a.examRelevance * 100)}%</div>
          </div>
        )}
        {a.learningOutcomeRef && (
          <div>
            <div style={labelStyle}>Learning Outcome</div>
            <div style={valueStyle}>{a.learningOutcomeRef}</div>
          </div>
        )}
        {a.topicSlug && (
          <div>
            <div style={labelStyle}>Topic</div>
            <div style={{ ...valueStyle, fontFamily: "monospace", fontSize: 12 }}>{a.topicSlug}</div>
          </div>
        )}
        <div>
          <div style={labelStyle}>Review Status</div>
          {a.reviewedAt ? (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>Reviewed</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                by {a.reviewer?.name || a.reviewer?.email || "unknown"} on {new Date(a.reviewedAt).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pending</span>
          )}
        </div>
        {a._count.children > 0 && (
          <div>
            <div style={labelStyle}>Children</div>
            <div style={valueStyle}>{a._count.children} sub-assertions</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} style={actionBtnStyle}>Edit</button>
        {!a.reviewedAt && (
          <button
            onClick={handleMarkReviewed}
            disabled={reviewing}
            style={{ ...actionBtnStyle, background: "#16a34a", color: "#fff", border: "none", opacity: reviewing ? 0.6 : 1 }}
          >
            {reviewing ? "..." : "Mark Reviewed"}
          </button>
        )}
      </div>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: "5px 14px",
  borderRadius: 6,
  border: "1px solid var(--border-default)",
  background: "var(--surface-primary)",
  color: "var(--text-primary)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

// ── Edit Form ──────────────────────────────────────────

function EditForm({
  assertion: a,
  sourceId,
  onSaved,
  onCancel,
  onDeleted,
  onError,
}: {
  assertion: Assertion;
  sourceId: string;
  onSaved: () => void;
  onCancel: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    assertion: a.assertion,
    category: a.category,
    tags: a.tags.join(", "),
    chapter: a.chapter || "",
    section: a.section || "",
    pageRef: a.pageRef || "",
    validFrom: a.validFrom ? a.validFrom.split("T")[0] : "",
    validUntil: a.validUntil ? a.validUntil.split("T")[0] : "",
    taxYear: a.taxYear || "",
    examRelevance: a.examRelevance !== null ? String(a.examRelevance) : "",
    learningOutcomeRef: a.learningOutcomeRef || "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async (markReviewed = false) => {
    setSaving(true);
    try {
      const body: Record<string, any> = {
        assertion: form.assertion,
        category: form.category,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        chapter: form.chapter || null,
        section: form.section || null,
        pageRef: form.pageRef || null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        taxYear: form.taxYear || null,
        learningOutcomeRef: form.learningOutcomeRef || null,
        examRelevance: form.examRelevance ? parseFloat(form.examRelevance) : null,
      };
      if (markReviewed) body.markReviewed = true;

      const res = await fetch(`/api/content-sources/${sourceId}/assertions/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        onSaved();
      } else {
        onError(data.error || "Save failed");
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/assertions/${a.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        onDeleted();
      } else {
        onError(data.error || "Delete failed");
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: "5px 8px", borderRadius: 4, border: "1px solid var(--border-default)",
    backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13, width: "100%",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 2 };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Assertion text */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Assertion Text</div>
        <textarea
          value={form.assertion}
          onChange={(e) => setForm({ ...form, assertion: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
        />
      </div>

      {/* Category + Tags row */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>Category</div>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={inputStyle}
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <div style={labelStyle}>Tags (comma-separated)</div>
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            style={inputStyle}
            placeholder="tax, isa, allowance"
          />
        </div>
      </div>

      {/* Location row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 10, marginBottom: 10 }}>
        <div>
          <div style={labelStyle}>Chapter</div>
          <input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} style={inputStyle} placeholder="Chapter 3" />
        </div>
        <div>
          <div style={labelStyle}>Section</div>
          <input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} style={inputStyle} placeholder="3.2 ISA Allowances" />
        </div>
        <div>
          <div style={labelStyle}>Page</div>
          <input value={form.pageRef} onChange={(e) => setForm({ ...form, pageRef: e.target.value })} style={inputStyle} placeholder="p.47" />
        </div>
      </div>

      {/* Validity + exam row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 120px 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={labelStyle}>Valid From</div>
          <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Valid Until</div>
          <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={labelStyle}>Tax Year</div>
          <input value={form.taxYear} onChange={(e) => setForm({ ...form, taxYear: e.target.value })} style={inputStyle} placeholder="2024/25" />
        </div>
        <div>
          <div style={labelStyle}>Exam Rel.</div>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={form.examRelevance}
            onChange={(e) => setForm({ ...form, examRelevance: e.target.value })}
            style={inputStyle}
            placeholder="0.0-1.0"
          />
        </div>
        <div>
          <div style={labelStyle}>LO Reference</div>
          <input value={form.learningOutcomeRef} onChange={(e) => setForm({ ...form, learningOutcomeRef: e.target.value })} style={inputStyle} placeholder="R04-LO2-AC2.3" />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          style={{ ...actionBtnStyle, background: "var(--accent-primary)", color: "#fff", border: "none", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {!a.reviewedAt && (
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            style={{ ...actionBtnStyle, background: "#16a34a", color: "#fff", border: "none", opacity: saving ? 0.6 : 1 }}
          >
            Save & Mark Reviewed
          </button>
        )}
        <button onClick={onCancel} style={actionBtnStyle}>Cancel</button>

        {/* Delete (with confirmation) */}
        <div style={{ marginLeft: "auto" }}>
          {confirmDelete ? (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--status-error-text)" }}>
                {a._count.children > 0 ? `Has ${a._count.children} children` : "Delete permanently?"}
              </span>
              {a._count.children === 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ ...actionBtnStyle, background: "var(--status-error-text)", color: "#fff", border: "none", fontSize: 11, opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? "..." : "Confirm"}
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ ...actionBtnStyle, fontSize: 11 }}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ ...actionBtnStyle, color: "var(--status-error-text)", borderColor: "#FFCDD2" }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
