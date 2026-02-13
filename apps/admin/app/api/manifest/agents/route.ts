import { NextResponse } from "next/server";
import {
  loadManifest,
  addAgent,
  type AgentDefinition,
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
 * @api GET /api/manifest/agents
 * @visibility internal
 * @scope manifest:read
 * @auth session
 * @tags manifest
 * @description List all agents in the manifest with summary info (settings, schema, prompts, I/O counts)
 * @response 200 { ok: true, count: number, agents: AgentSummary[] }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();

    const manifest = loadManifest();
    const agents = manifest.agents || [];

    return NextResponse.json({
      ok: true,
      count: agents.length,
      agents: agents.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        enabled: a.enabled,
        opid: a.opid,
        hasSettings: !!a.settings && Object.keys(a.settings).length > 0,
        hasSchema: !!a.settingsSchema,
        hasPrompts: !!a.prompts && Object.keys(a.prompts).length > 0,
        inputCount: a.inputs?.length || 0,
        outputCount: a.outputs?.length || 0,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to list agents" },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/manifest/agents
 * @visibility internal
 * @scope manifest:write
 * @auth session
 * @tags manifest
 * @description Add a new agent definition to the manifest
 * @body agent object - Agent definition with required id, title, and opid fields
 * @response 200 { ok: true, message: "Agent added to manifest", agent: AgentDefinition }
 * @response 400 { ok: false, error: "agent object required" }
 * @response 400 { ok: false, error: "agent.id is required" }
 * @response 400 { ok: false, error: "agent.title is required" }
 * @response 400 { ok: false, error: "agent.opid is required" }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();

    const body = await req.json();
    const { agent } = body;

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: "agent object required" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!agent.id) {
      return NextResponse.json(
        { ok: false, error: "agent.id is required" },
        { status: 400 }
      );
    }
    if (!agent.title) {
      return NextResponse.json(
        { ok: false, error: "agent.title is required" },
        { status: 400 }
      );
    }
    if (!agent.opid) {
      return NextResponse.json(
        { ok: false, error: "agent.opid is required" },
        { status: 400 }
      );
    }

    // Set defaults
    const newAgent: AgentDefinition = {
      id: agent.id,
      agentId: agent.agentId || agent.id,
      title: agent.title,
      description: agent.description || "",
      enabled: agent.enabled ?? false,
      opid: agent.opid,
      inputs: agent.inputs || [],
      outputs: agent.outputs || [],
      resources: agent.resources || [],
      settings: agent.settings || {},
      settingsSchema: agent.settingsSchema,
      prompts: agent.prompts,
      prerequisites: agent.prerequisites,
    };

    const created = addAgent(newAgent);

    return NextResponse.json({
      ok: true,
      message: "Agent added to manifest",
      agent: created,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to add agent" },
      { status: 500 }
    );
  }
}
