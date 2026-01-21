import { NextResponse } from "next/server";
import {
  getAgent,
  updateAgent,
  removeAgent,
} from "@/lib/manifest";

export const runtime = "nodejs";

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Manifest API is disabled in production");
  }
  if (process.env.HF_OPS_ENABLED !== "true") {
    throw new Error("Manifest API is disabled (set HF_OPS_ENABLED=true)");
  }
}

/**
 * GET /api/manifest/agents/[agentId]
 *
 * Get a specific agent's full definition from manifest
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    assertLocalOnly();
    const { agentId } = await params;

    const agent = getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      agent,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to get agent" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/manifest/agents/[agentId]
 *
 * Update an agent's definition in the manifest
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    assertLocalOnly();
    const { agentId } = await params;

    const body = await req.json();
    const { updates } = body;

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { ok: false, error: "updates object required" },
        { status: 400 }
      );
    }

    // Don't allow changing the ID
    if (updates.id && updates.id !== agentId) {
      return NextResponse.json(
        { ok: false, error: "Cannot change agent ID" },
        { status: 400 }
      );
    }

    const updated = updateAgent(agentId, updates);

    return NextResponse.json({
      ok: true,
      message: "Agent updated in manifest",
      agent: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to update agent" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/manifest/agents/[agentId]
 *
 * Partial update - merge specific fields
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    assertLocalOnly();
    const { agentId } = await params;

    const body = await req.json();

    // Get current agent
    const current = getAgent(agentId);
    if (!current) {
      return NextResponse.json(
        { ok: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      );
    }

    // Merge settings if provided
    const updates: Record<string, unknown> = {};

    if (body.settings) {
      updates.settings = { ...(current.settings || {}), ...body.settings };
    }
    if (body.settingsSchema) {
      const currentSchema = current.settingsSchema || { type: "object", properties: {} };
      updates.settingsSchema = {
        ...currentSchema,
        properties: {
          ...(currentSchema.properties || {}),
          ...(body.settingsSchema.properties || {}),
        },
      };
    }
    if (body.prompts) {
      updates.prompts = { ...(current.prompts || {}), ...body.prompts };
    }
    if (body.inputs) {
      updates.inputs = body.inputs;
    }
    if (body.outputs) {
      updates.outputs = body.outputs;
    }
    if (body.prerequisites) {
      updates.prerequisites = body.prerequisites;
    }
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.opid !== undefined) updates.opid = body.opid;

    const updated = updateAgent(agentId, updates);

    return NextResponse.json({
      ok: true,
      message: "Agent patched in manifest",
      agent: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to patch agent" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/manifest/agents/[agentId]
 *
 * Remove an agent from the manifest
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    assertLocalOnly();
    const { agentId } = await params;

    const removed = removeAgent(agentId);

    if (!removed) {
      return NextResponse.json(
        { ok: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Agent removed from manifest",
      agentId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to remove agent" },
      { status: 500 }
    );
  }
}
