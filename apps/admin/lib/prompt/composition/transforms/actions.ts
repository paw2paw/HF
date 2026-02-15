/**
 * Actions Transform
 *
 * Formats open call actions for inclusion in the voice prompt.
 * The AI agent sees pending actions and can:
 * - Check if the learner completed homework
 * - Fulfill promises it made last time
 * - Reference operator tasks if asked
 */

import { registerTransform } from "../TransformRegistry";
import type { OpenActionData } from "../types";

registerTransform("formatActions", (_rawData, context) => {
  const actions = context.loadedData.openActions;
  if (!actions || actions.length === 0) return null;

  const lines = (actions as OpenActionData[]).map((a) => {
    const assigneeLabel = a.assignee === "AGENT" ? "You" : a.assignee === "CALLER" ? "Learner" : "Operator";
    const dateStr = formatDate(a.createdAt);
    const dueStr = a.dueAt ? `, due ${formatDate(a.dueAt)}` : "";
    const desc = a.description ? ` — ${a.description}` : "";
    return `- [${a.type.replace(/_/g, " ")} / ${assigneeLabel}] ${a.title}${desc} (assigned ${dateStr}${dueStr})`;
  });

  return {
    header: "Open Actions",
    intro: "From previous conversations, the following actions are pending:",
    items: lines,
    guidance: [
      "For Learner actions: ask if they have completed them and acknowledge progress.",
      "For You (Agent) actions: fulfill these during this conversation if relevant.",
      "For Operator actions: if the learner asks, confirm the request has been made.",
    ],
    count: actions.length,
  };
});

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
