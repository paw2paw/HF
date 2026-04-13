"use client";

/**
 * ContinuousProgrammeView — teacher-facing view for continuous learning courses.
 *
 * Shows:
 * 1. Enrolled learner progress bars (LO mastery %)
 * 2. Module → LO → TP hierarchy (progressive disclosure)
 * 3. Teaching instructions at the bottom (course-wide)
 *
 * Used in place of JourneyRail when lessonPlanMode === 'continuous'.
 */

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, BookOpen, Layers } from "lucide-react";

// ── Types ──────────────────────────────────────────

interface ModuleWithLOs {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  learningObjectives: LOItem[];
  tpCount: number;
}

interface LOItem {
  id: string;
  ref: string;
  description: string;
  sortOrder: number;
  assertions: TPItem[];
  teachMethods: string[];
}

interface TPItem {
  id: string;
  assertion: string;
  teachMethod: string | null;
  category: string | null;
}

interface LearnerProgress {
  callerId: string;
  callerName: string;
  loMastered: number;
  loTotal: number;
  progressPct: number;
}

interface Props {
  courseId: string;
  curriculumId: string | null;
  learners?: LearnerProgress[];
  loading?: boolean;
}

// ── Component ──────────────────────────────────────

export function ContinuousProgrammeView({ courseId, curriculumId, learners, loading }: Props) {
  const [modules, setModules] = useState<ModuleWithLOs[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedLOs, setExpandedLOs] = useState<Set<string>>(new Set());
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch module/LO/TP hierarchy
  useEffect(() => {
    if (!curriculumId) { setDataLoading(false); return; }

    fetch(`/api/curricula/${curriculumId}/continuous-programme`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setModules(data.modules || []);
          setInstructions(data.instructions || []);
        }
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [curriculumId]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleLO = (id: string) => {
    setExpandedLOs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalLOs = modules.reduce((sum, m) => sum + m.learningObjectives.length, 0);
  const totalTPs = modules.reduce((sum, m) => sum + m.tpCount, 0);

  if (loading || dataLoading) {
    return <div className="hf-card"><div className="hf-spinner" /></div>;
  }

  return (
    <div className="hf-flex-col hf-gap-md">
      {/* Header */}
      <div className="hf-card">
        <div className="hf-flex hf-items-center hf-gap-sm hf-mb-sm">
          <Layers size={18} style={{ color: "var(--accent-primary)" }} />
          <span className="hf-section-title" style={{ margin: 0 }}>Learning Programme</span>
          <span className="hf-text-muted hf-text-xs">{totalLOs} LOs, {totalTPs} TPs</span>
        </div>

        {/* Learner progress bars */}
        {learners && learners.length > 0 && (
          <div className="hf-flex-col hf-gap-xs hf-mb-md">
            <div className="hf-text-xs hf-text-muted hf-mb-xs">
              Enrolled learners: {learners.length}
            </div>
            {learners.map((l) => (
              <div key={l.callerId} className="hf-flex hf-items-center hf-gap-sm">
                <span className="hf-text-sm" style={{ minWidth: 80 }}>{l.callerName}</span>
                <div
                  style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: "var(--surface-secondary)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${l.progressPct}%`, height: "100%", borderRadius: 4,
                      background: "var(--accent-primary)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span className="hf-text-xs hf-text-muted" style={{ minWidth: 80 }}>
                  {l.progressPct}% ({l.loMastered}/{l.loTotal} LOs)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modules */}
      {modules.map((mod) => (
        <div key={mod.id} className="hf-card hf-card-compact">
          {/* Module header — click to expand */}
          <button
            className="hf-list-row"
            onClick={() => toggleModule(mod.id)}
            style={{ width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
          >
            <div className="hf-flex hf-items-center hf-gap-sm" style={{ width: "100%" }}>
              {expandedModules.has(mod.id)
                ? <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                : <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
              }
              <BookOpen size={16} style={{ color: "var(--accent-primary)" }} />
              <span className="hf-text-sm" style={{ fontWeight: 600 }}>{mod.title}</span>
              <span className="hf-text-xs hf-text-muted" style={{ marginLeft: "auto" }}>
                {mod.learningObjectives.length} LOs · {mod.tpCount} TPs
              </span>
            </div>
          </button>

          {/* Expanded: LOs with teach method chips */}
          {expandedModules.has(mod.id) && (
            <div className="hf-flex-col hf-gap-sm" style={{ paddingTop: 12, paddingLeft: 28 }}>
              {mod.learningObjectives.map((lo) => (
                <div key={lo.id}>
                  {/* LO row — click to expand TPs */}
                  <button
                    onClick={() => toggleLO(lo.id)}
                    style={{ width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <div className="hf-flex-col hf-gap-xxs">
                      <span className="hf-text-sm">
                        <strong>{lo.ref}:</strong> {lo.description}
                      </span>
                      {lo.teachMethods.length > 0 && (
                        <div className="hf-chip-row" style={{ gap: 4 }}>
                          {lo.teachMethods.map((tm) => (
                            <span key={tm} className="hf-category-label">{tm}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded LO: individual TPs */}
                  {expandedLOs.has(lo.id) && (
                    <div className="hf-flex-col hf-gap-xxs" style={{ paddingLeft: 16, paddingTop: 6 }}>
                      {lo.assertions.map((tp) => (
                        <div key={tp.id} className="hf-flex hf-items-start hf-gap-xs hf-text-xs">
                          <span style={{ color: "var(--text-muted)" }}>·</span>
                          <span style={{ flex: 1 }}>{tp.assertion}</span>
                          {tp.teachMethod && (
                            <span className="hf-text-muted" style={{ whiteSpace: "nowrap" }}>
                              {tp.teachMethod}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Teaching Instructions — course-wide, at the bottom */}
      {instructions.length > 0 && (
        <div className="hf-card hf-card-compact">
          <div className="hf-text-xs hf-text-muted hf-mb-xs" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Teaching Instructions (applies to all modules)
          </div>
          <div className="hf-flex-col hf-gap-xxs">
            {instructions.map((inst, i) => (
              <div key={i} className="hf-text-sm">· {inst}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
