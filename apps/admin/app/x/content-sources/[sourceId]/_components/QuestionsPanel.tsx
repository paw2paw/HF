"use client";

import { useState, useEffect, useCallback } from "react";
import "./questions-panel.css";

type Question = {
  id: string;
  questionText: string;
  questionType: string;
  correctAnswer: string | null;
  answerExplanation: string | null;
  options: any;
  markScheme: string | null;
  difficulty: number | null;
  tags: string[];
  chapter: string | null;
  pageRef: string | null;
  learningOutcomeRef: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewer: { id: string; name: string | null; email: string } | null;
};

const QUESTION_TYPES = [
  { value: "MCQ", label: "MCQ" },
  { value: "TRUE_FALSE", label: "True/False" },
  { value: "SHORT_ANSWER", label: "Short Answer" },
  { value: "MATCHING", label: "Matching" },
  { value: "FILL_IN_BLANK", label: "Fill in Blank" },
  { value: "ORDERING", label: "Ordering" },
  { value: "OPEN", label: "Open" },
  { value: "CALCULATION", label: "Calculation" },
  { value: "CASE_STUDY", label: "Case Study" },
  { value: "ESSAY", label: "Essay" },
];

const PAGE_SIZE = 50;

export default function QuestionsPanel({
  sourceId,
  onCountChange,
}: {
  sourceId: string;
  onCountChange?: (total: number, reviewed: number) => void;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterReview, setFilterReview] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterType) params.set("questionType", filterType);
      if (filterReview) params.set("reviewed", filterReview);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(`/api/content-sources/${sourceId}/questions?${params}`);
      const data = await res.json();
      if (data.ok) {
        setQuestions(data.questions);
        setTotal(data.total);
        setReviewedCount(data.reviewedCount);
        onCountChange?.(data.total, data.reviewedCount);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [sourceId, search, filterType, filterReview, page, onCountChange]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);
  useEffect(() => { setPage(0); }, [search, filterType, filterReview]);
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
      const res = await fetch(`/api/content-sources/${sourceId}/questions/bulk-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIds: [...selected] }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({ type: "success", message: `${data.updated} question${data.updated !== 1 ? "s" : ""} marked as reviewed` });
        setSelected(new Set());
        fetchQuestions();
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
      const res = await fetch(`/api/content-sources/${sourceId}/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markReviewed: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback({ type: "success", message: "Marked as reviewed" });
        fetchQuestions();
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/content-sources/${sourceId}/questions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setExpandedId(null);
        setFeedback({ type: "success", message: "Question deleted" });
        fetchQuestions();
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const allOnPageSelected = questions.length > 0 && questions.every((q) => selected.has(q.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      const next = new Set(selected);
      questions.forEach((q) => next.delete(q.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      questions.forEach((q) => next.add(q.id));
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
      <div className="qp-progress-section">
        <div className="qp-progress-header">
          <span className="qp-progress-label">
            {reviewedCount}/{total} reviewed ({reviewPct}%)
          </span>
          {reviewPct === 100 && total > 0 && (
            <span className="qp-all-reviewed">{"\u2713"} All reviewed</span>
          )}
        </div>
        <div className="qp-progress-track">
          <div
            className={`qp-progress-fill${reviewPct === 100 ? " qp-progress-fill-complete" : ""}`}
            style={{ width: `${reviewPct}%` }}
          />
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`qp-feedback ${feedback.type === "error" ? "qp-feedback-error" : "qp-feedback-success"}`}>
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div className="qp-filters">
        <input
          type="text" placeholder="Search questions..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="qp-search-input"
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="qp-filter-select">
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterReview} onChange={(e) => setFilterReview(e.target.value)} className="qp-filter-select">
          <option value="">All review status</option>
          <option value="true">Reviewed</option>
          <option value="false">Pending review</option>
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkReview} disabled={bulkLoading} className="qp-bulk-review-btn">
            {bulkLoading ? "Reviewing..." : `Mark ${selected.size} Reviewed`}
          </button>
        )}
        <span className="qp-total-count">
          {total} question{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading && questions.length === 0 ? (
        <p className="qp-empty-text">Loading questions...</p>
      ) : questions.length === 0 ? (
        <p className="qp-empty-text">
          {search || filterType || filterReview ? "No questions match your filters." : "No questions extracted yet."}
        </p>
      ) : (
        <>
          <div className="qp-table-wrap">
            <table className="qp-table">
              <thead>
                <tr className="qp-thead-row">
                  <th className="qp-th qp-th-checkbox">
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
                  </th>
                  <th className="qp-th">Question</th>
                  <th className="qp-th qp-th-type">Type</th>
                  <th className="qp-th qp-th-answer">Answer</th>
                  <th className="qp-th qp-th-diff">Diff.</th>
                  <th className="qp-th qp-th-review">Review</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => {
                  const isExpanded = expandedId === q.id;
                  const isSelected = selected.has(q.id);
                  const isReviewed = !!q.reviewedAt;
                  const truncated = q.questionText.length > 100 ? q.questionText.slice(0, 100) + "..." : q.questionText;

                  return (
                    <QuestionRow key={q.id} question={q} isExpanded={isExpanded} isSelected={isSelected} isReviewed={isReviewed} truncated={truncated}
                      onToggleSelect={() => toggleSelect(q.id)}
                      onToggleExpand={() => setExpandedId(isExpanded ? null : q.id)}
                      onMarkReviewed={() => handleMarkReviewed(q.id)}
                      onDelete={() => handleDelete(q.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="qp-pagination">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="qp-pagination-btn">Prev</button>
              <span className="qp-pagination-label">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="qp-pagination-btn">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────

function QuestionRow({ question: q, isExpanded, isSelected, isReviewed, truncated, onToggleSelect, onToggleExpand, onMarkReviewed, onDelete }: {
  question: Question; isExpanded: boolean; isSelected: boolean; isReviewed: boolean; truncated: string;
  onToggleSelect: () => void; onToggleExpand: () => void; onMarkReviewed: () => void; onDelete: () => void;
}) {
  const typeLabel = QUESTION_TYPES.find((t) => t.value === q.questionType)?.label || q.questionType;

  const rowClasses = [
    "qp-row",
    isExpanded ? "qp-row-expanded" : "",
    isSelected ? "qp-row-selected" : isExpanded ? "qp-row-expanded-bg" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <tr
        onClick={(e) => { if ((e.target as HTMLElement).closest("input, button")) return; onToggleExpand(); }}
        className={rowClasses}
      >
        <td className="qp-td-checkbox">
          <input type="checkbox" checked={isSelected} onChange={onToggleSelect} />
        </td>
        <td className="qp-td qp-td-question">{truncated}</td>
        <td className="qp-td">
          <span className="qp-type-badge">{typeLabel}</span>
        </td>
        <td className="qp-td qp-td-answer">
          {q.correctAnswer ? (q.correctAnswer.length > 30 ? q.correctAnswer.slice(0, 30) + "..." : q.correctAnswer) : "\u2014"}
        </td>
        <td className="qp-td qp-td-center">
          {q.difficulty || "\u2014"}
        </td>
        <td className="qp-td qp-td-center">
          {isReviewed
            ? <span className="qp-review-status-reviewed">Reviewed</span>
            : <span className="qp-review-status-pending">Pending</span>}
        </td>
      </tr>
      {isExpanded && (
        <tr className="qp-expanded-row">
          <td colSpan={6} className="qp-expanded-cell">
            <QuestionDetail question={q} onMarkReviewed={onMarkReviewed} onDelete={onDelete} />
          </td>
        </tr>
      )}
    </>
  );
}

function QuestionDetail({ question: q, onMarkReviewed, onDelete }: { question: Question; onMarkReviewed: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isReviewed = !!q.reviewedAt;

  return (
    <div className="qp-detail">
      {/* Full question text */}
      <div className="qp-detail-question-text">
        {q.questionText}
      </div>

      {/* Options (for MCQ etc.) */}
      {q.options && typeof q.options === "object" && Object.keys(q.options).length > 0 && (
        <div className="qp-options-section">
          <div className="qp-detail-label">Options</div>
          <div className="qp-options-list">
            {Object.entries(q.options).map(([key, val]) => {
              const isCorrect = q.correctAnswer === key || q.correctAnswer === String(val);
              return (
                <div key={key} className={`qp-option${isCorrect ? " qp-option-correct" : ""}`}>
                  <strong>{key}.</strong> {String(val)}
                  {isCorrect && " \u2713"}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div className="qp-meta-grid">
        {q.correctAnswer && (
          <div>
            <div className="qp-detail-label">Correct Answer</div>
            <div className="qp-correct-answer-value">{q.correctAnswer}</div>
          </div>
        )}
        {q.answerExplanation && (
          <div className="qp-meta-span-2">
            <div className="qp-detail-label">Explanation</div>
            <div className="qp-detail-value-relaxed">{q.answerExplanation}</div>
          </div>
        )}
        {q.markScheme && (
          <div className="qp-meta-span-2">
            <div className="qp-detail-label">Mark Scheme</div>
            <div className="qp-detail-value-relaxed">{q.markScheme}</div>
          </div>
        )}
        {q.difficulty && (
          <div>
            <div className="qp-detail-label">Difficulty</div>
            <div className="qp-detail-value">{q.difficulty}/5</div>
          </div>
        )}
        {q.learningOutcomeRef && (
          <div>
            <div className="qp-detail-label">Learning Outcome</div>
            <div className="qp-detail-value">{q.learningOutcomeRef}</div>
          </div>
        )}
        {(q.chapter || q.pageRef) && (
          <div>
            <div className="qp-detail-label">Location</div>
            <div className="qp-detail-value">{[q.chapter, q.pageRef].filter(Boolean).join(" / ")}</div>
          </div>
        )}
        {q.tags.length > 0 && (
          <div>
            <div className="qp-detail-label">Tags</div>
            <div className="qp-tags">
              {q.tags.map((t) => (
                <span key={t} className="qp-tag">{t}</span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="qp-detail-label">Review Status</div>
          {q.reviewedAt ? (
            <div className="qp-review-detail">
              <span className="qp-review-detail-reviewed">Reviewed</span>
              <span className="qp-review-detail-by">
                by {q.reviewer?.name || q.reviewer?.email || "unknown"} on {new Date(q.reviewedAt).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <span className="qp-review-detail-pending">Pending</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="qp-actions">
        {!isReviewed && (
          <button onClick={onMarkReviewed} className="qp-btn-mark-reviewed">
            Mark Reviewed
          </button>
        )}
        <div className="qp-delete-area">
          {confirmDelete ? (
            <span className="qp-confirm-group">
              <span className="qp-confirm-label">Delete permanently?</span>
              <button onClick={onDelete} className="qp-btn-confirm-delete">
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)} className="qp-btn-cancel">
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="qp-btn-delete">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
