'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { HierarchyBreadcrumb, type BreadcrumbSegment } from '@/components/shared/HierarchyBreadcrumb';
import { SessionDetailClient } from './session-detail';

export default function SessionDetailPage() {
  const { courseId, sessionNum } = useParams<{ courseId: string; sessionNum: string }>();
  const [courseName, setCourseName] = useState<string>('');

  // Fetch course name for breadcrumb
  useEffect(() => {
    if (!courseId) return;
    fetch(`/api/playbooks/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCourseName(data.playbook.name);
      })
      .catch(() => {});
  }, [courseId]);

  const segments: BreadcrumbSegment[] = [
    { label: 'Courses', href: '/x/courses' },
    { label: courseName || '', href: `/x/courses/${courseId}`, loading: !courseName },
    { label: `Session ${sessionNum}`, href: `/x/courses/${courseId}/sessions/${sessionNum}` },
  ];

  return (
    <div className="hf-page-content">
      <HierarchyBreadcrumb segments={segments} />
      <SessionDetailClient courseId={courseId} sessionNum={parseInt(sessionNum, 10)} />
    </div>
  );
}
