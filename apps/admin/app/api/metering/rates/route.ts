/**
 * /api/metering/rates
 *
 * GET: List all cost rates (DB + defaults)
 * POST: Create or update a cost rate
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthError } from "@/lib/permissions";
import { UsageCategory } from "@prisma/client";
import { getDefaultRates, clearRateCache } from "@/lib/metering/cost-config";

export const runtime = "nodejs";

/**
 * @api GET /api/metering/rates
 * @visibility internal
 * @scope metering:read
 * @auth session
 * @tags metering
 * @description List all cost rates merged from database entries and defaults
 * @response 200 { ok: true, rates: CostRate[], dbRatesCount: number, defaultRatesCount: number }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("VIEWER");
    if (isAuthError(authResult)) return authResult.error;

    // Get database rates
    const dbRates = await prisma.usageCostRate.findMany({
      where: {
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
      },
      orderBy: [{ category: "asc" }, { operation: "asc" }],
    });

    // Get default rates
    const defaultRates = getDefaultRates();

    // Merge: DB rates override defaults
    const mergedRates: Array<{
      category: string;
      operation: string | null;
      costPerUnit: number;
      unitType: string;
      description: string | null;
      source: "database" | "default";
      effectiveFrom?: Date;
      effectiveUntil?: Date | null;
      id?: string;
    }> = [];

    // Add default rates first
    for (const [key, rate] of Object.entries(defaultRates)) {
      const [category, operation] = key.split(":");
      mergedRates.push({
        category,
        operation: operation || null,
        costPerUnit: rate.costPerUnit,
        unitType: rate.unitType,
        description: rate.description,
        source: "default",
      });
    }

    // Add/override with DB rates
    for (const dbRate of dbRates) {
      const existingIndex = mergedRates.findIndex(
        (r) => r.category === dbRate.category && r.operation === dbRate.operation
      );

      const rateEntry = {
        id: dbRate.id,
        category: dbRate.category,
        operation: dbRate.operation,
        costPerUnit: dbRate.costPerUnit,
        unitType: dbRate.unitType,
        description: dbRate.description,
        source: "database" as const,
        effectiveFrom: dbRate.effectiveFrom,
        effectiveUntil: dbRate.effectiveUntil,
      };

      if (existingIndex >= 0) {
        mergedRates[existingIndex] = rateEntry;
      } else {
        mergedRates.push(rateEntry);
      }
    }

    return NextResponse.json({
      ok: true,
      rates: mergedRates,
      dbRatesCount: dbRates.length,
      defaultRatesCount: Object.keys(defaultRates).length,
    });
  } catch (error: unknown) {
    console.error("[metering/rates] GET Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch rates",
      },
      { status: 500 }
    );
  }
}

/**
 * @api POST /api/metering/rates
 * @visibility internal
 * @scope metering:read
 * @auth session
 * @tags metering
 * @description Create or update a cost rate (expires existing rate and creates new one)
 * @body category string - Usage category (AI, DATABASE, COMPUTE, STORAGE, EXTERNAL)
 * @body operation string - Optional operation name
 * @body costPerUnit number - Cost per unit in cents
 * @body unitType string - Unit type (e.g. "tokens", "bytes")
 * @body description string - Optional description
 * @response 200 { ok: true, rate: UsageCostRate, previousRateExpired: boolean }
 * @response 400 { ok: false, error: "category, costPerUnit, and unitType are required" }
 * @response 400 { ok: false, error: "Invalid category..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const body = await request.json();

    const { category, operation, costPerUnit, unitType, description } = body;

    // Validate required fields
    if (!category || costPerUnit === undefined || !unitType) {
      return NextResponse.json(
        { ok: false, error: "category, costPerUnit, and unitType are required" },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: UsageCategory[] = [
      "AI",
      "DATABASE",
      "COMPUTE",
      "STORAGE",
      "EXTERNAL",
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { ok: false, error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Find existing active rate
    const existingRate = await prisma.usageCostRate.findFirst({
      where: {
        category,
        operation: operation || null,
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
      },
    });

    // If exists, expire it and create new one
    if (existingRate) {
      await prisma.usageCostRate.update({
        where: { id: existingRate.id },
        data: { effectiveUntil: new Date() },
      });
    }

    // Create new rate
    const newRate = await prisma.usageCostRate.create({
      data: {
        category,
        operation: operation || null,
        costPerUnit,
        unitType,
        description,
        effectiveFrom: new Date(),
      },
    });

    // Clear rate cache so new rate takes effect
    clearRateCache();

    return NextResponse.json({
      ok: true,
      rate: newRate,
      previousRateExpired: !!existingRate,
    });
  } catch (error: unknown) {
    console.error("[metering/rates] POST Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save rate",
      },
      { status: 500 }
    );
  }
}
