/**
 * Demo Spec Types
 *
 * Defines the JSON schema for interactive demo walkthroughs.
 * Mirrors BDD spec conventions (id, title, version, status, story)
 * but purpose-built for self-contained presentations.
 *
 * Each demo is a JSON file in lib/demo/content/ that the DemoPlayer
 * renders as a step-by-step guided experience.
 */

// =====================================================
// SPEC TYPES
// =====================================================

export interface DemoSpec {
  /** Unique demo ID following project convention, e.g. "DEMO-TUTOR-001" */
  id: string;
  /** Human-readable title */
  title: string;
  /** Short subtitle for listings */
  subtitle: string;
  /** Semver */
  version: string;
  /** draft | active | archived */
  status: "draft" | "active" | "archived";
  /** ISO date of last edit */
  date: string;

  /** Who is this demo for? */
  audience: DemoAudience[];
  /** Estimated duration in minutes */
  estimatedMinutes: number;
  /** Icon emoji for listing cards */
  icon: string;

  /** Why this demo exists — mirrors the BDD "story" block */
  story: {
    asA: string;
    iWant: string;
    soThat: string;
  };

  /** What the viewer should learn */
  objectives: string[];

  /** Prerequisites: other demos or system concepts */
  prerequisites: DemoPrerequisite[];

  /** Ordered steps */
  steps: DemoStep[];

  /** Autoplay settings */
  autoplay: {
    enabled: boolean;
    /** Seconds per step (default) — individual steps can override */
    defaultDurationSec: number;
  };
}

export type DemoAudience = "operator" | "team_member" | "evaluator" | "developer";

export interface DemoPrerequisite {
  type: "demo" | "concept";
  id: string;
  title: string;
}

// =====================================================
// STEP TYPES
// =====================================================

export interface DemoStep {
  /** Unique step ID within this demo, e.g. "navigate-to-domains" */
  id: string;
  /** Step title shown in the progress bar */
  title: string;
  /** 1-3 sentence explanation of what is happening */
  description: string;

  /** Content shown in the main area */
  content: DemoStepContent;

  /** Why this step matters — shown in a callout box */
  reason?: string;
  /** Which system goal this step contributes to */
  goal?: string;

  /** Sidebar tips/warnings (reuses FlashSidebar suggestion shape) */
  tips?: DemoTip[];

  /** AI context: injected into the assistant when user pauses to ask questions */
  aiContext: DemoAIContext;

  /** Autoplay override for this specific step (seconds) */
  durationOverrideSec?: number;

  /** Optional: highlight a sidebar nav item while on this step (GuidanceContext) */
  sidebarHighlight?: {
    href: string;
    type: "pulse" | "flash" | "glow";
  };
}

export interface DemoTip {
  type: "tip" | "warning" | "shortcut" | "best-practice";
  message: string;
}

export interface DemoAIContext {
  /** What the user is looking at right now */
  currentView: string;
  /** What just happened */
  action: string;
  /** Related system concepts the AI should know about */
  relatedConcepts: string[];
  /** Page/entity context for the assistant hook */
  assistantLocation?: {
    page: string;
    section?: string;
    entityType?: string;
    action?: string;
  };
}

// =====================================================
// CONTENT TYPES
// =====================================================

/** What to render in the main content area of a step */
export type DemoStepContent =
  | ScreenshotContent
  | MarkdownContent
  | SplitContent;

export interface ScreenshotContent {
  type: "screenshot";
  src: string;
  alt: string;
  annotations?: Annotation[];
}

export interface MarkdownContent {
  type: "markdown";
  body: string;
}

export interface SplitContent {
  type: "split";
  left: ScreenshotContent | MarkdownContent;
  right: ScreenshotContent | MarkdownContent;
}

export interface Annotation {
  /** CSS percentage position */
  x: string;
  y: string;
  /** Text label */
  label: string;
  /** Arrow direction */
  direction?: "up" | "down" | "left" | "right";
  /** Pulsing highlight circle */
  highlight?: boolean;
}

// =====================================================
// PLAYER STATE TYPES
// =====================================================

export interface DemoPlayerState {
  specId: string;
  currentStepIndex: number;
  totalSteps: number;
  isAutoplay: boolean;
  isPaused: boolean;
  visitedSteps: Set<number>;
  startedAt: number;
}

export type DemoPlayerAction =
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "GOTO"; index: number }
  | { type: "TOGGLE_AUTOPLAY" }
  | { type: "PAUSE_FOR_AI" }
  | { type: "RESUME_FROM_AI" }
  | { type: "RESET"; totalSteps: number };
