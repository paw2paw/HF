'use client';

import { ArrowRight, CheckCircle, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { StepProps } from '../CourseSetupWizard';

export function TeachingPointsStep({ getData, onNext, onPrev }: StepProps) {
  const [countdown, setCountdown] = useState(2);

  const contentFile = getData<File>('contentFile');
  const contentDescription = getData<string>('contentDescription');

  // Auto-advance after 2 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onNext();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onNext]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Teaching Points
          </h1>
          <p className="text-[var(--text-secondary)]">
            Your content will be analyzed when the course launches
          </p>
        </div>

        {/* Content Status */}
        <div className="space-y-6">
          {contentFile ? (
            <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 dark:text-green-100 mb-1">
                    Content ready for analysis
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <FileText className="w-4 h-4 inline mr-1" />
                    {contentFile.name}
                  </p>
                </div>
              </div>
            </div>
          ) : contentDescription ? (
            <div className="p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Course description provided
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200 line-clamp-2">
                    {contentDescription}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
              <p className="text-[var(--text-secondary)]">
                No content added yet — that's optional. We'll use your learning outcomes to generate the lesson plan.
              </p>
            </div>
          )}

          <div className="p-6 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
            <p className="text-sm text-[var(--text-secondary)] mb-3 font-semibold">What happens next:</p>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li>✓ AI will extract key teaching points from your content</li>
              <li>✓ Generate structured lessons aligned with your outcomes</li>
              <li>✓ Create personalized voice prompts for each lesson</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-[var(--text-tertiary)]">
          Continuing in {countdown}s...
        </div>
      </div>

      <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)] flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
