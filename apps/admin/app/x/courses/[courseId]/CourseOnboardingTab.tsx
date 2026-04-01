'use client';

import { useState } from 'react';
import { MessageCircle, LogOut } from 'lucide-react';
import { OnboardingEditor } from '@/components/shared/OnboardingEditor';

// ── Types ──────────────────────────────────────────────

export type CourseOnboardingTabProps = {
  courseId: string;
  detail: {
    id: string;
    name: string;
    domain: { id: string; name: string; slug: string };
  };
  isOperator: boolean;
};

import { SectionHeader } from './SectionHeader';

type SubView = 'onboarding' | 'offboarding';

// ── Main Component ─────────────────────────────────────

export function CourseOnboardingTab({
  courseId,
  detail,
  isOperator,
}: CourseOnboardingTabProps) {
  const [subView, setSubView] = useState<SubView>('onboarding');

  return (
    <>
      {/* ── Sub-navigation pills ──────────────────────── */}
      <div className="hf-flex hf-gap-xs hf-mb-lg">
        <button
          className={`hf-filter-pill${subView === 'onboarding' ? ' hf-filter-pill-active' : ''}`}
          onClick={() => setSubView('onboarding')}
        >
          <MessageCircle size={13} />
          First Call
        </button>
        <button
          className={`hf-filter-pill${subView === 'offboarding' ? ' hf-filter-pill-active' : ''}`}
          onClick={() => setSubView('offboarding')}
        >
          <LogOut size={13} />
          End of Course
        </button>
      </div>

      {/* ── Onboarding sub-view ───────────────────────── */}
      {subView === 'onboarding' && (
        <>
          <SectionHeader title="First Call Structure &amp; Phases" icon={MessageCircle} />
          <OnboardingEditor
            courseId={courseId}
            domainId={detail.domain.id}
            domainName={detail.domain.name}
            isOperator={isOperator}
            mode="onboarding"
          />
        </>
      )}

      {/* ── Offboarding sub-view ──────────────────────── */}
      {subView === 'offboarding' && (
        <>
          <SectionHeader title="End of Course Flow" icon={LogOut} />
          <OnboardingEditor
            courseId={courseId}
            domainId={detail.domain.id}
            domainName={detail.domain.name}
            isOperator={isOperator}
            mode="offboarding"
          />
        </>
      )}
    </>
  );
}
