'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function LessonStructureStep({ setData, getData, onNext, onPrev }: StepProps) {
  const [sessionCount, setSessionCount] = useState(12);
  const [duration, setDuration] = useState(30);
  const [emphasis, setEmphasis] = useState('balanced');
  const [assessment, setAssessment] = useState('light');

  useEffect(() => {
    const saved = getData<number>('sessionCount');
    if (saved) setSessionCount(saved);
  }, [getData]);

  const handleNext = () => {
    setData('sessionCount', sessionCount);
    setData('durationMins', duration);
    setData('emphasis', emphasis);
    setData('assessmentStyle', assessment);
    onNext();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Plan Your Lessons</h1>
          <p className="text-[var(--text-secondary)]">How many lessons, how long, and how deep?</p>
        </div>

        {/* Session Count */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-4">
            Number of sessions: {sessionCount}
          </label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[6, 12, 20].map((num) => (
              <button
                key={num}
                onClick={() => setSessionCount(num)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  sessionCount === num
                    ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                    : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <p className="font-semibold">{num}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {num === 6 ? 'Quick' : num === 12 ? 'Standard' : 'Deep'}
                </p>
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="100"
            value={sessionCount}
            onChange={(e) => setSessionCount(parseInt(e.currentTarget.value))}
            className="w-full"
          />
        </div>

        {/* Duration */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-4">
            Session duration: {duration} minutes
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[15, 20, 30, 45, 60].map((min) => (
              <button
                key={min}
                onClick={() => setDuration(min)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  duration === min
                    ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                    : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
                }`}
              >
                {min}m
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Voice lessons are capped at 2 minutes per call
          </p>
        </div>

        {/* Emphasis */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-4">Teaching emphasis</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'breadth', label: 'Breadth', desc: 'Wide coverage' },
              { value: 'balanced', label: 'Balanced', desc: 'Even mix' },
              { value: 'depth', label: 'Depth', desc: 'Deep dive' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEmphasis(opt.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  emphasis === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                    : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Assessment */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-4">Assessment style</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'none', label: 'None', desc: 'No quizzes' },
              { value: 'light', label: 'Light', desc: 'Informal checks' },
              { value: 'formal', label: 'Formal', desc: 'Full assessment' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAssessment(opt.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  assessment === opt.value
                    ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                    : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">{opt.desc}</p>
              </button>
            ))}
          </div>
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
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
