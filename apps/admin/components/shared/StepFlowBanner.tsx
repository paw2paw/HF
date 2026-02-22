'use client';

/**
 * StepFlowBanner — persistent navigation bar for multi-step flows.
 * Fixed at top of viewport.
 * Shows "Back to flow" + current step label when user navigates away from the wizard page.
 * Hidden on the wizard page itself (inline ProgressStepper handles it) and on sim/login pages.
 *
 * NO auto-dismiss: flow persists until explicitly ended (endFlow) or replaced (startFlow conflict).
 * This allows users to click fix-action links, view domain/caller pages, etc. and return.
 */

import { useStepFlow } from '@/contexts/StepFlowContext';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export const STEP_FLOW_BANNER_HEIGHT = 44;
const BANNER_BG = 'var(--step-flow-bg, #0891b2)';       // Cyan-600 — distinct from purple masquerade
const BANNER_BORDER = 'var(--step-flow-border, #0e7490)';   // Cyan-700

export default function StepFlowBanner() {
  const { state, isActive, isOnFlowPage } = useStepFlow();
  const pathname = usePathname();
  const router = useRouter();

  const returnPath = state?.returnPath ?? '';
  const flowId = state?.flowId ?? '';

  if (!isActive || !state) return null;

  // Hide banner when on the wizard home page (inline ProgressStepper handles progress)
  if (isOnFlowPage) return null;

  // Hide on sim pages, auth pages
  if (pathname?.startsWith('/x/sim') || pathname?.startsWith('/login')) return null;

  const { currentStep, steps } = state;
  const totalSteps = steps.length;
  const stepDef = steps[currentStep];

  // Derive a display name for the flow from the flowId
  const flowDisplayName = flowId.charAt(0).toUpperCase() + flowId.slice(1);

  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: 'var(--surface-primary)',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    lineHeight: '18px',
    transition: 'background 150ms',
  };

  return (
    <div
      role="navigation"
      aria-label={`${flowDisplayName} flow — step ${currentStep + 1} of ${totalSteps}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: STEP_FLOW_BANNER_HEIGHT,
        background: BANNER_BG,
        color: 'var(--surface-primary)',
        borderBottom: `1px solid ${BANNER_BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.02em',
        userSelect: 'none',
        zIndex: 9997,
      }}
    >
      <button
        onClick={() => router.push(returnPath)}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
      >
        <ArrowLeft size={14} /> Back to {flowDisplayName}
      </button>

      <span style={{ fontSize: 13, fontWeight: 500 }}>
        Step {currentStep + 1} of {totalSteps}: {stepDef?.activeLabel || stepDef?.label}
      </span>
    </div>
  );
}
