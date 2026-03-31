'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { MessageCircle, GraduationCap, RotateCcw, TrendingUp } from 'lucide-react';
import { useResponsive } from '@/hooks/useResponsive';
import { ConversationList } from '@/components/sim/ConversationList';

interface ActiveCourseInfo {
  enrollmentId: string;
  courseName: string;
  status: string;
  completedAt: string | null;
  sessionCount: number;
}

export default function SimChatListPage() {
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [checked, setChecked] = useState(false);
  const [completedCourse, setCompletedCourse] = useState<ActiveCourseInfo | null>(null);
  const [retaking, setRetaking] = useState(false);

  const domainId = searchParams.get('domainId');
  const isStudent = session?.user?.role === 'STUDENT';

  // Check for course completion (students only)
  useEffect(() => {
    if (!isStudent || !session) return;
    fetch('/api/student/courses')
      .then(res => res.json())
      .then(data => {
        if (!data.ok) return;
        const active = data.enrollments?.find((e: any) => e.isDefault) || data.enrollments?.[0];
        if (active?.status === 'COMPLETED') {
          setCompletedCourse({
            enrollmentId: active.id,
            courseName: active.courseName,
            status: active.status,
            completedAt: active.completedAt,
            sessionCount: active.sessionCount,
          });
        }
      })
      .catch(() => {});
  }, [isStudent, session]);

  // Auto-redirect: always for STUDENT, desktop-only for others
  useEffect(() => {
    if (!isStudent && !isDesktop) return;
    if (!session) return; // Wait for session to load
    const url = domainId
      ? `/api/sim/conversations?domainId=${encodeURIComponent(domainId)}`
      : '/api/sim/conversations';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.conversations?.length > 0) {
          const sorted = [...data.conversations].sort((a: any, b: any) => {
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            if (aTime || bTime) return bTime - aTime;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          router.replace(`/x/sim/${sorted[0].callerId}`);
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [isDesktop, isStudent, session, router, domainId]);

  async function handleRetake(skipOnboarding = false) {
    if (!completedCourse) return;
    setRetaking(true);
    try {
      const res = await fetch(`/api/student/courses/${completedCourse.enrollmentId}/retake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipOnboarding }),
      });
      const data = await res.json();
      if (data.ok) {
        setCompletedCourse(null);
        router.refresh();
      }
    } finally {
      setRetaking(false);
    }
  }

  // Loading while checking for callers to auto-select (always for STUDENT, desktop for others)
  if ((isDesktop || isStudent) && !checked) {
    return (
      <div className="wa-desktop-empty">
        <div className="hf-spinner" style={{ width: 28, height: 28 }} />
        <p style={{ fontSize: 14, color: 'var(--wa-text-muted)', marginTop: 16 }}>
          Loading...
        </p>
      </div>
    );
  }

  // Student course completion card
  if (isStudent && completedCourse) {
    const completedDate = completedCourse.completedAt
      ? new Date(completedCourse.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    return (
      <div className="wa-completion-card">
        <GraduationCap size={56} strokeWidth={1.2} style={{ color: 'var(--wa-green-primary)' }} />
        <h2>Course Complete!</h2>
        <p>
          You finished <strong>{completedCourse.courseName}</strong>
          {completedCourse.sessionCount > 0 && <><br />{completedCourse.sessionCount} session{completedCourse.sessionCount !== 1 ? 's' : ''}</>}
          {completedDate && <> &middot; {completedDate}</>}
        </p>
        <div className="wa-completion-actions">
          <button className="wa-completion-btn wa-completion-btn-primary" onClick={() => handleRetake(true)} disabled={retaking}>
            <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {retaking ? 'Restarting...' : 'Dive Back In'}
          </button>
          <button className="wa-completion-btn wa-completion-btn-secondary" onClick={() => handleRetake(false)} disabled={retaking}>
            <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Start Fresh
          </button>
          <button className="wa-completion-btn wa-completion-btn-secondary" onClick={() => router.push('/x/student/progress')}>
            <TrendingUp size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            View Progress
          </button>
        </div>
        <p style={{ fontSize: 12, marginTop: 4 }}>
          <strong>Dive Back In</strong> skips onboarding &amp; surveys. <strong>Start Fresh</strong> re-does the full welcome.
        </p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Have another course? Switch from the menu above.
        </p>
      </div>
    );
  }

  // Desktop: no callers found — show empty state
  if (isDesktop) {
    return (
      <div className="wa-desktop-empty">
        <div style={{ color: 'var(--wa-border)' }}>
          <MessageCircle size={72} strokeWidth={1} />
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 300, color: 'var(--wa-text-secondary)', margin: '24px 0 12px' }}>
          HumanFirst
        </h2>
        <p style={{ fontSize: 14, color: 'var(--wa-text-muted)', maxWidth: 460, lineHeight: 1.5 }}>
          No callers yet. Create one from Get Started or Quick Launch.
        </p>
      </div>
    );
  }

  // Mobile/Tablet: show conversation list
  return <ConversationList />;
}
