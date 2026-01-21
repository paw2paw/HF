import { NextResponse } from "next/server";
import {
  loadManifest,
  addAgent,
  type AgentDefinition,
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
 * GET /api/manifest/agents
 *
 * List all agents in the manifest
 */
export async function GET() {
  try {
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
 * POST /api/manifest/agents
 *
 * Add a new agent to the manifest
 */
export async function POST(req: Request) {
  try {
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
