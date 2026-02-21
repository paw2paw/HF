'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Zap } from 'lucide-react';
import { useTerminology } from '@/contexts/TerminologyContext';
import { CourseCard } from './_components/CourseCard';
import { CourseSetupWizard } from './_components/CourseSetupWizard';
import { useStepFlow } from '@/contexts';

type Course = {
  id: string;
  name: string;
  domain: { id: string; name: string };
  studentCount: number;
  status: 'draft' | 'published';
  createdAt: string;
};

export default function CoursesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { terms } = useTerminology();
  const { state, isActive: isSetupFlowActive, startFlow } = useStepFlow();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive wizard visibility from flow context (survives page refresh)
  const showWizard = isSetupFlowActive && state?.flowId === "create-course";

  // Load courses on mount
  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/courses');
      if (!res.ok) throw new Error('Failed to load courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleNewCourse = async () => {
    // Load wizard steps from spec
    let stepsToUse = [
      { id: 'intent', label: 'Intent', activeLabel: 'Setting Intent' },
      { id: 'content', label: 'Content', activeLabel: 'Adding Content' },
      { id: 'lesson-plan', label: 'Lesson Plan', activeLabel: 'Planning Lessons' },
      { id: 'course-config', label: 'Configure AI', activeLabel: 'Configuring AI' },
      { id: 'students', label: 'Students', activeLabel: 'Adding Students' },
      { id: 'done', label: 'Launch', activeLabel: 'Creating Course' },
    ];

    try {
      const response = await fetch('/api/wizard-steps?wizard=course');
      const data = await response.json();

      if (data.ok && data.steps && data.steps.length > 0) {
        // Convert WizardStep to StepDefinition
        stepsToUse = data.steps.map((step: any) => ({
          id: step.id,
          label: step.label,
          activeLabel: step.activeLabel,
        }));
      }
    } catch (err) {
      console.warn('[CoursesPage] Failed to load spec steps, using defaults', err);
    }

    // Start the wizard flow using StepFlowContext
    startFlow({
      flowId: 'create-course',
      steps: stepsToUse,
      returnPath: '/x/courses',
    });
  };

  if (showWizard) {
    return (
      <CourseSetupWizard
        onComplete={async () => {
          // Reload courses after wizard completes (endFlow called by wizard)
          await loadCourses();
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My {terms.playbook}s</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Create and manage {terms.playbook.toLowerCase()}s for your {terms.caller.toLowerCase()}s
          </p>
        </div>
        <button
          onClick={handleNewCourse}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          New {terms.playbook}
        </button>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-[var(--text-secondary)]">Loading courses...</div>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            No {terms.playbook.toLowerCase()}s yet
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md">
            Create your first {terms.playbook.toLowerCase()} to start teaching. You'll set the curriculum, add {terms.caller.toLowerCase()}s, and launch lessons.
          </p>
          <button
            onClick={handleNewCourse}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Create First {terms.playbook}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onSelect={(courseId) => router.push(`/x/playbooks/${courseId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
