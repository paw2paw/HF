/**
 * Visual Aids Transform
 *
 * Formats extracted images/figures for inclusion in the voice prompt.
 * The AI uses this list to:
 * - Describe diagrams verbally during voice calls
 * - Share images via share_content tool during sim sessions
 */

import { registerTransform } from "../TransformRegistry";
import type { VisualAidData } from "../types";

registerTransform("formatVisualAids", (rawData) => {
  const aids = rawData as VisualAidData[] | null;
  if (!aids || aids.length === 0) return null;

  const available = aids.map((a) => ({
    mediaId: a.mediaId,
    fileName: a.fileName,
    captionText: a.captionText,
    figureRef: a.figureRef,
    chapter: a.chapter,
  }));

  return {
    hasVisualAids: true,
    count: available.length,
    available,
  };
});
