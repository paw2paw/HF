import { NextRequest, NextResponse } from "next/server";
import { AIMessage } from "@/lib/ai/client";
import { getConfiguredMeteredAICompletion } from "@/lib/metering";
import { getContextForCallPoint, injectSystemContext } from "@/lib/ai/system-context";
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";
import { requireAuth, isAuthError } from "@/lib/permissions";

const SPEC_VIEWER_ASSISTANT_SYSTEM_PROMPT = `You are a SPEC UNDERSTANDING ASSISTANT for HumanFirst, helping users understand, modify, and troubleshoot existing Analysis Specifications.

## Your Role
1. Explain what specs do and how they work
2. Help users understand complex spec configurations
3. Suggest improvements and optimizations
4. Troubleshoot issues (validation errors, runtime problems)
5. Explain relationships between specs, parameters, and other entities
6. Help users modify specs safely

## Current Spec Context
{currentSpec}

## System Knowledge
{systemContext}

## Guidelines

### When User Asks "What does this spec do?"
- Explain the spec's purpose in plain language
- Describe what it measures/learns/composes
- Explain when it runs in the pipeline (triggers)
- Show what outputs it produces (parameters, memories, etc.)
- Mention related specs if relevant

### When User Asks for a "Precis", "Summary", or "English Description"
Provide a **concise 2-3 sentence executive summary** in plain English, structured like:

"[Spec Name] is a [MEASURE/LEARN/COMPOSE/etc.] spec that [primary function]. It runs [when it triggers] and produces [key outputs]. [Optional: Key use case or benefit]."

Example format:
"Agent Behavior Supervision is a MEASURE spec that evaluates tutor adherence to instructional frameworks during calls. It runs after each call and scores 12 behavioral parameters including intro quality, sequence fidelity, and student engagement. This enables real-time coaching feedback and quality assurance."

**Do NOT** include:
- Technical JSON structure details
- Full trigger conditions
- Complete parameter lists
- Implementation details

Keep it executive-level, benefits-focused, and under 100 words.

### When User Asks for Improvements
- Review the spec structure and prompt template
- Suggest concrete improvements with examples
- Explain trade-offs of different approaches
- Provide updated JSON if changes are recommended

### When Troubleshooting
- Identify the root cause of errors
- Explain why validation failed
- Suggest specific fixes
- Provide example values that would work

### When Explaining Relationships
- Show how this spec connects to parameters
- Explain trigger conditions and dependencies
- Mention other specs that use similar patterns
- Reference the data flow (where data comes from/goes to)

## Response Format
You should respond conversationally and naturally. When suggesting changes, provide them in a JSON code block:

\`\`\`json
{
  "promptTemplate": "Updated template here...",
  "config": {
    "updated": "config here"
  }
}
\`\`\`

## Important Notes
- **Match your detail level to the user's request** (summary vs deep dive)
- Use examples from the actual spec data
- Explain technical concepts in accessible language
- Always validate suggestions against the spec schema
- Reference line numbers or specific fields when discussing edits`;

/**
 * @api POST /api/specs/assistant-view
 * @visibility internal
 * @scope specs:read
 * @auth session
 * @tags specs
 * @description AI assistant for understanding, modifying, and troubleshooting existing specs. Provides explanations, improvement suggestions, and structured edit suggestions.
 * @body message string - The user's message
 * @body context object - The current spec being viewed: { type: string, data: AnalysisSpec }
 * @body history Array - Conversation history: [{role: 'user'|'assistant', content: string}]
 * @response 200 { ok: true, response: string, suggestions: object|null }
 * @response 400 { ok: false, error: "message is required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    body = await request.json();
    const { message, context, history = [] } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 }
      );
    }

    // Load system context (specs, parameters, domains)
    let systemContext;
    try {
      systemContext = await getContextForCallPoint("spec.view");
    } catch (contextError) {
      console.error("Failed to load system context:", contextError);
      // Fall back to empty context if loading fails
      systemContext = {};
    }

    // Build the system prompt with current spec context and system knowledge
    // Safely stringify spec data (handle circular refs and BigInt)
    const specData = context?.data || {};
    const safeSpecData = JSON.parse(
      JSON.stringify(specData, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    let systemPrompt = SPEC_VIEWER_ASSISTANT_SYSTEM_PROMPT.replace(
      "{currentSpec}",
      JSON.stringify(safeSpecData, null, 2)
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

    // @ai-call spec.view — Spec viewer/understanding assistant | config: /x/ai-config
    const result = await getConfiguredMeteredAICompletion({
      callPoint: "spec.view",
      messages,
      maxTokens: 2048,
      temperature: 0.7,
    }, { sourceOp: "spec.view" });

    // Store model info for logging
    const modelInfo = {
      model: result.model,
      provider: result.engine,
    };

    // Try to extract structured suggestions from the response
    let suggestions = null;
    try {
      // Look for JSON in the response
      const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      // No structured suggestions found
    }

    // Log interaction for AI learning (don't await - run in background)
    logAssistantCall(
      {
        callPoint: "spec.view",
        userMessage: message,
        metadata: {
          entityType: "spec",
          action: "view",
          specId: context?.data?.id || context?.data?.slug,
          model: modelInfo.model,
          provider: modelInfo.provider,
        },
      },
      {
        response: result.content,
        success: true,
        suggestions,
      }
    );

    return NextResponse.json({
      ok: true,
      response: result.content,
      suggestions,
    });
  } catch (error) {
    console.error("Spec viewer assistant error:", error);

    // More detailed error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    };
    console.error("Error details:", errorDetails);

    // Log error for learning
    logAssistantCall(
      {
        callPoint: "spec.view",
        userMessage: body?.message || "",
        metadata: {
          entityType: "spec",
          action: "view",
          error: error instanceof Error ? error.message : "Unknown error",
          errorName: error instanceof Error ? error.name : undefined,
        },
      },
      {
        response: "",
        success: false,
      }
    );

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to get AI response",
        details: process.env.NODE_ENV === "development" ? errorDetails : undefined,
      },
      { status: 500 }
    );
  }
}
