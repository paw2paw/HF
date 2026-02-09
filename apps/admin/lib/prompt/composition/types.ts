/**
 * Composition Pipeline Types
 *
 * Shared interfaces for the declarative prompt composition system.
 * COMP-001 spec sections are parsed into these types, and the
 * CompositionExecutor processes them.
 */

// === SPEC SECTION DEFINITION ===
// Read from COMP-001 spec's `sections` array

export interface CompositionSectionDef {
  id: string;
  name: string;
  priority: number;
  /** Named loader(s) to fetch data, or "_assembled" for cross-section references */
  dataSource: string | string[];
  activateWhen: ActivationCondition;
  fallback: FallbackAction;
  /** Named transform from registry (null = pass through raw data) */
  transform: string | null;
  /** Section-specific config (limits, thresholds, etc.) */
  config?: Record<string, any>;
  /** Key in the final llmPrompt output */
  outputKey: string;
  /** IDs of sections that must run before this one */
  dependsOn?: string[];
}

export interface ActivationCondition {
  condition:
    | "always"
    | "dataExists"
    | "contentSpecExists"
    | "callerHasDomain"
    | "callCount == 0"
    | string;
}

export interface FallbackAction {
  action: "omit" | "null" | "emptyObject" | "skip";
  value?: any;
}

// === RESOLVED SPEC TYPES ===

export interface ResolvedSpec {
  name: string;
  slug?: string;
  config: any;
  description?: string | null;
}

export interface ResolvedSpecs {
  identitySpec: ResolvedSpec | null;
  contentSpec: ResolvedSpec | null;
  voiceSpec: ResolvedSpec | null;
}

// === LOADED DATA CONTEXT ===
// Raw data loaded by SectionDataLoader, keyed by loader name

export interface LoadedDataContext {
  caller: CallerData | null;
  memories: MemoryData[];
  personality: PersonalityData | null;
  learnerProfile: LearnerProfileData | null;
  recentCalls: RecentCallData[];
  callCount: number;
  behaviorTargets: BehaviorTargetData[];
  callerTargets: CallerTargetData[];
  callerAttributes: CallerAttributeData[];
  goals: GoalData[];
  /** Stacked playbooks for domain, ordered by sortOrder (first = highest priority) */
  playbooks: PlaybookData[];
  systemSpecs: SystemSpecData[];
  /** INIT-001 onboarding spec for first-call defaults (null if not found) */
  onboardingSpec: OnboardingSpecData | null;
}

/** INIT-001 onboarding spec shape */
export interface OnboardingSpecData {
  id: string;
  slug: string;
  name: string;
  config: {
    /** Default behavior targets for new callers */
    defaultTargets?: Record<string, {
      value: number;
      confidence: number;
      rationale?: string;
    }>;
    /** First call flow phases */
    firstCallFlow?: {
      phases: Array<{
        phase: string;
        duration: string;
        priority: string;
        goals: string[];
        avoid: string[];
      }>;
      successMetrics?: string[];
    };
    /** Welcome templates by domain type */
    welcomeTemplates?: Record<string, string>;
  } | null;
}

// === ASSEMBLED CONTEXT ===
// Accumulates section outputs as transforms run

export interface AssembledContext {
  loadedData: LoadedDataContext;
  sections: Record<string, any>;
  resolvedSpecs: ResolvedSpecs;
  sharedState: SharedComputedState;
  specConfig: Record<string, any>;
}

// === SHARED COMPUTED STATE ===
// Computed once, shared across transforms (modules, session flow, etc.)

export interface CurriculumMetadata {
  type: 'sequential' | 'branching' | 'open-ended';
  trackingMode: 'module-based' | 'competency-based';
  moduleSelector: string;
  moduleOrder: string;
  progressKey: string;
  masteryThreshold: number;
}

export interface SharedComputedState {
  modules: ModuleData[];
  isFirstCall: boolean;
  daysSinceLastCall: number;
  completedModules: Set<string>;
  estimatedProgress: number;
  lastCompletedIndex: number;
  moduleToReview: ModuleData | null;
  nextModule: ModuleData | null;
  reviewType: string;
  reviewReason: string;
  thresholds: { high: number; low: number };
  /** Curriculum metadata from CONTENT spec (if contract-compliant) */
  curriculumMetadata?: CurriculumMetadata | null;
}

export interface ModuleData {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  sequence?: number;
  masteryThreshold?: number | null;
  prerequisites?: string[];
  concepts?: string[];
  learningOutcomes?: string[];
  /** Module content from spec config - the actual curriculum material */
  content?: Record<string, any>;
  [key: string]: any;
}

// === INDIVIDUAL DATA TYPES ===
// Mirror Prisma select shapes from route.ts queries

export interface CallerData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  externalId: string | null;
  domain: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  domainId?: string | null;
}

export interface MemoryData {
  category: string;
  key: string;
  value: string;
  confidence: number;
  evidence: string | null;
}

export interface PersonalityData {
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  neuroticism: number | null;
  preferredTone: string | null;
  preferredLength: string | null;
  technicalLevel: string | null;
  confidenceScore: number | null;
}

export interface LearnerProfileData {
  learningStyle: string | null;
  pacePreference: string | null;
  interactionStyle: string | null;
  priorKnowledge: Record<string, string>;
  preferredModality: string | null;
  questionFrequency: string | null;
  sessionLength: string | null;
  feedbackStyle: string | null;
  lastUpdated: string | null;
}

export interface RecentCallData {
  id: string;
  transcript: string | null;
  createdAt: Date;
  scores: Array<{
    parameterId: string;
    score: number;
    parameter: { name: string } | null;
  }>;
}

export interface BehaviorTargetData {
  parameterId: string;
  targetValue: number;
  confidence: number;
  scope: string;
  playbookId?: string | null;
  parameter: {
    name: string | null;
    interpretationLow: string | null;
    interpretationHigh: string | null;
    domainGroup: string | null;
  } | null;
}

export interface CallerTargetData {
  parameterId: string;
  targetValue: number;
  confidence: number;
  parameter: {
    name: string | null;
    interpretationLow: string | null;
    interpretationHigh: string | null;
    domainGroup: string | null;
  } | null;
}

export interface CallerAttributeData {
  key: string;
  scope: string;
  domain: string | null;
  valueType: string;
  stringValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  jsonValue: any;
  confidence: number | null;
  sourceSpecSlug: string | null;
}

export interface GoalData {
  id: string;
  type: string;
  name: string;
  description: string | null;
  status: string;
  priority: number;
  progress: number;
  playbookId: string | null;
  contentSpec: {
    id: string;
    name: string;
    slug: string;
  } | null;
  playbook: {
    id: string;
    name: string;
  } | null;
  startedAt: Date | null;
}

export interface PlaybookData {
  id: string;
  name: string;
  status: string;
  domain: { id: string; name: string; description: string | null } | null;
  items: Array<{
    spec: SystemSpecData | null;
  }>;
}

export interface SystemSpecData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  specRole: string | null;
  outputType: string;
  config: any;
  domain: string | null;
  promptTemplate?: string | null;
}

// === TRANSFORM FUNCTION SIGNATURE ===

export type TransformFn = (
  rawData: any,
  context: AssembledContext,
  sectionDef: CompositionSectionDef,
) => any;

// === COMPOSITION RESULT ===

export interface CompositionResult {
  llmPrompt: Record<string, any>;
  callerContext: string;
  /** Section outputs keyed by outputKey — for downstream consumers (template rendering, etc.) */
  sections: Record<string, any>;
  /** Raw loaded data — for downstream consumers that need Prisma-shaped data */
  loadedData: LoadedDataContext;
  /** Resolved identity/content/voice specs */
  resolvedSpecs: ResolvedSpecs;
  metadata: {
    sectionsActivated: string[];
    sectionsSkipped: string[];
    loadTimeMs: number;
    transformTimeMs: number;
    /** Merged behavior targets (for backward compat with template rendering) */
    mergedTargetCount: number;
  };
}

// === UTILITY ===

/** Extract value from a CallerAttribute regardless of type */
export function getAttributeValue(attr: CallerAttributeData): any {
  switch (attr.valueType) {
    case "STRING": return attr.stringValue;
    case "NUMBER": return attr.numberValue;
    case "BOOLEAN": return attr.booleanValue;
    case "JSON": return attr.jsonValue;
    default: return attr.stringValue || attr.numberValue || attr.booleanValue || attr.jsonValue;
  }
}

/** Classify a 0-1 value as HIGH/MODERATE/LOW using thresholds */
export function classifyValue(
  value: number | null,
  thresholds: { high: number; low: number },
): string | null {
  if (value === null) return null;
  if (value >= thresholds.high) return "HIGH";
  if (value <= thresholds.low) return "LOW";
  return "MODERATE";
}

/** Classify a 0-1 value as high/moderate/low (lowercase) */
export function scoreToLevel(
  value: number,
  thresholds: { high: number; low: number },
): string {
  if (value >= thresholds.high) return "high";
  if (value <= thresholds.low) return "low";
  return "moderate";
}
