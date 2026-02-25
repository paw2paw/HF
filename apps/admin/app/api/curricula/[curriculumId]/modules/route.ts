/**
 * @api GET /api/curricula/:curriculumId/modules
 * @scope curricula:read
 * @auth session (VIEWER+)
 * @desc List all modules for a curriculum, with learning objectives
 *
 * @api POST /api/curricula/:curriculumId/modules
 * @scope curricula:write
 * @auth session (OPERATOR+)
 * @desc Bulk upsert modules (array). Used by curriculum generation and saveCurriculum.
 *
 * @api PUT /api/curricula/:curriculumId/modules
 * @scope curricula:write
 * @auth session (OPERATOR+)
 * @desc Bulk reorder modules ({ items: [{ id, sortOrder }] })
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ curriculumId: string }> };

// ---------------------------------------------------------------------------
// GET — list modules with LOs
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    const { curriculumId } = await params;

    const modules = await prisma.curriculumModule.findMany({
      where: { curriculumId, isActive: true },
      include: {
        learningObjectives: { orderBy: { sortOrder: "asc" } },
        _count: { select: { callerProgress: true, calls: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, modules });
  } catch (error: any) {
    console.error("[curricula/:id/modules] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — bulk upsert modules (with LOs)
// ---------------------------------------------------------------------------

interface ModuleInput {
  slug: string;
  title: string;
  description?: string | null;
  sortOrder?: number;
  estimatedDurationMinutes?: number | null;
  masteryThreshold?: number | null;
  prerequisites?: string[];
  keyTerms?: string[];
  assessmentCriteria?: string[];
  learningOutcomes?: string[]; // Raw text — parsed into LearningObjective records
}

// Parse LO ref from text like "LO1: Identify..." → { ref: "LO1", description: "Identify..." }
const LO_REF_PATTERN = /^(LO\d+|AC[\d.]+|R\d+-LO\d+(?:-AC[\d.]+)?)\s*[:\-–]\s*/i;

function parseLORef(text: string, index: number): { ref: string; description: string } {
  const match = text.match(LO_REF_PATTERN);
  if (match) {
    return { ref: match[1].toUpperCase(), description: text.slice(match[0].length).trim() || text };
  }
  return { ref: `LO-${index + 1}`, description: text };
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { curriculumId } = await params;
    const body = await req.json();
    const inputModules: ModuleInput[] = body.modules;

    if (!Array.isArray(inputModules) || inputModules.length === 0) {
      return NextResponse.json({ error: "modules array is required" }, { status: 400 });
    }

    // Verify curriculum exists
    const curriculum = await prisma.curriculum.findUnique({
      where: { id: curriculumId },
      select: { id: true },
    });
    if (!curriculum) {
      return NextResponse.json({ error: "Curriculum not found" }, { status: 404 });
    }

    // Bulk upsert within a transaction
    const result = await prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (let i = 0; i < inputModules.length; i++) {
        const mod = inputModules[i];
        const slug = mod.slug || `MOD-${i + 1}`;

        const upserted = await tx.curriculumModule.upsert({
          where: { curriculumId_slug: { curriculumId, slug } },
          create: {
            curriculumId,
            slug,
            title: mod.title || slug,
            description: mod.description || null,
            sortOrder: mod.sortOrder ?? i,
            estimatedDurationMinutes: mod.estimatedDurationMinutes || null,
            masteryThreshold: mod.masteryThreshold || null,
            prerequisites: mod.prerequisites || [],
            keyTerms: mod.keyTerms || [],
            assessmentCriteria: mod.assessmentCriteria || [],
          },
          update: {
            title: mod.title || slug,
            description: mod.description || null,
            sortOrder: mod.sortOrder ?? i,
            estimatedDurationMinutes: mod.estimatedDurationMinutes || null,
            masteryThreshold: mod.masteryThreshold || null,
            prerequisites: mod.prerequisites || [],
            keyTerms: mod.keyTerms || [],
            assessmentCriteria: mod.assessmentCriteria || [],
          },
        });

        // Sync learning objectives if provided
        if (mod.learningOutcomes && mod.learningOutcomes.length > 0) {
          // Delete existing LOs for this module, re-create from array
          await tx.learningObjective.deleteMany({ where: { moduleId: upserted.id } });

          for (let j = 0; j < mod.learningOutcomes.length; j++) {
            const { ref, description } = parseLORef(mod.learningOutcomes[j], j);
            await tx.learningObjective.create({
              data: {
                moduleId: upserted.id,
                ref,
                description,
                sortOrder: j,
              },
            });
          }
        }

        created.push(upserted);
      }

      return created;
    });

    // Re-fetch with includes for response
    const modules = await prisma.curriculumModule.findMany({
      where: { curriculumId, isActive: true },
      include: { learningObjectives: { orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ ok: true, modules, count: result.length }, { status: 201 });
  } catch (error: any) {
    console.error("[curricula/:id/modules] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT — bulk reorder
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { curriculumId } = await params;
    const body = await req.json();
    const items: { id: string; sortOrder: number }[] = body.items;

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 });
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.curriculumModule.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[curricula/:id/modules] PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
