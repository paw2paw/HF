import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

const prisma = new PrismaClient();

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Agent Publish API is disabled in production");
  }
  if (process.env.HF_OPS_ENABLED !== "true") {
    throw new Error("Agent Publish API is disabled (set HF_OPS_ENABLED=true)");
  }
}

/**
 * @api POST /api/agents/:agentId/publish
 * @visibility internal
 * @scope agents:write
 * @auth session
 * @tags agents
 * @description Publish the current draft agent instance, superseding any existing published version.
 *   Workflow: Find DRAFT, mark existing PUBLISHED as SUPERSEDED, mark DRAFT as PUBLISHED.
 * @pathParam agentId string - The agent identifier
 * @response 200 { ok: true, action: "published", instance: AgentInstance, superseded: { id, version } | null }
 * @response 404 { ok: false, error: "No draft found to publish" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();
    const { agentId } = await params;

    // Find draft to publish
    const draft = await prisma.agentInstance.findFirst({
      where: { agentId, status: "DRAFT" },
    });

    if (!draft) {
      return NextResponse.json(
        { ok: false, error: "No draft found to publish" },
        { status: 404 }
      );
    }

    // Find existing published version
    const currentPublished = await prisma.agentInstance.findFirst({
      where: { agentId, status: "PUBLISHED" },
    });

    // Use transaction to atomically update both
    const result = await prisma.$transaction(async (tx) => {
      // Supersede current published version
      if (currentPublished) {
        await tx.agentInstance.update({
          where: { id: currentPublished.id },
          data: { status: "SUPERSEDED" },
        });
      }

      // Publish the draft
      const published = await tx.agentInstance.update({
        where: { id: draft.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      return {
        published,
        superseded: currentPublished,
      };
    });

    return NextResponse.json({
      ok: true,
      action: "published",
      instance: result.published,
      superseded: result.superseded
        ? { id: result.superseded.id, version: result.superseded.version }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to publish agent" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * @api GET /api/agents/:agentId/publish
 * @visibility internal
 * @scope agents:read
 * @auth session
 * @tags agents
 * @description Get the currently published instance for this agent with recent runs
 * @pathParam agentId string - The agent identifier
 * @response 200 { ok: true, published: AgentInstance | null }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();
    const { agentId } = await params;

    const published = await prisma.agentInstance.findFirst({
      where: { agentId, status: "PUBLISHED" },
      include: {
        runs: {
          take: 10,
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!published) {
      return NextResponse.json({
        ok: true,
        published: null,
        message: "No published version - using manifest defaults",
      });
    }

    return NextResponse.json({
      ok: true,
      published,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to get published agent" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
