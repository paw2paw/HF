'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Plus, Zap } from 'lucide-react';
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
  const { isActive: isSetupFlowActive, startFlow } = useStepFlow();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Load courses on mount
  useEffect(() => {
    const loadCourses = async () => {
      try {
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
    loadCourses();
  }, []);

  const handleNewCourse = () => {
    // Start the wizard flow using StepFlowContext
    startFlow({
      flowId: 'create-course',
      steps: [
        { id: 'intent', label: 'Intent', activeLabel: 'Setting Intent' },
        { id: 'content', label: 'Content', activeLabel: 'Adding Content' },
        { id: 'teaching-points', label: 'Teaching Points', activeLabel: 'Reviewing Teaching Points' },
        { id: 'lesson-structure', label: 'Lesson Structure', activeLabel: 'Planning Lessons' },
        { id: 'students', label: 'Students', activeLabel: 'Adding Students' },
        { id: 'course-config', label: 'Course Config', activeLabel: 'Configuring Course' },
        { id: 'done', label: 'Done', activeLabel: 'Complete' },
      ],
      returnPath: '/x/courses',
    });
    setShowWizard(true);
  };

  if (showWizard && isSetupFlowActive) {
    return <CourseSetupWizard onComplete={() => setShowWizard(false)} />;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">My Courses</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Create and manage courses for your students
          </p>
        </div>
        <button
          onClick={handleNewCourse}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          New Course
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
            No courses yet
          </h2>
          <p className="text-[var(--text-secondary)] mb-6 max-w-md">
            Create your first course to start teaching. You'll set the curriculum, add students, and launch lessons.
          </p>
          <button
            onClick={handleNewCourse}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Create First Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onSelect={(courseId) => router.push(`/x/courses/${courseId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
