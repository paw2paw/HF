import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  composePromptsFromSpecs,
  TemplateContext,
} from "@/lib/prompt/PromptTemplateCompiler";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/**
 * POST /api/prompt/post-call
 *
 * Post-call pipeline endpoint that orchestrates:
 * 1. Receives call data (transcript, callerId, metadata)
 * 2. Runs analysis specs to extract measures and learnings
 * 3. Stores analysis results (parameter values, memories)
 * 4. Composes the next prompt using updated values
 *
 * This is the main entry point for the call analysis pipeline.
 *
 * Request body:
 * - callerId: string (required) - The caller identifier
 * - transcript?: string - Raw transcript text
 * - transcriptId?: string - ID of existing transcript record
 * - analysisResults?: object - Pre-computed analysis results (if running externally)
 *   - parameterValues?: Record<string, number> - Measured parameter values
 *   - memories?: Array<{category, key, value, confidence}>
 * - runAnalysis?: boolean - Whether to trigger analysis (default: false, requires external runner)
 * - composePrompt?: boolean - Whether to compose next prompt (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      callerId,
      transcript,
      transcriptId,
      analysisResults,
      runAnalysis = false,
      composePrompt = true,
    } = body;

    if (!callerId) {
      return NextResponse.json(
        { ok: false, error: "callerId is required" },
        { status: 400 }
      );
    }

    // Get or create caller identity and associated caller
    let callerIdentity = await prisma.callerIdentity.findUnique({
      where: { id: callerId },
      include: {
        caller: {
          include: {
            personalityProfile: true,
          },
        },
      },
    });

    if (!callerIdentity) {
      // Auto-create caller identity with a new caller
      const newCaller = await prisma.caller.create({
        data: {
          name: `Caller ${callerId.substring(0, 8)}`,
        },
      });

      const newCallerIdentity = await prisma.callerIdentity.create({
        data: {
          id: callerId,
          externalId: callerId,
          callerId: newCaller.id,
        },
        include: {
          caller: {
            include: {
              personalityProfile: true,
            },
          },
        },
      });
      callerIdentity = newCallerIdentity;
    }

    const actualCallerId = callerIdentity.caller?.id;
    if (!actualCallerId) {
      return NextResponse.json(
        { ok: false, error: "No caller associated with caller identity" },
        { status: 400 }
      );
    }

    const pipeline: PipelineResult = {
      callerId,
      actualCallerId,
      steps: [],
      success: true,
    };

    // Step 1: Store transcript if provided
    if (transcript && !transcriptId) {
      pipeline.steps.push({
        step: "store_transcript",
        status: "skipped",
        message: "Transcript storage not yet implemented in pipeline",
      });
    }

    // Step 2: Process analysis results
    if (analysisResults) {
      const { parameterValues, memories } = analysisResults;

      // Store parameter values
      if (parameterValues && Object.keys(parameterValues).length > 0) {
        try {
          // Upsert personality profile
          const profile = await prisma.callerPersonalityProfile.upsert({
            where: { callerId: actualCallerId },
            create: {
              callerId: actualCallerId,
              parameterValues: parameterValues as any,
              lastUpdatedAt: new Date(),
            },
            update: {
              parameterValues: parameterValues as any,
              lastUpdatedAt: new Date(),
            },
          });

          pipeline.steps.push({
            step: "store_parameters",
            status: "success",
            data: {
              profileId: profile.id,
              parameterCount: Object.keys(parameterValues).length,
              parameters: parameterValues,
            },
          });
        } catch (err: any) {
          pipeline.steps.push({
            step: "store_parameters",
            status: "error",
            error: err.message,
          });
          pipeline.success = false;
        }
      }

      // Store memories
      if (memories && memories.length > 0) {
        const stored: string[] = [];
        const errors: string[] = [];

        for (const memory of memories) {
          try {
            // Check for existing memory with same key
            const existing = await prisma.callerMemory.findFirst({
              where: {
                callerId: actualCallerId,
                category: memory.category,
                key: memory.key,
                supersededById: null,
              },
            });

            if (existing) {
              // Create new memory and mark old as superseded
              const newMemory = await prisma.callerMemory.create({
                data: {
                  callerId: actualCallerId,
                  category: memory.category,
                  key: memory.key,
                  value: String(memory.value),
                  confidence: memory.confidence || 0.8,
                  decayFactor: memory.decayFactor || 1.0,
                  source: "EXTRACTED",
                  callId: transcriptId || null,
                },
              });

              await prisma.callerMemory.update({
                where: { id: existing.id },
                data: { supersededById: newMemory.id },
              });

              stored.push(`${memory.category}:${memory.key} (updated)`);
            } else {
              // Create new memory
              await prisma.callerMemory.create({
                data: {
                  callerId: actualCallerId,
                  category: memory.category,
                  key: memory.key,
                  value: String(memory.value),
                  confidence: memory.confidence || 0.8,
                  decayFactor: memory.decayFactor || 1.0,
                  source: "EXTRACTED",
                  callId: transcriptId || null,
                },
              });

              stored.push(`${memory.category}:${memory.key}`);
            }
          } catch (err: any) {
            errors.push(`${memory.category}:${memory.key}: ${err.message}`);
          }
        }

        pipeline.steps.push({
          step: "store_memories",
          status: errors.length === 0 ? "success" : "partial",
          data: {
            stored,
            errors: errors.length > 0 ? errors : undefined,
          },
        });

        if (errors.length === memories.length) {
          pipeline.success = false;
        }
      }
    }

    // Step 3: Run analysis (if requested - requires external agent)
    if (runAnalysis) {
      pipeline.steps.push({
        step: "run_analysis",
        status: "skipped",
        message: "External analysis runner required. Use /api/agents/run with personality_analyzer agent.",
      });
    }

    // Step 4: Compose next prompt
    let composedPrompt: string | null = null;
    if (composePrompt) {
      try {
        // Fetch latest parameter values
        const profile = await prisma.callerPersonalityProfile.findUnique({
          where: { callerId: actualCallerId },
        });

        const parameterValues = (profile?.parameterValues as Record<string, number>) || {};

        // Build template context
        const context: TemplateContext = {
          callerId: actualCallerId,
          parameterValues,
        };

        // Fetch memories
        const memories = await prisma.callerMemory.findMany({
          where: {
            callerId: actualCallerId,
            supersededById: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: [{ confidence: "desc" }, { extractedAt: "desc" }],
          take: 100,
        });

        context.memories = memories.map((m) => ({
          category: m.category,
          key: m.key,
          value: m.value,
          confidence: m.confidence,
          decayFactor: m.decayFactor,
        }));

        // Compose prompts from specs
        const result = await composePromptsFromSpecs(context);

        composedPrompt = result.prompts.map((p) => p.renderedPrompt).join("\n\n");

        pipeline.steps.push({
          step: "compose_prompt",
          status: "success",
          data: {
            promptLength: composedPrompt.length,
            specsUsed: result.prompts.length,
            totalSpecs: result.totalSpecs,
            memoriesUsed: result.memoriesIncluded,
          },
        });
      } catch (err: any) {
        pipeline.steps.push({
          step: "compose_prompt",
          status: "error",
          error: err.message,
        });
        pipeline.success = false;
      }
    }

    // Build response
    return NextResponse.json({
      ok: pipeline.success,
      pipeline,
      prompt: composedPrompt,
      nextCall: {
        callerIdentityId: callerId,
        callerId: actualCallerId,
        hasPrompt: !!composedPrompt,
        promptLength: composedPrompt?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("Post-call pipeline error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Pipeline failed" },
      { status: 500 }
    );
  }
}

interface PipelineStep {
  step: string;
  status: "success" | "error" | "skipped" | "partial";
  message?: string;
  error?: string;
  data?: any;
}

interface PipelineResult {
  callerId: string;
  actualCallerId: string;
  steps: PipelineStep[];
  success: boolean;
}

/**
 * GET /api/prompt/post-call?callerId=...
 *
 * Get the current state and next prompt for a caller
 * Useful for checking what prompt would be generated without running the full pipeline
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callerId = searchParams.get("callerId");

    if (!callerId) {
      return NextResponse.json(
        { ok: false, error: "callerId query parameter required" },
        { status: 400 }
      );
    }

    // Get caller identity and associated caller
    const callerIdentity = await prisma.callerIdentity.findUnique({
      where: { id: callerId },
      include: {
        caller: {
          include: {
            personalityProfile: true,
            memories: {
              where: {
                supersededById: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              orderBy: [{ confidence: "desc" }, { extractedAt: "desc" }],
              take: 50,
            },
          },
        },
      },
    });

    if (!callerIdentity) {
      return NextResponse.json(
        { ok: false, error: "Caller identity not found" },
        { status: 404 }
      );
    }

    const actualCallerId = callerIdentity.caller?.id;
    const parameterValues = (callerIdentity.caller?.personalityProfile?.parameterValues as Record<string, number>) || {};
    const memories = callerIdentity.caller?.memories || [];

    // Compose prompt
    const context: TemplateContext = {
      callerId: actualCallerId,
      parameterValues,
      memories: memories.map((m) => ({
        category: m.category,
        key: m.key,
        value: m.value,
        confidence: m.confidence,
        decayFactor: m.decayFactor,
      })),
    };

    const result = await composePromptsFromSpecs(context);
    const prompt = result.prompts.map((p) => p.renderedPrompt).join("\n\n");

    return NextResponse.json({
      ok: true,
      callerIdentity: {
        id: callerId,
        callerId: actualCallerId,
        externalId: callerIdentity.externalId,
        callerName: callerIdentity.caller?.name,
      },
      state: {
        hasProfile: !!callerIdentity.caller?.personalityProfile,
        parameterCount: Object.keys(parameterValues).length,
        memoryCount: memories.length,
        parameterValues,
      },
      prompt: {
        text: prompt,
        length: prompt.length,
        specsUsed: result.prompts.length,
        totalActiveSpecs: result.totalSpecs,
        specs: result.prompts.map((p) => ({
          slug: p.specSlug,
          name: p.specName,
          domain: p.domain,
          outputType: p.outputType,
          context: p.context,
        })),
      },
    });
  } catch (error: any) {
    console.error("Post-call GET error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get caller state" },
      { status: 500 }
    );
  }
}
