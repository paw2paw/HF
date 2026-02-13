import { NextRequest, NextResponse } from "next/server";
import { getConfiguredMeteredAICompletion } from "@/lib/metering";
import { logAssistantCall } from "@/lib/ai/assistant-wrapper";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

const DETECTION_PROMPT = `You are analyzing a document to determine what type of BDD specification it should be converted to.

Analyze the content and determine:
1. What type of spec this should be (CURRICULUM, MEASURE, IDENTITY, CONTENT, ADAPT, GUARDRAIL)
2. Your confidence level (0.0 to 1.0)
3. Key structural elements you detected

Spec Type Definitions:
- CURRICULUM: Module-based learning content with learning outcomes, modules, assessments (e.g., training courses, certifications)
- MEASURE: Behavioral parameters with scoring anchors and measurement rubrics (e.g., personality traits, engagement metrics)
- IDENTITY: Agent persona definitions with voice, style, and character traits (e.g., character sheets, role definitions)
- CONTENT: Book or reference knowledge for teaching (e.g., textbook summaries, reference materials)
- ADAPT: Behavior adaptation rules with triggers and actions (e.g., pacing adjustments, personalization rules)
- GUARDRAIL: Safety constraints and boundaries (e.g., compliance rules, content filters)

Document Content:
---
{CONTENT}
---

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "suggestedType": "CURRICULUM" | "MEASURE" | "IDENTITY" | "CONTENT" | "ADAPT" | "GUARDRAIL",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this type was chosen",
  "detectedElements": ["list", "of", "key", "elements", "found"],
  "suggestedId": "ID-FORMAT-001"
}`;

/**
 * @api POST /api/specs/parse-document
 * @visibility internal
 * @scope specs:write
 * @auth session
 * @tags specs
 * @description AI-powered document type detection. Analyzes an uploaded file to determine the best BDD spec type (CURRICULUM, MEASURE, IDENTITY, etc.) and suggests an ID.
 * @body file File - The document to analyze (multipart/form-data)
 * @response 200 { ok: true, fileName: string, suggestedType: string, confidence: number, reasoning: string, detectedElements: string[], suggestedId: string }
 * @response 400 { ok: false, error: "No file provided" }
 * @response 400 { ok: false, error: "File is empty" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    // Read file content
    const rawText = await file.text();

    if (!rawText.trim()) {
      return NextResponse.json({ ok: false, error: "File is empty" }, { status: 400 });
    }

    // Truncate if too long (keep first 15k chars for analysis)
    const contentForAnalysis = rawText.length > 15000
      ? rawText.slice(0, 15000) + "\n...[truncated]..."
      : rawText;

    // @ai-call spec.parse — Detect document type for BDD spec conversion | config: /x/ai-config
    const prompt = DETECTION_PROMPT.replace("{CONTENT}", contentForAnalysis);

    const result = await getConfiguredMeteredAICompletion({
      callPoint: "spec.parse",
      messages: [
        { role: "user", content: prompt },
      ],
      maxTokens: 500,
      temperature: 0.3,
    }, { sourceOp: "spec.parse" });

    // Parse the JSON response
    let parsed;
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", result.content);
      // Fallback to CURRICULUM as default
      parsed = {
        suggestedType: "CURRICULUM",
        confidence: 0.5,
        reasoning: "Could not parse AI response, defaulting to CURRICULUM",
        detectedElements: [],
        suggestedId: "SPEC-001",
      };
    }

    // Log document parsing for AI learning
    logAssistantCall(
      {
        callPoint: "spec.parse",
        userMessage: `Parse document type: ${file.name}`,
        metadata: {
          action: "parse",
          fileName: file.name,
          fileSize: file.size,
        },
      },
      {
        response: result.content,
        success: true,
        suggestions: {
          type: parsed.suggestedType,
          confidence: parsed.confidence,
        },
      }
    );

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      fileSize: file.size,
      rawTextLength: rawText.length,
      suggestedType: parsed.suggestedType,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      detectedElements: parsed.detectedElements || [],
      suggestedId: parsed.suggestedId,
    });
  } catch (error) {
    console.error("Parse document error:", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
