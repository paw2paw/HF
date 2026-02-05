import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { composeCurriculumSection } from "@/lib/prompt/compose-curriculum-section";
import { getLearnerProfile } from "@/lib/learner/profile";

/**
 * GET /api/callers/[callerId]
 *
 * Get comprehensive caller data including:
 * - Basic profile
 * - Personality profile and observations
 * - Memories and summary
 * - Calls
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;

    // Fetch all caller data in parallel
    const [caller, personality, observations, memories, memorySummary, calls, identities, scores, callerTargets, curriculum, learnerProfile, goals] = await Promise.all([
      // Basic caller info
      prisma.caller.findUnique({
        where: { id: callerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          externalId: true,
          createdAt: true,
          domainId: true,
          domain: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
        },
      }),

      // Personality profile
      prisma.callerPersonality.findUnique({
        where: { callerId: callerId },
        select: {
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
          confidenceScore: true,
          lastAggregatedAt: true,
          observationsUsed: true,
          preferredTone: true,
          preferredLength: true,
          technicalLevel: true,
        },
      }),

      // Personality observations
      prisma.personalityObservation.findMany({
        where: { callerId: callerId },
        orderBy: { observedAt: "desc" },
        take: 50,
        select: {
          id: true,
          callId: true,
          openness: true,
          conscientiousness: true,
          extraversion: true,
          agreeableness: true,
          neuroticism: true,
          confidence: true,
          observedAt: true,
        },
      }),

      // Active memories (not superseded, not expired)
      prisma.callerMemory.findMany({
        where: {
          callerId: callerId,
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: [{ category: "asc" }, { confidence: "desc" }],
        take: 100,
        select: {
          id: true,
          category: true,
          key: true,
          value: true,
          evidence: true,
          confidence: true,
          extractedAt: true,
          expiresAt: true,
        },
      }),

      // Memory summary
      prisma.callerMemorySummary.findUnique({
        where: { callerId: callerId },
        select: {
          factCount: true,
          preferenceCount: true,
          eventCount: true,
          topicCount: true,
          keyFacts: true,
          preferences: true,
          topTopics: true,
        },
      }),

      // Calls with analysis status
      prisma.call.findMany({
        where: { callerId: callerId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          source: true,
          externalId: true,
          transcript: true,
          createdAt: true,
          callSequence: true,
          _count: {
            select: {
              scores: true,
              behaviorMeasurements: true,
            },
          },
          rewardScore: {
            select: { id: true },
          },
        },
      }),

      // Caller identities (phone numbers, external IDs, etc.)
      prisma.callerIdentity.findMany({
        where: { callerId: callerId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          externalId: true,
          nextPrompt: true,
          nextPromptComposedAt: true,
          nextPromptInputs: true,
          segmentId: true,
          segment: {
            select: { name: true },
          },
        },
      }),

      // Call scores
      prisma.callScore.findMany({
        where: {
          call: { callerId: callerId },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          callId: true,
          parameterId: true,
          score: true,
          confidence: true,
          evidence: true,
          reasoning: true,
          scoredBy: true,
          scoredAt: true,
          analysisSpecId: true,
          createdAt: true,
          parameter: {
            select: {
              name: true,
              definition: true,
            },
          },
          analysisSpec: {
            select: {
              id: true,
              slug: true,
              name: true,
              outputType: true,
            },
          },
          call: {
            select: {
              createdAt: true,
            },
          },
        },
      }),

      // CallerTargets - personalized behavior targets computed by ADAPT specs
      prisma.callerTarget.findMany({
        where: { callerId: callerId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          parameterId: true,
          targetValue: true,
          callsUsed: true,
          confidence: true,
          decayHalfLife: true,
          lastUpdatedAt: true,
          createdAt: true,
          updatedAt: true,
          parameter: {
            select: {
              name: true,
              definition: true,
              interpretationLow: true,
              interpretationHigh: true,
              domainGroup: true,
            },
          },
        },
      }),

      // Curriculum progress - loads from CONTENT specs using contract-based system
      (async () => {
        try {
          // First fetch caller to get domain
          const callerData = await prisma.caller.findUnique({
            where: { id: callerId },
            select: {
              domain: {
                select: { name: true }
              }
            },
          });

          if (callerData?.domain?.name) {
            return await composeCurriculumSection(callerId, callerData.domain.name);
          }
          return null;
        } catch (error) {
          console.error('[caller-api] Failed to load curriculum:', error);
          return null;
        }
      })(),

      // Learner profile - inferred learning preferences from behavior
      (async () => {
        try {
          return await getLearnerProfile(callerId);
        } catch (error) {
          console.error('[caller-api] Failed to load learner profile:', error);
          return null;
        }
      })(),

      // Goals for this caller
      prisma.goal.findMany({
        where: { callerId },
        include: {
          playbook: {
            select: { id: true, name: true, version: true },
          },
          contentSpec: {
            select: { id: true, slug: true, name: true },
          },
        },
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
    ]);

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Get counts
    const [callCount, memoryCount, observationCount, promptsCount, measurementsCount] = await Promise.all([
      prisma.call.count({ where: { callerId: callerId } }),
      prisma.callerMemory.count({
        where: {
          callerId: callerId,
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      }),
      prisma.personalityObservation.count({ where: { callerId: callerId } }),
      prisma.composedPrompt.count({ where: { callerId: callerId } }),
      prisma.behaviorMeasurement.count({
        where: {
          call: { callerId: callerId },
        },
      }),
    ]);

    // Get behavior targets count for this caller
    // First get caller's identity and find the published playbook for their domain
    const [callerIdentity, publishedPlaybook] = await Promise.all([
      prisma.callerIdentity.findFirst({
        where: { callerId: callerId },
        select: {
          id: true,
          segmentId: true,
        },
      }),
      // Find the published playbook for the caller's domain with its templates
      caller.domainId
        ? prisma.playbook.findFirst({
            where: {
              domainId: caller.domainId,
              status: "PUBLISHED",
            },
            select: {
              id: true,
              items: {
                where: { isEnabled: true, itemType: "PROMPT_TEMPLATE" },
                select: {
                  promptTemplate: {
                    select: {
                      slug: true,
                      name: true,
                      systemPrompt: true,
                      contextTemplate: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

    // Count targets at various levels (SYSTEM is always available)
    let targetsCount = 0;
    const [systemTargets, segmentTargets, callerScopeTargets, playbookTargets] = await Promise.all([
      prisma.behaviorTarget.count({
        where: { scope: "SYSTEM", effectiveUntil: null },
      }),
      callerIdentity?.segmentId
        ? prisma.behaviorTarget.count({
            where: { scope: "SEGMENT", segmentId: callerIdentity.segmentId, effectiveUntil: null },
          })
        : Promise.resolve(0),
      callerIdentity?.id
        ? prisma.behaviorTarget.count({
            where: { scope: "CALLER", callerIdentityId: callerIdentity.id, effectiveUntil: null },
          })
        : Promise.resolve(0),
      // Use the published playbook from the caller's domain for PLAYBOOK scope
      publishedPlaybook?.id
        ? prisma.behaviorTarget.count({
            where: { scope: "PLAYBOOK", playbookId: publishedPlaybook.id, effectiveUntil: null },
          })
        : Promise.resolve(0),
    ]);
    targetsCount = systemTargets + segmentTargets + callerScopeTargets + playbookTargets;

    // Get memory counts per call for status
    const memoryCountsByCall = await prisma.callerMemory.groupBy({
      by: ["callId"],
      where: {
        callerId: callerId,
        supersededById: null,
        callId: { not: null },
      },
      _count: { id: true },
    });
    const memoryCountMap = new Map(
      memoryCountsByCall.map((m) => [m.callId, m._count.id])
    );

    // Transform calls to include analysis status
    const callsWithStatus = calls.map((call) => ({
      id: call.id,
      source: call.source,
      externalId: call.externalId,
      transcript: call.transcript,
      createdAt: call.createdAt,
      callSequence: call.callSequence,
      // Analysis status flags
      hasScores: call._count.scores > 0,
      hasMemories: (memoryCountMap.get(call.id) || 0) > 0,
      hasBehaviorMeasurements: call._count.behaviorMeasurements > 0,
      hasRewardScore: !!call.rewardScore,
    }));

    // Extract available slug variable names from playbook templates
    const availableSlugNames = new Set<string>();
    if (publishedPlaybook?.items) {
      // Regex to match {slug.variable_name} patterns
      const slugPattern = /\{slug\.([a-zA-Z0-9_]+)\}/g;

      for (const item of publishedPlaybook.items) {
        if (item.promptTemplate) {
          const templates = [
            item.promptTemplate.systemPrompt,
            item.promptTemplate.contextTemplate,
          ].filter(Boolean);

          for (const template of templates) {
            let match;
            while ((match = slugPattern.exec(template as string)) !== null) {
              availableSlugNames.add(match[1]);
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      caller: {
        ...caller,
        personality,
        _count: {
          calls: callCount,
          memories: memoryCount,
          personalityObservations: observationCount,
        },
      },
      personality,
      observations,
      memories,
      memorySummary,
      calls: callsWithStatus,
      identities,
      scores,
      callerTargets,
      curriculum,
      learnerProfile,
      goals,
      availableSlugNames: Array.from(availableSlugNames).sort(),
      counts: {
        calls: callCount,
        memories: memoryCount,
        observations: observationCount,
        prompts: promptsCount,
        targets: targetsCount,
        callerTargets: callerTargets.length,
        measurements: measurementsCount,
        curriculumModules: curriculum?.totalModules || 0,
        curriculumCompleted: curriculum?.completedCount || 0,
        goals: goals.length,
        activeGoals: goals.filter(g => g.status === 'ACTIVE').length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch caller" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/callers/[callerId]
 *
 * Update caller profile (name, email, phone, domainId)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await req.json();

    // Allowed fields to update
    const { name, email, phone, domainId } = body;

    // Build update data
    const updateData: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      domainId?: string | null;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (domainId !== undefined) updateData.domainId = domainId;

    // If domainId provided, verify it exists
    if (domainId) {
      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
      });
      if (!domain) {
        return NextResponse.json(
          { ok: false, error: "Domain not found" },
          { status: 400 }
        );
      }
    }

    const updatedCaller = await prisma.caller.update({
      where: { id: callerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        externalId: true,
        createdAt: true,
        domainId: true,
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
      data: updateData,
    });

    // If domain was changed, instantiate goals from playbook
    const goalsCreated: string[] = [];
    if (domainId) {
      // Archive old goals (don't delete, preserve history)
      await prisma.goal.updateMany({
        where: {
          callerId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        data: { status: 'ARCHIVED' },
      });

      // Find published playbook for new domain
      const playbook = await prisma.playbook.findFirst({
        where: {
          domainId,
          status: 'PUBLISHED',
        },
        select: {
          id: true,
          name: true,
          config: true,
        },
      });

      if (playbook?.config) {
        const config = playbook.config as any;
        const goals = config.goals || [];

        // Create goal instances for caller
        for (const goalConfig of goals) {
          // Find contentSpec if it's a LEARN goal
          let contentSpecId = null;
          if (goalConfig.type === 'LEARN' && goalConfig.contentSpecSlug) {
            const contentSpec = await prisma.analysisSpec.findFirst({
              where: {
                slug: { contains: goalConfig.contentSpecSlug.toLowerCase().replace(/_/g, '-') },
                isActive: true,
              },
              select: { id: true },
            });
            contentSpecId = contentSpec?.id || null;
          }

          // Create goal
          const goal = await prisma.goal.create({
            data: {
              callerId,
              playbookId: playbook.id,
              type: goalConfig.type,
              name: goalConfig.name,
              description: goalConfig.description || null,
              contentSpecId,
              status: 'ACTIVE',
              priority: goalConfig.priority || 5,
              startedAt: new Date(),
            },
          });

          goalsCreated.push(goal.name);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      caller: updatedCaller,
      goalsCreated: goalsCreated.length > 0 ? goalsCreated : undefined,
    });
  } catch (error: any) {
    console.error("Error updating caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update caller" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/callers/[callerId]
 *
 * Delete a caller and all their data.
 * Optionally exclude their phone/externalId from future imports.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ callerId: string }> }
) {
  try {
    const { callerId } = await params;
    const body = await req.json().catch(() => ({}));
    const { exclude = false } = body;

    // Find the caller first
    const caller = await prisma.caller.findUnique({
      where: { id: callerId },
      select: {
        id: true,
        name: true,
        phone: true,
        externalId: true,
      },
    });

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // If exclude option is set, add to ExcludedCaller table
    if (exclude && (caller.phone || caller.externalId)) {
      // Create exclusion record(s)
      if (caller.phone) {
        await prisma.excludedCaller.upsert({
          where: { phone: caller.phone },
          create: {
            phone: caller.phone,
            reason: `Deleted caller: ${caller.name || caller.phone}`,
          },
          update: {
            reason: `Deleted caller: ${caller.name || caller.phone}`,
          },
        });
      }
      if (caller.externalId) {
        await prisma.excludedCaller.upsert({
          where: { externalId: caller.externalId },
          create: {
            externalId: caller.externalId,
            reason: `Deleted caller: ${caller.name || caller.externalId}`,
          },
          update: {
            reason: `Deleted caller: ${caller.name || caller.externalId}`,
          },
        });
      }
    }

    // Delete all related records (order matters due to FK constraints)
    // Delete in order of dependency
    await prisma.$transaction(async (tx) => {
      // Delete call-related records first
      const callIds = await tx.call.findMany({
        where: { callerId },
        select: { id: true },
      });
      const callIdList = callIds.map((c) => c.id);

      if (callIdList.length > 0) {
        // Delete records that reference calls
        await tx.callScore.deleteMany({ where: { callId: { in: callIdList } } });
        await tx.behaviorMeasurement.deleteMany({ where: { callId: { in: callIdList } } });
        await tx.callTarget.deleteMany({ where: { callId: { in: callIdList } } });
        await tx.rewardScore.deleteMany({ where: { callId: { in: callIdList } } });
      }

      // Delete caller-related records
      await tx.callerMemory.deleteMany({ where: { callerId } });
      await tx.callerMemorySummary.deleteMany({ where: { callerId } });
      await tx.personalityObservation.deleteMany({ where: { callerId } });
      await tx.callerPersonality.deleteMany({ where: { callerId } });
      await tx.callerPersonalityProfile.deleteMany({ where: { callerId } });
      await tx.promptSlugSelection.deleteMany({ where: { callerId } });
      await tx.composedPrompt.deleteMany({ where: { callerId } });
      await tx.callerTarget.deleteMany({ where: { callerId } });
      await tx.callerAttribute.deleteMany({ where: { callerId } });

      // Delete caller identities
      await tx.callerIdentity.deleteMany({ where: { callerId } });

      // Delete calls
      await tx.call.deleteMany({ where: { callerId } });

      // Finally delete the caller
      await tx.caller.delete({ where: { id: callerId } });
    });

    return NextResponse.json({
      ok: true,
      message: `Deleted caller ${caller.name || caller.phone || callerId}`,
      excluded: exclude && (caller.phone || caller.externalId),
    });
  } catch (error: any) {
    console.error("Error deleting caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete caller" },
      { status: 500 }
    );
  }
}
