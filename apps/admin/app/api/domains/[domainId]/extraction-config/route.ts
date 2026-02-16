import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import {
  resolveExtractionConfigForDomain,
  ExtractionConfig,
} from "@/lib/content-trust/resolve-config";

/**
 * @api GET /api/domains/:domainId/extraction-config
 * @visibility public
 * @scope domains:read
 * @auth session
 * @tags domains, content-trust, extraction
 * @description Get merged extraction config for a domain (system + domain override).
 *   Returns the fully resolved config along with whether a domain-level override exists.
 * @pathParam domainId string - Domain UUID
 * @response 200 { ok: true, config: ExtractionConfig, hasOverride: boolean, overrideSpecId: string | null }
 * @response 404 { ok: false, error: "Domain not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true },
    });

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 },
      );
    }

    // Resolve fully merged config
    const mergedConfig = await resolveExtractionConfigForDomain(domainId);

    // Find the domain-level override spec (if any) to report override status
    const overrideSpec = await findDomainOverrideSpec(domainId);

    return NextResponse.json({
      ok: true,
      config: mergedConfig,
      hasOverride: overrideSpec !== null,
      overrideSpecId: overrideSpec?.id ?? null,
    });
  } catch (error: any) {
    console.error("Error fetching extraction config:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch extraction config" },
      { status: 500 },
    );
  }
}

/**
 * @api PUT /api/domains/:domainId/extraction-config
 * @visibility public
 * @scope domains:write
 * @auth session
 * @tags domains, content-trust, extraction
 * @description Set or clear the domain-level extraction config override.
 *   Pass partial config to override specific fields; pass null/empty to reset to system defaults.
 *   Requires a published playbook on the domain.
 * @pathParam domainId string - Domain UUID
 * @body config Partial<ExtractionConfig> | null - Override config (null to reset)
 * @response 200 { ok: true, config: ExtractionConfig, hasOverride: boolean, overrideSpecId: string | null }
 * @response 400 { ok: false, error: "Domain has no published playbook..." }
 * @response 404 { ok: false, error: "Domain not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { domainId } = await params;

    // Verify domain exists
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true, name: true },
    });

    if (!domain) {
      return NextResponse.json(
        { ok: false, error: "Domain not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const overrideConfig: Partial<ExtractionConfig> | null = body.config ?? null;

    // Check if this is a reset (empty/null config)
    const isReset =
      overrideConfig === null ||
      (typeof overrideConfig === "object" && Object.keys(overrideConfig).length === 0);

    // Find existing override spec
    const existingOverride = await findDomainOverrideSpec(domainId);

    if (isReset) {
      // Delete the override spec if it exists (reset to system defaults)
      if (existingOverride) {
        await prisma.$transaction(async (tx) => {
          // Remove playbook item referencing this spec
          await tx.playbookItem.deleteMany({
            where: { specId: existingOverride.id },
          });
          // Delete the spec itself
          await tx.analysisSpec.delete({
            where: { id: existingOverride.id },
          });
        });
      }
    } else {
      // Find or create the override spec
      if (existingOverride) {
        // Update existing override
        await prisma.analysisSpec.update({
          where: { id: existingOverride.id },
          data: { config: overrideConfig as any },
        });
      } else {
        // Need a published playbook to attach the override to
        const playbook = await prisma.playbook.findFirst({
          where: { domainId, status: "PUBLISHED" },
          select: { id: true },
        });

        if (!playbook) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Domain has no published playbook. Publish a playbook before setting extraction config overrides.",
            },
            { status: 400 },
          );
        }

        // Create domain-level EXTRACT spec + playbook item
        const slugPrefix = domainId.substring(0, 8).toUpperCase();
        const slug = `CONTENT-EXTRACT-${slugPrefix}`;

        await prisma.$transaction(async (tx) => {
          const spec = await tx.analysisSpec.create({
            data: {
              slug,
              name: `Extraction Config Override — ${domain.name}`,
              specRole: "EXTRACT",
              specType: "DOMAIN",
              scope: "DOMAIN",
              domain: "content-trust",
              isActive: true,
              config: overrideConfig as any,
            },
          });

          // Get the next sort order in the playbook
          const maxSort = await tx.playbookItem.aggregate({
            where: { playbookId: playbook.id },
            _max: { sortOrder: true },
          });

          await tx.playbookItem.create({
            data: {
              playbookId: playbook.id,
              specId: spec.id,
              sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
              itemType: "SPEC",
            },
          });
        });
      }
    }

    // Return the newly resolved config
    const mergedConfig = await resolveExtractionConfigForDomain(domainId);
    const updatedOverride = await findDomainOverrideSpec(domainId);

    return NextResponse.json({
      ok: true,
      config: mergedConfig,
      hasOverride: updatedOverride !== null,
      overrideSpecId: updatedOverride?.id ?? null,
    });
  } catch (error: any) {
    console.error("Error updating extraction config:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update extraction config" },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Find the domain-level EXTRACT override spec for a domain.
 * Returns the spec id and config, or null if no override exists.
 */
async function findDomainOverrideSpec(
  domainId: string,
): Promise<{ id: string; config: Record<string, any> } | null> {
  const playbook = await prisma.playbook.findFirst({
    where: {
      domainId,
      status: "PUBLISHED",
    },
    select: {
      items: {
        where: {
          itemType: "SPEC",
          spec: {
            specRole: "EXTRACT",
            scope: "DOMAIN",
            domain: "content-trust",
            isActive: true,
          },
        },
        select: {
          spec: {
            select: { id: true, config: true },
          },
        },
        take: 1,
      },
    },
  });

  const spec = playbook?.items?.[0]?.spec;
  if (!spec) return null;

  return {
    id: spec.id,
    config: spec.config as Record<string, any>,
  };
}
