import { prisma } from "@/lib/prisma";
import { updateCurriculumProgress } from "@/lib/curriculum/track-progress";

/**
 * Initialize lesson plan session tracking after onboarding is complete (or skipped).
 * Finds the first non-onboarding session entry in the Subject's curriculum lesson plan
 * and sets the caller's currentSession attribute to that session number.
 *
 * Extracted from trackOnboardingAfterCall in the pipeline route so both
 * the pipeline and the caller creation route can reuse it.
 */
export async function initializeLessonPlanSession(
  callerId: string,
  domainId: string,
): Promise<{ initialized: boolean; specSlug?: string; session?: number }> {
  const subjectDomains = await prisma.subjectDomain.findMany({
    where: { domainId },
    include: {
      subject: {
        include: {
          curricula: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { slug: true, deliveryConfig: true },
          },
        },
      },
    },
  });

  for (const sd of subjectDomains) {
    const curriculum = sd.subject.curricula[0];
    if (!curriculum) continue;

    const dc = curriculum.deliveryConfig as Record<string, any> | null;
    const lessonPlan = dc?.lessonPlan;
    if (!lessonPlan?.entries?.length || lessonPlan.entries.length < 2) continue;

    // Find first non-onboarding session number
    const firstLessonEntry = lessonPlan.entries.find((e: any) => e.type !== "onboarding");
    const firstLessonSession = firstLessonEntry?.session ?? 2;

    await updateCurriculumProgress(callerId, curriculum.slug, {
      currentSession: firstLessonSession,
      lastAccessedAt: new Date(),
    });

    return { initialized: true, specSlug: curriculum.slug, session: firstLessonSession };
  }

  return { initialized: false };
}
