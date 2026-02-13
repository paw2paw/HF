import { PrismaClient, AgentRunStatus } from "@prisma/client";
import { requireAuth, isAuthError } from "@/lib/permissions";

const prisma = new PrismaClient();

/**
 * @api GET /api/agents/runs
 * @visibility internal
 * @scope agents:read
 * @auth session
 * @tags agents
 * @description List agent runs with optional filters for agentId, status, and limit
 * @query agentId string - Filter by agent ID
 * @query status string - Comma-separated status filter (QUEUED, RUNNING, OK, ERROR)
 * @query limit number - Max results (1-500, default: 50)
 * @response 200 { ok: true, agentId, status, limit, count, runs: AgentRun[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const url = new URL(req.url);
    const agentId = (url.searchParams.get("agentId") || "").trim();
    const statusParam = url.searchParams.get("status") || "";
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || "50")));

    // Parse status filter (comma-separated)
    let statusFilter: AgentRunStatus[] | undefined;
    if (statusParam) {
      const validStatuses = ["QUEUED", "RUNNING", "OK", "ERROR"];
      statusFilter = statusParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => validStatuses.includes(s)) as AgentRunStatus[];

      if (statusFilter.length === 0) {
        statusFilter = undefined;
      }
    }

    const where: any = {};
    if (agentId) {
      where.agentId = agentId;
    }
    if (statusFilter && statusFilter.length > 0) {
      where.status = { in: statusFilter };
    }

    const runs = await prisma.agentRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        agentInstance: {
          select: { name: true, agentId: true },
        },
      },
    });

    // Transform to include name from instance
    const transformedRuns = runs.map((run) => ({
      id: run.id,
      agentId: run.agentId,
      name: run.agentInstance?.name || run.agentId,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString(),
      opid: run.opid,
      // Parse progress from artifacts if present
      progress: run.artifacts && typeof run.artifacts === "object" && "progress" in (run.artifacts as any)
        ? (run.artifacts as any).progress
        : undefined,
    }));

    return Response.json({
      ok: true,
      agentId: agentId || null,
      status: statusFilter || null,
      limit,
      count: transformedRuns.length,
      runs: transformedRuns,
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}