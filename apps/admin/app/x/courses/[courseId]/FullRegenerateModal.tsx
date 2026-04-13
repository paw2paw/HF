'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle, Circle,
  SkipForward,
} from 'lucide-react';
import { useSourceStatus } from '@/hooks/useSourceStatus';
import { useTaskPoll, type PollableTask } from '@/hooks/useTaskPoll';

// ── Types ──────────────────────────────────────────────

type SourceItem = {
  id: string;
  name: string;
  documentType: string;
  extractorVersion: number | null;
  assertionCount: number;
};

type Phase =
  | 'confirm'
  | 'extracting'
  | 'regenerating-curriculum'
  | 'generating-lesson-plan'
  | 'recomposing'
  | 'done';

type PhaseStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

type ReExtractResult = {
  sourceId: string;
  name: string;
  jobId: string | null;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
};

interface FullRegenerateModalProps {
  courseId: string;
  sources: SourceItem[];
  onClose: () => void;
  onComplete: () => void;
}

// ── Phase definitions for progress rail ────────────────

const PHASE_STEPS = [
  { key: 'extracting' as const, label: 'Re-extract content' },
  { key: 'regenerating-curriculum' as const, label: 'Regenerate curriculum' },
  { key: 'generating-lesson-plan' as const, label: 'Generate lesson plan' },
  { key: 'recomposing' as const, label: 'Recompose caller prompts' },
] as const;

const INITIAL_STATUSES: Record<string, PhaseStatus> = {
  'extracting': 'pending',
  'regenerating-curriculum': 'pending',
  'generating-lesson-plan': 'pending',
  'recomposing': 'pending',
};

// ── Component ──────────────────────────────────────────

export function FullRegenerateModal({
  courseId, sources, onClose, onComplete,
}: FullRegenerateModalProps) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [statuses, setStatuses] = useState<Record<string, PhaseStatus>>({ ...INITIAL_STATUSES });
  const [error, setError] = useState<string | null>(null);

  // Data gathered during execution
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [activeCallerCount, setActiveCallerCount] = useState(0);
  const [extractResults, setExtractResults] = useState<ReExtractResult[]>([]);
  const [curriculumResult, setCurriculumResult] = useState<{ moduleCount: number } | null>(null);
  const [lessonPlanTaskId, setLessonPlanTaskId] = useState<string | null>(null);
  const [lessonPlanResult, setLessonPlanResult] = useState<{ sessionCount: number } | null>(null);
  const [recomposeResult, setRecomposeResult] = useState<{ composed: number; failed: number } | null>(null);

  // Guards
  const extractionDoneRef = useRef(false);

  const totalAssertions = sources.reduce((sum, s) => sum + s.assertionCount, 0);

  // ── Helpers ──────────────────────────────────────────

  const markPhase = useCallback((key: string, status: PhaseStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }));
  }, []);

  // ── Extraction polling ───────────────────────────────

  const extractingIds = extractResults.filter((r) => r.jobId).map((r) => r.sourceId);
  const statusMap = useSourceStatus(extractingIds, {
    enabled: phase === 'extracting' && extractingIds.length > 0,
    pollInterval: 5_000,
  });

  const allExtracted = phase === 'extracting'
    && extractingIds.length > 0
    && extractingIds.every((id) => {
      const s = statusMap[id];
      return s && s.assertionCount > 0;
    });

  // Auto-advance from extraction → curriculum
  useEffect(() => {
    if (allExtracted && !extractionDoneRef.current) {
      extractionDoneRef.current = true;
      markPhase('extracting', 'done');
      startCurriculumRegen();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allExtracted]);

  // ── Lesson plan polling ──────────────────────────────

  useTaskPoll({
    taskId: lessonPlanTaskId,
    onComplete: async (task: PollableTask) => {
      const plan = task.context?.plan;
      if (plan && curriculumId) {
        // Save the generated plan
        try {
          await fetch(`/api/curricula/${curriculumId}/lesson-plan`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries: plan }),
          });
        } catch {
          // Non-fatal — plan was generated, save failed
        }
        setLessonPlanResult({ sessionCount: Array.isArray(plan) ? plan.length : 0 });
      }
      setLessonPlanTaskId(null);
      markPhase('generating-lesson-plan', 'done');
      startRecompose();
    },
    onError: (message: string) => {
      setLessonPlanTaskId(null);
      setError(message);
      markPhase('generating-lesson-plan', 'error');
      setPhase('generating-lesson-plan');
    },
    timeoutMs: 300_000, // 5 minutes for lesson plan
  });

  // ── Phase runners ────────────────────────────────────

  const fetchCurriculumId = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`/api/courses/${courseId}/sessions`);
      const data = await res.json();
      if (data.ok && data.curriculumId) {
        setCurriculumId(data.curriculumId);
        return data.curriculumId;
      }
    } catch { /* fall through */ }
    return null;
  }, [courseId]);

  const startExtraction = useCallback(async () => {
    if (sources.length === 0) {
      markPhase('extracting', 'skipped');
      startCurriculumRegen();
      return;
    }

    setPhase('extracting');
    markPhase('extracting', 'active');
    setError(null);
    extractionDoneRef.current = false;

    try {
      const res = await fetch(`/api/courses/${courseId}/re-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: sources.map((s) => s.id) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to start re-extraction');
        markPhase('extracting', 'error');
        return;
      }
      setExtractResults(data.sources || []);
      setActiveCallerCount(data.activeCallerCount || 0);

      // If no jobs triggered (all failed), advance
      const triggered = (data.sources || []).filter((s: ReExtractResult) => s.jobId);
      if (triggered.length === 0) {
        markPhase('extracting', 'done');
        startCurriculumRegen();
      }
    } catch {
      setError('Network error starting extraction');
      markPhase('extracting', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, sources]);

  const startCurriculumRegen = useCallback(async () => {
    setPhase('regenerating-curriculum');
    markPhase('regenerating-curriculum', 'active');
    setError(null);

    try {
      const res = await fetch(`/api/courses/${courseId}/regenerate-curriculum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to regenerate curriculum');
        markPhase('regenerating-curriculum', 'error');
        return;
      }
      setCurriculumResult({ moduleCount: data.moduleCount || 0 });
      const cId = data.curriculumId || curriculumId;
      if (data.curriculumId) setCurriculumId(data.curriculumId);
      markPhase('regenerating-curriculum', 'done');
      startLessonPlan(cId);
    } catch {
      setError('Network error regenerating curriculum');
      markPhase('regenerating-curriculum', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, curriculumId]);

  const startLessonPlan = useCallback(async (cId?: string | null) => {
    const useCurrId = cId || curriculumId;
    if (!useCurrId) {
      markPhase('generating-lesson-plan', 'skipped');
      startRecompose();
      return;
    }

    setPhase('generating-lesson-plan');
    markPhase('generating-lesson-plan', 'active');
    setError(null);

    try {
      const res = await fetch(`/api/curricula/${useCurrId}/lesson-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to start lesson plan generation');
        markPhase('generating-lesson-plan', 'error');
        return;
      }
      // Polling handled by useTaskPoll
      setLessonPlanTaskId(data.taskId);
    } catch {
      setError('Network error starting lesson plan');
      markPhase('generating-lesson-plan', 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculumId]);

  const startRecompose = useCallback(async () => {
    if (activeCallerCount === 0) {
      markPhase('recomposing', 'skipped');
      setPhase('done');
      return;
    }

    setPhase('recomposing');
    markPhase('recomposing', 'active');

    try {
      const res = await fetch(`/api/courses/${courseId}/re-extract/recompose`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setRecomposeResult({ composed: data.composed, failed: data.failed });
      }
    } catch {
      // Non-fatal
    }
    markPhase('recomposing', 'done');
    setPhase('done');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, activeCallerCount]);

  // ── Start the full chain ─────────────────────────────

  const handleStart = useCallback(async () => {
    // Pre-fetch curriculumId
    await fetchCurriculumId();
    startExtraction();
  }, [fetchCurriculumId, startExtraction]);

  // ── Skip / Retry handlers ───────────────────────────

  const handleRetry = useCallback(() => {
    setError(null);
    if (phase === 'extracting') startExtraction();
    else if (phase === 'regenerating-curriculum') startCurriculumRegen();
    else if (phase === 'generating-lesson-plan') startLessonPlan();
    else if (phase === 'recomposing') startRecompose();
  }, [phase, startExtraction, startCurriculumRegen, startLessonPlan, startRecompose]);

  const handleSkip = useCallback(() => {
    setError(null);
    markPhase(phase, 'skipped');
    if (phase === 'extracting') startCurriculumRegen();
    else if (phase === 'regenerating-curriculum') startLessonPlan();
    else if (phase === 'generating-lesson-plan') startRecompose();
    else if (phase === 'recomposing') { markPhase('recomposing', 'skipped'); setPhase('done'); }
  }, [phase, markPhase, startCurriculumRegen, startLessonPlan, startRecompose]);

  // ── Render helpers ───────────────────────────────────

  const canClose = phase === 'confirm' || phase === 'done';

  const phaseIcon = (status: PhaseStatus) => {
    switch (status) {
      case 'active': return <span className="hf-spinner" style={{ width: 14, height: 14 }} />;
      case 'done': return <CheckCircle size={14} className="hf-text-success" />;
      case 'error': return <XCircle size={14} className="hf-text-error" />;
      case 'skipped': return <SkipForward size={14} className="hf-text-muted" />;
      default: return <Circle size={14} className="hf-text-placeholder" />;
    }
  };

  // ── Extraction progress detail ───────────────────────

  const extractDoneCount = extractingIds.filter((id) => statusMap[id]?.assertionCount > 0).length;

  return (
    <div className="hf-modal-overlay" onClick={() => canClose && onClose()}>
      <div className="hf-modal" style={{ maxWidth: 560, padding: 24 }} onClick={(e) => e.stopPropagation()}>

        {/* ── Title ── */}
        <h3 className="hf-modal-title hf-flex hf-items-center hf-gap-sm">
          <RefreshCw size={18} />
          Fully Regenerate Course
        </h3>

        {/* ── Progress rail (always visible during execution) ── */}
        {phase !== 'confirm' && (
          <div className="hf-card-compact hf-mb-md">
            {PHASE_STEPS.map((step) => {
              const status = statuses[step.key];
              const isCurrent = phase === step.key;
              return (
                <div
                  key={step.key}
                  className={`hf-flex hf-items-center hf-gap-sm${isCurrent ? ' hf-glow-active' : ''}`}
                  style={{ padding: '8px 12px' }}
                >
                  {phaseIcon(status)}
                  <span className={`hf-text-sm ${status === 'skipped' ? 'hf-text-muted' : 'hf-text-secondary'}`}>
                    {step.label}
                    {status === 'skipped' && ' — skipped'}
                  </span>
                  {step.key === 'extracting' && status === 'active' && extractingIds.length > 0 && (
                    <span className="hf-text-xs hf-text-placeholder hf-ml-auto">
                      {extractDoneCount}/{extractingIds.length}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Phase: Confirm ── */}
        {phase === 'confirm' && (
          <>
            <div className="hf-banner hf-banner-warning hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="hf-flex hf-items-center hf-gap-xs hf-text-bold hf-text-sm">
                <AlertTriangle size={14} />
                This is a destructive operation
              </div>
              <div className="hf-text-sm hf-mt-xs">
                All content assertions will be purged and re-extracted from {sources.length} source{sources.length === 1 ? '' : 's'}.
                {totalAssertions > 0 && <> ({totalAssertions} assertions will be rebuilt.)</>}
                {' '}The curriculum and lesson plan will be regenerated from scratch.
              </div>
              <div className="hf-text-xs hf-text-muted hf-mt-xs">
                Active caller prompts will be recomposed automatically. This may take several minutes.
              </div>
            </div>

            {/* Preview of phases */}
            <div className="hf-card-compact hf-mb-md">
              {PHASE_STEPS.map((step) => (
                <div key={step.key} className="hf-flex hf-items-center hf-gap-sm" style={{ padding: '8px 12px' }}>
                  <Circle size={14} className="hf-text-placeholder" />
                  <span className="hf-text-sm hf-text-secondary">
                    {step.label}
                    {step.key === 'extracting' && ` (${sources.length} sources)`}
                  </span>
                </div>
              ))}
            </div>

            <div className="hf-modal-actions">
              <button onClick={onClose} className="hf-btn hf-btn-secondary">Cancel</button>
              <button
                onClick={handleStart}
                disabled={sources.length === 0}
                className="hf-btn hf-btn-destructive"
              >
                <RefreshCw size={14} />
                Fully Regenerate
              </button>
            </div>
          </>
        )}

        {/* ── Error banner with retry/skip ── */}
        {error && phase !== 'confirm' && phase !== 'done' && (
          <div className="hf-banner hf-banner-error hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="hf-text-sm">{error}</div>
            <div className="hf-flex hf-gap-sm hf-mt-sm">
              <button onClick={handleRetry} className="hf-btn hf-btn-sm hf-btn-primary">
                Retry
              </button>
              <button onClick={handleSkip} className="hf-btn hf-btn-sm hf-btn-secondary">
                <SkipForward size={12} />
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── Phase: Done ── */}
        {phase === 'done' && (
          <>
            <div className="hf-banner hf-banner-success hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="hf-flex hf-items-center hf-gap-xs hf-text-bold hf-text-sm">
                <CheckCircle size={14} />
                Regeneration complete
              </div>
              <div className="hf-text-sm hf-mt-xs">
                {statuses['extracting'] === 'done' && (
                  <>
                    {extractResults.filter((r) => r.jobId).length} source{extractResults.filter((r) => r.jobId).length === 1 ? '' : 's'} re-extracted.
                    {extractResults.filter((r) => r.skipped).length > 0 && (
                      <> {extractResults.filter((r) => r.skipped).length} skipped (no file). </>
                    )}
                    {' '}
                  </>
                )}
                {curriculumResult && (
                  <>{curriculumResult.moduleCount} module{curriculumResult.moduleCount === 1 ? '' : 's'} generated. </>
                )}
                {lessonPlanResult && (
                  <>{lessonPlanResult.sessionCount} session{lessonPlanResult.sessionCount === 1 ? '' : 's'} planned. </>
                )}
                {recomposeResult && recomposeResult.composed > 0 && (
                  <>{recomposeResult.composed} caller{recomposeResult.composed === 1 ? '' : 's'} recomposed.</>
                )}
              </div>
            </div>

            {/* Failures summary */}
            {(extractResults.some((r) => r.error) || (recomposeResult && recomposeResult.failed > 0)) && (
              <div className="hf-banner hf-banner-warning hf-mb-md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                {extractResults.some((r) => r.error) && (
                  <div className="hf-flex hf-items-center hf-gap-xs hf-text-sm">
                    <XCircle size={14} />
                    {extractResults.filter((r) => r.error).length} extraction{extractResults.filter((r) => r.error).length === 1 ? '' : 's'} failed
                  </div>
                )}
                {recomposeResult && recomposeResult.failed > 0 && (
                  <div className="hf-text-xs hf-text-muted hf-mt-xs">
                    {recomposeResult.failed} caller{recomposeResult.failed === 1 ? '' : 's'} failed to recompose
                  </div>
                )}
              </div>
            )}

            <div className="hf-modal-actions">
              <button
                onClick={() => { onComplete(); onClose(); }}
                className="hf-btn hf-btn-primary"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
