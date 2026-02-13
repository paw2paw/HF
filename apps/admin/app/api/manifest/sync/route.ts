import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { loadManifest, validateManifest } from "@/lib/manifest";
import crypto from "crypto";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

const prisma = new PrismaClient();

function assertLocalOnly() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Manifest Sync API is disabled in production");
  }
  if (process.env.HF_OPS_ENABLED !== "true") {
    throw new Error("Manifest Sync API is disabled (set HF_OPS_ENABLED=true)");
  }
}

function computeSettingsHash(settings: Record<string, unknown>): string {
  const json = JSON.stringify(settings, Object.keys(settings).sort());
  return crypto.createHash("sha256").update(json).digest("hex").substring(0, 16);
}

/**
 * @api GET /api/manifest/sync
 * @visibility internal
 * @scope manifest:read
 * @auth session
 * @tags manifest
 * @description Preview sync: compare manifest agents with DB AgentInstances, showing what needs syncing
 * @response 200 { ok: true, validation, comparison, summary: { total, needsSync, orphaned, outOfSync, synced } }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();

    const manifest = loadManifest(true);
    const validation = validateManifest(manifest);

    // Get all DB instances
    const dbInstances = await prisma.agentInstance.findMany({
      where: {
        status: { in: ["DRAFT", "PUBLISHED"] },
      },
      orderBy: { agentId: "asc" },
    });

    const dbByAgentId = new Map<string, typeof dbInstances[0]>();
    for (const inst of dbInstances) {
      // Prefer published over draft
      const existing = dbByAgentId.get(inst.agentId);
      if (!existing || inst.status === "PUBLISHED") {
        dbByAgentId.set(inst.agentId, inst);
      }
    }

    // Compare
    const comparison: Array<{
      agentId: string;
      title: string;
      inManifest: boolean;
      inDb: boolean;
      manifestSettings: Record<string, unknown> | null;
      dbSettings: Record<string, unknown> | null;
      settingsMatch: boolean;
      dbStatus: string | null;
      dbVersion: string | null;
    }> = [];

    // Agents in manifest
    for (const agent of manifest.agents || []) {
      const dbInst = dbByAgentId.get(agent.id);
      const manifestSettings = agent.settings || {};
      const dbSettings = (dbInst?.settings as Record<string, unknown>) || null;

      let settingsMatch = false;
      if (dbSettings) {
        const manifestHash = computeSettingsHash(manifestSettings);
        const dbHash = computeSettingsHash(dbSettings);
        settingsMatch = manifestHash === dbHash;
      }

      comparison.push({
        agentId: agent.id,
        title: agent.title,
        inManifest: true,
        inDb: !!dbInst,
        manifestSettings,
        dbSettings,
        settingsMatch,
        dbStatus: dbInst?.status || null,
        dbVersion: dbInst?.version || null,
      });

      dbByAgentId.delete(agent.id);
    }

    // Agents only in DB (orphaned)
    for (const [agentId, dbInst] of dbByAgentId) {
      comparison.push({
        agentId,
        title: dbInst.name || agentId,
        inManifest: false,
        inDb: true,
        manifestSettings: null,
        dbSettings: dbInst.settings as Record<string, unknown>,
        settingsMatch: false,
        dbStatus: dbInst.status,
        dbVersion: dbInst.version,
      });
    }

    // Summary
    const needsSync = comparison.filter((c) => c.inManifest && !c.inDb);
    const orphaned = comparison.filter((c) => !c.inManifest && c.inDb);
    const outOfSync = comparison.filter((c) => c.inManifest && c.inDb && !c.settingsMatch);

    return NextResponse.json({
      ok: true,
      validation,
      comparison,
      summary: {
        total: comparison.length,
        needsSync: needsSync.length,
        orphaned: orphaned.length,
        outOfSync: outOfSync.length,
        synced: comparison.filter((c) => c.inManifest && c.inDb && c.settingsMatch).length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to compare sync status" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * @api POST /api/manifest/sync
 * @visibility internal
 * @scope manifest:write
 * @auth session
 * @tags manifest
 * @description Execute sync between manifest and DB: bootstrap new agents, reset to defaults, or cleanup orphans
 * @body action string - Sync action: "bootstrap" | "reset" | "cleanup" (default: "bootstrap")
 * @body agentIds string[] - Optional filter to only sync specific agent IDs
 * @response 200 { ok: true, action, results, summary: { total, created, reset, archived, skipped } }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    assertLocalOnly();

    const body = await req.json().catch(() => ({}));
    const action = body.action || "bootstrap";
    const agentIds = body.agentIds as string[] | undefined; // Optional filter

    const manifest = loadManifest(true);
    const results: Array<{
      agentId: string;
      action: string;
      success: boolean;
      message: string;
    }> = [];

    if (action === "bootstrap") {
      // Create DRAFT instances for agents not yet in DB
      for (const agent of manifest.agents || []) {
        if (agentIds && !agentIds.includes(agent.id)) continue;

        const existing = await prisma.agentInstance.findFirst({
          where: {
            agentId: agent.id,
            status: { in: ["DRAFT", "PUBLISHED"] },
          },
        });

        if (existing) {
          results.push({
            agentId: agent.id,
            action: "skip",
            success: true,
            message: `Already exists (${existing.status} ${existing.version})`,
          });
          continue;
        }

        const settings = (agent.settings || {}) as Record<string, unknown>;
        const settingsHash = computeSettingsHash(settings);

        await prisma.agentInstance.create({
          data: {
            agentId: agent.id,
            name: agent.title,
            description: agent.description || null,
            version: "v1.0",
            status: "DRAFT",
            settings: settings as Prisma.JsonObject,
            settingsHash,
          },
        });

        results.push({
          agentId: agent.id,
          action: "created",
          success: true,
          message: "Created DRAFT v1.0 from manifest defaults",
        });
      }
    }

    if (action === "reset") {
      // Reset DB settings to manifest defaults
      for (const agent of manifest.agents || []) {
        if (agentIds && !agentIds.includes(agent.id)) continue;

        const existing = await prisma.agentInstance.findFirst({
          where: {
            agentId: agent.id,
            status: { in: ["DRAFT", "PUBLISHED"] },
          },
          orderBy: { status: "asc" }, // DRAFT before PUBLISHED
        });

        if (!existing) {
          // Create if not exists
          const settings = (agent.settings || {}) as Record<string, unknown>;
          const settingsHash = computeSettingsHash(settings);

          await prisma.agentInstance.create({
            data: {
              agentId: agent.id,
              name: agent.title,
              description: agent.description || null,
              version: "v1.0",
              status: "DRAFT",
              settings: settings as Prisma.JsonObject,
              settingsHash,
            },
          });

          results.push({
            agentId: agent.id,
            action: "created",
            success: true,
            message: "Created DRAFT v1.0 from manifest defaults",
          });
          continue;
        }

        // Update existing
        const settings = (agent.settings || {}) as Record<string, unknown>;
        const settingsHash = computeSettingsHash(settings);

        await prisma.agentInstance.update({
          where: { id: existing.id },
          data: {
            name: agent.title,
            description: agent.description || null,
            settings: settings as Prisma.JsonObject,
            settingsHash,
            updatedAt: new Date(),
          },
        });

        results.push({
          agentId: agent.id,
          action: "reset",
          success: true,
          message: `Reset ${existing.status} ${existing.version} to manifest defaults`,
        });
      }
    }

    if (action === "cleanup") {
      // Archive orphaned DB instances
      const manifestAgentIds = new Set((manifest.agents || []).map((a) => a.id));

      const orphaned = await prisma.agentInstance.findMany({
        where: {
          status: { in: ["DRAFT", "PUBLISHED"] },
          agentId: { notIn: Array.from(manifestAgentIds) },
        },
      });

      for (const inst of orphaned) {
        if (agentIds && !agentIds.includes(inst.agentId)) continue;

        await prisma.agentInstance.update({
          where: { id: inst.id },
          data: { status: "ARCHIVED" },
        });

        results.push({
          agentId: inst.agentId,
          action: "archived",
          success: true,
          message: `Archived ${inst.status} ${inst.version} (not in manifest)`,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      results,
      summary: {
        total: results.length,
        created: results.filter((r) => r.action === "created").length,
        reset: results.filter((r) => r.action === "reset").length,
        archived: results.filter((r) => r.action === "archived").length,
        skipped: results.filter((r) => r.action === "skip").length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to sync" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
