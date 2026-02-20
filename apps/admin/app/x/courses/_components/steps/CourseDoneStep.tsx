'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle, PlayCircle, Zap } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function CourseDoneStep({ getData, endFlow }: StepProps) {
  const router = useRouter();

  const courseName = getData<string>('courseName');
  const sessionCount = getData<number>('sessionCount') || 12;
  const studentEmails = getData<string[]>('studentEmails');
  const teachingStyle = getData<string>('teachingStyle');

  const handleLaunch = () => {
    // TODO: Create the course in the DB here
    // For now, just end the flow
    endFlow();
    router.push('/x/courses');
  };

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
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity font-semibold"
          >
            <PlayCircle className="w-5 h-5" />
            Launch Course
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
    </div>
  );
}
