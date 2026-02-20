'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function CourseConfigStep({ setData, getData, onNext, onPrev }: StepProps) {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [persona, setPersona] = useState<string | undefined>();

  useEffect(() => {
    const saved = getData<string>('welcomeMessage');
    if (saved) setWelcomeMessage(saved);
  }, [getData]);

  const teachingStyle = getData<string>('teachingStyle');

  const PERSONAS = {
    tutor: "I'm your interactive tutor. I'll ask questions to guide your learning.",
    coach: "I'm your coach. I believe in you and want to help you succeed.",
    mentor: 'I\'m your mentor. Let\'s explore this together at your pace.',
    socratic: 'I\'m here to ask you great questions that help you discover answers.',
  };

  const defaultPersona = teachingStyle ? PERSONAS[teachingStyle as keyof typeof PERSONAS] : '';

  const handleNext = () => {
    setData('welcomeMessage', welcomeMessage || defaultPersona);
    setData('persona', persona || teachingStyle);
    onNext();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Configure Your Course</h1>
          <p className="text-[var(--text-secondary)]">Customize how your AI teaches</p>
        </div>

        {/* Persona Preview */}
        <div className="mb-8 p-4 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            How will your AI introduce itself?
          </label>
          <p className="text-[var(--text-secondary)] italic">
            {welcomeMessage || defaultPersona || 'Your AI will introduce itself...'}
          </p>
        </div>

        {/* Welcome Message */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Custom welcome message (optional)
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder={defaultPersona}
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Leave blank to use the default introduction
          </p>
        </div>

        {/* WhatsApp Notice */}
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>💬 WhatsApp Follow-ups:</strong> After each lesson, students will receive a message on WhatsApp.
            Make sure students have provided phone numbers during enrollment.
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
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
