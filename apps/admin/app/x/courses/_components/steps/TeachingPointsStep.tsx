'use client';

import { ArrowRight } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function TeachingPointsStep({ onNext, onPrev }: StepProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Review Teaching Points</h1>
          <p className="text-[var(--text-secondary)]">Extracted key concepts from your curriculum</p>
        </div>

        <div className="p-8 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)] text-center">
          <p className="text-[var(--text-secondary)]">Teaching points extraction coming soon</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-2">
            For now, we'll use your content to generate a lesson plan
          </p>
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
