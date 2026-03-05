"use client";

import { useState } from "react";
import { ChevronDown, BookOpen, Play } from "lucide-react";

export interface LessonEntry {
  session: number;
  label: string;
  type: "introduction" | "lesson" | "review" | string;
  notes?: string;
  estimatedDurationMins?: number;
}

interface LessonPlanAccordionProps {
  entries: LessonEntry[];
  courseName?: string;
  onTestLesson?: (session: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  introduction: "Intro",
  review: "Review",
  lesson: "Lesson",
};

export function LessonPlanAccordion({ entries, courseName, onTestLesson }: LessonPlanAccordionProps) {
  const [listOpen, setListOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<Set<number>>(new Set());

  if (!entries.length) return null;

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
        </div>
      )}
    </div>
  );
}
