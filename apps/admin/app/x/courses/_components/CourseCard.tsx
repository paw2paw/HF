import { BookOpen, Users, Calendar } from 'lucide-react';

type CourseCardProps = {
  course: {
    id: string;
    name: string;
    domain: { id: string; name: string };
    studentCount: number;
    status: 'draft' | 'published';
    createdAt: string;
  };
  onSelect: (courseId: string) => void;
};

export function CourseCard({ course, onSelect }: CourseCardProps) {
  const createdDate = new Date(course.createdAt).toLocaleDateString();

  return (
    <button
      onClick={() => onSelect(course.id)}
      className="flex flex-col gap-4 p-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-primary)] hover:border-[var(--accent)] transition-all text-left"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent)] bg-opacity-20">
            <BookOpen className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{course.name}</h3>
            <p className="text-sm text-[var(--text-secondary)]">{course.domain.name}</p>
          </div>
        </div>
        <span
          style={{
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 4,
            background: course.status === 'published' ? "var(--status-success-bg)" : "color-mix(in srgb, var(--status-warning-text) 12%, transparent)",
            color: course.status === 'published' ? "var(--status-success-text)" : "var(--status-warning-text)",
          }}
        >
          {course.status === 'published' ? 'Live' : 'Draft'}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{course.studentCount} student{course.studentCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          <span>{createdDate}</span>
        </div>
      </div>
    </button>
  );
}
