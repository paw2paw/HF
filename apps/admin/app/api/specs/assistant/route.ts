import { NextRequest, NextResponse } from "next/server";
import { getAICompletion, AIMessage } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config-loader";
import { getContextForCallPoint, injectSystemContext } from "@/lib/ai/system-context";
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";

const SPEC_ASSISTANT_SYSTEM_PROMPT = `You are a SPEC CREATION ASSISTANT for HumanFirst, helping users create BDD-style Analysis Specifications.

## Your Role
1. Help users fill in spec fields based on their descriptions
2. Suggest appropriate values for each field
3. Generate well-structured user stories (As a..., I want..., So that...)
4. Suggest parameter definitions with scoring anchors
5. Validate that specs follow best practices

## Spec Structure
A spec has these main sections:

1. **Basic Info**
   - id: Unique identifier like "PERS-001", "COMP-IE-001", "MEM-001"
   - title: Human-readable name
   - version: Semantic version (e.g., "1.0")
   - status: Draft | Review | Approved | Deprecated
   - domain: Category like "personality", "memory", "engagement"

2. **Classification**
   - specType: SYSTEM (global), DOMAIN (domain-specific)
   - specRole: ORCHESTRATE (flow control), EXTRACT (measurement/learning), SYNTHESISE (transform data), CONSTRAIN (guardrails), IDENTITY (agent personas), CONTENT (curriculum), VOICE (voice guidance)
   - outputType: MEASURE (scores parameters), LEARN (extracts info), ADAPT (adjusts behavior), COMPOSE (builds prompts), AGGREGATE (combines data), REWARD (computes rewards), SUPERVISE (oversight)

3. **User Story**
   - asA: The role/persona (e.g., "conversational AI system")
   - iWant: The goal (e.g., "to measure caller personality traits")
   - soThat: The benefit (e.g., "I can personalize interactions")

4. **Parameters** (for MEASURE specs)
   - id: Parameter identifier (e.g., "openness")
   - name: Display name (e.g., "Openness to Experience")
   - description: What it measures
   - targetRange: { min, max } for target values
   - scoringAnchors: Examples at different score levels

## Current Spec Being Created
{currentSpec}

## System Knowledge
{systemContext}

## Guidelines
- **FIRST**: Check if an existing spec already does what the user needs
- **IF FOUND**: Recommend using/copying the existing spec instead of creating a new one
- **IF NOT FOUND**: Help create a new spec with appropriate fields
- Provide concrete, actionable suggestions
- When suggesting field values, be specific
- For parameters, include clear descriptions and example scoring anchors
- Keep user story components concise but meaningful
- Match the spec's outputType to its purpose (MEASURE for scoring, LEARN for extraction, etc.)

## Response Format
You MUST respond with two parts:

1. **Conversational Response** - Talk naturally to the user, explaining what you understand
2. **Structured Updates** - Provide a JSON code block with field updates to auto-populate the form (OR recommend an existing spec)

### If an Existing Spec Matches:
"I found an existing spec that does exactly this! The spec **{name}** (ID: {slug}) already measures {what it does}.

Would you like to:
1. Use that spec as-is
2. Copy and modify it for your needs
3. Create a completely new spec anyway

The existing spec can be found at: /x/specs?id={id}"

(No JSON code block needed when recommending existing spec)

### If Creating New Spec:
"Got it! I'll create a spec for measuring emotional intelligence in conversations. Let me set up the basic structure for you.

\`\`\`json
{
  "id": "PERS-EI-001",
  "title": "Emotional Intelligence Assessment",
  "domain": "personality",
  "specType": "DOMAIN",
  "specRole": "EXTRACT",
  "outputType": "MEASURE",
  "story": {
    "asA": "conversational AI coach",
    "iWant": "to assess the caller's emotional intelligence traits",
    "soThat": "I can tailor my coaching approach to their emotional awareness level"
  }
}
\`\`\`

I've set this as a MEASURE spec in the personality domain. Would you like me to add some parameters to measure specific EI traits?"

IMPORTANT:
- **ALWAYS check existing specs first** - don't create duplicates!
- ALWAYS include the JSON code block with field updates (unless recommending existing spec)
- Only include fields you want to update (partial updates are fine)
- The JSON will be automatically applied to the form
- Keep the conversational part natural and helpful`;

/**
 * POST /api/specs/assistant
 * AI assistant for spec creation
 *
 * Request body:
 * {
 *   message: string - the user's message
 *   currentSpec: object - the current spec form state
 *   history: Array<{role: 'user' | 'assistant', content: string}> - conversation history
 * }
 *
 * Response:
 * {
 *   ok: boolean
 *   response: string - the AI response
 *   suggestions?: object - structured suggestions that can be applied to form
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, currentSpec, history = [] } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 }
      );
    }

    // Load system context (specs, parameters, domains)
    const systemContext = await getContextForCallPoint("spec.assistant");

    // Build the system prompt with current spec context and system knowledge
    let systemPrompt = SPEC_ASSISTANT_SYSTEM_PROMPT.replace(
      "{currentSpec}",
      JSON.stringify(currentSpec || {}, null, 2)
    );
    systemPrompt = injectSystemContext(systemPrompt, systemContext);

    // Build messages array
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      // Include conversation history
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      // Add the current message
      { role: "user", content: message },
    ];

    // Get AI configuration for this call point
    const aiConfig = await getAIConfig("spec.assistant");

    // Get AI completion
    const result = await getAICompletion({
      engine: aiConfig.provider,
      model: aiConfig.model,
      messages,
      maxTokens: aiConfig.maxTokens ?? 2048,
      temperature: aiConfig.temperature ?? 0.7,
    });

    // Store model info for logging
    const modelInfo = {
      model: aiConfig.model,
      provider: aiConfig.provider,
    };

    // Try to extract structured field updates from the response
    let fieldUpdates = null;
    try {
      // Look for JSON in the response
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        fieldUpdates = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      // No structured updates found
    }

    // Log interaction for AI learning (don't await - run in background)
    logAssistantCall(
      {
        callPoint: "spec.assistant",
        userMessage: message,
        metadata: {
          entityType: "spec",
          action: "create",
          specId: currentSpec?.id,
          model: modelInfo.model,
          provider: modelInfo.provider,
        },
      },
      {
        response: result.content,
        success: true,
        fieldUpdates,
      }
    );

    return NextResponse.json({
      ok: true,
      response: result.content,
      fieldUpdates, // Will be null if no structured updates found
    });
  } catch (error) {
    console.error("Spec assistant error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get AI response" },
      { status: 500 }
    );
  }
}
