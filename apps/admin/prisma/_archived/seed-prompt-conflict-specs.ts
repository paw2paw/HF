import { PrismaClient, AnalysisOutputType, SpecificationScope, ParameterType, SpecRole } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script for Prompt Conflict Detection Specs
 *
 * These specs detect and handle conflicts in composed prompts:
 * - State consistency (call count, curriculum progress, etc.)
 * - Stale instruction detection ("No memories yet" when memories exist)
 * - Memory-content conflicts (e.g., "dislikes Nogales" but must review it)
 * - Topic adherence scoring (did agent stick to plan?)
 * - Behavior target conflict resolution (brevity vs warmth)
 * - Duplicate content detection
 *
 * Run with: npx tsx prisma/seed-prompt-conflict-specs.ts
 */

async function main() {
  console.log("\n🔍 SEEDING PROMPT CONFLICT DETECTION SPECS\n");
  console.log("━".repeat(60));

  // ============================================
  // 1. Create Parameters for conflict detection
  // ============================================
  console.log("\n📐 Creating conflict detection parameters...\n");

  const conflictParams = [
    {
      parameterId: "LINT-STATE-CONSISTENCY",
      name: "State Consistency Score",
      definition: "How consistent the prompt state values are across sections (_quickStart, callHistory, curriculum, etc.)",
      interpretationHigh: "All state values are consistent and match",
      interpretationLow: "Multiple conflicting values detected (e.g., call #3 vs totalCalls: 2)",
      domainGroup: "prompt-lint",
    },
    {
      parameterId: "LINT-STALE-INSTRUCTIONS",
      name: "Stale Instruction Score",
      definition: "Detects placeholder text that contradicts actual data (e.g., 'No memories yet' when memories exist)",
      interpretationHigh: "No stale placeholder text detected",
      interpretationLow: "Stale placeholders contradict actual data",
      domainGroup: "prompt-lint",
    },
    {
      parameterId: "LINT-DUPLICATE-CONTENT",
      name: "Duplicate Content Score",
      definition: "Detects when the same data appears in multiple prompt sections (wastes tokens, creates confusion)",
      interpretationHigh: "No unnecessary duplication detected",
      interpretationLow: "Same content appears multiple times (e.g., voice rules in two places)",
      domainGroup: "prompt-lint",
    },
    {
      parameterId: "RUNTIME-TOPIC-ADHERENCE",
      name: "Topic Adherence Score",
      definition: "How well the agent stayed on the planned session topics vs following tangents",
      interpretationHigh: "Agent stuck to plan, properly redirected tangents",
      interpretationLow: "Agent frequently went off-topic or abandoned session plan",
      domainGroup: "session-quality",
    },
    {
      parameterId: "RUNTIME-MEMORY-CONFLICT-DETECTED",
      name: "Memory-Content Conflict Detected",
      definition: "Whether a conflict between caller memory and required content was detected",
      interpretationHigh: "Conflict detected (e.g., dislikes topic X but must cover it)",
      interpretationLow: "No memory-content conflicts",
      domainGroup: "session-quality",
    },
    {
      parameterId: "RUNTIME-BEHAVIOR-TARGET-CONFLICT",
      name: "Behavior Target Conflict Score",
      definition: "Detects when behavior targets create impossible demands (e.g., HIGH warmth + LOW response length)",
      interpretationHigh: "Conflicting targets detected that need resolution",
      interpretationLow: "All targets are compatible",
      domainGroup: "prompt-lint",
    },
  ];

  for (const param of conflictParams) {
    await prisma.parameter.upsert({
      where: { parameterId: param.parameterId },
      create: {
        parameterId: param.parameterId,
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
        scaleType: "0-1",
        directionality: "neutral",
        computedBy: "measured",
        sectionId: "conflict-detection",
        domainGroup: param.domainGroup,
        parameterType: ParameterType.STATE,
        isAdjustable: false,
      },
      update: {
        name: param.name,
        definition: param.definition,
        interpretationHigh: param.interpretationHigh,
        interpretationLow: param.interpretationLow,
      },
    });
    console.log(`   ✓ Upserted parameter: ${param.parameterId}`);
  }

  // ============================================
  // 2. SYSTEM SPEC: State Consistency Check
  // ============================================
  console.log("\n🔍 Creating State Consistency Check spec...");

  await prisma.analysisSpec.upsert({
    where: { slug: "prompt-state-consistency" },
    update: {
      name: "Prompt State Consistency Check",
      description: `PRE-CALL LINT: Validates that state values are consistent across prompt sections.

Checks for mismatches between:
- _quickStart.this_caller call number vs callHistory.totalCalls
- curriculum.nextModule vs instructions.curriculum_guidance
- curriculum.modules[].status vs _quickStart.this_session plan
- callHistory.recent.length vs totalCalls

Outputs a score (1.0 = consistent, lower = conflicts found) and a list of detected conflicts.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        checks: [
          {
            name: "call_count_match",
            description: "Verify _quickStart call number matches callHistory.totalCalls + 1",
            severity: "high",
            paths: ["_quickStart.this_caller", "callHistory.totalCalls"],
          },
          {
            name: "next_module_match",
            description: "Verify curriculum.nextModule matches instructions.curriculum_guidance",
            severity: "high",
            paths: ["curriculum.nextModule", "instructions.curriculum_guidance"],
          },
          {
            name: "current_module_status",
            description: "Verify in_progress module is referenced in session plan",
            severity: "medium",
            paths: ["curriculum.modules[].status", "_quickStart.this_session"],
          },
          {
            name: "recent_calls_count",
            description: "Verify callHistory.recent.length makes sense with totalCalls",
            severity: "low",
            paths: ["callHistory.recent", "callHistory.totalCalls"],
          },
        ],
        outputFormat: {
          score: "0-1 (1.0 = all consistent)",
          conflicts: "Array of { check, expected, actual, severity }",
        },
      },
      promptTemplate: `Analyze the following prompt JSON for state consistency issues.

Check for these specific mismatches:
1. Call count: Does _quickStart.this_caller call number match callHistory.totalCalls + 1?
2. Next module: Does curriculum.nextModule match what's stated in instructions.curriculum_guidance?
3. Current progress: Is the in_progress module referenced in the session plan?
4. History length: Does callHistory.recent array length make sense with totalCalls?

For each issue found, note:
- What check failed
- What value was expected
- What value was found
- Severity (high/medium/low)

Return a JSON object:
{
  "score": <0.0-1.0 where 1.0 means all consistent>,
  "conflicts": [
    { "check": "...", "expected": "...", "actual": "...", "severity": "..." }
  ],
  "recommendation": "<brief fix suggestion>"
}`,
    },
    create: {
      slug: "prompt-state-consistency",
      name: "Prompt State Consistency Check",
      description: `PRE-CALL LINT: Validates that state values are consistent across prompt sections.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 100,
      isActive: true,
      isDirty: false,
      config: {
        checks: [
          {
            name: "call_count_match",
            description: "Verify _quickStart call number matches callHistory.totalCalls + 1",
            severity: "high",
            paths: ["_quickStart.this_caller", "callHistory.totalCalls"],
          },
          {
            name: "next_module_match",
            description: "Verify curriculum.nextModule matches instructions.curriculum_guidance",
            severity: "high",
            paths: ["curriculum.nextModule", "instructions.curriculum_guidance"],
          },
        ],
        outputFormat: {
          score: "0-1 (1.0 = all consistent)",
          conflicts: "Array of { check, expected, actual, severity }",
        },
      },
      promptTemplate: `Analyze the following prompt JSON for state consistency issues...`,
    },
  });

  console.log(`   ✓ Created: prompt-state-consistency`);

  // ============================================
  // 3. SYSTEM SPEC: Stale Instruction Detector
  // ============================================
  console.log("\n📜 Creating Stale Instruction Detector spec...");

  await prisma.analysisSpec.upsert({
    where: { slug: "prompt-stale-instruction-detector" },
    update: {
      name: "Stale Instruction Detector",
      description: `PRE-CALL LINT: Detects placeholder text that contradicts actual data.

Common patterns to detect:
- "No specific memories recorded yet" when memories.totalCount > 0
- "No specific session goals set" when _quickStart.this_session has content
- "No topics of interest" when memories.byCategory.PREFERENCE exists
- "Build rapport and learn about them" when personality/memories already established

These stale instructions confuse the model and create contradictory guidance.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 95,
      isActive: true,
      isDirty: false,
      config: {
        stalePatterns: [
          {
            pattern: "No specific memories recorded yet",
            contradictsWhen: "memories.totalCount > 0",
            field: "instructions.use_memories",
            replacement: "Reference the {{memories.totalCount}} memories stored for this caller.",
          },
          {
            pattern: "No specific session goals set",
            contradictsWhen: "_quickStart.this_session is not empty",
            field: "instructions.session_guidance",
            replacement: "Follow the session plan: {{_quickStart.this_session}}",
          },
          {
            pattern: "Build rapport and learn about them",
            contradictsWhen: "callHistory.totalCalls > 1",
            field: "instructions.use_memories",
            replacement: "This is a returning caller with {{callHistory.totalCalls}} previous calls.",
          },
          {
            pattern: "No topics of interest",
            contradictsWhen: "memories.byCategory.PREFERENCE exists",
            field: "instructions.use_topics",
            replacement: "Caller interests: {{memories.byCategory.PREFERENCE}}",
          },
        ],
        outputFormat: {
          score: "0-1 (1.0 = no stale text)",
          staleFields: "Array of { field, staleText, actualData, suggestedFix }",
        },
      },
      promptTemplate: `Analyze the prompt for stale placeholder text that contradicts actual data.

Look for these patterns:
1. "No specific memories recorded yet" but memories.totalCount > 0
2. "No specific session goals set" but _quickStart.this_session has a plan
3. "Build rapport and learn about them" but this is call #2+
4. Any text saying "no data" or "not set" when data clearly exists

For each stale instruction found, report:
- The field containing stale text
- The stale text itself
- What the actual data shows
- Suggested replacement text

Return:
{
  "score": <0.0-1.0 where 1.0 means no stale text>,
  "staleFields": [
    { "field": "...", "staleText": "...", "actualData": "...", "suggestedFix": "..." }
  ]
}`,
    },
    create: {
      slug: "prompt-stale-instruction-detector",
      name: "Stale Instruction Detector",
      description: `PRE-CALL LINT: Detects placeholder text that contradicts actual data.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 95,
      isActive: true,
      isDirty: false,
      config: {
        stalePatterns: [
          {
            pattern: "No specific memories recorded yet",
            contradictsWhen: "memories.totalCount > 0",
            field: "instructions.use_memories",
          },
        ],
      },
      promptTemplate: `Analyze the prompt for stale placeholder text...`,
    },
  });

  console.log(`   ✓ Created: prompt-stale-instruction-detector`);

  // ============================================
  // 4. DOMAIN SPEC: Memory-Content Conflict Handler
  // ============================================
  console.log("\n⚠️ Creating Memory-Content Conflict Handler spec...");

  await prisma.analysisSpec.upsert({
    where: { slug: "prompt-memory-content-conflict" },
    update: {
      name: "Memory-Content Conflict Handler",
      description: `RUNTIME ADAPT: When caller memory conflicts with required content, output a handling strategy.

Example conflicts:
- Memory says "dislikes Nogales story" but session plan requires "Review Nogales Puzzle"
- Memory says "prefers short responses" but topic requires detailed explanation
- Memory says "gets frustrated with repetition" but spaced retrieval requires review

Outputs one of:
- brief: Cover required content but keep it minimal (60 seconds max)
- reframe: Present required content from a different angle that respects the preference
- skip-with-bridge: Skip the problematic content but explicitly bridge to next topic
- acknowledge-and-proceed: Explicitly acknowledge the tension and ask permission`,
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.ADAPT,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "session-quality",
      priority: 90,
      isActive: true,
      isDirty: false,
      config: {
        conflictTypes: [
          {
            type: "dislike_required_content",
            description: "Caller dislikes content they must review",
            strategies: ["brief", "reframe", "acknowledge-and-proceed"],
            defaultStrategy: "brief",
          },
          {
            type: "length_preference_vs_depth",
            description: "Caller prefers short responses but topic needs depth",
            strategies: ["chunked", "high-level-first", "ask-permission"],
            defaultStrategy: "chunked",
          },
          {
            type: "repetition_aversion_vs_review",
            description: "Caller dislikes repetition but spaced retrieval needed",
            strategies: ["different-angle", "application-focus", "minimal-recall"],
            defaultStrategy: "different-angle",
          },
        ],
        strategyDescriptions: {
          brief: "Cover required content in 60 seconds or less, focus on key points only",
          reframe: "Present the same content from a different angle that respects their preference",
          "skip-with-bridge": "Skip problematic content but explicitly explain the connection to next topic",
          "acknowledge-and-proceed": "Explicitly name the tension and ask if they're OK to proceed",
          chunked: "Break content into smaller pieces with check-ins between",
          "high-level-first": "Start with overview, only go deeper if they want",
          "ask-permission": "Ask if they want the full explanation or just the summary",
          "different-angle": "Review the same concept but through a different example or perspective",
          "application-focus": "Instead of restating, ask them to apply the concept",
          "minimal-recall": "One quick recall question, then move on",
        },
      },
      promptTemplate: `Analyze the prompt for memory-content conflicts.

A conflict exists when:
- Caller memory (preference, dislike, style) conflicts with required session content
- The session plan asks for something the caller has indicated they don't like

Given the memories and session plan, identify conflicts and recommend a handling strategy.

For each conflict found:
1. What is the memory? (e.g., "dislikes: Nogales story")
2. What is the required content? (e.g., "reviewFirst: The Nogales Puzzle")
3. What strategy should be used? (brief, reframe, skip-with-bridge, acknowledge-and-proceed)
4. Specific guidance for executing that strategy

Return:
{
  "conflictsDetected": true/false,
  "conflicts": [
    {
      "memory": "...",
      "requiredContent": "...",
      "conflictType": "...",
      "recommendedStrategy": "...",
      "executionGuidance": "..."
    }
  ]
}`,
    },
    create: {
      slug: "prompt-memory-content-conflict",
      name: "Memory-Content Conflict Handler",
      description: `RUNTIME ADAPT: When caller memory conflicts with required content, output a handling strategy.`,
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.ADAPT,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "session-quality",
      priority: 90,
      isActive: true,
      isDirty: false,
      config: {
        conflictTypes: [
          {
            type: "dislike_required_content",
            description: "Caller dislikes content they must review",
            strategies: ["brief", "reframe", "acknowledge-and-proceed"],
            defaultStrategy: "brief",
          },
        ],
      },
      promptTemplate: `Analyze the prompt for memory-content conflicts...`,
    },
  });

  console.log(`   ✓ Created: prompt-memory-content-conflict`);

  // ============================================
  // 5. DOMAIN SPEC: Topic Adherence (Post-Call)
  // ============================================
  console.log("\n🎯 Creating Topic Adherence spec...");

  await prisma.analysisSpec.upsert({
    where: { slug: "prompt-topic-adherence" },
    update: {
      name: "Topic Adherence Score",
      description: `POST-CALL MEASURE: Score how well the agent stuck to the planned session topics.

Measures:
- Did the agent follow the session_pedagogy flow steps?
- How many tangents occurred and were they redirected?
- Was the core planned content covered?
- If plan was abandoned, was it justified (caller need)?

Different domains may have different targets:
- Tutor: HIGH adherence (0.7+) - stay on curriculum
- Companion: MODERATE (0.4-0.6) - follow caller lead more
- Support: HIGH (0.7+) - resolve the issue`,
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "session-quality",
      priority: 80,
      isActive: true,
      isDirty: false,
      config: {
        scoringCriteria: {
          flowStepsCompleted: {
            weight: 0.4,
            description: "What percentage of planned flow steps were completed?",
          },
          tangentHandling: {
            weight: 0.3,
            description: "Were tangents acknowledged then redirected, or did they derail?",
          },
          coreContentCovered: {
            weight: 0.2,
            description: "Was the primary learning objective addressed?",
          },
          planAbandonmentJustified: {
            weight: 0.1,
            description: "If plan was abandoned, was it for good reason (caller crisis, explicit request)?",
          },
        },
        verdicts: {
          "on-track": "Score >= 0.7, followed plan with minor deviations",
          "minor-tangents": "Score 0.4-0.7, some tangents but returned to plan",
          "off-rails": "Score < 0.4, plan largely abandoned",
        },
        domainTargets: {
          tutor: { target: 0.7, tolerance: 0.15 },
          companion: { target: 0.5, tolerance: 0.2 },
          support: { target: 0.8, tolerance: 0.1 },
        },
      },
      promptTemplate: `Analyze the transcript against the original session plan.

Session Plan:
{{session_pedagogy}}

Transcript:
{{transcript}}

Score the agent's topic adherence by evaluating:

1. FLOW STEPS (40%): What percentage of the planned flow steps were completed?
   - List each planned step and whether it was executed

2. TANGENT HANDLING (30%): How did the agent handle off-topic moments?
   - Count tangents
   - Count successful redirects
   - Note any extended tangents (>2 turns)

3. CORE CONTENT (20%): Was the main learning objective addressed?
   - What was the primary goal?
   - Was it achieved?

4. JUSTIFICATION (10%): If plan was modified, was it justified?
   - Caller crisis or emotional need?
   - Explicit caller request to change topic?

Return:
{
  "score": <0.0-1.0>,
  "verdict": "on-track" | "minor-tangents" | "off-rails",
  "flowStepsCompleted": <count>/<total>,
  "tangentCount": <number>,
  "redirectsAttempted": <number>,
  "redirectsSuccessful": <number>,
  "coreContentCovered": true/false,
  "planModificationJustified": true/false/null,
  "notes": "..."
}`,
    },
    create: {
      slug: "prompt-topic-adherence",
      name: "Topic Adherence Score",
      description: `POST-CALL MEASURE: Score how well the agent stuck to the planned session topics.`,
      scope: SpecificationScope.DOMAIN,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "session-quality",
      priority: 80,
      isActive: true,
      isDirty: false,
      config: {
        scoringCriteria: {
          flowStepsCompleted: { weight: 0.4 },
          tangentHandling: { weight: 0.3 },
          coreContentCovered: { weight: 0.2 },
          planAbandonmentJustified: { weight: 0.1 },
        },
      },
      promptTemplate: `Analyze the transcript against the original session plan...`,
    },
  });

  console.log(`   ✓ Created: prompt-topic-adherence`);

  // ============================================
  // 6. SYSTEM SPEC: Brevity-Warmth Priority
  // ============================================
  console.log("\n⚖️ Creating Brevity-Warmth Priority spec...");

  await prisma.analysisSpec.upsert({
    where: { slug: "prompt-brevity-warmth-priority" },
    update: {
      name: "Brevity-Warmth Priority Resolution",
      description: `RUNTIME ADAPT: Resolves conflicts between competing behavior targets.

Common conflicts:
- Response Length LOW + Warmth HIGH + Empathy HIGH
  → Can't be deeply empathetic in 1-2 sentences

- Question Rate HIGH + Turn Length LOW
  → Hard to ask good questions in 10-second turns

- Directness HIGH + Formality LOW
  → Can clash depending on interpretation

Outputs priority rules and specific guidance for the current target configuration.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.ADAPT,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 85,
      isActive: true,
      isDirty: false,
      config: {
        conflictPatterns: [
          {
            name: "warmth-brevity",
            targets: ["BEH-WARMTH", "BEH-EMPATHY-RATE", "BEH-RESPONSE-LENGTH"],
            condition: "WARMTH=HIGH && EMPATHY=HIGH && RESPONSE_LENGTH=LOW",
            conflict: "HIGH warmth/empathy requires enough words to express care; LOW length restricts this",
            resolution: "Warmth applies to TONE, not verbosity. Use warm brief phrases. Upgrade length to MEDIUM if needed.",
            priorityOrder: ["BEH-WARMTH", "BEH-EMPATHY-RATE", "BEH-RESPONSE-LENGTH"],
          },
          {
            name: "questions-turnlength",
            targets: ["BEH-QUESTION-RATE", "BEH-TURN-LENGTH"],
            condition: "QUESTION_RATE=HIGH && TURN_LENGTH=LOW",
            conflict: "Good Socratic questions need setup; short turns limit context-building",
            resolution: "Use pointed, single-sentence questions. Avoid multi-part questions.",
            priorityOrder: ["BEH-QUESTION-RATE", "BEH-TURN-LENGTH"],
          },
          {
            name: "directness-formality",
            targets: ["BEH-DIRECTNESS", "BEH-FORMALITY"],
            condition: "DIRECTNESS=HIGH && FORMALITY=LOW",
            conflict: "Direct + casual can sound blunt; needs careful balance",
            resolution: "Be direct in content but soften with casual tone markers ('So basically...', 'Here's the thing...')",
            priorityOrder: ["BEH-DIRECTNESS", "BEH-FORMALITY"],
          },
        ],
        defaultPriority: [
          "BEH-WARMTH",
          "BEH-EMPATHY-RATE",
          "BEH-QUESTION-RATE",
          "BEH-DIRECTNESS",
          "BEH-RESPONSE-LENGTH",
          "BEH-TURN-LENGTH",
          "BEH-FORMALITY",
        ],
      },
      promptTemplate: `Analyze the behavior targets for conflicts.

Current targets:
{{behaviorTargets}}

Check for these conflict patterns:

1. WARMTH-BREVITY CONFLICT
   If Warmth=HIGH and Empathy=HIGH but Response Length=LOW:
   → "Warmth applies to tone, not length. Use warm but brief phrases."

2. QUESTIONS-TURNLENGTH CONFLICT
   If Question Rate=HIGH but Turn Length=LOW:
   → "Use pointed single-sentence questions. No multi-part questions."

3. DIRECTNESS-FORMALITY CONFLICT
   If Directness=HIGH but Formality=LOW:
   → "Be direct in content, casual in delivery. 'Here's the thing...'"

Return:
{
  "conflictsDetected": true/false,
  "conflicts": [
    {
      "name": "...",
      "involvedTargets": ["...", "..."],
      "resolution": "...",
      "priorityOrder": ["...", "..."]
    }
  ],
  "adjustedTargets": {
    "<parameterId>": { "newLevel": "...", "reason": "..." }
  }
}`,
    },
    create: {
      slug: "prompt-brevity-warmth-priority",
      name: "Brevity-Warmth Priority Resolution",
      description: `RUNTIME ADAPT: Resolves conflicts between competing behavior targets.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.ADAPT,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 85,
      isActive: true,
      isDirty: false,
      config: {
        conflictPatterns: [
          {
            name: "warmth-brevity",
            targets: ["BEH-WARMTH", "BEH-EMPATHY-RATE", "BEH-RESPONSE-LENGTH"],
            condition: "WARMTH=HIGH && EMPATHY=HIGH && RESPONSE_LENGTH=LOW",
            resolution: "Warmth applies to TONE, not verbosity.",
          },
        ],
      },
      promptTemplate: `Analyze the behavior targets for conflicts...`,
    },
  });

  console.log(`   ✓ Created: prompt-brevity-warmth-priority`);

  // ============================================
  // 7. SYSTEM SPEC: Duplicate Content Detector
  // ============================================
  console.log("\n📋 Creating Duplicate Content Detector spec...");

  await prisma.analysisSpec.upsert({
    where: { slug: "prompt-duplicate-content-detector" },
    update: {
      name: "Duplicate Content Detector",
      description: `PRE-CALL LINT: Flags when the same data appears in multiple prompt sections.

Common duplications:
- content.modules vs curriculum.modules (same curriculum twice)
- _preamble.voiceRules vs instructions.voice.voice_rules (same rules twice)
- identity.styleDefaults vs behaviorTargets (overlapping style info)
- Multiple places mentioning caller name or preferences

Duplicate content:
- Wastes tokens
- Creates confusion if copies have different values
- Makes prompts harder to maintain`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 70,
      isActive: true,
      isDirty: false,
      config: {
        knownDuplicationPaths: [
          {
            pathA: "content.modules",
            pathB: "curriculum.modules",
            description: "Curriculum appears twice",
            recommendation: "Remove content.modules, use curriculum.modules as authoritative",
          },
          {
            pathA: "_preamble.voiceRules",
            pathB: "instructions.voice.voice_rules",
            description: "Voice rules appear twice",
            recommendation: "Keep only instructions.voice.voice_rules, reference in _preamble",
          },
          {
            pathA: "identity.styleDefaults",
            pathB: "behaviorTargets",
            description: "Style values may overlap",
            recommendation: "Remove identity.styleDefaults, behaviorTargets is authoritative",
          },
        ],
        similarityThreshold: 0.8,
        outputFormat: {
          score: "0-1 (1.0 = no duplication)",
          duplications: "Array of { pathA, pathB, similarity, recommendation }",
          tokenWaste: "Estimated tokens wasted by duplication",
        },
      },
      promptTemplate: `Analyze the prompt JSON for duplicate or redundant content.

Check these known duplication paths:
1. content.modules vs curriculum.modules
2. _preamble.voiceRules vs instructions.voice.voice_rules
3. identity.styleDefaults vs behaviorTargets

Also scan for:
- Any arrays that contain the same or very similar items
- Objects with overlapping key-value pairs
- Text blocks that repeat the same information

For each duplication found:
- Which paths contain duplicated data
- Similarity score (0-1)
- Recommendation for which to keep

Return:
{
  "score": <0.0-1.0 where 1.0 means no duplication>,
  "duplications": [
    { "pathA": "...", "pathB": "...", "similarity": 0.95, "recommendation": "..." }
  ],
  "estimatedTokenWaste": <number>
}`,
    },
    create: {
      slug: "prompt-duplicate-content-detector",
      name: "Duplicate Content Detector",
      description: `PRE-CALL LINT: Flags when the same data appears in multiple prompt sections.`,
      scope: SpecificationScope.SYSTEM,
      outputType: AnalysisOutputType.MEASURE,
      specRole: SpecRole.MEASURE, // META not in schema, using MEASURE
      domain: "prompt-lint",
      priority: 70,
      isActive: true,
      isDirty: false,
      config: {
        knownDuplicationPaths: [
          {
            pathA: "content.modules",
            pathB: "curriculum.modules",
            description: "Curriculum appears twice",
          },
        ],
      },
      promptTemplate: `Analyze the prompt JSON for duplicate or redundant content...`,
    },
  });

  console.log(`   ✓ Created: prompt-duplicate-content-detector`);

  // ============================================
  // Summary
  // ============================================
  console.log("\n" + "━".repeat(60));
  console.log("\n✅ Prompt Conflict Detection Specs seeded successfully!\n");
  console.log("Created specs:");
  console.log("   🔍 prompt-state-consistency (SYSTEM/MEASURE) - PRE_CALL lint");
  console.log("   📜 prompt-stale-instruction-detector (SYSTEM/MEASURE) - PRE_CALL lint");
  console.log("   ⚠️  prompt-memory-content-conflict (DOMAIN/ADAPT) - RUNTIME");
  console.log("   🎯 prompt-topic-adherence (DOMAIN/MEASURE) - POST_CALL");
  console.log("   ⚖️  prompt-brevity-warmth-priority (SYSTEM/ADAPT) - RUNTIME");
  console.log("   📋 prompt-duplicate-content-detector (SYSTEM/MEASURE) - PRE_CALL lint");
  console.log("\nCreated parameters:");
  conflictParams.forEach((p) => console.log(`   📐 ${p.parameterId}`));
  console.log("");
}

main()
  .catch((e) => {
    console.error("Error seeding prompt conflict specs:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
