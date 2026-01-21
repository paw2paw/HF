import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const [caller, personality, observations, memories, memorySummary, calls] = await Promise.all([
      // Basic caller info
      prisma.user.findUnique({
        where: { id: callerId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          externalId: true,
          createdAt: true,
        },
      }),

      // Personality profile
      prisma.userPersonality.findUnique({
        where: { userId: callerId },
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
        where: { userId: callerId },
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
      prisma.userMemory.findMany({
        where: {
          userId: callerId,
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
      prisma.userMemorySummary.findUnique({
        where: { userId: callerId },
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

      // Calls
      prisma.call.findMany({
        where: { userId: callerId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          source: true,
          externalId: true,
          transcript: true,
          createdAt: true,
        },
      }),
    ]);

    if (!caller) {
      return NextResponse.json(
        { ok: false, error: "Caller not found" },
        { status: 404 }
      );
    }

    // Get counts
    const [callCount, memoryCount, observationCount] = await Promise.all([
      prisma.call.count({ where: { userId: callerId } }),
      prisma.userMemory.count({
        where: {
          userId: callerId,
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      }),
      prisma.personalityObservation.count({ where: { userId: callerId } }),
    ]);

    return NextResponse.json({
      ok: true,
      caller,
      personality,
      observations,
      memories,
      memorySummary,
      calls,
      counts: {
        calls: callCount,
        memories: memoryCount,
        observations: observationCount,
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
