'use client';

/**
 * StepFlowBanner — persistent step navigation bar for multi-step flows.
 * Fixed at top of viewport (below MasqueradeBanner if active).
 * Shows step progress + PREV/NEXT on flow page, "Back to flow" on other pages.
 */

import { useEffect } from 'react';
import { useStepFlow } from '@/contexts/StepFlowContext';
import { useMasquerade } from '@/contexts/MasqueradeContext';
import { MASQUERADE_BANNER_HEIGHT } from '@/components/shared/MasqueradeBanner';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

export const STEP_FLOW_BANNER_HEIGHT = 44;
const BANNER_BG = '#0891b2';       // Cyan-600 — distinct from purple masquerade
const BANNER_BORDER = '#0e7490';   // Cyan-700

export default function StepFlowBanner() {
  const { state, isActive, isOnFlowPage, prevStep, nextStep, endFlow } = useStepFlow();
  const { isMasquerading } = useMasquerade();
  const pathname = usePathname();
  const router = useRouter();

  // Compute flow context membership before any early returns (hooks must not be conditional)
  const returnPath = state?.returnPath ?? '';
  const flowId = state?.flowId ?? '';
  const isFlowChild = (() => {
    if (flowId === 'content-sources') return pathname?.startsWith('/x/content-sources') ?? false;
    if (flowId === 'demonstrate') return pathname?.startsWith('/x/demonstrate') ?? false;
    if (flowId === 'teach') return pathname?.startsWith('/x/teach') ?? false;
    if (flowId === 'domain-setup') return pathname?.startsWith('/x/domain-setup') ?? false;
    if (flowId === 'create-course') return pathname?.startsWith('/x/courses') ?? false;
    return false;
  })();
  const shouldDismiss = isActive && !!state && !isOnFlowPage && !isFlowChild
    && !pathname?.startsWith('/x/sim') && !pathname?.startsWith('/login');

  // Auto-dismiss when user navigates away from the flow context (must be in effect, not render)
  useEffect(() => {
    if (shouldDismiss) endFlow();
  }, [shouldDismiss, endFlow]);

  if (!isActive || !state) return null;

  // Hide banner when on the wizard home page (inline ProgressStepper handles progress)
  if (isOnFlowPage) return null;

  // Hide on sim pages, auth pages, embed mode
  if (pathname?.startsWith('/x/sim') || pathname?.startsWith('/login')) return null;

  // Still rendering during the effect tick — suppress until dismissed
  if (shouldDismiss) return null;

  const { currentStep, steps } = state;
  const totalSteps = steps.length;
  const stepDef = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Derive a display name for the flow from the flowId
  const flowDisplayName = flowId.charAt(0).toUpperCase() + flowId.slice(1);

  const topOffset = isMasquerading ? MASQUERADE_BANNER_HEIGHT : 0;

  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
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

  const disabledBtnStyle: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.35,
    cursor: 'default',
  };

  return (
    <div
      role="navigation"
      aria-label={`${flowDisplayName} flow — step ${currentStep + 1} of ${totalSteps}`}
      style={{
        position: 'fixed',
        top: topOffset,
        left: 0,
        right: 0,
        height: STEP_FLOW_BANNER_HEIGHT,
        background: BANNER_BG,
        color: '#ffffff',
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
      {isOnFlowPage ? (
        /* On the flow page: show PREV / STEP X OF Y / NEXT */
        <>
          <button
            onClick={isFirstStep ? undefined : prevStep}
            style={isFirstStep ? disabledBtnStyle : btnStyle}
            disabled={isFirstStep}
            onMouseEnter={(e) => { if (!isFirstStep) e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { if (!isFirstStep) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            <ChevronLeft size={14} /> PREV
          </button>

          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 200, textAlign: 'center' }}>
            Step {currentStep + 1} of {totalSteps}: {stepDef?.label}
          </span>

          <button
            onClick={isLastStep ? undefined : nextStep}
            style={isLastStep ? disabledBtnStyle : btnStyle}
            disabled={isLastStep}
            onMouseEnter={(e) => { if (!isLastStep) e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { if (!isLastStep) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            NEXT <ChevronRight size={14} />
          </button>
        </>
      ) : (
        /* On another page (fix-action target): show Back link + current step */
        <>
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
        </>
      )}
    </div>
  );
}
