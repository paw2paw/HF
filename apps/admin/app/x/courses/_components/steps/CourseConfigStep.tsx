'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { AgentTuner } from '@/components/shared/AgentTuner';
import type { AgentTunerOutput, AgentTunerPill } from '@/lib/agent-tuner/types';
import type { StepProps } from '../CourseSetupWizard';

export function CourseConfigStep({ setData, getData, onNext, onPrev }: StepProps) {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [defaultWelcome, setDefaultWelcome] = useState('');
  const [loadingWelcome, setLoadingWelcome] = useState(false);
  const [tunerPills, setTunerPills] = useState<AgentTunerPill[]>(getData<AgentTunerPill[]>('tunerPills') ?? []);
  const [behaviorTargets, setBehaviorTargets] = useState<Record<string, number>>(getData<Record<string, number>>('behaviorTargets') ?? {});

  const personaSlug = getData<string>('persona');
  const personaName = getData<string>('personaName');

  // Load saved welcome message
  useEffect(() => {
    const saved = getData<string>('welcomeMessage');
    if (saved) setWelcomeMessage(saved);
  }, [getData]);

  // Fetch default welcome template for selected persona
  useEffect(() => {
    if (!personaSlug) return;
    let cancelled = false;
    setLoadingWelcome(true);

    (async () => {
      try {
        const res = await fetch(`/api/onboarding?persona=${encodeURIComponent(personaSlug)}`);
        if (!res.ok) throw new Error('Failed to fetch persona config');
        const data = await res.json();
        if (!cancelled && data.ok) {
          setDefaultWelcome(data.welcomeTemplate || '');
        }
      } catch (e) {
        console.warn('[CourseConfigStep] Failed to load welcome template:', e);
      } finally {
        if (!cancelled) setLoadingWelcome(false);
      }
    })();

    return () => { cancelled = true; };
  }, [personaSlug]);

  const handleTunerChange = ({ pills, parameterMap }: AgentTunerOutput) => {
    setTunerPills(pills);
    setBehaviorTargets(parameterMap);
    setData('tunerPills', pills);
    setData('behaviorTargets', parameterMap);
  };

  const handleNext = () => {
    setData('welcomeMessage', welcomeMessage || defaultWelcome);
    setData('tunerPills', tunerPills);
    setData('behaviorTargets', behaviorTargets);
    onNext();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Configure Your AI</h1>
          <p className="text-[var(--text-secondary)]">Defaults are ready — customize if you like, or just hit Accept</p>
        </div>

        {/* Persona Preview */}
        <div className="mb-8 p-4 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-default)]">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            How will your AI introduce itself?
          </label>
          {loadingWelcome ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading welcome template...</span>
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] italic">
              {welcomeMessage || defaultWelcome || 'Your AI will introduce itself...'}
            </p>
          )}
          {personaName && (
            <p className="text-xs text-[var(--text-tertiary)] mt-2">
              Based on {personaName} persona
            </p>
          )}
        </div>

        {/* Welcome Message */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Custom welcome message (optional)
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder={defaultWelcome || 'Enter a custom welcome message...'}
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Leave blank to use the default introduction
          </p>
        </div>

        {/* WhatsApp Notice */}
        <div className="hf-banner hf-banner-info">
          <strong>WhatsApp Follow-ups:</strong> After each lesson, students will receive a message on WhatsApp.
          Make sure students have provided phone numbers during enrollment.
        </div>

        {/* Behavior Tuning */}
        <div className="mt-6">
          <AgentTuner
            initialPills={tunerPills}
            context={{ personaSlug: personaSlug || undefined, subjectName: getData<string>('courseName') || undefined }}
            onChange={handleTunerChange}
          />
        </div>
      </div>

      <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)] flex justify-between items-center">
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
          Accept <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
