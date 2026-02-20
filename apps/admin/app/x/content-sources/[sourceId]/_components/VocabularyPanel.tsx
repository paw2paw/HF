"use client";

import { useState, useEffect, useCallback } from "react";

type VocabEntry = {
  id: string;
  term: string;
  definition: string;
  partOfSpeech: string | null;
  topic: string | null;
  exampleUsage: string | null;
  pronunciation: string | null;
  difficulty: number | null;
  tags: string[];
  chapter: string | null;
  pageRef: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewer: { id: string; name: string | null; email: string } | null;
};

const PAGE_SIZE = 50;

export default function VocabularyPanel({
  sourceId,
  onCountChange,
}: {
  sourceId: string;
  onCountChange?: (total: number, reviewed: number) => void;
}) {
  const [vocabulary, setVocabulary] = useState<VocabEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterReview, setFilterReview] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchVocabulary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterReview) params.set("reviewed", filterReview);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/content-sources/${sourceId}/vocabulary?${params}`);
      const data = await res.json();
      if (data.ok) {
        setVocabulary(data.vocabulary);
        setTotal(data.total);
        setReviewedCount(data.reviewedCount);
        onCountChange?.(data.total, data.reviewedCount);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [sourceId, search, filterReview, page, onCountChange]);

  useEffect(() => { fetchVocabulary(); }, [fetchVocabulary]);
  useEffect(() => { setPage(0); }, [search, filterReview]);
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const handleBulkReview = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/vocabulary/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocabularyIds: [...selected] }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({ type: "success", message: `${data.updated} term${data.updated !== 1 ? "s" : ""} marked as reviewed` });
        setSelected(new Set());
        fetchVocabulary();
      } else {
        setFeedback({ type: "error", message: data.error || "Bulk review failed" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleMarkReviewed = async (id: string) => {
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/vocabulary/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markReviewed: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({ type: "success", message: "Marked as reviewed" });
        fetchVocabulary();
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/vocabulary/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setExpandedId(null);
        setFeedback({ type: "success", message: "Term deleted" });
        fetchVocabulary();
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const allOnPageSelected = vocabulary.length > 0 && vocabulary.every((v) => selected.has(v.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      vocabulary.forEach((v) => next.delete(v.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      vocabulary.forEach((v) => next.add(v.id));
      setSelected(next);
    }
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const reviewPct = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;

  return (
    <div>
      {/* Review progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
            {reviewedCount}/{total} reviewed ({reviewPct}%)
          </span>
          {reviewPct === 100 && total > 0 && (
            <span style={{ fontSize: 11, color: "var(--status-success-text, #16a34a)", fontWeight: 600 }}>{"\u2713"} All reviewed</span>
          )}
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "var(--surface-tertiary)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: reviewPct === 100 ? "#16a34a" : "linear-gradient(90deg, var(--accent-primary), #6366f1)",
            width: `${reviewPct}%`, transition: "width 0.3s ease-out",
          }} />
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: "8px 16px", marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 500,
          ...(feedback.type === "error"
            ? { background: "var(--status-error-bg)", color: "var(--status-error-text)", border: "1px solid #FFCDD2" }
            : { background: "#E8F5E9", color: "#2E7D32", border: "1px solid #C8E6C9" }),
        }}>
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text" placeholder="Search terms..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13, width: 220 }}
        />
        <select value={filterReview} onChange={(e) => setFilterReview(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
          <option value="">All review status</option>
          <option value="true">Reviewed</option>
          <option value="false">Pending review</option>
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkReview} disabled={bulkLoading}
            style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 600, cursor: bulkLoading ? "not-allowed" : "pointer", opacity: bulkLoading ? 0.6 : 1 }}>
            {bulkLoading ? "Reviewing..." : `Mark ${selected.size} Reviewed`}
          </button>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          {total} term{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading && vocabulary.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading vocabulary...</p>
      ) : vocabulary.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {search || filterReview ? "No terms match your filters." : "No vocabulary extracted yet."}
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
                  <th style={thStyle}>Term</th>
                  <th style={thStyle}>Definition</th>
                  <th style={{ ...thStyle, width: 100 }}>Topic</th>
                  <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Review</th>
                </tr>
              </thead>
              <tbody>
                {vocabulary.map((v) => {
                  const isExpanded = expandedId === v.id;
                  const isSelected = selected.has(v.id);
                  const isReviewed = !!v.reviewedAt;

                  return (
                    <VocabRow key={v.id} entry={v} isExpanded={isExpanded} isSelected={isSelected} isReviewed={isReviewed}
                      onToggleSelect={() => toggleSelect(v.id)}
                      onToggleExpand={() => setExpandedId(isExpanded ? null : v.id)}
                      onMarkReviewed={() => handleMarkReviewed(v.id)}
                      onDelete={() => handleDelete(v.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                style={paginationBtnStyle(page === 0)}>Prev</button>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                style={paginationBtnStyle(page >= totalPages - 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────

function VocabRow({ entry: v, isExpanded, isSelected, isReviewed, onToggleSelect, onToggleExpand, onMarkReviewed, onDelete }: {
  entry: VocabEntry; isExpanded: boolean; isSelected: boolean; isReviewed: boolean;
  onToggleSelect: () => void; onToggleExpand: () => void; onMarkReviewed: () => void; onDelete: () => void;
}) {
  const defTruncated = v.definition.length > 80 ? v.definition.slice(0, 80) + "..." : v.definition;

  return (
    <>
      <tr
        onClick={(e) => { if ((e.target as HTMLElement).closest("input, button")) return; onToggleExpand(); }}
        style={{
          borderBottom: isExpanded ? "none" : "1px solid var(--border-subtle)",
          cursor: "pointer",
          background: isSelected ? "color-mix(in srgb, var(--accent-primary) 6%, transparent)"
            : isExpanded ? "color-mix(in srgb, var(--accent-primary) 3%, transparent)" : "transparent",
        }}
      >
        <td style={{ padding: "8px 4px 8px 8px", width: 36 }}>
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </td>
        <td style={{ padding: "8px 10px", color: "var(--text-primary)", fontWeight: 600 }}>
          {v.term}
          {v.partOfSpeech && (
            <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>({v.partOfSpeech})</span>
          )}
        </td>
        <td style={{ padding: "8px 10px", color: "var(--text-secondary)", lineHeight: 1.4 }}>{defTruncated}</td>
        <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-muted)" }}>{v.topic || "\u2014"}</td>
        <td style={{ padding: "8px 10px", textAlign: "center" }}>
          {isReviewed
            ? <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Reviewed</span>
            : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pending</span>}
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={5} style={{ padding: "0 10px 16px 46px" }}>
            <VocabDetail entry={v} onMarkReviewed={onMarkReviewed} onDelete={onDelete} />
          </td>
        </tr>
      )}
    </>
  );
}

function VocabDetail({ entry: v, onMarkReviewed, onDelete }: { entry: VocabEntry; onMarkReviewed: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isReviewed = !!v.reviewedAt;
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-primary)" };

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ ...valueStyle, lineHeight: 1.5, marginBottom: 12 }}>
        <strong>{v.term}</strong>
        {v.partOfSpeech && <span style={{ color: "var(--text-muted)" }}> ({v.partOfSpeech})</span>}
        : {v.definition}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px 20px", marginBottom: 12 }}>
        {v.exampleUsage && (
          <div style={{ gridColumn: "span 2" }}>
            <div style={labelStyle}>Example Usage</div>
            <div style={{ ...valueStyle, fontStyle: "italic", lineHeight: 1.5 }}>{v.exampleUsage}</div>
          </div>
        )}
        {v.pronunciation && (
          <div>
            <div style={labelStyle}>Pronunciation</div>
            <div style={valueStyle}>{v.pronunciation}</div>
          </div>
        )}
        {v.difficulty && (
          <div>
            <div style={labelStyle}>Difficulty</div>
            <div style={valueStyle}>{v.difficulty}/5</div>
          </div>
        )}
        {v.topic && (
          <div>
            <div style={labelStyle}>Topic</div>
            <div style={valueStyle}>{v.topic}</div>
          </div>
        )}
        {(v.chapter || v.pageRef) && (
          <div>
            <div style={labelStyle}>Location</div>
            <div style={valueStyle}>{[v.chapter, v.pageRef].filter(Boolean).join(" / ")}</div>
          </div>
        )}
        {v.tags.length > 0 && (
          <div>
            <div style={labelStyle}>Tags</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {v.tags.map((t) => (
                <span key={t} style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, background: "var(--surface-tertiary)", color: "var(--text-secondary)" }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={labelStyle}>Review Status</div>
          {v.reviewedAt ? (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "#16a34a", fontWeight: 600 }}>Reviewed</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                by {v.reviewer?.name || v.reviewer?.email || "unknown"} on {new Date(v.reviewedAt).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pending</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        {!isReviewed && (
          <button onClick={onMarkReviewed}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Mark Reviewed
          </button>
        )}
        <div style={{ marginLeft: "auto" }}>
          {confirmDelete ? (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--status-error-text)" }}>Delete permanently?</span>
              <button onClick={onDelete}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--status-error-text)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--surface-primary)", color: "var(--text-primary)", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #FFCDD2", background: "var(--surface-primary)", color: "var(--status-error-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
};

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border-default)",
    background: disabled ? "transparent" : "var(--surface-primary)",
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    fontSize: 12, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
  };
}
