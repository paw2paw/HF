'use client';

import { useCallback } from 'react';
import { useStepFlow } from '@/contexts/StepFlowContext';
import { IntentStep } from './steps/IntentStep';
import { ContentStep } from './steps/ContentStep';
import { TeachingPointsStep } from './steps/TeachingPointsStep';
import { LessonStructureStep } from './steps/LessonStructureStep';
import { StudentsStep } from './steps/StudentsStep';
import { CourseConfigStep } from './steps/CourseConfigStep';
import { CourseDoneStep } from './steps/CourseDoneStep';

type StepComponent = React.FC<StepProps>;

export interface StepProps {
  setData: (key: string, value: unknown) => void;
  getData: <T = unknown>(key: string) => T | undefined;
  onNext: () => void;
  onPrev: () => void;
  endFlow: () => void;
}

type CourseSetupWizardProps = {
  onComplete?: () => void;
};

export function CourseSetupWizard({ onComplete }: CourseSetupWizardProps) {
  const { state, setStep, nextStep, prevStep, setData, getData, endFlow } = useStepFlow();

  if (!state || !state.active) {
    return <div>Loading wizard...</div>;
  }

  const currentStepId = state.steps[state.currentStep]?.id;

  const steps: Record<string, StepComponent> = {
    intent: IntentStep,
    content: ContentStep,
    'teaching-points': TeachingPointsStep,
    'lesson-structure': LessonStructureStep,
    students: StudentsStep,
    'course-config': CourseConfigStep,
    done: CourseDoneStep,
  };

  const StepComponent = steps[currentStepId];

  const handleNext = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const handlePrev = useCallback(() => {
    prevStep();
  }, [prevStep]);

  const handleEndFlow = useCallback(() => {
    endFlow();
    onComplete?.();
  }, [endFlow, onComplete]);

  if (!StepComponent) {
    return <div>Unknown step: {currentStepId}</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--surface-primary)]">
      <StepComponent
        setData={setData}
        getData={getData}
        onNext={handleNext}
        onPrev={handlePrev}
        endFlow={handleEndFlow}
      />
    </div>
  );
}
