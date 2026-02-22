"use client";

import { useState, useEffect, useCallback } from "react";
import './vocabulary-panel.css';

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
      <div className="vp-progress-section">
        <div className="vp-progress-header">
          <span className="vp-progress-label">
            {reviewedCount}/{total} reviewed ({reviewPct}%)
          </span>
          {reviewPct === 100 && total > 0 && (
            <span className="vp-all-reviewed">{"\u2713"} All reviewed</span>
          )}
        </div>
        <div className="vp-progress-track">
          <div
            className={`vp-progress-fill${reviewPct === 100 ? " vp-progress-fill-complete" : ""}`}
            style={{ width: `${reviewPct}%` }}
          />
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`vp-feedback ${feedback.type === "error" ? "vp-feedback-error" : "vp-feedback-success"}`}>
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div className="vp-filters">
        <input
          type="text" placeholder="Search terms..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="vp-search-input"
        />
        <select value={filterReview} onChange={(e) => setFilterReview(e.target.value)}
          className="vp-filter-select">
          <option value="">All review status</option>
          <option value="true">Reviewed</option>
          <option value="false">Pending review</option>
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkReview} disabled={bulkLoading}
            className="vp-bulk-btn">
            {bulkLoading ? "Reviewing..." : `Mark ${selected.size} Reviewed`}
          </button>
        )}
        <span className="vp-term-count">
          {total} term{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading && vocabulary.length === 0 ? (
        <p className="vp-empty-text">Loading vocabulary...</p>
      ) : vocabulary.length === 0 ? (
        <p className="vp-empty-text">
          {search || filterReview ? "No terms match your filters." : "No vocabulary extracted yet."}
        </p>
      ) : (
        <>
          <div className="vp-table-wrap">
            <table className="vp-table">
              <thead>
                <tr className="vp-thead-row">
                  <th className="vp-th vp-th-checkbox">
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                  </th>
                  <th className="vp-th">Term</th>
                  <th className="vp-th">Definition</th>
                  <th className="vp-th vp-th-topic">Topic</th>
                  <th className="vp-th vp-th-review">Review</th>
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
            <div className="vp-pagination">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="vp-pagination-btn">Prev</button>
              <span className="vp-pagination-info">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="vp-pagination-btn">Next</button>
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

  const rowClass = [
    "vp-row",
    isExpanded ? "vp-row-expanded" : "",
    isSelected ? "vp-row-selected" : isExpanded ? "vp-row-active" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <tr
        onClick={(e) => { if ((e.target as HTMLElement).closest("input, button")) return; onToggleExpand(); }}
        className={rowClass}
      >
        <td className="vp-td-checkbox">
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </td>
        <td className="vp-td-term">
          {v.term}
          {v.partOfSpeech && (
            <span className="vp-part-of-speech">({v.partOfSpeech})</span>
          )}
        </td>
        <td className="vp-td-definition">{defTruncated}</td>
        <td className="vp-td-topic">{v.topic || "\u2014"}</td>
        <td className="vp-td-review">
          {isReviewed
            ? <span className="vp-status-reviewed">Reviewed</span>
            : <span className="vp-status-pending">Pending</span>}
        </td>
      </tr>
      {isExpanded && (
        <tr className="vp-detail-row">
          <td colSpan={5} className="vp-detail-cell">
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

  return (
    <div className="vp-detail">
      <div className="vp-detail-heading">
        <strong>{v.term}</strong>
        {v.partOfSpeech && <span className="vp-detail-heading-muted"> ({v.partOfSpeech})</span>}
        : {v.definition}
      </div>

      <div className="vp-detail-grid">
        {v.exampleUsage && (
          <div className="vp-span-2">
            <div className="vp-detail-label">Example Usage</div>
            <div className="vp-detail-value vp-detail-value-italic">{v.exampleUsage}</div>
          </div>
        )}
        {v.pronunciation && (
          <div>
            <div className="vp-detail-label">Pronunciation</div>
            <div className="vp-detail-value">{v.pronunciation}</div>
          </div>
        )}
        {v.difficulty && (
          <div>
            <div className="vp-detail-label">Difficulty</div>
            <div className="vp-detail-value">{v.difficulty}/5</div>
          </div>
        )}
        {v.topic && (
          <div>
            <div className="vp-detail-label">Topic</div>
            <div className="vp-detail-value">{v.topic}</div>
          </div>
        )}
        {(v.chapter || v.pageRef) && (
          <div>
            <div className="vp-detail-label">Location</div>
            <div className="vp-detail-value">{[v.chapter, v.pageRef].filter(Boolean).join(" / ")}</div>
          </div>
        )}
        {v.tags.length > 0 && (
          <div>
            <div className="vp-detail-label">Tags</div>
            <div className="vp-tags">
              {v.tags.map((t) => (
                <span key={t} className="vp-tag">{t}</span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="vp-detail-label">Review Status</div>
          {v.reviewedAt ? (
            <div className="vp-review-info">
              <span className="vp-review-done">Reviewed</span>
              <span className="vp-review-meta">
                by {v.reviewer?.name || v.reviewer?.email || "unknown"} on {new Date(v.reviewedAt).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <span className="vp-review-pending">Pending</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="vp-actions">
        {!isReviewed && (
          <button onClick={onMarkReviewed} className="vp-btn-review">
            Mark Reviewed
          </button>
        )}
        <div className="hf-ml-auto">
          {confirmDelete ? (
            <span className="vp-delete-confirm">
              <span className="vp-delete-confirm-text">Delete permanently?</span>
              <button onClick={onDelete} className="vp-btn-confirm-delete">
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} className="vp-btn-cancel">
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="vp-btn-delete">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
