"use client";

/**
 * CourseCurriculumTab — structural spine of the course.
 *
 * Epic #131 #138. The home the curriculum has never had. Renders:
 *   1. A data-quality scorecard banner (LO coverage, FK coverage, garbage count)
 *   2. The existing CurriculumEditor for inline module/LO editing
 *   3. A "Regenerate curriculum" button that calls the new POST endpoint
 *      wrapping extractCurriculumFromAssertions → syncModulesToDB → reconciler
 *   4. A persistent warning banner after regen if the lesson plan may be stale
 *
 * The scorecard + regenerate flow are the structural prevention for the
 * incident #137 root cause: the curriculum was invisible, so its rot went
 * unnoticed. Making it visible + fixable from one screen is the fix.
 */

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, RefreshCw, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import CurriculumEditor from "@/app/x/subjects/_components/CurriculumEditor";
import type { CourseLinkageScorecard } from "@/lib/content-trust/validate-lo-linkage";
import "./course-curriculum-tab.css";

interface CourseCurriculumTabProps {
  courseId: string;
  curriculumId: string | null;
  isOperator: boolean;
  onSwitchTab?: (tab: string) => void;
}

interface RegenerateResponse {
  ok: boolean;
  curriculumId?: string;
  moduleCount?: number;
  warnings?: string[];
  reconcile?: { assertionsScanned: number; fkWritten: number };
  lessonPlanStaleWarning?: boolean;
  orphanedProgressSlugs?: string[];
  error?: string;
}

export function CourseCurriculumTab({
  courseId,
  curriculumId,
  isOperator,
  onSwitchTab,
}: CourseCurriculumTabProps) {
  const [scorecard, setScorecard] = useState<CourseLinkageScorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [regenResult, setRegenResult] = useState<RegenerateResponse | null>(null);

  // ── Load scorecard ────────────────────────────────────────
  const loadScorecard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/curriculum-scorecard`);
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed to load scorecard");
      } else {
        setScorecard(data.scorecard);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadScorecard();
  }, [loadScorecard]);

  // ── Regenerate handler ────────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    if (regenerating) return;
    const confirmMsg =
      "Regenerate the curriculum from extracted content?\n\n" +
      "This will rewrite modules and learning objectives using the A3-hardened AI prompt. " +
      "Existing lesson plan session assignments will be preserved but may go stale if modules change.\n\n" +
      "This makes one AI call.";
    if (!window.confirm(confirmMsg)) return;

    setRegenerating(true);
    setRegenResult(null);
    try {
      const res = await fetch(`/api/courses/${courseId}/regenerate-curriculum`, {
        method: "POST",
      });
      const data = (await res.json()) as RegenerateResponse;
      setRegenResult(data);
      if (data.ok) {
        await loadScorecard();
      }
    } catch (e) {
      setRegenResult({ ok: false, error: e instanceof Error ? e.message : "Network error" });
    } finally {
      setRegenerating(false);
    }
  }, [courseId, regenerating, loadScorecard]);

  // ── Render ─────────────────────────────────────────────────
  if (!curriculumId) {
    return (
      <div className="hf-empty">
        <p className="hf-text-sm hf-text-muted">
          No curriculum yet. Upload content on the Content tab to generate one.
        </p>
      </div>
    );
  }

  return (
    <div className="hf-stack-md">
      {/* Scorecard banner */}
      {loading && <div className="hf-spinner" />}

      {error && <div className="hf-banner hf-banner-error">{error}</div>}

      {scorecard && (
        <ScorecardBanner
          scorecard={scorecard}
          onRegenerate={isOperator ? handleRegenerate : undefined}
          regenerating={regenerating}
        />
      )}

      {/* Regeneration result */}
      {regenResult && (
        <RegenerateResult result={regenResult} onSwitchTab={onSwitchTab} />
      )}

      {/* The actual editor */}
      <CurriculumEditor curriculumId={curriculumId} />
    </div>
  );
}

// ── Scorecard banner component ────────────────────────────────

function ScorecardBanner({
  scorecard,
  onRegenerate,
  regenerating,
}: {
  scorecard: CourseLinkageScorecard;
  onRegenerate?: () => void;
  regenerating: boolean;
}) {
  const hasWarnings = scorecard.warnings.length > 0;
  const healthy =
    scorecard.scorecard.coveragePct >= 60 &&
    scorecard.scorecard.fkCoveragePct >= 60 &&
    scorecard.loRows.garbageDescriptions === 0;

  return (
    <div className={`hf-card ${hasWarnings ? "hf-banner-warning" : ""} curriculum-scorecard`}>
      <div className="curriculum-scorecard-header">
        <div className="curriculum-scorecard-title">
          {healthy ? (
            <CheckCircle2 size={16} className="hf-text-success" />
          ) : (
            <AlertTriangle size={16} className="hf-text-warning" />
          )}
          <span className="hf-section-title">Curriculum health</span>
        </div>
        {onRegenerate && (
          <button
            type="button"
            className="hf-btn hf-btn-primary hf-btn-sm"
            onClick={onRegenerate}
            disabled={regenerating}
            title="Regenerate curriculum from extracted content"
          >
            {regenerating ? (
              <>
                <RefreshCw size={13} className="hf-glow-active" /> Regenerating…
              </>
            ) : (
              <>
                <Sparkles size={13} /> Regenerate
              </>
            )}
          </button>
        )}
      </div>

      <div className="curriculum-scorecard-grid">
        <Metric label="Teaching points" value={scorecard.scorecard.total} />
        <Metric
          label="With LO ref"
          value={`${scorecard.scorecard.withValidRef} / ${scorecard.scorecard.total}`}
          pct={scorecard.scorecard.coveragePct}
        />
        <Metric
          label="FK linked"
          value={`${scorecard.scorecard.withFk} / ${scorecard.scorecard.total}`}
          pct={scorecard.scorecard.fkCoveragePct}
        />
        <Metric label="Modules" value={`${scorecard.modules.active} / ${scorecard.modules.total}`} />
        <Metric
          label="Learning objectives"
          value={scorecard.loRows.total}
          warning={scorecard.loRows.garbageDescriptions > 0
            ? `${scorecard.loRows.garbageDescriptions} garbage`
            : undefined}
        />
        <Metric
          label="Questions linked"
          value={`${scorecard.questions.linkedToTp} / ${scorecard.questions.total}`}
          pct={scorecard.questions.linkedPct}
        />
      </div>

      {hasWarnings && (
        <ul className="curriculum-scorecard-warnings">
          {scorecard.warnings.map((w, i) => (
            <li key={i} className="hf-text-xs">
              <AlertTriangle size={11} className="hf-text-warning" /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  pct,
  warning,
}: {
  label: string;
  value: string | number;
  pct?: number;
  warning?: string;
}) {
  return (
    <div className="curriculum-scorecard-metric">
      <div className="curriculum-scorecard-metric-label">{label}</div>
      <div className="curriculum-scorecard-metric-value">
        {value}
        {pct !== undefined && <span className="curriculum-scorecard-metric-pct"> ({pct}%)</span>}
      </div>
      {warning && (
        <div className="curriculum-scorecard-metric-warning">
          <AlertTriangle size={10} /> {warning}
        </div>
      )}
    </div>
  );
}

// ── Regenerate result banner ─────────────────────────────────

function RegenerateResult({
  result,
  onSwitchTab,
}: {
  result: RegenerateResponse;
  onSwitchTab?: (tab: string) => void;
}) {
  if (!result.ok) {
    return (
      <div className="hf-banner hf-banner-error">
        <AlertTriangle size={14} /> Regeneration failed: {result.error}
      </div>
    );
  }

  return (
    <div className="hf-banner hf-banner-success">
      <div>
        <CheckCircle2 size={14} />
        <strong> Curriculum regenerated.</strong>{" "}
        {result.moduleCount} modules, {result.reconcile?.fkWritten ?? 0} FK links written
        across {result.reconcile?.assertionsScanned ?? 0} assertions.
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <ul className="hf-text-xs hf-mt-xs">
          {result.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {result.lessonPlanStaleWarning && (
        <div className="hf-text-xs hf-mt-sm">
          <AlertTriangle size={11} className="hf-text-warning" /> Module structure changed.
          The lesson plan may reference stale LO refs.{" "}
          {onSwitchTab ? (
            <button
              type="button"
              className="hf-link"
              onClick={() => onSwitchTab("journey")}
            >
              Review the Journey tab →
            </button>
          ) : (
            <Link href="?tab=journey" className="hf-link">
              Review the Journey tab →
            </Link>
          )}
        </div>
      )}

      {result.orphanedProgressSlugs && result.orphanedProgressSlugs.length > 0 && (
        <div className="hf-text-xs hf-mt-sm">
          <AlertTriangle size={11} className="hf-text-warning" />{" "}
          {result.orphanedProgressSlugs.length} module(s) had caller progress but were
          removed: {result.orphanedProgressSlugs.join(", ")}
        </div>
      )}
    </div>
  );
}
