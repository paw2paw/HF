import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * @api POST /api/admin/demo-reset-content
 * @visibility internal
 * @scope admin:write
 * @auth session (SUPERADMIN)
 * @tags admin, data-management, demo, content
 * @description Delete all ContentSources AND curriculum artifacts (curricula,
 *   modules, learning objectives) for a given domain. Forces the next upload
 *   to run a fresh extraction → curriculum generation → tag-on-extract
 *   pipeline with no legacy LO structure to inherit.
 *
 *   Cleaned:
 *     - ContentSource (assertions, questions, vocabulary cascade)
 *     - SubjectSource links
 *     - MediaAsset sourceId refs (set to null)
 *     - Curriculum + CurriculumModule + LearningObjective rows
 *       for every subject in the domain
 *     - CallerModuleProgress rows pointing at deleted modules
 *
 *   Preserved:
 *     - Subjects themselves (keeps PlaybookSubject links stable)
 *     - Playbooks + playbook config (wizard outputs)
 *     - Callers + their goals
 *
 * @request { domainId: string }
 * @response 200 { ok: true, deleted: { sources, subjects_unlinked, curricula, modules, learningObjectives, moduleProgress }, domainName }
 * @response 400 { ok: false, error: "domainId is required" }
 * @response 403 { ok: false, error: "SUPERADMIN required" }
 * @response 404 { ok: false, error: "Domain not found" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth("SUPERADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const body = await req.json().catch(() => ({}));
    const { domainId } = body as { domainId?: string };

    if (!domainId) {
      return NextResponse.json(
        { ok: false, error: "domainId is required" },
        { status: 400 },
      );
    }

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

    // Find all subjects linked to this domain
    const subjectDomains = await prisma.subjectDomain.findMany({
      where: { domainId },
      select: { subjectId: true },
    });
    const subjectIds = subjectDomains.map((sd) => sd.subjectId);

    const emptyDeleted = {
      sources: 0,
      subjects_unlinked: 0,
      curricula: 0,
      modules: 0,
      learningObjectives: 0,
      moduleProgress: 0,
    };

    if (subjectIds.length === 0) {
      return NextResponse.json({ ok: true, deleted: emptyDeleted, domainName: domain.name });
    }

    // ── 1. Curriculum cleanup ─────────────────────────────────
    // Wipe curricula + modules + LOs BEFORE deleting content sources so we
    // don't leave orphan LO rows pointing at deleted assertions. Cascade
    // ordering: LearningObjective → CurriculumModule → Curriculum.
    const curricula = await prisma.curriculum.findMany({
      where: { subjectId: { in: subjectIds } },
      select: { id: true },
    });
    const curriculumIds = curricula.map((c) => c.id);

    let deletedLOs = 0;
    let deletedModules = 0;
    let deletedCurricula = 0;
    let deletedProgress = 0;

    if (curriculumIds.length > 0) {
      const moduleRows = await prisma.curriculumModule.findMany({
        where: { curriculumId: { in: curriculumIds } },
        select: { id: true },
      });
      const moduleIds = moduleRows.map((m) => m.id);

      if (moduleIds.length > 0) {
        // CallerModuleProgress references CurriculumModule — delete first so
        // the module delete doesn't violate FKs on restricted-delete relations.
        const progress = await prisma.callerModuleProgress.deleteMany({
          where: { moduleId: { in: moduleIds } },
        });
        deletedProgress = progress.count;

        const los = await prisma.learningObjective.deleteMany({
          where: { moduleId: { in: moduleIds } },
        });
        deletedLOs = los.count;

        const modules = await prisma.curriculumModule.deleteMany({
          where: { id: { in: moduleIds } },
        });
        deletedModules = modules.count;
      }

      const cur = await prisma.curriculum.deleteMany({
        where: { id: { in: curriculumIds } },
      });
      deletedCurricula = cur.count;
    }

    // ── 2. ContentSource cleanup ──────────────────────────────
    const subjectSources = await prisma.subjectSource.findMany({
      where: { subjectId: { in: subjectIds } },
      select: { sourceId: true },
    });
    const sourceIds = [...new Set(subjectSources.map((ss) => ss.sourceId))];

    if (sourceIds.length === 0) {
      return NextResponse.json({
        ok: true,
        deleted: {
          ...emptyDeleted,
          curricula: deletedCurricula,
          modules: deletedModules,
          learningObjectives: deletedLOs,
          moduleProgress: deletedProgress,
        },
        domainName: domain.name,
      });
    }

    // Clean up join tables first
    const unlinked = await prisma.subjectSource.deleteMany({
      where: { sourceId: { in: sourceIds } },
    });

    // Detach MediaAssets (onDelete: SetNull won't fire on bulk delete)
    await prisma.mediaAsset.updateMany({
      where: { sourceId: { in: sourceIds } },
      data: { sourceId: null },
    });

    // Delete ContentSources — assertions, questions, vocabulary cascade automatically
    const deleted = await prisma.contentSource.deleteMany({
      where: { id: { in: sourceIds } },
    });

    return NextResponse.json({
      ok: true,
      deleted: {
        sources: deleted.count,
        subjects_unlinked: unlinked.count,
        curricula: deletedCurricula,
        modules: deletedModules,
        learningObjectives: deletedLOs,
        moduleProgress: deletedProgress,
      },
      domainName: domain.name,
    });
  } catch (error: unknown) {
    console.error("Demo content reset error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Reset failed" },
      { status: 500 },
    );
  }
}
