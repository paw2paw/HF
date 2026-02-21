'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useTerminology } from '@/contexts/TerminologyContext';
import type { StepProps } from '../CourseSetupWizard';

type PersonaOption = {
  slug: string;
  name: string;
  description: string | null;
  icon: string;
};

export function IntentStep({ setData, getData, onNext, onPrev }: StepProps) {
  const { terms, lower } = useTerminology();
  const [courseName, setCourseName] = useState('');
  const [outcomes, setOutcomes] = useState<string[]>(['', '', '']);
  const [persona, setPersona] = useState<string | undefined>();
  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [personasLoading, setPersonasLoading] = useState(true);
  const [existingCourseWarning, setExistingCourseWarning] = useState<string | null>(null);
  const [checkingCourse, setCheckingCourse] = useState(false);

  // Load saved data
  useEffect(() => {
    const saved = getData<string>('courseName');
    const savedOutcomes = getData<string[]>('learningOutcomes');
    const savedPersona = getData<string>('persona') || getData<string>('teachingStyle');

    if (saved) setCourseName(saved);
    if (savedOutcomes) setOutcomes(savedOutcomes);
    if (savedPersona) setPersona(savedPersona);
  }, [getData]);

  // Fetch personas from API (same source as Quick Launch)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/onboarding');
        if (!res.ok) throw new Error('Failed to fetch personas');
        const data = await res.json();
        if (!cancelled && data.ok && data.personasList?.length > 0) {
          setPersonas(data.personasList.map((p: any) => ({
            slug: p.slug,
            name: p.name,
            description: p.description || null,
            icon: p.icon || '🎭',
          })));
        } else if (!cancelled) {
          // API returned ok:false or empty list — use fallback
          throw new Error(data.error || 'No personas returned');
        }
      } catch (e) {
        console.warn('[IntentStep] Failed to load personas, using fallback:', e);
        if (!cancelled) {
          setPersonas([
            { slug: 'tutor', name: 'Tutor', description: 'Patient teaching expert', icon: '🧑‍🏫' },
          ]);
        }
      } finally {
        if (!cancelled) setPersonasLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Check for existing course when name changes
  useEffect(() => {
    if (!courseName.trim()) {
      setExistingCourseWarning(null);
      return;
    }

    const checkCourse = async () => {
      setCheckingCourse(true);
      try {
        const res = await fetch(`/api/courses?q=${encodeURIComponent(courseName)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.existingCourse) {
            setExistingCourseWarning(data.existingCourse.name);
          } else {
            setExistingCourseWarning(null);
          }
        }
      } catch (err) {
        console.error('Error checking course:', err);
      } finally {
        setCheckingCourse(false);
      }
    };

    const timer = setTimeout(checkCourse, 500);
    return () => clearTimeout(timer);
  }, [courseName]);

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const handleNext = () => {
    const selected = personas.find(p => p.slug === persona);
    setData('courseName', courseName.trim());
    setData('learningOutcomes', outcomes.filter(o => o.trim()));
    setData('persona', persona);
    setData('personaName', selected?.name || persona);
    // Keep teachingStyle for backwards compat with course-setup API
    setData('teachingStyle', persona);
    onNext();
  };

  const isValid = courseName.trim().length > 0 && persona;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Content */}
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Create Your Course</h1>
          <p className="text-[var(--text-secondary)]">Tell us about your course and how you want to teach</p>
        </div>

        {/* Course Name */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            What&apos;s your course called?
          </label>
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="e.g., High School Biology 101"
            className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          {existingCourseWarning && (
            <div className="mt-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700 dark:text-yellow-200">
                <p className="font-medium">Course exists: &quot;{existingCourseWarning}&quot;</p>
                <p className="mt-1">Would you like to enroll more students in it, or create a new version?</p>
              </div>
            </div>
          )}
        </div>

        {/* Learning Outcomes */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            What will students learn? (1-3 outcomes)
          </label>
          <div className="space-y-2">
            {outcomes.map((outcome, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-tertiary)] w-6">•</span>
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => handleOutcomeChange(i, e.target.value)}
                  placeholder={`Outcome ${i + 1}`}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            Examples: &quot;Understand photosynthesis&quot; • &quot;Explain cellular respiration&quot; • &quot;Design experiments&quot;
          </p>
        </div>

        {/* Persona Selection */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-3">
            Choose a {lower('persona')}
          </label>
          {personasLoading ? (
            <div className="flex items-center gap-2 text-[var(--text-muted)] py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading {lower('persona')}s...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {personas.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => setPersona(p.slug)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    persona === p.slug
                      ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                      : 'border-[var(--border-default)] hover:border-[var(--border-default)]'
                  }`}
                >
                  <div className="text-2xl mb-2">{p.icon}</div>
                  <h3 className="font-semibold text-[var(--text-primary)]">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{p.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)] flex justify-between items-center">
        <button
          onClick={onPrev}
          disabled
          className="px-6 py-2 text-[var(--text-secondary)] disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!isValid}
          className="flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
