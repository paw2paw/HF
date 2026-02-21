"use client";

import { useState, useEffect } from "react";
import { BookOpen, CheckSquare } from "lucide-react";
import { VerticalSlider, SliderGroup } from "@/components/shared/VerticalSlider";
import { GoalPill, PlaybookPill, StatusBadge } from "@/src/components/shared/EntityPill";
import { EXAM_LEVEL_CONFIG } from "@/lib/curriculum/constants";
import { useViewMode } from "@/contexts/ViewModeContext";
import { TwoColumnTargetsDisplay } from "./CallsTab";
import type { CallScore, CurriculumProgress, LearnerProfile, Goal, Call, MemorySummary } from "./types";
import { CATEGORY_COLORS } from "./constants";

// =====================================================
// ScoresSection
// =====================================================

export function ScoresSection({ scores }: { scores: CallScore[] }) {
  const { isAdvanced } = useViewMode();
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [expandedScore, setExpandedScore] = useState<string | null>(null);

  if (!scores || scores.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No scores yet</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Run analysis to generate parameter scores</div>
      </div>
    );
  }

  // Group all scores by parameter (agent behavior has its own Behaviour tab via BehaviorMeasurement)
  const groupByParameter = (scoreList: CallScore[]) => {
    const grouped: Record<string, CallScore[]> = {};
    for (const score of scoreList) {
      const key = score.parameterId;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(score);
    }
    return grouped;
  };

  const allGrouped = groupByParameter(scores);

  // Score color helper
  const scoreColor = (v: number) => ({
    primary: v >= 0.7 ? "var(--status-success-text)" : v >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
    glow: v >= 0.7 ? "var(--status-success-text)" : v >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
  });


  // Render a group of score sliders
  const renderScoreSliders = (grouped: Record<string, CallScore[]>, groupColor: { primary: string; glow: string }, groupTitle: string, emptyMessage: string) => {
    const entries = Object.entries(grouped);
    if (entries.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: "center", color: "var(--text-placeholder)", fontSize: 12 }}>
          {emptyMessage}
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {entries.map(([parameterId, paramScores]) => {
            const avg = paramScores.reduce((sum, s) => sum + s.score, 0) / paramScores.length;
            const paramName = paramScores[0]?.parameter?.name || parameterId;
            const isExpanded = expandedParam === parameterId;
            const color = scoreColor(avg);

            // Build history sorted oldest→newest
            const history = [...paramScores]
              .sort((a, b) => new Date(a.call.createdAt).getTime() - new Date(b.call.createdAt).getTime())
              .map(s => s.score);

            const historyInfo = history.length >= 2
              ? `\n\nHistory: ${history.length} calls\nRange: ${(Math.min(...history) * 100).toFixed(0)}% - ${(Math.max(...history) * 100).toFixed(0)}%`
              : "";
            const tooltip = `${paramName}\n\nAverage: ${(avg * 100).toFixed(0)}% (${paramScores.length} scores)${historyInfo}\n\n${paramScores[0]?.parameter?.definition || ""}\n\nClick for details`;

            return (
              <div key={parameterId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <VerticalSlider
                  value={avg}
                  color={color}
                  onClick={() => setExpandedParam(isExpanded ? null : parameterId)}
                  isActive={isExpanded}
                  tooltip={tooltip}
                  width={56}
                  height={140}
                  showGauge={false}
                  historyPoints={history}
                />

                {/* Label */}
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 9,
                    fontWeight: 500,
                    color: isExpanded ? color.primary : "var(--text-muted)",
                    textAlign: "center",
                    maxWidth: 70,
                    lineHeight: 1.2,
                    textTransform: "uppercase",
                    letterSpacing: "0.3px",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedParam(isExpanded ? null : parameterId)}
                >
                  {paramName}
                </div>

                {/* Sparkline - now handled automatically by VerticalSlider when historyPoints is provided */}
              </div>
            );
          })}
        </div>

        {/* Expanded detail panel */}
        {expandedParam && grouped[expandedParam] && (() => {
          const paramScores = grouped[expandedParam];
          const paramName = paramScores[0]?.parameter?.name || expandedParam;
          const avg = paramScores.reduce((sum, s) => sum + s.score, 0) / paramScores.length;
          const sorted = [...paramScores].sort((a, b) => new Date(b.call.createdAt).getTime() - new Date(a.call.createdAt).getTime());

          return (
            <div style={{
              marginTop: 16,
              background: "var(--surface-primary)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-default)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{paramName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{paramScores[0]?.parameter?.definition || ""}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: scoreColor(avg).primary }}>
                  {(avg * 100).toFixed(0)}% <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-placeholder)" }}>avg of {paramScores.length}</span>
                </div>
              </div>

              {/* Individual scores */}
              {sorted.map((s) => {
                const isScoreExpanded = expandedScore === s.id;
                return (
                  <div key={s.id} style={{ borderBottom: "1px solid var(--border-default)" }}>
                    <button
                      onClick={() => setExpandedScore(isScoreExpanded ? null : s.id)}
                      style={{
                        width: "100%",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: isScoreExpanded ? "var(--background)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 44,
                        padding: "3px 6px",
                        textAlign: "center",
                        background: s.score >= 0.7 ? "var(--status-success-bg)" : s.score >= 0.4 ? "var(--status-warning-bg)" : "var(--status-error-bg)",
                        color: s.score >= 0.7 ? "var(--status-success-text)" : s.score >= 0.4 ? "var(--status-warning-text)" : "var(--status-error-text)",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                      }}>
                        {(s.score * 100).toFixed(0)}
                      </div>
                      <div style={{ width: 50, fontSize: 11, color: "var(--text-muted)" }}>
                        {(s.confidence * 100).toFixed(0)}% conf
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(s.call.createdAt).toLocaleString()}
                      </div>
                      {s.analysisSpec && (
                        <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--badge-purple-bg)", color: "var(--badge-purple-text)", borderRadius: 4, fontWeight: 500 }}>
                          {s.analysisSpec.slug || s.analysisSpec.name}
                        </span>
                      )}
                      <span style={{ color: "var(--text-placeholder)", fontSize: 12 }}>{isScoreExpanded ? "▼" : "▶"}</span>
                    </button>

                    {isScoreExpanded && (
                      <div style={{ padding: "8px 16px 12px", background: "var(--background)", marginLeft: 56 }}>
                        {isAdvanced && s.evidence && s.evidence.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Evidence</div>
                            {s.evidence.map((e: string, i: number) => (
                              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "3px 0", borderLeft: "2px solid var(--border-default)", paddingLeft: 8, marginBottom: 3 }}>
                                {e}
                              </div>
                            ))}
                          </div>
                        )}
                        {isAdvanced && s.reasoning && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Reasoning</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>{s.reasoning}</div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--text-placeholder)" }}>
                          <span>Call ID: {s.callId?.slice(0, 8)}...</span>
                          <span>Scored: {new Date(s.scoredAt).toLocaleString()}</span>
                          {s.analysisSpecId && <span>Spec: {s.analysisSpecId.slice(0, 8)}...</span>}
                          {s.scoredBy && <span>By: {s.scoredBy}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <SliderGroup
      title={`Caller Scores (${Object.keys(allGrouped).length})`}
      color={{ primary: "var(--button-primary-bg)", glow: "var(--button-primary-bg)" }}
    >
      {renderScoreSliders(allGrouped, { primary: "var(--button-primary-bg)", glow: "var(--button-primary-bg)" }, "Scores", "No scores yet")}
    </SliderGroup>
  );
}

// =====================================================
// TrustProgressSection
// =====================================================

// Trust-Weighted Progress Section
const TRUST_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  REGULATORY_STANDARD: { bg: "var(--status-error-bg)", text: "var(--trust-l5-text, #991b1b)" },
  ACCREDITED_MATERIAL: { bg: "var(--status-warning-bg)", text: "var(--trust-l4-text, #854d0e)" },
  PUBLISHED_REFERENCE: { bg: "var(--badge-blue-bg)", text: "var(--status-info-text)" },
  EXPERT_CURATED: { bg: "var(--badge-purple-bg, #f5f3ff)", text: "var(--badge-purple-text, #5b21b6)" },
  AI_ASSISTED: { bg: "var(--status-success-bg)", text: "var(--status-success-text)" },
  UNVERIFIED: { bg: "var(--surface-secondary)", text: "var(--text-muted)" },
};

const TRUST_LABELS: Record<string, string> = {
  REGULATORY_STANDARD: "L5 Regulatory",
  ACCREDITED_MATERIAL: "L4 Accredited",
  PUBLISHED_REFERENCE: "L3 Published",
  EXPERT_CURATED: "L2 Expert",
  AI_ASSISTED: "L1 AI",
  UNVERIFIED: "L0 Unverified",
};

type TrustCurriculum = {
  specSlug: string;
  specName: string;
  specId: string | null;
  certifiedMastery: number;
  supplementaryMastery: number;
  certificationReadiness: number;
  moduleBreakdown: Record<string, {
    mastery: number;
    trustLevel: string;
    trustWeight: number;
    countsToCertification: boolean;
  }>;
};

export function TrustProgressSection({ callerId }: { callerId: string }) {
  const [curricula, setCurricula] = useState<TrustCurriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`/api/callers/${callerId}/trust-progress`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.curricula?.length > 0) {
          setCurricula(data.curricula);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [callerId]);

  if (loading || curricula.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
      borderRadius: 16,
      padding: 20,
      border: "1px solid var(--border-default)",
      boxShadow: "0 4px 24px color-mix(in srgb, var(--text-primary) 10%, transparent)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--status-success-text)", boxShadow: "0 0 8px color-mix(in srgb, var(--status-success-text) 60%, transparent)" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.5px" }}>Certification Progress</span>
      </div>

      {curricula.map((curr) => {
        const modules = Object.entries(curr.moduleBreakdown);
        const certCount = modules.filter(([, m]) => m.countsToCertification).length;

        return (
          <div key={curr.specSlug} style={{ marginBottom: curricula.length > 1 ? 16 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
              {curr.specName}
            </div>

            {/* Dual-track bars */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Certification Readiness */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--status-success-text)", width: 140, flexShrink: 0 }}>
                  Cert. Readiness
                </span>
                <div style={{ flex: 1, height: 10, background: "var(--border-default)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.round(curr.certificationReadiness * 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--status-success-text), var(--status-success-text))",
                    borderRadius: 5,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--status-success-text)", width: 40, textAlign: "right" }}>
                  {Math.round(curr.certificationReadiness * 100)}%
                </span>
              </div>

              {/* General Understanding */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", width: 140, flexShrink: 0 }}>
                  General Understanding
                </span>
                <div style={{ flex: 1, height: 10, background: "var(--border-default)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.round(curr.supplementaryMastery * 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--accent-secondary, #8b5cf6), var(--accent-secondary, #8b5cf6))",
                    borderRadius: 5,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace, monospace", color: "var(--accent-secondary, #8b5cf6)", width: 40, textAlign: "right" }}>
                  {Math.round(curr.supplementaryMastery * 100)}%
                </span>
              </div>
            </div>

            {/* Summary line */}
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
              {certCount} of {modules.length} modules count toward certification (L3+)
            </div>

            {/* Expandable module breakdown */}
            {modules.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    padding: "4px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block", fontSize: 9 }}>&#9654;</span>
                  Module breakdown
                </button>

                {expanded && (
                  <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    {modules.map(([moduleId, mod]) => {
                      const badgeColors = TRUST_BADGE_COLORS[mod.trustLevel] || TRUST_BADGE_COLORS.UNVERIFIED;
                      const label = TRUST_LABELS[mod.trustLevel] || mod.trustLevel;
                      return (
                        <div
                          key={moduleId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            background: "var(--surface-primary)",
                            border: "1px solid var(--border-default)",
                            borderRadius: 6,
                            fontSize: 11,
                          }}
                        >
                          <span style={{ flex: 1, fontWeight: 500, color: "var(--text-primary)" }}>{moduleId}</span>
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 600,
                            background: badgeColors.bg,
                            color: badgeColors.text,
                          }}>
                            {label}
                          </span>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, color: mod.mastery >= 0.8 ? "var(--status-success-text)" : mod.mastery >= 0.5 ? "var(--status-warning-text)" : "var(--text-muted)", width: 36, textAlign: "right" }}>
                            {Math.round(mod.mastery * 100)}%
                          </span>
                          <span style={{ fontSize: 10, color: mod.countsToCertification ? "var(--status-success-text)" : "var(--text-placeholder)", width: 14, textAlign: "center" }}>
                            {mod.countsToCertification ? "\u2713" : "\u2212"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// ProgressRing (private helper)
// =====================================================

// Learning Section - displays goals, curriculum progress and learner profile
function ProgressRing({ progress, size = 64, strokeWidth = 5, color }: { progress: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-default)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.3s ease" }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" style={{ transform: "rotate(90deg)", transformOrigin: "center", fontSize: size * 0.22, fontWeight: 700, fill: color, fontFamily: "ui-monospace, monospace" }}>
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

// =====================================================
// LearningSection
// =====================================================

export function LearningSection({
  curriculum,
  learnerProfile,
  goals,
  callerId
}: {
  curriculum: CurriculumProgress | null | undefined;
  learnerProfile: LearnerProfile | null | undefined;
  goals: Goal[] | undefined;
  callerId: string;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const hasCurriculum = curriculum && curriculum.hasData;
  const hasProfile = learnerProfile && (
    learnerProfile.learningStyle ||
    learnerProfile.pacePreference ||
    learnerProfile.interactionStyle ||
    learnerProfile.preferredModality ||
    learnerProfile.questionFrequency ||
    learnerProfile.feedbackStyle ||
    Object.keys(learnerProfile.priorKnowledge).length > 0
  );
  const hasGoals = goals && goals.length > 0;

  if (!hasCurriculum && !hasProfile && !hasGoals) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", background: "var(--background)", borderRadius: "12px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎯</div>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "var(--text-secondary)" }}>No goals yet</div>
        <div style={{ fontSize: "14px", marginTop: "4px" }}>Goals are created automatically when a caller is assigned to a domain</div>
      </div>
    );
  }

  const GOAL_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; glow: string }> = {
    LEARN: { label: "Learn", icon: "📚", color: "var(--status-success-text)", glow: "var(--status-success-text)" },
    ACHIEVE: { label: "Achieve", icon: "🏆", color: "var(--status-warning-text)", glow: "var(--status-warning-text)" },
    CHANGE: { label: "Change", icon: "🔄", color: "var(--accent-secondary, #8b5cf6)", glow: "var(--accent-secondary, #8b5cf6)" },
    CONNECT: { label: "Connect", icon: "🤝", color: "var(--badge-cyan-text, #06b6d4)", glow: "var(--badge-cyan-text, #0891b2)" },
    SUPPORT: { label: "Support", icon: "💚", color: "var(--status-success-text)", glow: "var(--status-success-text)" },
    CREATE: { label: "Create", icon: "🎨", color: "var(--badge-pink-text, #ec4899)", glow: "var(--badge-pink-accent, #db2777)" },
  };

  const MODULE_STATUS_COLORS: Record<string, { primary: string; glow: string }> = {
    completed: { primary: "var(--status-success-text)", glow: "var(--status-success-text)" },
    in_progress: { primary: "var(--accent-primary)", glow: "var(--accent-primary)" },
    not_started: { primary: "var(--text-muted)", glow: "var(--text-muted)" },
  };

  const activeGoals = goals?.filter(g => g.status === 'ACTIVE' || g.status === 'PAUSED') || [];
  const archivedGoals = goals?.filter(g => g.status === 'ARCHIVED' || g.status === 'COMPLETED') || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Active Goals — each as a visual card */}
      {activeGoals.map((goal) => {
        const typeConfig = GOAL_TYPE_CONFIG[goal.type] || { label: goal.type, icon: "🎯", color: "var(--text-muted)", glow: "var(--text-muted)" };
        const isLearn = goal.type === 'LEARN' && hasCurriculum && curriculum;

        return (
          <div key={goal.id}>
            {isLearn ? (
              /* LEARN goal: SliderGroup with curriculum modules as sliders */
              <SliderGroup
                title={`${typeConfig.icon} ${goal.name} — ${Math.round(goal.progress * 100)}% — ${curriculum.completedCount}/${curriculum.totalModules} modules`}
                color={{ primary: typeConfig.color, glow: typeConfig.glow }}
              >
                {/* Goal metadata strip */}
                <div style={{ width: "100%", display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", marginBottom: 4, flexWrap: "wrap", alignItems: "center" }}>
                  {goal.description && <span>{goal.description}</span>}
                  {goal.playbook && <PlaybookPill label={`${goal.playbook.name} v${goal.playbook.version}`} size="compact" />}
                  {goal.startedAt && <span style={{ opacity: 0.7 }}>Started {new Date(goal.startedAt).toLocaleDateString()}</span>}
                  {curriculum.nextModule && (
                    <span style={{ color: "var(--status-success-text)", fontWeight: 600 }}>
                      Next: {curriculum.modules.find(m => m.id === curriculum.nextModule)?.name || curriculum.nextModule}
                    </span>
                  )}
                </div>
                {/* One slider per curriculum module */}
                {curriculum.modules.map((mod) => {
                  const modColor = MODULE_STATUS_COLORS[mod.status] || MODULE_STATUS_COLORS.not_started;
                  const isCurrent = mod.id === curriculum.nextModule;
                  return (
                    <VerticalSlider
                      key={mod.id}
                      value={mod.mastery}
                      targetValue={0.8}
                      color={modColor}
                      label={mod.name}
                      tooltip={`${mod.name}\nStatus: ${mod.status}\nMastery: ${Math.round(mod.mastery * 100)}%\n${mod.description}`}
                      width={56}
                      height={120}
                      isActive={isCurrent}
                      showSparkline={false}
                    />
                  );
                })}
              </SliderGroup>
            ) : (
              /* Non-LEARN goal: Progress ring card */
              <div style={{
                background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
                borderRadius: 16,
                padding: 20,
                border: "1px solid var(--border-default)",
                boxShadow: "0 4px 24px color-mix(in srgb, var(--text-primary) 10%, transparent)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ProgressRing progress={goal.progress} size={72} color={typeConfig.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{typeConfig.icon}</span>
                      <GoalPill label={typeConfig.label} size="compact" />
                      <StatusBadge status={goal.status === 'ACTIVE' ? 'active' : 'pending'} size="compact" />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{goal.name}</div>
                    {goal.description && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{goal.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-muted)", marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {goal.playbook && <PlaybookPill label={`${goal.playbook.name} v${goal.playbook.version}`} size="compact" />}
                      {goal.startedAt && <span>Started {new Date(goal.startedAt).toLocaleDateString()}</span>}
                      {goal.targetDate && <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Learner Profile — compact chips */}
      {hasProfile && learnerProfile && (
        <div style={{
          background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
          borderRadius: 16,
          padding: 20,
          border: "1px solid var(--border-default)",
          boxShadow: "0 4px 24px color-mix(in srgb, var(--text-primary) 10%, transparent)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-secondary, #8b5cf6)", boxShadow: "0 0 8px var(--accent-secondary, #8b5cf6)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.5px" }}>Learner Profile</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {learnerProfile.learningStyle && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Style:</strong> {learnerProfile.learningStyle}
              </span>
            )}
            {learnerProfile.pacePreference && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Pace:</strong> {learnerProfile.pacePreference}
              </span>
            )}
            {learnerProfile.interactionStyle && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Interaction:</strong> {learnerProfile.interactionStyle}
              </span>
            )}
            {learnerProfile.preferredModality && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Modality:</strong> {learnerProfile.preferredModality}
              </span>
            )}
            {learnerProfile.questionFrequency && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Questions:</strong> {learnerProfile.questionFrequency}
              </span>
            )}
            {learnerProfile.feedbackStyle && (
              <span style={{ fontSize: 11, padding: "4px 10px", background: "var(--background)", border: "1px solid var(--border-default)", borderRadius: 6, color: "var(--text-secondary)" }}>
                <strong>Feedback:</strong> {learnerProfile.feedbackStyle}
              </span>
            )}
            {Object.entries(learnerProfile.priorKnowledge).map(([domain, level]) => (
              <span key={domain} style={{ fontSize: 11, padding: "4px 10px", background: "var(--status-info-bg)", border: "1px solid var(--status-info-border)", borderRadius: 6, color: "var(--status-info-text)" }}>
                <strong>{domain}:</strong> {level}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trust-Weighted Progress */}
      <TrustProgressSection callerId={callerId} />

      {/* Archived Goals — collapsed by default */}
      {archivedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-muted)",
              padding: "8px 0",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ transform: showArchived ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>&#9654;</span>
            {archivedGoals.length} archived goal{archivedGoals.length > 1 ? "s" : ""}
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {archivedGoals.map((goal) => {
                const typeConfig = GOAL_TYPE_CONFIG[goal.type] || { label: goal.type, icon: "🎯", color: "var(--text-muted)", glow: "var(--text-muted)" };
                return (
                  <div
                    key={goal.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "var(--surface-primary)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      opacity: 0.7,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{typeConfig.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", flex: 1 }}>{goal.name}</span>
                    <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: typeConfig.color, fontWeight: 600 }}>
                      {Math.round(goal.progress * 100)}%
                    </span>
                    <StatusBadge status={goal.status === 'COMPLETED' ? 'validated' : 'archived'} size="compact" />
                    {goal.playbook && (
                      <PlaybookPill label={goal.playbook.name} size="compact" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// TopicsCoveredSection
// =====================================================

export function TopicsCoveredSection({ memorySummary, keyFactCount }: { memorySummary: MemorySummary | null; keyFactCount: number }) {
  const topTopics = memorySummary?.topTopics ?? [];
  const topicCount = memorySummary?.topicCount ?? 0;

  if (!topTopics.length && !keyFactCount) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        No topics or key facts recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 16px", flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <BookOpen size={12} /> Topics Discussed
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{topicCount}</div>
        </div>
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 16px", flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckSquare size={12} /> Key Facts
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{keyFactCount}</div>
        </div>
      </div>

      {/* Topic chips */}
      {topTopics.length > 0 && (
        <div style={{ background: "var(--surface-primary)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topTopics.map((t) => (
              <span
                key={t.topic}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: CATEGORY_COLORS.TOPIC.bg,
                  color: CATEGORY_COLORS.TOPIC.text,
                }}
              >
                <BookOpen size={11} />
                {t.topic}
                {t.lastMentioned && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    {formatRelativeDate(t.lastMentioned)}
                  </span>
                )}
              </span>
            ))}
          </div>
          {topicCount > topTopics.length && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
              +{topicCount - topTopics.length} more topics discussed across calls
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// formatRelativeDate (private helper)
// =====================================================

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// =====================================================
// ExamReadinessSection
// =====================================================

// Exam Readiness Section - shows readiness scores, gate status, weak modules, attempt history
export function ExamReadinessSection({ callerId }: { callerId: string }) {
  const [curricula, setCurricula] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/callers/${callerId}/exam-readiness`)
      .then((r) => r.json())
      .then((result) => {
        if (result.ok) {
          setCurricula(result.curricula || []);
        } else {
          setError(result.error || "Failed to load exam readiness");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [callerId]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading exam readiness...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{error}</div>
      </div>
    );
  }

  if (curricula.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No exam data yet</div>
        <div style={{ fontSize: 14, marginTop: 4 }}>Exam readiness is computed once a caller has curriculum progress and a domain with exams enabled</div>
      </div>
    );
  }

  const LEVEL_CONFIG = EXAM_LEVEL_CONFIG;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {curricula.map((curr: any) => {
        const levelCfg = LEVEL_CONFIG[curr.level] || LEVEL_CONFIG.not_ready;
        const pct = Math.round(curr.readinessScore * 100);
        const weakModules: string[] = curr.weakModules || [];
        const moduleMastery: Record<string, number> = curr.moduleMastery || {};
        const moduleEntries = Object.entries(moduleMastery);

        return (
          <div
            key={curr.specSlug}
            style={{
              background: "linear-gradient(180deg, var(--surface-secondary) 0%, var(--surface-primary) 100%)",
              borderRadius: 16,
              padding: 24,
              border: "1px solid var(--border-default)",
              boxShadow: "0 4px 24px color-mix(in srgb, var(--text-primary) 10%, transparent)",
            }}
          >
            {/* Header: spec slug + level badge + gate */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: levelCfg.color, boxShadow: `0 0 8px ${levelCfg.color}` }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{curr.specSlug}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: levelCfg.bg,
                  color: levelCfg.color,
                  border: `1px solid ${levelCfg.border}`,
                  letterSpacing: "0.02em",
                }}>
                  {levelCfg.label}
                </span>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 6,
                background: curr.gateStatus?.allowed ? "var(--status-success-bg)" : "var(--status-error-bg)",
                color: curr.gateStatus?.allowed ? "var(--status-success-text)" : "var(--status-error-text)",
                border: `1px solid ${curr.gateStatus?.allowed ? "var(--status-success-border)" : "var(--status-error-border)"}`,
              }}>
                {curr.gateStatus?.allowed ? "Gate: OPEN" : "Gate: LOCKED"}
              </span>
            </div>

            {/* Readiness Score — large ring */}
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 20 }}>
              <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
                <svg width={80} height={80} viewBox="0 0 80 80">
                  <circle cx={40} cy={40} r={34} fill="none" stroke="var(--border-default)" strokeWidth={6} />
                  <circle
                    cx={40} cy={40} r={34}
                    fill="none"
                    stroke={levelCfg.color}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - curr.readinessScore)}`}
                    transform="rotate(-90 40 40)"
                    style={{ filter: `drop-shadow(0 0 4px ${levelCfg.color})` }}
                  />
                </svg>
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: levelCfg.color,
                }}>
                  {pct}%
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Readiness Score</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {curr.gateStatus?.reason}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                  {curr.formativeScore !== null && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Formative: <strong style={{ color: "var(--text-secondary)" }}>{Math.round(curr.formativeScore * 100)}%</strong>
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Attempts: <strong style={{ color: "var(--text-secondary)" }}>{curr.attemptCount}</strong>
                  </span>
                  {curr.bestScore !== null && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Best: <strong style={{ color: "var(--text-secondary)" }}>{Math.round(curr.bestScore * 100)}%</strong>
                    </span>
                  )}
                  {curr.lastAttemptPassed !== null && (
                    <span style={{ fontSize: 11, color: curr.lastAttemptPassed ? "var(--status-success-text)" : "var(--status-error-text)" }}>
                      Last: {curr.lastAttemptPassed ? "PASSED" : "FAILED"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Module Mastery Bars */}
            {moduleEntries.length > 0 && (
              <div style={{ marginBottom: weakModules.length > 0 ? 16 : 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, letterSpacing: "0.03em" }}>
                  Module Mastery
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {moduleEntries.map(([moduleId, mastery]) => {
                    const masteryPct = Math.round((mastery as number) * 100);
                    const isWeak = weakModules.includes(moduleId);
                    const barColor = isWeak ? "var(--status-warning-text)" : "var(--status-success-text)";
                    return (
                      <div key={moduleId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 140, fontSize: 11, color: isWeak ? "var(--status-warning-text)" : "var(--text-muted)",
                          fontWeight: isWeak ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          flexShrink: 0,
                        }} title={moduleId}>
                          {moduleId}
                        </div>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--border-default)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 4,
                            width: `${masteryPct}%`,
                            background: barColor,
                            boxShadow: `0 0 6px ${barColor}`,
                            transition: "width 0.3s ease",
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isWeak ? "var(--status-warning-text)" : "var(--text-secondary)", width: 36, textAlign: "right", flexShrink: 0 }}>
                          {masteryPct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Weak Modules Warning */}
            {weakModules.length > 0 && (
              <div style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "var(--status-warning-bg)",
                border: "1px solid var(--status-warning-border)",
                fontSize: 12,
                color: "var(--status-warning-text)",
                lineHeight: 1.5,
              }}>
                <strong>Weak modules:</strong> {weakModules.join(", ")} — targeted revision recommended before exam attempt
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// TopLevelAgentBehaviorSection
// =====================================================

// Top-Level Targets Section - shows behavior targets for this caller
// Top-Level Behaviour Section - shows targets + measurements across all calls
export function TopLevelAgentBehaviorSection({ callerId, calls: propCalls, callerTargets: propCallerTargets }: { callerId: string; calls?: any[]; callerTargets?: any[] }) {
  const { isAdvanced } = useViewMode();
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [callerTargets, setCallerTargets] = useState<any[]>(propCallerTargets || []);
  const [behaviorTargets, setBehaviorTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [callerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use calls from props if available, otherwise fetch
      let calls = propCalls;
      if (!calls) {
        const res = await fetch(`/api/callers/${callerId}`);
        const data = await res.json();
        if (data.ok) {
          calls = data.calls || [];
          setCallerTargets(data.callerTargets || []);
        } else {
          calls = [];
        }
      }

      if (calls.length > 0) {
        // Fetch measurements from each call
        const allMeasurements: any[] = [];
        for (const call of calls.slice(0, 10)) {
          const callRes = await fetch(`/api/calls/${call.id}`);
          const callData = await callRes.json();
          if (callData.ok && callData.measurements) {
            allMeasurements.push(
              ...callData.measurements.map((m: any) => ({
                ...m,
                callCreatedAt: call.createdAt,
              }))
            );
          }
        }
        setMeasurements(allMeasurements);

        // Fetch behavior targets from the most recent call
        const mostRecentCall = calls[0];
        const callDetailRes = await fetch(`/api/calls/${mostRecentCall.id}`);
        const callDetail = await callDetailRes.json();
        if (callDetail.ok) {
          setBehaviorTargets(callDetail.effectiveTargets || []);
        }
      }
    } catch (err) {
      console.error("Error fetching behaviour data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading behaviour data...</div>
      </div>
    );
  }

  if (measurements.length === 0 && behaviorTargets.length === 0 && callerTargets.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No behaviour data</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Targets and measurements will appear here after calls are analyzed
        </div>
      </div>
    );
  }

  // Group measurements by parameter and calculate averages
  const grouped: Record<string, any[]> = {};
  for (const m of measurements) {
    const key = m.parameterId;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  }

  // Transform measurements into format for TwoColumnTargetsDisplay
  // We show average measurements as the primary value
  const avgMeasurements = Object.entries(grouped).map(([parameterId, paramMeasurements]) => {
    const avg = paramMeasurements.reduce((sum, m) => sum + m.actualValue, 0) / paramMeasurements.length;
    return {
      parameterId,
      actualValue: avg,
    };
  });

  // Build per-parameter history arrays sorted oldest-to-newest for sparklines
  const historyByParameter: Record<string, number[]> = {};
  for (const [parameterId, paramMeasurements] of Object.entries(grouped)) {
    const sorted = [...paramMeasurements].sort(
      (a, b) => new Date(a.callCreatedAt).getTime() - new Date(b.callCreatedAt).getTime()
    );
    historyByParameter[parameterId] = sorted.map((m: any) => m.actualValue);
  }

  // Advanced: full two-column targets + measurements with layer cascade
  if (isAdvanced) {
    return <TwoColumnTargetsDisplay callerTargets={callerTargets} behaviorTargets={behaviorTargets} measurements={avgMeasurements} historyByParameter={historyByParameter} />;
  }

  // Simple: measurement averages as clean sliders (no targets, no scope cascade)
  if (avgMeasurements.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", background: "var(--background)", borderRadius: 12 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No measurements yet</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Behaviour measurements will appear here after calls are analyzed
        </div>
      </div>
    );
  }

  // Build a label lookup from behaviorTargets or callerTargets
  const paramNames: Record<string, string> = {};
  for (const t of [...behaviorTargets, ...callerTargets]) {
    if (t.parameter?.name) paramNames[t.parameterId] = t.parameter.name;
  }

  return (
    <SliderGroup
      title={`Behaviour (${avgMeasurements.length})`}
      color={{ primary: "var(--badge-indigo-text)", glow: "var(--button-primary-bg)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {avgMeasurements.map((m) => {
          const name = paramNames[m.parameterId] || m.parameterId;
          const history = historyByParameter[m.parameterId] || [];
          const color = m.actualValue >= 0.7
            ? { primary: "var(--status-success-text)", glow: "var(--status-success-text)" }
            : m.actualValue >= 0.4
            ? { primary: "var(--status-warning-text)", glow: "var(--status-warning-text)" }
            : { primary: "var(--status-error-text)", glow: "var(--status-error-text)" };

          return (
            <div key={m.parameterId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <VerticalSlider
                value={m.actualValue}
                color={color}
                tooltip={`${name}\n\nAverage: ${(m.actualValue * 100).toFixed(0)}%${history.length >= 2 ? `\nHistory: ${history.length} calls` : ""}`}
                width={56}
                height={140}
                showGauge={false}
                historyPoints={history}
              />
              <div style={{
                marginTop: 8, fontSize: 9, fontWeight: 500,
                color: "var(--text-muted)", textAlign: "center",
                maxWidth: 70, lineHeight: 1.2,
                textTransform: "uppercase", letterSpacing: "0.3px",
              }}>
                {name.replace("BEH-", "").replace(/-/g, " ")}
              </div>
            </div>
          );
        })}
      </div>
    </SliderGroup>
  );
}

// =====================================================
// PlanProgressSection
// =====================================================

// ------------------------------------------------------------------
// Plan Progress Section - shows lesson plan progress for a caller
// ------------------------------------------------------------------

const PLAN_SESSION_TYPES: Record<string, { label: string; color: string }> = {
  onboarding: { label: "Onboarding", color: "var(--accent-primary)" },
  introduce: { label: "Introduce", color: "var(--status-success-text)" },
  deepen: { label: "Deepen", color: "var(--accent-primary)" },
  review: { label: "Review", color: "var(--status-warning-text)" },
  assess: { label: "Assess", color: "var(--status-error-text)" },
  consolidate: { label: "Consolidate", color: "var(--accent-secondary, #8b5cf6)" },
};

export function PlanProgressSection({
  callerId,
  calls,
  domainId,
}: {
  callerId: string;
  calls: Call[];
  domainId: string | null | undefined;
}) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domainId) {
      setLoading(false);
      return;
    }
    // Find curriculum for this caller's domain, then fetch its lesson plan
    (async () => {
      try {
        // Find subject for this domain
        const domainRes = await fetch(`/api/domains/${domainId}`);
        const domainData = await domainRes.json();
        if (!domainData.ok || !domainData.domain?.subjects?.length) {
          setLoading(false);
          return;
        }
        const subjectId = domainData.domain.subjects[0].subjectId;

        // Get curriculum for this subject
        const currRes = await fetch(`/api/subjects/${subjectId}/curriculum`);
        const currData = await currRes.json();
        if (!currData.curriculum?.id) {
          setLoading(false);
          return;
        }

        // Get lesson plan
        const planRes = await fetch(`/api/curricula/${currData.curriculum.id}/lesson-plan`);
        const planData = await planRes.json();
        if (planData.ok && planData.plan) {
          setPlan(planData.plan);
        }
      } catch {
        // silent
      }
      setLoading(false);
    })();
  }, [domainId]);

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Plan Progress</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!plan || !plan.entries?.length) {
    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Plan Progress</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No lesson plan configured for this caller&apos;s domain. Create one from the Subject page.
        </p>
      </div>
    );
  }

  const entries: any[] = plan.entries;
  const completedCalls = calls.length;
  const totalPlanned = entries.length;

  // Map calls to plan entries by index (call 1 → session 1, etc.)
  const progressEntries = entries.map((entry: any, i: number) => {
    const callIndex = i;
    const call = calls.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[callIndex];

    let status: "completed" | "current" | "upcoming";
    if (callIndex < completedCalls - 1) {
      status = "completed";
    } else if (callIndex === completedCalls - 1) {
      status = "current";
    } else {
      status = "upcoming";
    }

    return {
      ...entry,
      status,
      call: call || null,
      callDate: call?.createdAt || null,
    };
  });

  const progressPct = totalPlanned > 0 ? Math.round((Math.min(completedCalls, totalPlanned) / totalPlanned) * 100) : 0;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Plan Progress</h3>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        Call {completedCalls} of {totalPlanned} planned ({progressPct}% through plan)
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: "var(--surface-tertiary)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{
          height: "100%",
          borderRadius: 3,
          background: progressPct === 100 ? "var(--status-success-text)" : "linear-gradient(90deg, var(--accent-primary), var(--accent-primary))",
          width: `${progressPct}%`,
          transition: "width 0.5s ease-out",
        }} />
      </div>

      {/* Session list */}
      <div style={{ display: "grid", gap: 4 }}>
        {progressEntries.map((e: any) => {
          const sessionCfg = PLAN_SESSION_TYPES[e.type] || { label: e.type, color: "var(--text-muted)" };
          return (
            <div key={e.session} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
              borderRadius: 6,
              border: e.status === "current" ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
              background: e.status === "current"
                ? "color-mix(in srgb, var(--accent-primary) 6%, transparent)"
                : e.status === "completed"
                  ? "var(--surface-primary)"
                  : "transparent",
              opacity: e.status === "upcoming" ? 0.6 : 1,
            }}>
              {/* Status icon */}
              <span style={{ fontSize: 14, minWidth: 18, textAlign: "center" }}>
                {e.status === "completed" ? "\u2705" : e.status === "current" ? "\uD83D\uDD35" : "\u2B1C"}
              </span>

              {/* Session number */}
              <span style={{
                fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 20,
                textAlign: "right", fontVariantNumeric: "tabular-nums",
              }}>
                {e.session}.
              </span>

              {/* Label */}
              <span style={{ flex: 1, fontSize: 13, fontWeight: e.status === "current" ? 600 : 400, color: "var(--text-primary)" }}>
                {e.label}
              </span>

              {/* Session type badge */}
              <span style={{
                display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 10,
                fontWeight: 600, color: sessionCfg.color,
                backgroundColor: `color-mix(in srgb, ${sessionCfg.color} 12%, transparent)`,
                textTransform: "uppercase", minWidth: 70, textAlign: "center",
              }}>
                {sessionCfg.label}
              </span>

              {/* Module label */}
              {e.moduleLabel && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.moduleLabel}
                </span>
              )}

              {/* Call date */}
              {e.callDate && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {new Date(e.callDate).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
