'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardList, Pencil, FileText } from 'lucide-react';

interface CourseRefTabProps {
  courseId: string;
  isOperator: boolean;
}

interface CourseRefData {
  id: string;
  name: string;
  markdown: string | null;
  createdAt: string;
}

export function CourseRefTab({ courseId, isOperator }: CourseRefTabProps) {
  const [reference, setReference] = useState<CourseRefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/courses/${courseId}/course-reference`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setReference(data.reference);
        } else {
          setError(data.error || 'Failed to load course reference');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [courseId]);

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="hf-card-compact">
        <div className="hf-text-sm hf-text-muted hf-glow-active">
          Loading course reference...
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────
  if (error) {
    return (
      <div className="hf-card-compact">
        <div className="hf-text-sm hf-text-danger">{error}</div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────
  if (!reference || !reference.markdown) {
    return (
      <div className="hf-card-compact hf-text-center hf-py-xl">
        <ClipboardList size={40} className="hf-text-muted hf-mx-auto hf-mb-md" />
        <h3 className="hf-text-md hf-mb-sm">No course reference yet</h3>
        <p className="hf-text-sm hf-text-muted hf-mb-md">
          A course reference tells the AI tutor exactly how to teach this course —
          skills framework, teaching approach, edge cases, and more.
        </p>
        {isOperator && (
          <Link
            href={`/x/course-reference?courseId=${courseId}`}
            className="hf-btn hf-btn-sm hf-btn-primary hf-inline-flex hf-items-center hf-gap-xs"
          >
            <Pencil size={13} />
            Build Course Reference
          </Link>
        )}
      </div>
    );
  }

  // ── Rendered reference ─────────────────────────────────
  const createdDate = new Date(reference.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div>
      {/* Header bar */}
      <div className="hf-flex hf-flex-between hf-items-center hf-mb-md">
        <div className="hf-flex hf-items-center hf-gap-sm">
          <FileText size={16} className="hf-text-muted" />
          <span className="hf-text-xs hf-text-muted">
            {reference.name} &middot; Created {createdDate}
          </span>
        </div>
        {isOperator && (
          <Link
            href={`/x/course-reference?courseId=${courseId}`}
            className="hf-btn hf-btn-xs hf-btn-outline hf-flex hf-items-center hf-gap-xs"
          >
            <Pencil size={12} />
            Edit
          </Link>
        )}
      </div>

      {/* Markdown content */}
      <div className="hf-card-compact hf-p-lg prose prose-sm max-w-none [&>h1]:hf-text-lg [&>h1]:hf-mb-md [&>h2]:hf-text-md [&>h2]:hf-mb-sm [&>h2]:hf-mt-lg [&>h3]:hf-text-sm [&>h3]:hf-mb-xs [&>h3]:hf-mt-md [&>table]:hf-text-xs [&>p]:hf-mb-sm [&>ul]:hf-mb-sm [&>hr]:hf-my-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {reference.markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
