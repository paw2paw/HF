"use client";

import { useState, useEffect } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface PipelineStep {
  id: string;
  order: number;
  label: string;
  description: string;
  phase: "learn" | "adapt";
  icon: string;
  hasAiCall: boolean;
  specKeys: string[];
  inputs: string[];
  outputs: string[];
  pseudoCode: string[];
  sourceFile: string;
}

interface PipelineStage {
  name: string;
  order: number;
  outputTypes: string[];
  description?: string;
  batched?: boolean;
  requiresMode?: "prep" | "prompt";
}

interface CompositionSection {
  id: string;
  label: string;
  icon: string;
  loader: string;
  transform?: string;
  activateWhen: string;
  dependsOn: string[];
}

type ViewMode = "stages" | "timeline";

// =============================================================================
// STAGE METADATA (enriches API data with icons/details)
// =============================================================================

const STAGE_MANIFEST: Record<string, { icon: string; phase: "learn" | "adapt"; hasAiCall: boolean }> = {
  EXTRACT: { icon: "📥", phase: "learn", hasAiCall: true },
  SCORE_AGENT: { icon: "📏", phase: "learn", hasAiCall: true },
  AGGREGATE: { icon: "📊", phase: "learn", hasAiCall: false },
  REWARD: { icon: "⭐", phase: "learn", hasAiCall: false },
  ADAPT: { icon: "🎯", phase: "adapt", hasAiCall: true },
  SUPERVISE: { icon: "🛡️", phase: "adapt", hasAiCall: false },
  COMPOSE: { icon: "✍️", phase: "adapt", hasAiCall: false },
};

// =============================================================================
// STEP DATA (from manifest)
// =============================================================================

const STEPS: PipelineStep[] = [
  {
    id: "transcripts:process",
    order: 1,
    label: "Process Transcripts",
    description: "Import raw transcript files, create Call and Caller records",
    phase: "learn",
    icon: "📥",
    hasAiCall: false,
    specKeys: [],
    inputs: ["Raw JSON transcripts"],
    outputs: ["Call", "Caller"],
    pseudoCode: [
      "for file in uploadDir:",
      "  transcript = JSON.parse(file)",
      "  caller = findOrCreateCaller(phone)",
      "  call = createCall({ caller, transcript })",
    ],
    sourceFile: "lib/ops/pipeline-run.ts",
  },
  {
    id: "personality:analyze",
    order: 2,
    label: "Analyze Personality",
    description: "Score caller traits (Big 5) from transcript using analysis specs",
    phase: "learn",
    icon: "🧠",
    hasAiCall: true,
    specKeys: ["personality"],
    inputs: ["Call.transcript", "AnalysisSpec"],
    outputs: ["CallScore", "PersonalityObservation"],
    pseudoCode: [
      "prompt = compilePrompt(spec, { transcript })",
      "response = await callAI(prompt)",
      "scores = parseScores(response)",
      "saveCallScores(call, scores)",
    ],
    sourceFile: "lib/ops/personality-analyze.ts",
  },
  {
    id: "memory:extract",
    order: 2,
    label: "Extract Memories",
    description: "Extract structured facts, preferences, and events from transcript",
    phase: "learn",
    icon: "💭",
    hasAiCall: true,
    specKeys: ["memory-personal-facts", "memory-preferences"],
    inputs: ["Call.transcript", "AnalysisSpec[]"],
    outputs: ["CallerMemory"],
    pseudoCode: [
      "prompt = compilePrompt(spec, { transcript })",
      "response = await callAI(prompt)",
      "memories = parseMemories(response)",
      "saveCallerMemories(caller, memories)",
    ],
    sourceFile: "lib/ops/memory-extract.ts",
  },
  {
    id: "personality:aggregate",
    order: 3,
    label: "Aggregate Personality",
    description: "Aggregate per-call scores into CallerPersonality profile with time decay",
    phase: "learn",
    icon: "📊",
    hasAiCall: false,
    specKeys: ["personality-aggregate"],
    inputs: ["CallScore[]", "PersonalityObservation[]"],
    outputs: ["CallerPersonality", "CallerPersonalityProfile"],
    pseudoCode: [
      "scores = getCallerScores(caller, { limit: 30 })",
      "weighted = applyTimeDecay(scores, halfLifeDays)",
      "profile = aggregateTraits(weighted)",
      "saveCallerPersonality(caller, profile)",
    ],
    sourceFile: "lib/ops/personality-aggregate.ts",
  },
  {
    id: "agent:measure",
    order: 2,
    label: "Measure Agent",
    description: "Score what the agent actually did during the call against behavior parameters",
    phase: "learn",
    icon: "📏",
    hasAiCall: true,
    specKeys: ["measure-agent"],
    inputs: ["Call.transcript", "BehaviorTarget[]"],
    outputs: ["BehaviorMeasurement"],
    pseudoCode: [
      "prompt = compilePrompt(spec, { transcript, targets })",
      "response = await callAI(prompt)",
      "measurements = parseMeasurements(response)",
      "saveBehaviorMeasurements(call, measurements)",
    ],
    sourceFile: "lib/ops/measure-agent.ts",
  },
  {
    id: "reward:compute",
    order: 3,
    label: "Compute Reward",
    description: "Compare actual behavior vs targets, compute reward scores and deltas",
    phase: "learn",
    icon: "⭐",
    hasAiCall: false,
    specKeys: ["reward-compute"],
    inputs: ["BehaviorMeasurement[]", "BehaviorTarget[]"],
    outputs: ["RewardScore"],
    pseudoCode: [
      "measurements = getMeasurements(call)",
      "targets = getTargets(caller)",
      "deltas = computeDeltas(measurements, targets)",
      "reward = weightedSum(deltas, config.weights)",
      "saveRewardScore(call, reward)",
    ],
    sourceFile: "lib/ops/compute-reward.ts",
  },
  {
    id: "goals:extract",
    order: 3,
    label: "Extract Goals",
    description: "Extract learner goals from transcript - explicit ('I want to learn X') and implicit (frustrations, curiosities)",
    phase: "learn",
    icon: "🎯",
    hasAiCall: true,
    specKeys: ["goal-extract"],
    inputs: ["Call.transcript", "Goal[]"],
    outputs: ["Goal"],
    pseudoCode: [
      "existingGoals = getCallerGoals(caller)",
      "prompt = buildGoalExtractionPrompt(transcript, existingGoals)",
      "response = await callAI(prompt)",
      "goals = parseGoals(response)  // EXPLICIT or IMPLICIT",
      "for goal in goals:",
      "  if duplicate: updateGoalEvidence(existing, goal)",
      "  else: createGoal({ callerId, playbookId: null })",
    ],
    sourceFile: "lib/goals/extract-goals.ts",
  },
  {
    id: "goals:track",
    order: 3,
    label: "Track Goal Progress",
    description: "Update progress on existing goals based on conversation evidence",
    phase: "learn",
    icon: "📈",
    hasAiCall: true,
    specKeys: ["goal-track"],
    inputs: ["Call.transcript", "Goal[]"],
    outputs: ["Goal (updated)"],
    pseudoCode: [
      "activeGoals = getActiveGoals(caller)",
      "for goal in activeGoals:",
      "  progress = assessProgress(transcript, goal)",
      "  if progress.completed: markComplete(goal)",
      "  else: updateProgress(goal, progress)",
    ],
    sourceFile: "lib/goals/track-progress.ts",
  },
  {
    id: "adapt:targets",
    order: 3,
    label: "Compute Targets",
    description: "Compute personalized behavior targets for next call based on personality, goals, and history",
    phase: "adapt",
    icon: "🎛️",
    hasAiCall: true,
    specKeys: ["adapt-*"],
    inputs: ["CallerPersonality", "Goal[]", "CallScore[]", "RewardScore"],
    outputs: ["CallerTarget"],
    pseudoCode: [
      "profile = getCallerProfile(caller)",
      "goals = getActiveGoals(caller)",
      "scores = getRecentScores(caller)",
      "prompt = buildAdaptPrompt(profile, goals, scores)",
      "targets = await callAI(prompt)",
      "clampedTargets = applyGuardrails(targets)",
      "saveCallerTargets(caller, clampedTargets)",
    ],
    sourceFile: "lib/ops/compute-adapt.ts",
  },
  {
    id: "prompt:compose",
    order: 4,
    label: "Compose Prompt",
    description: "Assemble personalized prompt from personality, memories, targets, and playbook specs",
    phase: "adapt",
    icon: "✍️",
    hasAiCall: false,
    specKeys: ["compose-prompt"],
    inputs: ["CallerPersonality", "CallerMemory[]", "BehaviorTarget[]", "Playbook"],
    outputs: ["ComposedPrompt"],
    pseudoCode: [
      "data = loadSectionData(caller, playbook)",
      "for section in compositionOrder:",
      "  section.content = transform(data[section.id])",
      "prompt = renderPromptTemplate(spec, sections)",
      "return composedPrompt",
    ],
    sourceFile: "lib/prompt/composition/CompositionExecutor.ts",
  },
];

const COMPOSITION_SECTIONS: CompositionSection[] = [
  { id: "caller_info", label: "Caller Info", icon: "👤", loader: "caller", activateWhen: "always", dependsOn: [] },
  { id: "personality", label: "Personality", icon: "🎭", loader: "personality", transform: "mapPersonalityTraits", activateWhen: "dataExists", dependsOn: [] },
  { id: "memories", label: "Memories", icon: "💭", loader: "memories", transform: "deduplicateAndGroup", activateWhen: "dataExists", dependsOn: [] },
  { id: "behavior_targets", label: "Targets", icon: "🎯", loader: "behaviorTargets", transform: "mergeAndGroup", activateWhen: "dataExists", dependsOn: ["caller_info"] },
  { id: "identity", label: "Identity (WHO)", icon: "🆔", loader: "resolveIdentitySpec", activateWhen: "identitySpecExists", dependsOn: [] },
  { id: "content", label: "Content (WHAT)", icon: "📖", loader: "resolveContentSpec", activateWhen: "contentSpecExists", dependsOn: [] },
  { id: "instructions", label: "Instructions (HOW)", icon: "📝", loader: "derived", transform: "computeInstructions", activateWhen: "always", dependsOn: ["identity"] },
  { id: "quick_start", label: "Quick Start", icon: "⚡", loader: "derived", transform: "computeQuickStart", activateWhen: "always", dependsOn: ["personality", "memories"] },
];

// =============================================================================
// COMPONENT
// =============================================================================

// Types for supervisor API response
interface StageSpec {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  specRole: string | null;
  scope: string;
  isActive: boolean;
  priority: number;
  domain: string | null;
}

interface StageWithSpecs extends PipelineStage {
  systemSpecs: StageSpec[];
  domainSpecs: StageSpec[];
  totalSpecs: number;
}

export default function FlowVisualizer() {
  const [viewMode, setViewMode] = useState<ViewMode>("stages");
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [showComposition, setShowComposition] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [stagesWithSpecs, setStagesWithSpecs] = useState<StageWithSpecs[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);

  // Load pipeline stages and specs from API
  useEffect(() => {
    async function loadStages() {
      try {
        // Fetch both endpoints in parallel
        const [stagesRes, supervisorRes] = await Promise.all([
          fetch("/api/pipeline/stages"),
          fetch("/api/supervisor"),
        ]);
        const stagesData = await stagesRes.json();
        const supervisorData = await supervisorRes.json();

        if (stagesData.ok && stagesData.stages) {
          setStages(stagesData.stages);
        }

        // Merge stages with specs from supervisor API
        if (supervisorData.ok && supervisorData.stages) {
          setStagesWithSpecs(supervisorData.stages);
        }
      } catch (error) {
        console.error("Failed to load pipeline stages:", error);
      } finally {
        setStagesLoading(false);
      }
    }
    loadStages();
  }, []);

  // Group stages by phase for rendering (use stagesWithSpecs if available, fall back to stages)
  const stagesData = stagesWithSpecs.length > 0 ? stagesWithSpecs : stages;
  const learnStages = stagesData.filter((s) => {
    const manifest = STAGE_MANIFEST[s.name];
    return manifest?.phase === "learn";
  });
  const adaptStages = stagesData.filter((s) => {
    const manifest = STAGE_MANIFEST[s.name];
    return manifest?.phase === "adapt";
  });

  // Helper to get specs for a stage
  const getStageSpecs = (stageName: string): { systemSpecs: StageSpec[]; domainSpecs: StageSpec[] } => {
    const stageWithSpecs = stagesWithSpecs.find(s => s.name === stageName);
    return {
      systemSpecs: stageWithSpecs?.systemSpecs || [],
      domainSpecs: stageWithSpecs?.domainSpecs || [],
    };
  };

  return (
    <div className="p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-600">
            <button
              onClick={() => setViewMode("stages")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "stages"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              }`}
            >
              Stages
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === "timeline"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              }`}
            >
              Operations
            </button>
          </div>
          <span className="text-sm text-neutral-500">
            {viewMode === "stages"
              ? `${stages.length} stages from PIPELINE-001`
              : `${STEPS.length} operations, ${STEPS.filter((s) => s.hasAiCall).length} AI calls`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "stages" && stagesWithSpecs.length > 0 && (
            <>
              <button
                onClick={() => setExpandedStage(expandedStage ? null : stagesWithSpecs[0]?.name)}
                className="px-3 py-1.5 text-sm rounded-lg transition-colors bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-200 dark:hover:bg-neutral-600"
              >
                {expandedStage ? "Collapse" : "Expand"}
              </button>
            </>
          )}
          <button
            onClick={() => setShowComposition(!showComposition)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              showComposition
                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
                : "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-600"
            }`}
          >
            {showComposition ? "Hide" : "Show"} Composition
          </button>
        </div>
      </div>

      {/* Pipeline Stages View (from PIPELINE-001 spec) */}
      {viewMode === "stages" && (
        <div className="space-y-8">
          {stagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              <span className="ml-3 text-neutral-500">Loading pipeline stages...</span>
            </div>
          ) : (
            <>
              {/* Learn Phase Stages */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">📚</span>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    Learn Phase
                  </h3>
                  <span className="text-sm text-neutral-500">Post-call analysis</span>
                </div>
                <div className="flex items-start gap-4 overflow-x-auto pb-4">
                  {learnStages.map((stage, idx) => {
                    const manifest = STAGE_MANIFEST[stage.name] || { icon: "📦", phase: "learn", hasAiCall: false };
                    const { systemSpecs, domainSpecs } = getStageSpecs(stage.name);
                    const totalSpecs = systemSpecs.length + domainSpecs.length;
                    const isExpanded = expandedStage === stage.name;
                    return (
                      <div key={stage.name} className="flex items-start">
                        <div
                          className={`w-64 p-4 rounded-xl border cursor-pointer transition-all ${
                            isExpanded
                              ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 shadow-lg"
                              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-400"
                          }`}
                          onClick={() => setExpandedStage(isExpanded ? null : stage.name)}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700">
                              {manifest.icon}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">{stage.name}</h4>
                              <span className="text-xs text-neutral-500">Order {stage.order}</span>
                            </div>
                            {totalSpecs > 0 && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                {totalSpecs} specs
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                            {stage.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {stage.outputTypes.map((type) => (
                              <span
                                key={type}
                                className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                              >
                                {type}
                              </span>
                            ))}
                            {stage.batched && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                batched
                              </span>
                            )}
                            {manifest.hasAiCall && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                🤖 AI
                              </span>
                            )}
                          </div>

                          {/* Expanded: Show specs */}
                          {isExpanded && totalSpecs > 0 && (
                            <div
                              className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 space-y-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-xs font-semibold text-neutral-500 uppercase">Specs in this stage</div>
                              {systemSpecs.map((spec) => (
                                <a
                                  key={spec.id}
                                  href={`/x/dictionary?search=${encodeURIComponent(spec.slug)}`}
                                  className="block p-2 bg-white dark:bg-neutral-800 rounded border border-blue-200 dark:border-blue-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                      {spec.name}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
                                      {spec.scope}
                                    </span>
                                    <span className="ml-auto text-[10px] text-indigo-500">→</span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-mono mt-1">{spec.slug}</div>
                                </a>
                              ))}
                              {domainSpecs.map((spec) => (
                                <a
                                  key={spec.id}
                                  href={`/x/dictionary?search=${encodeURIComponent(spec.slug)}`}
                                  className="block p-2 bg-white dark:bg-neutral-800 rounded border border-purple-200 dark:border-purple-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                      {spec.name}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300">
                                      DOMAIN
                                    </span>
                                    <span className="ml-auto text-[10px] text-indigo-500">→</span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-mono mt-1">{spec.slug}</div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        {idx < learnStages.length - 1 && (
                          <div className="flex items-center px-2 pt-8">
                            <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phase Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-blue-500 to-pink-500" />
                <span className="text-sm font-medium text-neutral-500">Data feeds into</span>
                <div className="flex-1 h-px bg-gradient-to-r from-pink-500 to-blue-500" />
              </div>

              {/* Adapt Phase Stages */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🎯</span>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    Adapt Phase
                  </h3>
                  <span className="text-sm text-neutral-500">Pre-call preparation</span>
                </div>
                <div className="flex items-start gap-4 overflow-x-auto pb-4">
                  {adaptStages.map((stage, idx) => {
                    const manifest = STAGE_MANIFEST[stage.name] || { icon: "📦", phase: "adapt", hasAiCall: false };
                    const { systemSpecs, domainSpecs } = getStageSpecs(stage.name);
                    const totalSpecs = systemSpecs.length + domainSpecs.length;
                    const isExpanded = expandedStage === stage.name;
                    return (
                      <div key={stage.name} className="flex items-start">
                        <div
                          className={`w-64 p-4 rounded-xl border cursor-pointer transition-all ${
                            isExpanded
                              ? "bg-pink-100 dark:bg-pink-900/40 border-pink-400 dark:border-pink-600 shadow-lg"
                              : "bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 hover:border-pink-400"
                          }`}
                          onClick={() => setExpandedStage(isExpanded ? null : stage.name)}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-pink-100 dark:bg-pink-900/50 border border-pink-300 dark:border-pink-700">
                              {manifest.icon}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">{stage.name}</h4>
                              <span className="text-xs text-neutral-500">Order {stage.order}</span>
                            </div>
                            {totalSpecs > 0 && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                {totalSpecs} specs
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                            {stage.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {stage.outputTypes.map((type) => (
                              <span
                                key={type}
                                className="px-2 py-0.5 text-xs rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300"
                              >
                                {type}
                              </span>
                            ))}
                            {stage.requiresMode && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                mode: {stage.requiresMode}
                              </span>
                            )}
                            {manifest.hasAiCall && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                🤖 AI
                              </span>
                            )}
                          </div>

                          {/* Expanded: Show specs */}
                          {isExpanded && totalSpecs > 0 && (
                            <div
                              className="mt-3 pt-3 border-t border-pink-200 dark:border-pink-700 space-y-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-xs font-semibold text-neutral-500 uppercase">Specs in this stage</div>
                              {systemSpecs.map((spec) => (
                                <a
                                  key={spec.id}
                                  href={`/x/dictionary?search=${encodeURIComponent(spec.slug)}`}
                                  className="block p-2 bg-white dark:bg-neutral-800 rounded border border-pink-200 dark:border-pink-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                      {spec.name}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
                                      {spec.scope}
                                    </span>
                                    <span className="ml-auto text-[10px] text-indigo-500">→</span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-mono mt-1">{spec.slug}</div>
                                </a>
                              ))}
                              {domainSpecs.map((spec) => (
                                <a
                                  key={spec.id}
                                  href={`/x/dictionary?search=${encodeURIComponent(spec.slug)}`}
                                  className="block p-2 bg-white dark:bg-neutral-800 rounded border border-purple-200 dark:border-purple-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                                      {spec.name}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300">
                                      DOMAIN
                                    </span>
                                    <span className="ml-auto text-[10px] text-indigo-500">→</span>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-mono mt-1">{spec.slug}</div>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        {idx < adaptStages.length - 1 && (
                          <div className="flex items-center px-2 pt-8">
                            <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Source info */}
              <div className="text-center text-sm text-neutral-500 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                Stages loaded from <span className="font-mono text-indigo-600 dark:text-indigo-400">PIPELINE-001</span> spec via{" "}
                <span className="font-mono text-neutral-600 dark:text-neutral-400">/api/pipeline/stages</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Operations View (Timeline) */}
      {viewMode === "timeline" && (
        <div className="relative">
          {/* Group steps by order for parallel rendering */}
          {(() => {
            const stepsByOrder = STEPS.reduce((acc, step) => {
              if (!acc[step.order]) acc[step.order] = [];
              acc[step.order].push(step);
              return acc;
            }, {} as Record<number, PipelineStep[]>);
            const orders = Object.keys(stepsByOrder).map(Number).sort((a, b) => a - b);

            return (
              <div className="space-y-6">
                {orders.map((order, orderIdx) => {
                  const stepsAtOrder = stepsByOrder[order];
                  const isParallel = stepsAtOrder.length > 1;

                  return (
                    <div key={order}>
                      {/* Connector from previous */}
                      {orderIdx > 0 && (
                        <div className="flex justify-center mb-4">
                          <div className="flex flex-col items-center">
                            <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500 to-blue-500" />
                            <svg className="w-4 h-4 text-blue-500 -mt-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Concurrent indicator */}
                      {isParallel && (
                        <div className="flex items-center gap-2 mb-3 justify-center">
                          <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-amber-400" />
                          <span className="px-3 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                            ⚡ {stepsAtOrder.length} concurrent
                          </span>
                          <div className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-amber-400" />
                        </div>
                      )}

                      {/* Steps grid - centered */}
                      <div className="flex justify-center gap-4">
                        {stepsAtOrder.map((step) => (
                          <div key={step.id} className="w-72 flex-shrink-0">
                            {/* Step card */}
                            <div
                              className={`h-full p-4 rounded-xl border cursor-pointer transition-all ${
                                expandedStep === step.id
                                  ? "bg-white dark:bg-neutral-800 shadow-lg border-indigo-300 dark:border-indigo-600"
                                  : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 hover:border-indigo-300 dark:hover:border-indigo-600"
                              }`}
                              onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                            >
                              {/* Header with icon */}
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                                    step.phase === "learn"
                                      ? "bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-400"
                                      : "bg-pink-100 dark:bg-pink-900/50 border-2 border-pink-400"
                                  }`}
                                >
                                  {step.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                                      {step.label}
                                    </h4>
                                    {step.hasAiCall && (
                                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                        🤖 AI Call
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                                    {step.description}
                                  </p>
                                </div>
                                <svg
                                  className={`w-5 h-5 text-neutral-400 transition-transform flex-shrink-0 ${
                                    expandedStep === step.id ? "rotate-180" : ""
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>

                              {/* Badges */}
                              <div className="flex items-center gap-2 mt-3">
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
                                  Step {step.order}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    step.phase === "learn"
                                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                      : "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                                  }`}
                                >
                                  {step.phase}
                                </span>
                              </div>

                              {/* Expanded content */}
                              {expandedStep === step.id && (
                                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="text-xs font-semibold text-neutral-500 uppercase mb-2">Inputs</div>
                                      <div className="flex flex-wrap gap-1">
                                        {step.inputs.map((input) => (
                                          <span key={input} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                            {input}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold text-neutral-500 uppercase mb-2">Outputs</div>
                                      <div className="flex flex-wrap gap-1">
                                        {step.outputs.map((output) => (
                                          <span key={output} className="px-2 py-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded">
                                            {output}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {step.specKeys.length > 0 && (
                                    <div>
                                      <div className="text-xs font-semibold text-neutral-500 uppercase mb-2">Spec Keys</div>
                                      <div className="flex flex-wrap gap-1">
                                        {step.specKeys.map((key) => (
                                          <a
                                            key={key}
                                            href={`/x/dictionary?search=${encodeURIComponent(key)}`}
                                            className="px-2 py-1 text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors"
                                          >
                                            {key} →
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <div className="text-xs font-semibold text-neutral-500 uppercase mb-2">Pseudo-code</div>
                                    <pre className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-xs font-mono text-neutral-700 dark:text-neutral-300 overflow-x-auto">
                                      {step.pseudoCode.join("\n")}
                                    </pre>
                                  </div>

                                  <div className="text-xs text-neutral-500">
                                    📁 {step.sourceFile}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Composition Sections in Timeline */}
          {showComposition && (
            <div className="relative flex gap-6 mt-6">
              <div className="relative z-10 flex-shrink-0">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl shadow-lg bg-orange-100 dark:bg-orange-900/50 border-2 border-orange-500">
                  📦
                </div>
              </div>
              <div className="flex-1">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800">
                  <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-3">
                    Composition Sections
                  </h4>
                  <div className="grid grid-cols-4 gap-2">
                    {COMPOSITION_SECTIONS.map((section) => (
                      <div
                        key={section.id}
                        className="p-2 bg-white dark:bg-neutral-800 rounded border border-orange-200 dark:border-orange-800/50 text-center"
                      >
                        <span className="text-lg">{section.icon}</span>
                        <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mt-1">
                          {section.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
