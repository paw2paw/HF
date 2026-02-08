import { NextRequest, NextResponse } from "next/server";
import { getAICompletion, AIMessage } from "@/lib/ai/client";
import { getAIConfig } from "@/lib/ai/config-loader";

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
   - specType: SYSTEM (global), DOMAIN (domain-specific), ADAPT (adaptive), SUPERVISE (oversight)
   - specRole: IDENTITY (who agent is), CONTENT (domain knowledge), VOICE (how agent speaks), MEASURE (scores behavior), ADAPT (adjusts targets), REWARD (computes rewards), GUARDRAIL (safety constraints)
   - outputType: MEASURE (scores parameters), LEARN (extracts info), ADAPT (adjusts behavior), COMPOSE (builds prompts), AGGREGATE (combines data), REWARD (computes rewards)

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

## Guidelines
- Provide concrete, actionable suggestions
- When suggesting field values, be specific
- For parameters, include clear descriptions and example scoring anchors
- Keep user story components concise but meaningful
- Match the spec's outputType to its purpose (MEASURE for scoring, LEARN for extraction, etc.)

## Response Format
When making suggestions, format them clearly. For example:

**Suggested ID:** PERS-002
**Suggested Title:** Emotional Intelligence Assessment

If you're suggesting form field values, be explicit about which field you're suggesting for.`;

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

    // Build the system prompt with current spec context
    const systemPrompt = SPEC_ASSISTANT_SYSTEM_PROMPT.replace(
      "{currentSpec}",
      JSON.stringify(currentSpec || {}, null, 2)
    );

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

    return NextResponse.json({
      ok: true,
      response: result.content,
    });
  } catch (error) {
    console.error("Spec assistant error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to get AI response" },
      { status: 500 }
    );
  }
}
