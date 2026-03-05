"use client";

import { useState } from "react";
import { ChevronDown, BookOpen, Play, FileText } from "lucide-react";

export interface LessonEntry {
  session: number;
  label: string;
  type: "introduction" | "lesson" | "review" | string;
  notes?: string;
  estimatedDurationMins?: number;
  teachingPointCount?: number;
  vocabCount?: number;
  questionCount?: number;
  teachingPointPreviews?: string[];
  vocabPreviews?: string[];
}

interface LessonPlanAccordionProps {
  entries: LessonEntry[];
  courseName?: string;
  courseId?: string;
  onTestLesson?: (session: number) => void;
}

function hasContent(entry: LessonEntry): boolean {
  return !!(entry.teachingPointCount || entry.vocabCount || entry.questionCount);
}

const TYPE_LABELS: Record<string, string> = {
  introduction: "Intro",
  review: "Review",
  lesson: "Lesson",
};

export function LessonPlanAccordion({ entries, courseName, courseId, onTestLesson }: LessonPlanAccordionProps) {
  const [listOpen, setListOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<Set<number>>(new Set());

  if (!entries.length) {
    return (
      <div className="cv4-accordion cv4-accordion--empty">
        <div className="cv4-accordion-title">
          <BookOpen size={14} />
          <span>Lesson Plan</span>
        </div>
        <p className="cv4-lesson-notes">
          No sessions were generated yet.{" "}
          {courseId ? (
            <a href={`/x/courses/${courseId}`} target="_blank" rel="noopener noreferrer">
              Add sessions from the course page
            </a>
          ) : (
            "You can add sessions once the course is created."
          )}
        </p>
      </div>
    );
  }

  const toggleSession = (session: number) => {
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(session)) { next.delete(session); } else { next.add(session); }
      return next;
    });
  };

  return (
    <div className="cv4-accordion">
      <button
        type="button"
        className="cv4-accordion-header"
        onClick={() => setListOpen((o) => !o)}
        aria-expanded={listOpen}
      >
        <div className="cv4-accordion-title">
          <BookOpen size={14} />
          <span>{courseName ? `${courseName} — Lesson Plan` : "Lesson Plan"}</span>
          <span className="cv4-accordion-count">{entries.length} sessions</span>
        </div>
        <ChevronDown
          size={14}
          className="cv4-accordion-chevron"
          style={{ transform: listOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {listOpen && (
        <div className="cv4-accordion-body">
          {entries.map((entry) => {
            const isOpen = openSessions.has(entry.session);
            return (
              <div key={entry.session} className="cv4-lesson-row">
                <button
                  type="button"
                  className="cv4-lesson-summary"
                  onClick={() => toggleSession(entry.session)}
                  aria-expanded={isOpen}
                >
                  <span className="cv4-lesson-num">{entry.session}</span>
                  <span className="cv4-lesson-label">{entry.label}</span>
                  {hasContent(entry) && (
                    <span className="cv4-lesson-content-badge" title="teaching points">
                      {entry.teachingPointCount || 0} points
                    </span>
                  )}
                  <span className="cv4-lesson-type">
                    {TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                  <ChevronDown
                    size={12}
                    className="cv4-lesson-chevron"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {isOpen && (
                  <div className="cv4-lesson-detail">
                    {entry.notes && <p className="cv4-lesson-notes">{entry.notes}</p>}
                    {entry.estimatedDurationMins && (
                      <p className="cv4-lesson-meta">{entry.estimatedDurationMins} min</p>
                    )}

                    {hasContent(entry) && (
                      <div className="cv4-lesson-content">
                        <p className="cv4-lesson-content-counts">
                          {[
                            entry.teachingPointCount && `${entry.teachingPointCount} teaching point${entry.teachingPointCount !== 1 ? "s" : ""}`,
                            entry.vocabCount && `${entry.vocabCount} vocab term${entry.vocabCount !== 1 ? "s" : ""}`,
                            entry.questionCount && `${entry.questionCount} question${entry.questionCount !== 1 ? "s" : ""}`,
                          ].filter(Boolean).join(" · ")}
                        </p>

                        {entry.teachingPointPreviews?.length ? (
                          <ul className="cv4-lesson-content-previews">
                            {entry.teachingPointPreviews.map((tp, i) => (
                              <li key={i}>
                                <FileText size={11} />
                                <span>{tp}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {entry.vocabPreviews?.length ? (
                          <div className="cv4-lesson-content-vocab">
                            {entry.vocabPreviews.map((v, i) => (
                              <span key={i} className="cv4-vocab-chip">{v}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {onTestLesson && (
                      <button
                        type="button"
                        className="cv4-test-lesson-btn"
                        onClick={() => onTestLesson(entry.session)}
                      >
                        <Play size={12} />
                        Test this lesson
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {courseId && (
            <div className="cv4-lesson-fullplan-hint">
              <BookOpen size={12} />
              <span>
                Showing the first few teaching points per session.{" "}
                <a href={`/x/courses/${courseId}`} target="_blank" rel="noopener noreferrer">
                  Open the full lesson plan
                </a>{" "}
                to see all content, vocabulary, and questions.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
