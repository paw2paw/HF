/**
 * Guided Workflow System — Type Definitions
 *
 * Defines the data structures for the AI-powered guided workflow
 * that takes natural language intent → discovery conversation →
 * step-by-step inline forms → working entities.
 */

// ============================================================================
// Step Types — each maps 1:1 to a React component in the step registry
// ============================================================================

export type StepType =
  | "domain"          // Domain creation form
  | "spec"            // Spec creation (5-sub-step wizard)
  | "content_source"  // Register content source with trust level
  | "playbook"        // Create/configure playbook
  | "onboarding"      // Domain onboarding config
  | "upload"          // Document upload + assertion extraction
  | "review"          // Summary/review before activation
  | "activate";       // Publish/go-live

export type StepStatus = "pending" | "active" | "completed" | "skipped" | "error";

// ============================================================================
// Workflow Plan — returned by AI after discovery conversation
// ============================================================================

export interface WorkflowPlan {
  /** 1-2 sentence summary of what we're building */
  summary: string;
  /** High-level intent category */
  intentType: string;
  /** Existing system entities that match the user's intent */
  existingMatches: ExistingMatch[];
  /** Ordered list of steps to execute */
  steps: PlannedStep[];
}

export interface ExistingMatch {
  type: "domain" | "spec" | "playbook" | "content_source";
  id: string;
  name: string;
  /** Why this entity matches the user's intent */
  matchReason: string;
  /** AI recommendation: reuse existing, modify it, or skip */
  action: "reuse" | "modify" | "skip";
}

export interface PlannedStep {
  /** Unique step ID within this workflow (e.g., "create_domain", "upload_docs") */
  id: string;
  /** Maps to a UI component in the step registry */
  type: StepType;
  /** Human-readable step title */
  title: string;
  /** What this step accomplishes */
  description: string;
  /** Can the user skip this step? */
  required: boolean;
  /** AI-suggested field values from discovery conversation */
  prefilled?: Record<string, any>;
  /** Step IDs that must complete before this step can start */
  dependsOn?: string[];
  /** Optional condition that gates this step */
  condition?: StepCondition;
}

export interface StepCondition {
  type: "user_choice" | "previous_result";
  /** For user_choice: the question to ask (e.g., "Do you have curriculum documents?") */
  question?: string;
  /** For previous_result: field path to check in collectedData */
  checkField?: string;
  /** Has the condition been resolved? */
  resolved?: boolean;
  /** What was the answer? */
  answer?: boolean;
}

// ============================================================================
// Workflow Step — runtime state for each step during execution
// ============================================================================

export interface WorkflowStep extends PlannedStep {
  status: StepStatus;
  /** Data produced by this step (e.g., { id: "uuid", slug: "food-safety" }) */
  result?: Record<string, any>;
  /** Validation errors from most recent attempt */
  validationErrors?: string[];
}

// ============================================================================
// Chat Threading — per-step conversation management
// ============================================================================

export interface ChatOption {
  label: string;
  description?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Clickable option buttons (assistant messages only) */
  options?: ChatOption[];
}

export interface ChatThread {
  messages: ChatMessage[];
  /** Auto-generated when step completes (e.g., "✓ Created Food Safety domain") */
  summary?: string;
  /** Collapsed in the AI panel (expanded = current step only) */
  collapsed: boolean;
}

// ============================================================================
// Workflow State — full runtime state for the orchestrator
// ============================================================================

export type WorkflowPhase = "planning" | "executing" | "completed" | "abandoned";

export interface WorkflowState {
  /** Unique workflow instance ID */
  id: string;
  /** Current phase */
  phase: WorkflowPhase;
  /** Original user intent description */
  intentDescription: string;
  /** AI-generated plan (set after discovery conversation) */
  plan: WorkflowPlan | null;
  /** Runtime step states */
  steps: WorkflowStep[];
  /** ID of the currently active step (null during planning) */
  currentStepId: string | null;
  /** Cross-step data accumulator — keyed by step ID */
  collectedData: Record<string, Record<string, any>>;
  /** Per-step + planning conversation threads */
  chatThreads: Record<string, ChatThread>;
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Step Form Props — interface for all step form components
// ============================================================================

export interface StepFormProps {
  /** Current step definition + runtime state */
  step: WorkflowStep;
  /** AI-suggested values, with cross-step template refs resolved */
  prefilled?: Record<string, any>;
  /** Data from all completed previous steps */
  collectedData: Record<string, Record<string, any>>;
  /** Call when step is successfully completed */
  onComplete: (result: Record<string, any>) => void;
  /** Call to skip an optional step */
  onSkip: () => void;
  /** Call when validation fails */
  onError: (errors: string[]) => void;
  /** AI field updates to apply (from per-step guidance) */
  pendingFieldUpdates?: Record<string, any>;
  /** Acknowledge that field updates were applied */
  onFieldUpdatesApplied?: () => void;
}

// ============================================================================
// API Types — request/response for workflow endpoints
// ============================================================================

/** POST /api/ai/workflow/classify */
export interface ClassifyRequest {
  message: string;
  history: ChatMessage[];
  /** If AI already generated a plan, pass it for amendment */
  currentPlan?: WorkflowPlan | null;
}

export interface ClassifyResponse {
  ok: boolean;
  /** Conversational response (always present) */
  response: string;
  /** Plan — only present when AI has enough clarity to propose one */
  plan?: WorkflowPlan;
  /** True when AI considers the plan final and ready for user confirmation */
  planReady?: boolean;
  /** Structured options for the user to choose from */
  options?: ChatOption[];
  error?: string;
}

/** POST /api/ai/workflow/step-guidance */
export interface StepGuidanceRequest {
  message: string;
  stepType: StepType;
  stepTitle: string;
  /** Current form field values */
  formState: Record<string, any>;
  /** Data from all completed previous steps */
  collectedData: Record<string, Record<string, any>>;
  history: ChatMessage[];
}

export interface StepGuidanceResponse {
  ok: boolean;
  response: string;
  /** Optional field updates to auto-apply to the form */
  fieldUpdates?: Record<string, any>;
  error?: string;
}

// ============================================================================
// Utilities
// ============================================================================

/** Resolve template references in prefilled values using collectedData.
 *  e.g., "${create_domain.id}" → actual UUID from step result */
export function resolvePrefilled(
  prefilled: Record<string, any> | undefined,
  collectedData: Record<string, Record<string, any>>
): Record<string, any> {
  if (!prefilled) return {};
  const resolved: Record<string, any> = {};
  for (const [key, value] of Object.entries(prefilled)) {
    if (typeof value === "string" && value.startsWith("${")) {
      const match = value.match(/^\$\{(.+?)\.(.+?)\}$/);
      if (match) {
        const [, stepId, field] = match;
        resolved[key] = collectedData[stepId]?.[field] ?? value;
      } else {
        resolved[key] = value;
      }
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

/** Draft persistence key for localStorage */
export const WORKFLOW_DRAFT_KEY = "hf.workflow.draft";

/** Generate a unique workflow instance ID */
export function generateWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create initial workflow state */
export function createInitialWorkflowState(): WorkflowState {
  return {
    id: generateWorkflowId(),
    phase: "planning",
    intentDescription: "",
    plan: null,
    steps: [],
    currentStepId: null,
    collectedData: {},
    chatThreads: {
      planning: { messages: [], collapsed: false },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
