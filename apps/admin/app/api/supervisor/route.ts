import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadPipelineStages, PipelineStage } from "@/lib/pipeline/config";

/**
 * GET /api/supervisor
 *
 * Returns pipeline configuration and specs organized by stage for a domain.
 * Shows which specs will run at each pipeline stage.
 *
 * Query params:
 * - domainId: string (optional) - if provided, shows DOMAIN specs for that domain
 *
 * Pipeline stages are loaded from PIPELINE-001 spec (or GUARD-001 fallback).
 * Each stage shows:
 * - Stage metadata (name, order, description, outputTypes)
 * - SYSTEM specs that run in this stage (always enabled)
 * - DOMAIN specs for the selected domain (from published playbook)
 */

type SpecInfo = {
  id: string;
  slug: string;
  name: string;
  outputType: string;
  specRole: string | null;
  scope: string;
  isActive: boolean;
  priority: number;
  domain: string | null;
};

type StageWithSpecs = PipelineStage & {
  systemSpecs: SpecInfo[];
  domainSpecs: SpecInfo[];
  totalSpecs: number;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId");

    // 1. Load pipeline stages from PIPELINE-001 (or GUARD-001 fallback)
    const pipelineStages = await loadPipelineStages();

    // Get SUPERVISE spec info for display (if any)
    const superviseSpec = await prisma.analysisSpec.findFirst({
      where: {
        outputType: "SUPERVISE",
        isActive: true,
        isDirty: false,
      },
      select: { id: true, slug: true, name: true },
    });

    const superviseSpecInfo = superviseSpec
      ? { id: superviseSpec.id, slug: superviseSpec.slug, name: superviseSpec.name }
      : null;

    // 2. Load all SYSTEM specs
    const allSystemSpecs = await prisma.analysisSpec.findMany({
      where: {
        scope: "SYSTEM",
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        outputType: true,
        specRole: true,
        scope: true,
        isActive: true,
        priority: true,
        domain: true,
      },
      orderBy: { priority: "desc" },
    });

    // 3. Load DOMAIN specs for the selected domain (if provided)
    let domainSpecs: SpecInfo[] = [];
    let domainInfo = null;
    let playbookInfo = null;

    if (domainId) {
      // Get domain info
      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
        select: { id: true, slug: true, name: true },
      });

      if (domain) {
        domainInfo = domain;

        // Find published playbook for this domain
        const playbook = await prisma.playbook.findFirst({
          where: {
            domainId: domainId,
            status: "PUBLISHED",
          },
          select: {
            id: true,
            name: true,
            status: true,
            items: {
              where: {
                itemType: "SPEC",
                isEnabled: true,
                spec: {
                  scope: "DOMAIN",
                  isActive: true,
                },
              },
              select: {
                spec: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                    outputType: true,
                    specRole: true,
                    scope: true,
                    isActive: true,
                    priority: true,
                    domain: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (playbook) {
          playbookInfo = {
            id: playbook.id,
            name: playbook.name,
            status: playbook.status,
          };

          domainSpecs = playbook.items
            .filter((item) => item.spec)
            .map((item) => item.spec!);
        }
      }
    }

    // 4. Organize specs by stage
    const stages: StageWithSpecs[] = pipelineStages.map((stage) => {
      const systemSpecsForStage = allSystemSpecs.filter((spec) =>
        stage.outputTypes.includes(spec.outputType)
      );

      const domainSpecsForStage = domainSpecs.filter((spec) =>
        stage.outputTypes.includes(spec.outputType)
      );

      return {
        ...stage,
        systemSpecs: systemSpecsForStage,
        domainSpecs: domainSpecsForStage,
        totalSpecs: systemSpecsForStage.length + domainSpecsForStage.length,
      };
    });

    // 5. Get all available domains for dropdown
    const allDomains = await prisma.domain.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: "asc" },
    });

    // 6. Count totals
    const counts = {
      stages: stages.length,
      systemSpecs: allSystemSpecs.length,
      domainSpecs: domainSpecs.length,
      totalSpecs: allSystemSpecs.length + domainSpecs.length,
      domains: allDomains.length,
    };

    return NextResponse.json({
      ok: true,
      superviseSpec: superviseSpecInfo,
      domain: domainInfo,
      playbook: playbookInfo,
      stages,
      allDomains,
      counts,
    });
  } catch (error: any) {
    console.error("Error fetching supervisor data:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch supervisor data" },
      { status: 500 }
    );
  }
}
