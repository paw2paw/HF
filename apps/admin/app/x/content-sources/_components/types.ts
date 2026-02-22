/**
 * Shared types for content-source wizard steps.
 *
 * All step components receive these props from the StepFlowContext-backed wizard.
 */
export interface StepProps {
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  onNext: () => void;
  onPrev: () => void;
  endFlow: () => void;
  /** Optional: navigate directly to a specific step index */
  setStep?: (step: number) => void;
}
