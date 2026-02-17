/**
 * Chat API Tool Definitions and Handlers
 *
 * Tools available to the AI during sim chat conversations.
 * The share_content tool allows the AI to proactively share teaching materials.
 */

import { prisma } from "@/lib/prisma";
import type { AITool, AIToolUse } from "@/lib/ai/client";

// =====================================================
// TOOL DEFINITIONS
// =====================================================

export const CHAT_TOOLS: AITool[] = [
  {
    name: "share_content",
    description:
      "Share a teaching document, image, or audio file with the learner during the conversation. " +
      "Use this when referencing visual materials, comprehension passages, diagrams, worksheets, or exercises. " +
      "The content will appear inline in the chat for the learner to view.",
    input_schema: {
      type: "object",
      properties: {
        media_id: {
          type: "string",
          description: "ID of the media asset to share (from the available teaching materials list)",
        },
        context: {
          type: "string",
          description: "Brief message to show alongside the content (e.g. 'Here is the passage we will work through')",
        },
      },
      required: ["media_id"],
    },
  },
];

// =====================================================
// TOOL HANDLERS
// =====================================================

export interface ToolContext {
  callerId: string;
  callId: string;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/**
 * Execute a tool call and return the result.
 */
export async function executeToolCall(
  toolUse: AIToolUse,
  ctx: ToolContext
): Promise<ToolResult> {
  switch (toolUse.name) {
    case "share_content":
      return handleShareContent(toolUse, ctx);
    default:
      return {
        tool_use_id: toolUse.id,
        content: `Unknown tool: ${toolUse.name}`,
        is_error: true,
      };
  }
}

async function handleShareContent(
  toolUse: AIToolUse,
  ctx: ToolContext
): Promise<ToolResult> {
  const { media_id, context } = toolUse.input as { media_id: string; context?: string };

  // Validate media exists
  const media = await prisma.mediaAsset.findUnique({
    where: { id: media_id },
    select: { id: true, fileName: true, title: true, mimeType: true },
  });

  if (!media) {
    return {
      tool_use_id: toolUse.id,
      content: `Media asset "${media_id}" not found. Share a different resource or continue without it.`,
      is_error: true,
    };
  }

  // Create a CallMessage with media attachment
  await prisma.callMessage.create({
    data: {
      callId: ctx.callId,
      role: "assistant",
      content: context || media.title || media.fileName,
      mediaId: media.id,
    },
  });

  return {
    tool_use_id: toolUse.id,
    content: `Successfully shared "${media.title || media.fileName}" (${media.mimeType}) with the learner. It will appear as an image/document in their chat. Continue the conversation naturally — reference the content you just shared.`,
  };
}

// =====================================================
// CONTENT CATALOG FOR SYSTEM PROMPT
// =====================================================

/**
 * Build a list of available teaching materials for the system prompt.
 * Loaded from the caller's domain subjects.
 *
 * For first calls, annotates media with phase assignments from the domain's
 * onboardingFlowPhases config (phases[].content[].mediaId).
 */
export async function buildContentCatalog(callerId: string): Promise<string | null> {
  const caller = await prisma.caller.findUnique({
    where: { id: callerId },
    select: {
      domainId: true,
      domain: {
        select: {
          onboardingFlowPhases: true,
          subjects: { select: { subjectId: true } },
        },
      },
    },
  });

  if (!caller?.domain) return null;

  const subjectIds = caller.domain.subjects.map((s) => s.subjectId);
  if (subjectIds.length === 0) return null;

  const items = await prisma.subjectMedia.findMany({
    where: { subjectId: { in: subjectIds } },
    include: {
      media: {
        select: { id: true, fileName: true, mimeType: true, title: true, description: true, tags: true },
      },
    },
    orderBy: { sortOrder: "asc" },
    take: 30,
  });

  if (items.length === 0) return null;

  // Check if this is a first call in the domain (no onboarding session or incomplete)
  let isFirstCallInDomain = false;
  if (caller.domainId) {
    const onboardingSession = await prisma.onboardingSession.findUnique({
      where: { callerId_domainId: { callerId, domainId: caller.domainId } },
      select: { isComplete: true },
    });
    isFirstCallInDomain = !onboardingSession || !onboardingSession.isComplete;
  }

  // Build phase→mediaId mapping from onboarding flow config
  const phaseMediaMap = new Map<string, { phase: string; instruction?: string }>();
  if (isFirstCallInDomain && caller.domain.onboardingFlowPhases) {
    const flowConfig = caller.domain.onboardingFlowPhases as { phases?: Array<{ phase: string; content?: Array<{ mediaId: string; instruction?: string }> }> };
    for (const phase of flowConfig.phases || []) {
      for (const ref of phase.content || []) {
        phaseMediaMap.set(ref.mediaId, { phase: phase.phase, instruction: ref.instruction });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    if (seen.has(i.media.id)) return false;
    seen.add(i.media.id);
    return true;
  });

  const lines = unique.map((item) => {
    const m = item.media;
    const typeLabel = m.mimeType.startsWith("image/") ? "Image" : m.mimeType === "application/pdf" ? "PDF" : m.mimeType.startsWith("audio/") ? "Audio" : "File";
    const desc = m.description ? ` — ${m.description.slice(0, 80)}` : "";
    const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
    const phaseRef = phaseMediaMap.get(m.id);
    const phaseHint = phaseRef ? ` | SHARE DURING: "${phaseRef.phase}" phase${phaseRef.instruction ? ` — ${phaseRef.instruction}` : ""}` : "";
    return `- "${m.title || m.fileName}" (ID: ${m.id}) — ${typeLabel}${desc}${tags}${phaseHint}`;
  });

  let instructions = "When discussing content that has a visual component (passage, diagram, worksheet), share it proactively using share_content. After sharing, reference the content naturally (e.g. \"Take a look at the passage I just sent you\").";

  if (phaseMediaMap.size > 0) {
    instructions += "\n\nIMPORTANT: Items marked with \"SHARE DURING\" are assigned to specific onboarding phases. Share them at the indicated point in the session flow.";
  }

  return `\n## Available Teaching Materials\nYou can share these with the learner using the share_content tool:\n${lines.join("\n")}\n\n${instructions}`;
}
