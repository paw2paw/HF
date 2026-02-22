import { useState, useEffect } from "react";

/**
 * useWizardResume — detects resumable in-progress wizard tasks on mount.
 *
 * Queries /api/tasks for in-progress tasks matching the given taskType.
 * Returns the most recent pending task (if any) so the wizard page can
 * offer a "Continue where you left off?" banner.
 *
 * Only returns tasks in wizard phase (context._wizardStep exists or currentStep === 0).
 * Tasks that have transitioned to execution phase (background job running) are excluded.
 */

export interface PendingWizardTask {
  id: string;
  taskType: string;
  context: Record<string, any>;
  startedAt: string;
  currentStep: number;
  totalSteps: number;
}

interface UseWizardResumeResult {
  pendingTask: PendingWizardTask | null;
  isLoading: boolean;
}

export function useWizardResume(taskType: string): UseWizardResumeResult {
  const [pendingTask, setPendingTask] = useState<PendingWizardTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/tasks?status=in_progress&taskType=${encodeURIComponent(taskType)}&limit=1`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.tasks?.length > 0) {
          const task = data.tasks[0];
          // Only resume wizard-phase tasks (not tasks that have transitioned to execution)
          const ctx = task.context || {};
          const isWizardPhase = ctx._wizardStep !== undefined || task.currentStep === 0;
          if (isWizardPhase) {
            setPendingTask({
              id: task.id,
              taskType: task.taskType,
              context: ctx,
              startedAt: task.startedAt,
              currentStep: task.currentStep,
              totalSteps: task.totalSteps,
            });
          }
        }
      })
      .catch(() => {
        // Silent — if we can't check, just start fresh
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskType]);

  return { pendingTask, isLoading };
}
