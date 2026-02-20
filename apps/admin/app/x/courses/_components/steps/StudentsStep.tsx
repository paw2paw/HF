'use client';

import { useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function StudentsStep({ setData, onNext, onPrev }: StepProps) {
  const [mode, setMode] = useState<'email' | 'existing'>('email');
  const [emails, setEmails] = useState<string[]>(['']);
  const [selectedCallers, setSelectedCallers] = useState<string[]>([]);

  const handleAddEmail = () => {
    setEmails([...emails, '']);
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    const studentEmails = emails.filter((e) => e.trim());
    setData('studentEmails', studentEmails);
    setData('selectedCallers', selectedCallers);
    onNext();
  };

  const isValid = mode === 'email' ? emails.some((e) => e.trim()) : selectedCallers.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Add Students</h1>
          <p className="text-[var(--text-secondary)]">Invite students to join your course</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setMode('email')}
            className={`px-4 py-2 rounded-lg border-2 transition-all ${
              mode === 'email'
                ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                : 'border-[var(--border-default)]'
            }`}
          >
            Enter Emails
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`px-4 py-2 rounded-lg border-2 transition-all ${
              mode === 'existing'
                ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                : 'border-[var(--border-default)]'
            }`}
          >
            Pick Existing
          </button>
        </div>

        {/* Email Mode */}
        {mode === 'email' && (
          <div className="mb-8">
            <div className="space-y-3 mb-4">
              {emails.map((email, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(i, e.target.value)}
                    placeholder="student@school.edu"
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  {emails.length > 1 && (
                    <button
                      onClick={() => handleRemoveEmail(i)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleAddEmail}
              className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
            >
              <Plus className="w-4 h-4" /> Add another email
            </button>
            <p className="text-xs text-[var(--text-tertiary)] mt-4">
              Invitations will be sent to these addresses. Students will create accounts when they join.
            </p>
          </div>
        )}

        {/* Existing Mode */}
        {mode === 'existing' && (
          <div className="mb-8">
            <p className="text-[var(--text-secondary)] text-center py-8">
              Existing student selection coming soon
            </p>
          </div>
        )}
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
          disabled={!isValid}
          className="flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg disabled:opacity-50"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
