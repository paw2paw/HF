import { Given, When, Then } from "@cucumber/cucumber";
/**
 * “Service-like” helpers (in-memory).
 * These correspond to the service boundaries we agreed.
 */
function composePromptRun(params: {
  user: HFUser;
  agent: HFAgent;
  templates: PromptTemplate[];
  memories: Memory[];
}): PromptRun {
  const { user, agent, templates, memories } = params;

  const layers: PromptLayerSnapshot[] = [];

  // Always include active SYSTEM layer(s)
  for (const t of templates.filter((x) => x.isActive && x.layerType === "SYSTEM")) {
    layers.push({
      id: id("pls"),
      templateId: t.id,
      layerType: "SYSTEM",
      renderedText: t.content,
    });
  }

  // If we have TRAIT memories, include a PERSONALITY layer derived from them.
  const traits = memories.filter((m) => m.type === "TRAIT");
  if (traits.length > 0) {
    const renderedText =
      "Personality traits:\n" +
      traits
        .map(
          (t) =>
            `- ${t.content} (w=${t.weight.toFixed(2)}${
              t.confidence != null ? `, c=${t.confidence.toFixed(2)}` : ""
            })`
        )
        .join("\n");

    layers.push({
      id: id("pls"),
      layerType: "PERSONALITY",
      renderedText,
    });
  }

  return {
    id: id("pr"),
    userId: user.id,
    agentId: agent.id,
    layers,
    createdAt: new Date(),
  };
}
/**
 * In-memory BDD world + minimal domain types.
 * No DB. No Prisma. Deterministic, fast, and locks service boundaries.
 */
type ID = string;

type PromptLayerType = "SYSTEM" | "CONTEXT" | "PERSONALITY" | "RULE" | "OPTIMISATION";
type CallStatus = "CREATED" | "ACTIVE" | "COMPLETED" | "FAILED";
type AnalysisType = "SUMMARY" | "PERSONALITY" | "SENTIMENT" | "NEXT_BEST_MOVE";
type MemoryType = "FACT" | "PREFERENCE" | "TRAIT" | "EVENT";

interface HFUser {
  id: ID;
  email?: string;
  name?: string;
}

interface HFAgent {
  id: ID;
  name?: string;
  isActive: boolean;
}

interface PromptTemplate {
  id: ID;
  name: string;
  layerType: PromptLayerType;
  content: string;
  version: number;
  isActive: boolean;
}

interface PromptLayerSnapshot {
  id: ID;
  templateId?: ID;
  layerType: PromptLayerType;
  renderedText: string;
}

interface PromptRun {
  id: ID;
  userId: ID;
  agentId: ID;
  layers: PromptLayerSnapshot[];
  createdAt: Date;
}

interface HFCall {
  id: ID;
  userId: ID;
  agentId: ID;
  status: CallStatus;
  startedAt?: Date;
  endedAt?: Date;
  endedReason?: string;
  promptRunId: ID;
  createdAt: Date;
}

interface TranscriptChunk {
  id: ID;
  index: number;
  text: string;
}

interface Transcript {
  id: ID;
  callId: ID;
  rawText: string;
  chunks: TranscriptChunk[];
}

interface AnalysisRun {
  id: ID;
  callId: ID;
  type: AnalysisType;
  outputJson: Record<string, unknown>;
}

interface Memory {
  id: ID;
  userId: ID;
  callId?: ID;
  type: MemoryType;
  content: string;
  weight: number;
  confidence?: number;
  sourceAnalysisId?: ID;
}

interface HFWorldState {
  user?: HFUser;
  agent?: HFAgent;

  baselineSystemTemplate?: PromptTemplate;

  promptRun?: PromptRun;
  call?: HFCall;

  transcript?: Transcript;

  activeCallAnalysis?: AnalysisRun;
  postCallAnalysis?: AnalysisRun;

  memories: Memory[];

  nextPromptRun?: PromptRun;
}

/**
 * Minimal deterministic ID helper for tests.
 */
let _seq = 0;
function id(prefix: string): ID {
  _seq += 1;
  return `${prefix}_${String(_seq).padStart(3, "0")}`;
}

/**
 * “Service-like” helpers (in-memory).
 * These correspond to the service boundaries we agreed.
 */

function startCall(params: { user: HFUser; agent: HFAgent; promptRun: PromptRun }): HFCall {
  const { user, agent, promptRun } = params;
  const now = new Date();
  return {
    id: id("call"),
    userId: user.id,
    agentId: agent.id,
    status: "ACTIVE",
    startedAt: now,
    promptRunId: promptRun.id,
    createdAt: now,
  };
}

function completeCall(call: HFCall): HFCall {
  return {
    ...call,
    status: "COMPLETED",
    endedAt: new Date(),
    endedReason: "completed",
  };
}

function ingestTranscriptChunks(params: { call: HFCall; chunks: string[] }): Transcript {
  const transcript: Transcript = {
    id: id("tr"),
    callId: params.call.id,
    rawText: "",
    chunks: [],
  };

  params.chunks.forEach((text, index) => {
    transcript.chunks.push({ id: id("tc"), index, text });
  });

  transcript.rawText = transcript.chunks
    .sort((a, b) => a.index - b.index)
    .map((c) => c.text)
    .join(" ");

  return transcript;
}

function runSentimentAnalysis(params: { call: HFCall; transcript: Transcript }): AnalysisRun {
  const text = params.transcript.rawText.toLowerCase();
  const positive = ["great", "love", "good", "nice", "excited"].some((w) => text.includes(w));
  const negative = ["bad", "hate", "awful", "angry", "upset"].some((w) => text.includes(w));
  const sentiment = positive && !negative ? "positive" : negative && !positive ? "negative" : "neutral";

  return {
    id: id("ar"),
    callId: params.call.id,
    type: "SENTIMENT",
    outputJson: { sentiment },
  };
}

function runPersonalityAnalysis(params: { call: HFCall; transcript: Transcript }): AnalysisRun {
  const text = params.transcript.rawText.toLowerCase();

  // Heuristic stub (intentionally replaceable later by LLM/NBM).
  const conscientious = ["organised", "plan", "schedule", "detail"].some((w) => text.includes(w));
  const openness = ["curious", "explore", "new", "experiment"].some((w) => text.includes(w));

  const traits: string[] = [];
  if (conscientious) traits.push("Conscientiousness: high");
  if (openness) traits.push("Openness: high");
  if (traits.length === 0) traits.push("Openness: medium");

  return {
    id: id("ar"),
    callId: params.call.id,
    type: "PERSONALITY",
    outputJson: { traits },
  };
}

function synthesiseMemory(params: { user: HFUser; call: HFCall; analysis: AnalysisRun }): Memory[] {
  if (params.analysis.type !== "PERSONALITY") return [];

  const traits = (params.analysis.outputJson.traits as string[]) ?? [];
  return traits.map((t) => ({
    id: id("mem"),
    userId: params.user.id,
    callId: params.call.id,
    type: "TRAIT",
    content: t,
    weight: 1.0,
    confidence: 0.7,
    sourceAnalysisId: params.analysis.id,
  }));
}

/**
 * Ensure we always have a memories array.
 */
function ensureWorldInit(world: HFWorldState) {
  world.memories = world.memories ?? [];
}

/**
 * BDD steps
 */

Given("a user exists", function (this: HFWorldState) {
  ensureWorldInit(this);
  this.user = { id: "user_test_001" };
});

Given("an active agent exists", function (this: HFWorldState) {
  ensureWorldInit(this);
  this.agent = { id: "agent_test_001", isActive: true };
});

Given("a baseline system prompt template exists", function (this: HFWorldState) {
  ensureWorldInit(this);
  this.baselineSystemTemplate = {
    id: "prompt_tpl_system_v1",
    name: "Baseline System Prompt",
    layerType: "SYSTEM",
    content: "You are a helpful assistant.",
    version: 1,
    isActive: true,
  };
});

Given("the system composes an initial prompt for the user", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.user) throw new Error("Missing user");
  if (!this.agent) throw new Error("Missing agent");
  if (!this.baselineSystemTemplate) throw new Error("Missing baseline system prompt template");

  this.promptRun = composePromptRun({
    user: this.user,
    agent: this.agent,
    templates: [this.baselineSystemTemplate],
    memories: this.memories,
  });
});

Given("a call is started using that prompt", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.user) throw new Error("Missing user");
  if (!this.agent) throw new Error("Missing agent");
  if (!this.promptRun) throw new Error("Missing promptRun");

  this.call = startCall({ user: this.user, agent: this.agent, promptRun: this.promptRun });
});

When("the call is active", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.call) throw new Error("Missing call");
  if (this.call.status !== "ACTIVE") throw new Error(`Expected call ACTIVE, got ${this.call.status}`);
});

When("partial transcript chunks are received", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.call) throw new Error("Missing call");

  this.transcript = ingestTranscriptChunks({
    call: this.call,
    chunks: [
      "I'm quite organised and like to plan ahead.",
      "I also enjoy exploring new ideas and experimenting.",
      "That usually keeps me engaged.",
    ],
  });
});

When("lightweight sentiment analysis runs", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.call) throw new Error("Missing call");
  if (!this.transcript) throw new Error("Missing transcript");

  this.activeCallAnalysis = runSentimentAnalysis({ call: this.call, transcript: this.transcript });
});

When("the call completes", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.call) throw new Error("Missing call");
  this.call = completeCall(this.call);
});

When("a full transcript is available", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.transcript) throw new Error("Missing transcript");
  if (!this.transcript.rawText || this.transcript.rawText.length < 10) {
    throw new Error("Expected full transcript rawText to be populated");
  }
});

When("post-call personality analysis runs", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.call) throw new Error("Missing call");
  if (!this.transcript) throw new Error("Missing transcript");

  this.postCallAnalysis = runPersonalityAnalysis({ call: this.call, transcript: this.transcript });
});

Then("durable user memory is created from the analysis", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.user) throw new Error("Missing user");
  if (!this.call) throw new Error("Missing call");
  if (!this.postCallAnalysis) throw new Error("Missing postCallAnalysis");

  const newMemories = synthesiseMemory({ user: this.user, call: this.call, analysis: this.postCallAnalysis });
  if (newMemories.length === 0) throw new Error("Expected at least one Memory to be created");

  this.memories = [...this.memories, ...newMemories];
});

Then("the memory is linked to the completed call", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.call) throw new Error("Missing call");
  if (!this.memories || this.memories.length === 0) throw new Error("Missing memories");

  const linked = this.memories.filter((m) => m.callId === this.call!.id);
  if (linked.length === 0) throw new Error("Expected at least one Memory linked to the completed call");
});

When("the system prepares the next call", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.user) throw new Error("Missing user");
  if (!this.agent) throw new Error("Missing agent");
});

Then("the prompt is regenerated using the updated memory", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.user) throw new Error("Missing user");
  if (!this.agent) throw new Error("Missing agent");
  if (!this.baselineSystemTemplate) throw new Error("Missing baseline system prompt template");
  if (!this.memories || this.memories.length === 0) throw new Error("Expected memories to exist for regeneration");

  this.nextPromptRun = composePromptRun({
    user: this.user,
    agent: this.agent,
    templates: [this.baselineSystemTemplate],
    memories: this.memories,
  });

  if (!this.nextPromptRun) throw new Error("Missing nextPromptRun");
  const hasPersonalityLayer = this.nextPromptRun.layers.some((l) => l.layerType === "PERSONALITY");
  if (!hasPersonalityLayer) throw new Error("Expected regenerated prompt to include a PERSONALITY layer");
});

Then("the new prompt reflects the user’s inferred personality traits", function (this: HFWorldState) {
  ensureWorldInit(this);
  if (!this.nextPromptRun) throw new Error("Missing nextPromptRun");

  const personality =
    this.nextPromptRun.layers.find((l) => l.layerType === "PERSONALITY")?.renderedText ?? "";

  const reflects =
    personality.includes("Conscientiousness: high") ||
    personality.includes("Openness: high") ||
    personality.includes("Openness: medium");

  if (!reflects) throw new Error(`Expected personality layer to reflect inferred traits, got:\n${personality}`);
});