/**
 * Figure-Assertion Linking
 *
 * After both images and assertions are extracted from a content source,
 * this module links them via the AssertionMedia junction table.
 *
 * Matching strategy (in priority order):
 * 1. Exact figureRef match: assertion.figureRefs contains "Figure 1.2" → MediaAsset.figureRef = "Figure 1.2"
 * 2. Normalized match: case/format insensitive ("Fig. 1.2" matches "figure 1.2")
 * 3. Page proximity: assertions with fig: tags on the same page as an extracted image
 */

import { prisma } from "@/lib/prisma";
import { normalizeFigureRef, type ExtractedImage } from "./extract-images";

export interface LinkResult {
  linked: number;
  unlinked: number;
  warnings: string[];
}

/**
 * Link extracted images to assertions that reference them.
 * Creates AssertionMedia junction records for matched pairs.
 */
export async function linkFiguresToAssertions(
  sourceId: string,
  extractedImages: ExtractedImage[],
): Promise<LinkResult> {
  const warnings: string[] = [];
  let linked = 0;
  let unlinked = 0;

  if (extractedImages.length === 0) {
    return { linked: 0, unlinked: 0, warnings: [] };
  }

  // Build a lookup map of normalized figureRef → mediaId
  const refToMedia = new Map<string, string>();
  const pageToMedia = new Map<number, string[]>();

  for (const img of extractedImages) {
    if (img.figureRef) {
      refToMedia.set(normalizeFigureRef(img.figureRef), img.mediaId);
    }
    if (img.pageNumber) {
      const existing = pageToMedia.get(img.pageNumber) || [];
      existing.push(img.mediaId);
      pageToMedia.set(img.pageNumber, existing);
    }
  }

  // Load assertions for this source that have figure references
  // Check both the new figureRefs column and existing fig: tags
  const assertions = await prisma.contentAssertion.findMany({
    where: {
      sourceId,
      OR: [
        { figureRefs: { isEmpty: false } },
        { tags: { hasSome: await getFigTags(sourceId) } },
      ],
    },
    select: {
      id: true,
      figureRefs: true,
      tags: true,
      pageRef: true,
    },
  });

  if (assertions.length === 0) {
    return { linked: 0, unlinked: extractedImages.length, warnings: [] };
  }

  for (const assertion of assertions) {
    // Collect figure refs from both sources
    const refs: string[] = [
      ...(assertion.figureRefs || []),
      ...assertion.tags
        .filter((t: string) => t.startsWith("fig:"))
        .map((t: string) => t.slice(4)),
    ];

    // Deduplicate
    const uniqueRefs = [...new Set(refs)];

    for (const ref of uniqueRefs) {
      const normalized = normalizeFigureRef(ref);

      // Strategy 1 & 2: Match by figure reference
      let mediaId = refToMedia.get(normalized);

      // Strategy 3: Match by page proximity if no ref match
      if (!mediaId && assertion.pageRef) {
        const pageNum = parseInt(assertion.pageRef.replace(/\D/g, ""), 10);
        if (pageNum && pageToMedia.has(pageNum)) {
          const candidates = pageToMedia.get(pageNum)!;
          if (candidates.length === 1) {
            mediaId = candidates[0];
          }
          // If multiple images on the same page, skip (ambiguous)
        }
      }

      if (mediaId) {
        try {
          await prisma.assertionMedia.upsert({
            where: {
              assertionId_mediaId: {
                assertionId: assertion.id,
                mediaId,
              },
            },
            create: {
              assertionId: assertion.id,
              mediaId,
              figureRef: ref,
            },
            update: {},
          });
          linked++;
        } catch (err: any) {
          warnings.push(`Failed to link assertion ${assertion.id} to media ${mediaId}: ${err.message}`);
        }
      }
    }
  }

  unlinked = extractedImages.length - new Set(
    await prisma.assertionMedia.findMany({
      where: { media: { sourceId } },
      select: { mediaId: true },
      distinct: ["mediaId"],
    }).then((rows) => rows.map((r) => r.mediaId)),
  ).size;

  return { linked, unlinked, warnings };
}

/**
 * Get all fig: tag values from assertions for a source.
 * Used to build the OR query for assertions with figure references.
 */
async function getFigTags(sourceId: string): Promise<string[]> {
  const assertions = await prisma.contentAssertion.findMany({
    where: { sourceId },
    select: { tags: true },
  });

  const figTags = new Set<string>();
  for (const a of assertions) {
    for (const tag of a.tags) {
      if (tag.startsWith("fig:")) {
        figTags.add(tag);
      }
    }
  }

  return Array.from(figTags);
}
