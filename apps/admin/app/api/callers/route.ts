import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { requireEntityAccess, isEntityAuthError, buildScopeFilter } from "@/lib/access-control";

/**
 * @api GET /api/callers
 * @visibility public
 * @scope callers:read
 * @auth session
 * @tags callers
 * @description List all callers with optional memory/call counts. Returns paginated results ordered by creation date descending, with flattened domain and personality data.
 * @query withCounts boolean - When "true", fetches active memory and call counts per caller
 * @query includeArchived boolean - When "true", includes archived callers (default false)
 * @query limit number - Maximum callers to return (default 100, max 500)
 * @query offset number - Number of callers to skip for pagination (default 0)
 * @response 200 { ok: true, callers: Caller[], total: number, limit: number, offset: number }
 * @response 500 { ok: false, error: "Failed to fetch callers" }
 */
export async function GET(req: Request) {
  try {
    const authResult = await requireEntityAccess("callers", "R");
    if (isEntityAuthError(authResult)) return authResult.error;
    const { scope, session } = authResult;

    const url = new URL(req.url);
    const withCounts = url.searchParams.get("withCounts") === "true";
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "100"));
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Apply scope filter (ALL=no filter, DOMAIN=user's domain, OWN=user's callers)
    const scopeFilter = buildScopeFilter(scope, session, "userId", "domainId");

    // Merge scope filter with archive filter
    const whereClause = {
      ...scopeFilter,
      ...(includeArchived ? {} : { archivedAt: null }),
    };

    // Fetch callers with available relations
    const callers = await prisma.caller.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      include: {
        domain: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        personality: {
          select: {
            openness: true,
            conscientiousness: true,
            extraversion: true,
            agreeableness: true,
            neuroticism: true,
            preferredTone: true,
            preferredLength: true,
            technicalLevel: true,
            confidenceScore: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to flatten nested data
    const callersFlattened = callers.map((caller) => ({
      id: caller.id,
      name: caller.name || null,
      email: caller.email || null,
      phone: caller.phone || null,
      externalId: caller.externalId,
      domainId: caller.domainId || null,
      domain: caller.domain || null,
      personality: caller.personality || null,
      createdAt: caller.createdAt,
      archivedAt: caller.archivedAt || null,
    }));

    // If counts requested, fetch related counts
    if (withCounts && callersFlattened.length > 0) {
      const callerIds = callersFlattened.map((c) => c.id);

      // Get memory counts
      const memoryCounts = await prisma.callerMemory.groupBy({
        by: ["callerId"],
        where: {
          callerId: { in: callerIds },
          supersededById: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        _count: { id: true },
      });

      const memoryCountMap = new Map(
        memoryCounts.map((mc) => [mc.callerId, mc._count.id])
      );

      // Get call counts
      const callCounts = await prisma.call.groupBy({
        by: ["callerId"],
        where: {
          callerId: { in: callerIds },
        },
        _count: { id: true },
      });

      const callCountMap = new Map(
        callCounts.map((cc) => [cc.callerId, cc._count.id])
      );

      // Augment callers with counts
      for (let i = 0; i < callersFlattened.length; i++) {
        const caller = callers[i];
        (callersFlattened[i] as any)._count = {
          memories: memoryCountMap.get(caller.id) || 0,
          calls: callCountMap.get(caller.id) || 0,
        };
      }
    } else {
      // Default counts when withCounts is false
      for (const caller of callersFlattened) {
        (caller as any)._count = {
          memories: 0,
          calls: 0,
        };
      }
    }

    const total = await prisma.caller.count({ where: whereClause });

    return NextResponse.json({
      ok: true,
      callers: callersFlattened,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching callers:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch callers" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/callers
 * @visibility public
 * @scope callers:write
 * @auth session
 * @tags callers
 * @description Create a new caller. Auto-assigns the default domain if none specified. Generates a playground externalId.
 * @body name string - Caller name (required)
 * @body email string - Caller email (optional)
 * @body phone string - Caller phone number (optional)
 * @body domainId string - Domain ID to assign (optional, defaults to system default domain)
 * @response 200 { ok: true, caller: { id, name, email, phone, domain } }
 * @response 400 { ok: false, error: "Name is required" }
 * @response 500 { ok: false, error: "Failed to create caller" }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireEntityAccess("callers", "C");
    if (isEntityAuthError(authResult)) return authResult.error;

    const body = await req.json();
    let { name, email, phone, domainId } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Name is required" },
        { status: 400 }
      );
    }

    // Auto-assign default domain if no domain specified
    if (!domainId) {
      const defaultDomain = await prisma.domain.findFirst({
        where: { isDefault: true },
      });
      if (defaultDomain) {
        domainId = defaultDomain.id;
        console.log(`[caller-create] No domain specified, using default domain: ${defaultDomain.slug}`);
      }
    }

    const caller = await prisma.caller.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        domainId: domainId || null,
        externalId: `playground-${Date.now()}`,
      },
      include: {
        domain: {
          select: { id: true, slug: true, name: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      caller: {
        id: caller.id,
        name: caller.name,
        email: caller.email,
        phone: caller.phone,
        domain: caller.domain,
      },
    });
  } catch (error: any) {
    console.error("Error creating caller:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create caller" },
      { status: 500 }
    );
  }
}
