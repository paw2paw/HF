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
  const isOperator = ["OPERATOR", "EDUCATOR", "ADMIN", "SUPERADMIN"].includes((session?.user?.role as string) || "");
  const { terms } = useTerminology();
  const { state, isActive: isSetupFlowActive, startFlow } = useStepFlow();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteCourse = async (id: string, status: string) => {
    setDeleting(true);
    setDeleteError(null);
    try {
      if (status === "draft") {
        const res = await fetch(`/api/playbooks/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to delete");
      } else {
        const res = await fetch(`/api/playbooks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to archive");
      }
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

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
        {isOperator && (
          <button
            onClick={handleNewCourse}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            New {terms.playbook}
          </button>
        )}
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
          {isOperator && (
            <button
              onClick={handleNewCourse}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              Create First {terms.playbook}
            </button>
          )}
        </div>
      ) : (
        <>
        {deleteError && (
          <div className="hf-banner hf-banner-error" style={{ justifyContent: "space-between" }}>
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="hf-btn-ghost" style={{ padding: 0, fontSize: 12, color: "inherit", textDecoration: "underline" }}>Dismiss</button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div key={course.id} className="relative">
              <CourseCard
                course={course}
                onSelect={(courseId) => router.push(`/x/playbooks/${courseId}`)}
              />
              {isOperator && (
                <div className="px-4 pb-3 -mt-2" style={{ background: "var(--surface-primary)", borderRadius: "0 0 12px 12px" }}>
                  {confirmDeleteId === course.id ? (
                    <div className="flex items-center gap-2 text-xs pt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
                      <span style={{ color: "var(--status-error-text)" }}>
                        {course.status === "draft" ? "Delete permanently?" : "Archive this course?"}
                      </span>
                      <button
                        onClick={() => handleDeleteCourse(course.id, course.status)}
                        disabled={deleting}
                        className="hf-btn hf-btn-destructive"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        {deleting ? "..." : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="hf-btn hf-btn-secondary"
                        style={{ padding: "2px 8px", fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(course.id)}
                      className="hf-btn-ghost"
                      style={{ padding: "4px 0 0", fontSize: 11 }}
                    >
                      {course.status === "draft" ? "Delete" : "Archive"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
