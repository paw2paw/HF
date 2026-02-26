import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  LAYER_0_TABLES,
  LAYER_1_TABLES,
  LAYER_2_TABLES,
  LAYER_3_TABLES,
  SKIPPED_TABLES,
  getTableName,
} from "@/lib/snapshots/snapshot-config";

/**
 * @api GET /api/admin/entity-counts
 * @visibility internal
 * @scope admin:read
 * @auth session (ADMIN+)
 * @tags admin, data-management
 * @description Returns row counts for all entity tables across all layers.
 * @response 200 { ok: true, entities: EntityCount[], totals: { runtime: number, config: number } }
 * @response 500 { ok: false, error: "..." }
 */

interface EntityCount {
  name: string;
  layer: number | "skip";
  count: number;
}

// Build the full table list with layer info
const TABLE_LAYERS: Array<{ name: string; layer: number | "skip" }> = [
  ...(LAYER_0_TABLES as readonly string[]).map((t) => ({ name: t, layer: 0 as const })),
  ...(LAYER_1_TABLES as readonly string[]).map((t) => ({ name: t, layer: 1 as const })),
  ...(LAYER_2_TABLES as readonly string[]).map((t) => ({ name: t, layer: 2 as const })),
  ...(LAYER_3_TABLES as readonly string[]).map((t) => ({ name: t, layer: 3 as const })),
  ...(SKIPPED_TABLES as readonly string[]).map((t) => ({
    name: t,
    layer: "skip" as const,
  })),
];

export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    // Run all COUNT queries in parallel for speed
    const countPromises = TABLE_LAYERS.map(async ({ name, layer }) => {
      const pgTable = getTableName(name);
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM "${pgTable}"`
        );
        return {
          name,
          layer,
          count: Number(result[0]?.count ?? 0),
        };
      } catch {
        // Table might not exist (model removed but not migrated)
        return { name, layer, count: -1 };
      }
    });

    const entities = await Promise.all(countPromises);

    // Filter out tables that returned -1 (don't exist)
    const validEntities = entities.filter((e) => e.count >= 0);

    // Calculate totals
    const runtimeTotal = validEntities
      .filter((e) => e.layer === 3 || e.layer === "skip")
      .reduce((sum, e) => sum + e.count, 0);
    const configTotal = validEntities
      .filter((e) => e.layer === 0 || e.layer === 1 || e.layer === 2)
      .reduce((sum, e) => sum + e.count, 0);

    return NextResponse.json({
      ok: true,
      entities: validEntities,
      totals: { runtime: runtimeTotal, config: configTotal },
    });
  } catch (error: any) {
    console.error("Error fetching entity counts:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to fetch entity counts" },
      { status: 500 }
    );
  }
}
