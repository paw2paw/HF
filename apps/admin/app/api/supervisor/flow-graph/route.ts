/**
 * Pipeline Flow Graph API
 *
 * Returns a graph representation of the pipeline flow including:
 * - Pipeline steps (Learn + Adapt phases)
 * - AI calls made by each step
 * - Specs that configure each step
 * - Code blocks showing where logic runs
 * - Data flow between steps
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PIPELINE_MANIFEST,
  PipelineStepManifest,
  CompositionSectionManifest,
} from "@/lib/ops/pipeline-manifest";

// =============================================================================
// TYPES
// =============================================================================

type FlowNodeType =
  | "phase"
  | "step"
  | "aiCall"
  | "spec"
  | "codeBlock"
  | "dataStore"
  | "compositionSection";

interface FlowNode {
  id: string;
  label: string;
  type: FlowNodeType;
  phase?: "learn" | "adapt";
  details?: { label: string; value: string | number | boolean | null }[];
  sourceFile?: string;
  sourceLine?: number;
  pseudoCode?: string[];
  icon?: string;
  isActive?: boolean;
}

interface FlowEdge {
  from: string;
  to: string;
  type:
    | "flow"
    | "configures"
    | "produces"
    | "consumes"
    | "calls_ai"
    | "depends_on";
  label?: string;
}

interface FlowGraphResponse {
  ok: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  counts: {
    phases: number;
    steps: number;
    aiCalls: number;
    specs: number;
    codeBlocks: number;
    compositionSections: number;
  };
  manifest: typeof PIPELINE_MANIFEST;
}

// =============================================================================
// PSEUDO-CODE GENERATORS
// =============================================================================

const stepPseudoCode: Record<string, string[]> = {
  "transcripts:process": [
    "for each file in uploadDir:",
    "  transcript = JSON.parse(file)",
    "  caller = findOrCreateCaller(transcript.phone)",
    "  call = createCall({ caller, transcript })",
  ],
  "personality:analyze": [
    "prompt = compilePrompt(spec.promptTemplate, { transcript })",
    "response = await callAI(prompt)",
    "scores = parseScores(response)",
    "saveCallScores(call, scores)",
  ],
  "personality:aggregate": [
    "scores = getCallerScores(caller, { limit: 30 })",
    "weighted = applyTimeDecay(scores, halfLifeDays)",
    "profile = aggregateTraits(weighted)",
    "saveCallerPersonality(caller, profile)",
  ],
  "memory:extract": [
    "prompt = compilePrompt(spec.promptTemplate, { transcript })",
    "response = await callAI(prompt)",
    "memories = parseMemories(response)",
    "saveCallerMemories(caller, memories)",
  ],
  "agent:measure": [
    "prompt = compilePrompt(spec.promptTemplate, { transcript, targets })",
    "response = await callAI(prompt)",
    "measurements = parseMeasurements(response)",
    "saveBehaviorMeasurements(call, measurements)",
  ],
  "reward:compute": [
    "measurements = getMeasurements(call)",
    "targets = getTargets(caller)",
    "deltas = computeDeltas(measurements, targets)",
    "reward = weightedSum(deltas, config.weights)",
    "saveRewardScore(call, reward)",
  ],
  "prompt:compose": [
    "data = loadSectionData(caller, playbook)",
    "for each section in compositionOrder:",
    "  section.content = transform(data[section.id])",
    "prompt = renderPromptTemplate(spec, sections)",
    "return composedPrompt",
  ],
};

const compositionPseudoCode: Record<string, string[]> = {
  caller_info: ["return { phone, name, createdAt }"],
  personality: ["traits = mapBigFiveToDescriptors(personality)", "return traits"],
  memories: ["grouped = groupByCategory(memories)", "return deduplicate(grouped)"],
  behavior_targets: [
    "merged = mergePlaybookAndCallerTargets()",
    "return groupByDomain(merged)",
  ],
  identity: [
    "spec = resolveIdentitySpec(playbook)",
    "return extractIdentityFields(spec)",
  ],
  content: [
    "spec = resolveContentSpec(playbook)",
    "return extractCurriculumFields(spec)",
  ],
  instructions: [
    "voice = getVoiceGuidance(spec)",
    "pedagogy = getPedagogyRules(learnerProfile)",
    "return mergeInstructions(voice, pedagogy)",
  ],
  quick_start: [
    "summary = summarizeContext(personality, memories)",
    "return { keyPoints, doFirst, avoid }",
  ],
};

// =============================================================================
// GRAPH BUILDER
// =============================================================================

async function buildFlowGraph(): Promise<FlowGraphResponse> {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Get active specs from DB for linking
  const activeSpecs = await prisma.analysisSpec.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true, outputType: true },
  });
  const specBySlug = new Map(activeSpecs.map((s) => [s.slug, s]));

  // ==========================================================================
  // 1. Phase nodes
  // ==========================================================================
  for (const phase of PIPELINE_MANIFEST.phases) {
    nodes.push({
      id: `phase:${phase.id}`,
      label: phase.label,
      type: "phase",
      phase: phase.id,
      details: [
        { label: "Description", value: phase.description },
        { label: "Steps", value: phase.steps.length },
      ],
      icon: phase.id === "learn" ? "📚" : "🎯",
    });
  }

  // Edge between phases
  edges.push({
    from: "phase:learn",
    to: "phase:adapt",
    type: "flow",
    label: "data feeds into",
  });

  // ==========================================================================
  // 2. Step nodes + AI call nodes
  // ==========================================================================
  for (const phase of PIPELINE_MANIFEST.phases) {
    let prevStepId: string | null = null;

    for (const step of phase.steps) {
      const stepNodeId = `step:${step.id}`;
      const hasAiCall =
        step.configSource === "spec" || step.configSource === "hybrid";

      // Step node
      nodes.push({
        id: stepNodeId,
        label: step.label,
        type: "step",
        phase: step.phase,
        sourceFile: step.sourceFile,
        sourceLine: step.sourceLine,
        pseudoCode: stepPseudoCode[step.id] || [
          `// See ${step.sourceFile}`,
          "// Implementation details in source",
        ],
        details: [
          { label: "Config Source", value: step.configSource },
          { label: "Inputs", value: step.inputs.join(", ") },
          { label: "Outputs", value: step.outputs.join(", ") },
        ],
        icon: getStepIcon(step.id),
      });

      // Connect step to phase
      edges.push({
        from: `phase:${phase.id}`,
        to: stepNodeId,
        type: "flow",
      });

      // Connect to previous step (dependency)
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const depId of step.dependsOn) {
          edges.push({
            from: `step:${depId}`,
            to: stepNodeId,
            type: "depends_on",
            label: "depends on",
          });
        }
      } else if (prevStepId) {
        // If no explicit deps, connect sequentially within phase
        edges.push({
          from: prevStepId,
          to: stepNodeId,
          type: "flow",
        });
      }

      // AI Call node (if step calls AI)
      if (hasAiCall) {
        const aiNodeId = `ai:${step.id}`;
        nodes.push({
          id: aiNodeId,
          label: `AI: ${step.label}`,
          type: "aiCall",
          phase: step.phase,
          icon: "🤖",
          details: [
            { label: "Step", value: step.label },
            {
              label: "Spec Keys",
              value: step.specKeys?.join(", ") || "none",
            },
          ],
          pseudoCode: [
            "const prompt = compilePrompt(spec.promptTemplate, context);",
            "const response = await llm.complete(prompt);",
            "return parseResponse(response, spec.outputSchema);",
          ],
        });

        edges.push({
          from: stepNodeId,
          to: aiNodeId,
          type: "calls_ai",
          label: "calls AI",
        });

        // Link spec to AI call
        for (const specKey of step.specKeys || []) {
          const spec = specBySlug.get(specKey);
          if (spec) {
            const specNodeId = `spec:${spec.id}`;
            if (!nodes.find((n) => n.id === specNodeId)) {
              nodes.push({
                id: specNodeId,
                label: spec.name,
                type: "spec",
                isActive: true,
                details: [
                  { label: "Slug", value: spec.slug },
                  { label: "Output Type", value: spec.outputType },
                ],
                icon: "📋",
              });
            }
            edges.push({
              from: specNodeId,
              to: aiNodeId,
              type: "configures",
              label: "configures",
            });
          }
        }
      }

      // Data store nodes for outputs
      for (const output of step.outputs) {
        const dataNodeId = `data:${output}`;
        if (!nodes.find((n) => n.id === dataNodeId)) {
          nodes.push({
            id: dataNodeId,
            label: output,
            type: "dataStore",
            icon: "💾",
            details: [{ label: "Model", value: output }],
          });
        }
        edges.push({
          from: stepNodeId,
          to: dataNodeId,
          type: "produces",
          label: "writes",
        });
      }

      prevStepId = stepNodeId;
    }
  }

  // ==========================================================================
  // 3. Composition sections (part of prompt:compose step)
  // ==========================================================================
  const composeStepId = "step:prompt:compose";

  for (const section of PIPELINE_MANIFEST.compositionSections) {
    const sectionNodeId = `section:${section.id}`;

    nodes.push({
      id: sectionNodeId,
      label: section.label,
      type: "compositionSection",
      sourceFile: section.sourceFile,
      icon: getSectionIcon(section.id),
      pseudoCode: compositionPseudoCode[section.id] || [
        `// ${section.loader}`,
        section.transform ? `transform: ${section.transform}()` : "// direct load",
      ],
      details: [
        { label: "Loader", value: section.loader },
        { label: "Transform", value: section.transform || "none" },
        { label: "Activate When", value: section.activateWhen },
        { label: "Fallback", value: section.fallback },
      ],
    });

    // Connect section to compose step
    edges.push({
      from: sectionNodeId,
      to: composeStepId,
      type: "flow",
      label: "feeds into",
    });

    // Section dependencies
    for (const depId of section.dependsOn || []) {
      edges.push({
        from: `section:${depId}`,
        to: sectionNodeId,
        type: "depends_on",
        label: "depends on",
      });
    }
  }

  // ==========================================================================
  // 4. Code block nodes for key files
  // ==========================================================================
  const codeFiles = [
    {
      id: "code:pipeline-run",
      label: "Pipeline Runner",
      file: "lib/ops/pipeline-run.ts",
      desc: "Orchestrates step execution",
    },
    {
      id: "code:composition-executor",
      label: "Composition Executor",
      file: "lib/prompt/composition/CompositionExecutor.ts",
      desc: "Assembles final prompt",
    },
    {
      id: "code:transforms",
      label: "Data Transforms",
      file: "lib/prompt/composition/transforms.ts",
      desc: "Section transform functions",
    },
  ];

  for (const code of codeFiles) {
    nodes.push({
      id: code.id,
      label: code.label,
      type: "codeBlock",
      sourceFile: code.file,
      icon: "📦",
      details: [
        { label: "File", value: code.file },
        { label: "Description", value: code.desc },
      ],
    });
  }

  // Link code blocks to relevant steps
  edges.push({
    from: "code:pipeline-run",
    to: "phase:learn",
    type: "flow",
    label: "orchestrates",
  });
  edges.push({
    from: "code:composition-executor",
    to: "step:prompt:compose",
    type: "flow",
    label: "implements",
  });

  // ==========================================================================
  // Response
  // ==========================================================================
  return {
    ok: true,
    nodes,
    edges,
    counts: {
      phases: nodes.filter((n) => n.type === "phase").length,
      steps: nodes.filter((n) => n.type === "step").length,
      aiCalls: nodes.filter((n) => n.type === "aiCall").length,
      specs: nodes.filter((n) => n.type === "spec").length,
      codeBlocks: nodes.filter((n) => n.type === "codeBlock").length,
      compositionSections: nodes.filter((n) => n.type === "compositionSection")
        .length,
    },
    manifest: PIPELINE_MANIFEST,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getStepIcon(stepId: string): string {
  const icons: Record<string, string> = {
    "transcripts:process": "📥",
    "personality:analyze": "🧠",
    "personality:aggregate": "📊",
    "memory:extract": "💭",
    "agent:measure": "📏",
    "reward:compute": "⭐",
    "prompt:compose": "✍️",
  };
  return icons[stepId] || "⚡";
}

function getSectionIcon(sectionId: string): string {
  const icons: Record<string, string> = {
    caller_info: "👤",
    personality: "🎭",
    memories: "💭",
    behavior_targets: "🎯",
    call_history: "📞",
    curriculum: "📚",
    identity: "🆔",
    content: "📖",
    instructions: "📝",
    instructions_voice: "🎤",
    instructions_pedagogy: "🎓",
    quick_start: "⚡",
    preamble: "📜",
    learner_profile: "📊",
    learner_goals: "🎯",
    domain_context: "🌐",
    session_planning: "📅",
  };
  return icons[sectionId] || "📄";
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function GET() {
  try {
    const graph = await buildFlowGraph();
    return NextResponse.json(graph);
  } catch (error) {
    console.error("[flow-graph] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to build flow graph" },
      { status: 500 }
    );
  }
}
