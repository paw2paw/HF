import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");

    const calls = await prisma.call.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        caller: {
          select: { id: true, name: true, email: true },
        },
        scores: {
          select: {
            id: true,
            parameterId: true,
            score: true,
            analysisSpecId: true,
            analysisSpec: {
              select: {
                slug: true,
                name: true,
                outputType: true,
              },
            },
          },
        },
        extractedMemories: {
          select: {
            id: true,
            category: true,
            key: true,
            value: true,
          },
        },
        behaviorMeasurements: {
          select: { id: true },
        },
        triggeredPrompts: {
          select: { id: true, composedAt: true },
          take: 1,
          orderBy: { composedAt: "desc" },
        },
        _count: {
          select: { scores: true, extractedMemories: true, behaviorMeasurements: true },
        },
      },
    });

    // Also check if caller has nextPrompt set for each call
    const callsWithPromptStatus = await Promise.all(
      calls.map(async (call) => {
        let hasNextPrompt = false;
        if (call.callerId) {
          const identity = await prisma.callerIdentity.findFirst({
            where: { callerId: call.callerId },
            select: { nextPrompt: true, nextPromptComposedAt: true },
          });
          hasNextPrompt = !!identity?.nextPrompt;
        }
        return {
          ...call,
          hasNextPrompt,
          // Derive pipeline status
          pipelineStatus: {
            prepComplete: (call._count?.scores || 0) > 0 && (call._count?.behaviorMeasurements || 0) > 0,
            promptComposed: call.triggeredPrompts.length > 0 || hasNextPrompt,
          },
        };
      })
    );

    return NextResponse.json({ ok: true, calls: callsWithPromptStatus, count: calls.length });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
