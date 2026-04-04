/**
 * Offboarding Transform
 *
 * When `isFinalSession` is true, emits structured offboarding guidance
 * instructing the AI to summarise the learning journey, invite reflection,
 * and suggest next steps for continued learning.
 *
 * When `isFinalSession` is false, returns null (no-op).
 */

import { registerTransform } from "../TransformRegistry";
import type { AssembledContext } from "../types";

export interface OffboardingOutput {
  isFinalSession: true;
  guidance: string[];
}

registerTransform("computeOffboarding", (
  _rawData: unknown,
  context: AssembledContext,
): OffboardingOutput | null => {
  const { isFinalSession } = context.sharedState;

  if (!isFinalSession) {
    return null;
  }

  return {
    isFinalSession: true,
    guidance: [
      "This is the learner's final session.",
      "Summarise their learning journey — reference specific topics covered and progress made.",
      "Invite reflection on what they have achieved and how their understanding has grown.",
      "Suggest concrete next steps for continued learning beyond this course.",
      "End on an encouraging note that reinforces their capability to continue independently.",
    ],
  };
});
