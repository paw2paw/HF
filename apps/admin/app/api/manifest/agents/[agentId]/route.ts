import { NextResponse } from "next/server";
import {
  getAgent,
  updateAgent,
  removeAgent,
} from "@/lib/manifest";
import { requireAuth, isAuthError } from "@/lib/permissions";

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
 * @api GET /api/manifest/agents/:agentId
 * @visibility internal
 * @scope manifest:read
 * @auth session
 * @tags manifest
 * @description Get a specific agent's full definition from the manifest
 * @pathParam agentId string - The agent identifier
 * @response 200 { ok: true, agent: AgentDefinition }
 * @response 404 { ok: false, error: "Agent not found: ..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api PUT /api/manifest/agents/:agentId
 * @visibility internal
 * @scope manifest:write
 * @auth session
 * @tags manifest
 * @description Replace an agent's definition in the manifest (cannot change agent ID)
 * @pathParam agentId string - The agent identifier
 * @body updates object - The updated agent fields
 * @response 200 { ok: true, message: "Agent updated in manifest", agent: AgentDefinition }
 * @response 400 { ok: false, error: "updates object required" }
 * @response 400 { ok: false, error: "Cannot change agent ID" }
 * @response 500 { ok: false, error: "..." }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api PATCH /api/manifest/agents/:agentId
 * @visibility internal
 * @scope manifest:write
 * @auth session
 * @tags manifest
 * @description Partial update - merge specific fields (settings, schema, prompts, inputs, outputs, etc.)
 * @pathParam agentId string - The agent identifier
 * @body settings object - Settings to merge
 * @body settingsSchema object - Schema properties to merge
 * @body prompts object - Prompts to merge
 * @body inputs array - Input definitions (replaces)
 * @body outputs array - Output definitions (replaces)
 * @body title string - New title
 * @body description string - New description
 * @body enabled boolean - Enable/disable
 * @body opid string - New operation ID
 * @response 200 { ok: true, message: "Agent patched in manifest", agent: AgentDefinition }
 * @response 404 { ok: false, error: "Agent not found: ..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
 * @api DELETE /api/manifest/agents/:agentId
 * @visibility internal
 * @scope manifest:write
 * @auth session
 * @tags manifest
 * @description Remove an agent from the manifest
 * @pathParam agentId string - The agent identifier
 * @response 200 { ok: true, message: "Agent removed from manifest", agentId: string }
 * @response 404 { ok: false, error: "Agent not found: ..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

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
