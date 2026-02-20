'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle, PlayCircle, Zap } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { StepProps } from '../CourseSetupWizard';

export function CourseDoneStep({ getData, setData, endFlow }: StepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState<{
    message: string;
    phase: string;
    stepIndex?: number;
    totalSteps?: number;
    error?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const courseName = getData<string>('courseName');
  const sessionCount = getData<number>('sessionCount') || 12;
  const studentEmails = getData<string[]>('studentEmails') || [];
  const teachingStyle = getData<string>('teachingStyle');
  const learningOutcomes = getData<string[]>('learningOutcomes') || [];
  const contentFile = getData<File>('contentFile');
  const welcomeMessage = getData<string>('welcomeMessage') || '';
  const durationMins = getData<number>('durationMins') || 45;
  const emphasis = getData<string>('emphasis') || 'balanced';

  // On mount: resume if taskId already in flow bag (page refresh during setup)
  useEffect(() => {
    const existingTaskId = getData<string>('taskId');
    if (existingTaskId) {
      setTaskId(existingTaskId);
      setLoading(true);
    }
  }, []);

  // Poll for task progress using setInterval (correct React pattern)
  useEffect(() => {
    if (!taskId) return;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks?taskId=${taskId}`);
        const data = await res.json();

        if (data.ok && data.task) {
          const task = data.task;
          if (task.context) {
            setTaskProgress({
              message: task.context.message || task.context.phase || '',
              phase: task.context.phase || '',
              stepIndex: task.context.stepIndex,
              totalSteps: task.context.totalSteps,
              error: task.context.error,
            });
          }

          // If task is completed or abandoned, stop polling
          if (task.status === 'completed' || task.status === 'abandoned') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (task.status === 'abandoned') {
              setError(task.context?.error || 'Course setup failed');
            } else {
              // Successfully completed
              setData('taskId', undefined);
              setCompleted(true);
            }
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('[CourseDoneStep] Failed to poll task:', err);
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [taskId]);

  const handleLaunch = async () => {
    setLoading(true);
    setError(null);

    try {
      // Note: We don't have a sourceId yet (file upload in ContentStep doesn't persist)
      // This is acceptable - the executor will generate curriculum from learningOutcomes instead
      const res = await fetch('/api/courses/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName,
          learningOutcomes,
          teachingStyle,
          sessionCount,
          durationMins,
          emphasis,
          welcomeMessage,
          studentEmails,
          // sourceId: undefined, // not available (file not persisted)
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to start course setup');
      }

      // Persist taskId to flow bag (survives page refresh)
      setData('taskId', data.taskId);
      setTaskId(data.taskId);
      // Loading continues as we poll the task
    } catch (err: any) {
      setError(err.message || 'Failed to launch course setup');
      setLoading(false);
    }
  };

  // Show success state after course creation completes
  if (completed && !loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 p-8 max-w-2xl mx-auto w-full flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              Course Created Successfully!
            </h1>
            <p className="text-[var(--text-secondary)] mb-6">
              Your course is ready. Students can now join and start learning.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)]">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              onClick={() => {
                setCompleted(false);
                setLoading(false);
                setTaskId(null);
                endFlow();
                router.push('/x/courses');
              }}
              className="flex-1 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity font-semibold"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while creating course
  if (loading || taskId) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 p-8 max-w-2xl mx-auto w-full flex flex-col items-center justify-center">
          <div className="text-center">
            {taskProgress?.error || error ? (
              <>
                <div className="text-5xl mb-4">❌</div>
                <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                  Course Setup Failed
                </h1>
                <p className="text-[var(--text-secondary)] mb-6">
                  {error || taskProgress?.error || 'An error occurred while creating the course'}
                </p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4 animate-spin" style={{ animationDuration: '2s' }}>
                  ⚙️
                </div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                  Creating Your Course
                </h1>
                <p className="text-[var(--text-secondary)] mb-4">
                  {taskProgress?.message || 'Setting up...'}
                </p>
                {taskProgress?.totalSteps && (
                  <div className="w-full max-w-xs bg-[var(--surface-secondary)] rounded-full h-2">
                    <div
                      className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          ((taskProgress.stepIndex || 0) + 1) /
                          (taskProgress.totalSteps || 1) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Error Actions */}
        {(error || taskProgress?.error) && (
          <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)]">
            <div className="max-w-2xl mx-auto flex gap-3">
              <button
                onClick={() => {
                  setLoading(false);
                  setTaskId(null);
                  setTaskProgress(null);
                  setError(null);
                  setData('taskId', undefined);
                }}
                className="flex-1 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity font-semibold"
              >
                Retry
              </button>
              <button
                onClick={() => {
                  endFlow();
                  router.push('/x/courses');
                }}
                className="flex-1 px-6 py-3 border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-primary)] transition-colors"
              >
                Back to Courses
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Course Ready!</h1>
          <p className="text-[var(--text-secondary)]">Your course is configured and ready to teach</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Course Card */}
          <div className="p-4 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
            <p className="text-xs text-[var(--text-tertiary)] font-semibold mb-1">COURSE</p>
            <p className="font-semibold text-[var(--text-primary)]">{courseName}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{sessionCount} lessons planned</p>
          </div>

          {/* Students Card */}
          <div className="p-4 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
            <p className="text-xs text-[var(--text-tertiary)] font-semibold mb-1">STUDENTS</p>
            <p className="font-semibold text-[var(--text-primary)]">
              {studentEmails?.length || 0} invited
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Awaiting signup</p>
          </div>

          {/* Teaching Style Card */}
          <div className="p-4 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
            <p className="text-xs text-[var(--text-tertiary)] font-semibold mb-1">TEACHING STYLE</p>
            <p className="font-semibold text-[var(--text-primary)] capitalize">{teachingStyle}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">AI persona configured</p>
          </div>
        </div>

        {/* Readiness Check */}
        <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100 mb-1">Course is ready</p>
              <p className="text-sm text-green-800 dark:text-green-200">
                All requirements met. You can start teaching right away.
              </p>
            </div>
          </div>
        </div>

        {/* Action Text */}
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-6">
            What would you like to do next?
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)]">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button
            onClick={handleLaunch}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
          >
            <PlayCircle className="w-5 h-5" />
            Launch Course
          </button>
          <button
            onClick={() => {
              endFlow();
              router.push('/x/courses');
            }}
            disabled={loading}
            className="flex-1 px-6 py-3 border border-[var(--border-default)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-primary)] transition-colors disabled:opacity-50"
          >
            Back to Courses
          </button>
        </div>
      </div>
    </div>
  );
}
