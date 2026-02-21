"use client";

import { useState, useEffect, useCallback } from "react";

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
            background: reviewPct === 100 ? "var(--status-success-text)" : "linear-gradient(90deg, var(--accent-primary), var(--accent-primary))",
            width: `${reviewPct}%`, transition: "width 0.3s ease-out",
          }} />
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: "8px 16px", marginBottom: 12, borderRadius: 8, fontSize: 13, fontWeight: 500,
          ...(feedback.type === "error"
            ? { background: "var(--status-error-bg)", color: "var(--status-error-text)", border: "1px solid var(--status-error-border, #FFCDD2)" }
            : { background: "var(--status-success-bg)", color: "var(--status-success-text)", border: "1px solid var(--status-success-border, #C8E6C9)" }),
        }}>
          {feedback.message}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text" placeholder="Search questions..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13, width: 220 }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
          <option value="">All types</option>
          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterReview} onChange={(e) => setFilterReview(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid var(--border-default)", backgroundColor: "var(--surface-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
          <option value="">All review status</option>
          <option value="true">Reviewed</option>
          <option value="false">Pending review</option>
        </select>
        {selected.size > 0 && (
          <button onClick={handleBulkReview} disabled={bulkLoading}
            style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "var(--status-success-text)", color: "var(--button-primary-text, #fff)", fontSize: 12, fontWeight: 600, cursor: bulkLoading ? "not-allowed" : "pointer", opacity: bulkLoading ? 0.6 : 1 }}>
            {bulkLoading ? "Reviewing..." : `Mark ${selected.size} Reviewed`}
          </button>
        )}
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          {total} question{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading && questions.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading questions...</p>
      ) : questions.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {search || filterType || filterReview ? "No questions match your filters." : "No questions extracted yet."}
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
                  <th style={thStyle}>Question</th>
                  <th style={{ ...thStyle, width: 100 }}>Type</th>
                  <th style={{ ...thStyle, width: 100 }}>Answer</th>
                  <th style={{ ...thStyle, width: 60, textAlign: "center" }}>Diff.</th>
                  <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Review</th>
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

function QuestionRow({ question: q, isExpanded, isSelected, isReviewed, truncated, onToggleSelect, onToggleExpand, onMarkReviewed, onDelete }: {
  question: Question; isExpanded: boolean; isSelected: boolean; isReviewed: boolean; truncated: string;
  onToggleSelect: () => void; onToggleExpand: () => void; onMarkReviewed: () => void; onDelete: () => void;
}) {
  const typeLabel = QUESTION_TYPES.find((t) => t.value === q.questionType)?.label || q.questionType;

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
        <td style={{ padding: "8px 10px", color: "var(--text-primary)", lineHeight: 1.4 }}>{truncated}</td>
        <td style={{ padding: "8px 10px" }}>
          <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, color: "var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 10%, transparent)", textTransform: "uppercase" }}>
            {typeLabel}
          </span>
        </td>
        <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-muted)" }}>
          {q.correctAnswer ? (q.correctAnswer.length > 30 ? q.correctAnswer.slice(0, 30) + "..." : q.correctAnswer) : "\u2014"}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          {q.difficulty || "\u2014"}
        </td>
        <td style={{ padding: "8px 10px", textAlign: "center" }}>
          {isReviewed
            ? <span style={{ fontSize: 11, color: "var(--status-success-text)", fontWeight: 600 }}>Reviewed</span>
            : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pending</span>}
        </td>
      </tr>
      {isExpanded && (
        <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <td colSpan={6} style={{ padding: "0 10px 16px 46px" }}>
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
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-primary)" };

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Full question text */}
      <div style={{ ...valueStyle, lineHeight: 1.5, marginBottom: 12, whiteSpace: "pre-wrap" }}>
        {q.questionText}
      </div>

      {/* Options (for MCQ etc.) */}
      {q.options && typeof q.options === "object" && Object.keys(q.options).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>Options</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(q.options).map(([key, val]) => {
              const isCorrect = q.correctAnswer === key || q.correctAnswer === String(val);
              return (
                <div key={key} style={{
                  fontSize: 13, padding: "4px 8px", borderRadius: 4,
                  background: isCorrect ? "color-mix(in srgb, var(--status-success-text) 10%, transparent)" : "var(--surface-secondary)",
                  color: isCorrect ? "var(--status-success-text)" : "var(--text-primary)",
                  fontWeight: isCorrect ? 600 : 400,
                }}>
                  <strong>{key}.</strong> {String(val)}
                  {isCorrect && " \u2713"}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px 20px", marginBottom: 12 }}>
        {q.correctAnswer && (
          <div>
            <div style={labelStyle}>Correct Answer</div>
            <div style={{ ...valueStyle, color: "var(--status-success-text)", fontWeight: 600 }}>{q.correctAnswer}</div>
          </div>
        )}
        {q.answerExplanation && (
          <div style={{ gridColumn: "span 2" }}>
            <div style={labelStyle}>Explanation</div>
            <div style={{ ...valueStyle, lineHeight: 1.5 }}>{q.answerExplanation}</div>
          </div>
        )}
        {q.markScheme && (
          <div style={{ gridColumn: "span 2" }}>
            <div style={labelStyle}>Mark Scheme</div>
            <div style={{ ...valueStyle, lineHeight: 1.5 }}>{q.markScheme}</div>
          </div>
        )}
        {q.difficulty && (
          <div>
            <div style={labelStyle}>Difficulty</div>
            <div style={valueStyle}>{q.difficulty}/5</div>
          </div>
        )}
        {q.learningOutcomeRef && (
          <div>
            <div style={labelStyle}>Learning Outcome</div>
            <div style={valueStyle}>{q.learningOutcomeRef}</div>
          </div>
        )}
        {(q.chapter || q.pageRef) && (
          <div>
            <div style={labelStyle}>Location</div>
            <div style={valueStyle}>{[q.chapter, q.pageRef].filter(Boolean).join(" / ")}</div>
          </div>
        )}
        {q.tags.length > 0 && (
          <div>
            <div style={labelStyle}>Tags</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {q.tags.map((t) => (
                <span key={t} style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, background: "var(--surface-tertiary)", color: "var(--text-secondary)" }}>{t}</span>
              ))}
            </div>
          </div>
        )}
        <div>
          <div style={labelStyle}>Review Status</div>
          {q.reviewedAt ? (
            <div style={{ fontSize: 12 }}>
              <span style={{ color: "var(--status-success-text)", fontWeight: 600 }}>Reviewed</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                by {q.reviewer?.name || q.reviewer?.email || "unknown"} on {new Date(q.reviewedAt).toLocaleDateString()}
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
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--status-success-text)", color: "var(--button-primary-text, #fff)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Mark Reviewed
          </button>
        )}
        <div style={{ marginLeft: "auto" }}>
          {confirmDelete ? (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--status-error-text)" }}>Delete permanently?</span>
              <button onClick={onDelete}
                style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "var(--status-error-text)", color: "var(--button-primary-text, #fff)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--surface-primary)", color: "var(--text-primary)", fontSize: 11, cursor: "pointer" }}>
                Cancel
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--status-error-border, #FFCDD2)", background: "var(--surface-primary)", color: "var(--status-error-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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
