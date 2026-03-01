/**
 * AI Config Inspector API
 *
 * Returns the effective resolved configuration for one or more call points,
 * with source annotations showing where each value comes from in the cascade:
 *   1. DB AIConfig (admin overrides via /x/ai-config)
 *   2. SystemSettings fallback
 *   3. call-points.ts compiled defaults
 *
 * @api GET /api/ai-config/inspect
 * @visibility internal
 * @scope ai-config:read
 * @auth session
 * @tags ai
 * @query callPoint string - Single call point to inspect (e.g. "content-trust.extract-comprehension")
 * @query category string - Inspect all call points in a category (e.g. "content-processing")
 * @response 200 { ok: true, inspections: [...] }
 * @response 400 { ok: false, error: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEntityAccess, isEntityAuthError } from "@/lib/access-control";
import { getAIModelConfigsFallback } from "@/lib/fallback-settings";
import { getCallPointDef, CALL_POINTS, type CallPointDef } from "@/lib/ai/call-points";

// =====================================================
// TYPES
// =====================================================

type ConfigSource = "db-override" | "system-settings" | "system-default";

interface SourceAnnotation {
  value: string | number | undefined;
  source: ConfigSource;
}

interface InspectionResult {
  callPoint: string;
  label: string;
  description: string;
  category: string;
  effective: {
    provider: string;
    model: string;
    temperature: number | undefined;
    maxTokens: number | undefined;
    timeoutMs: number | undefined;
  };
  sources: {
    provider: SourceAnnotation;
    model: SourceAnnotation;
    temperature: SourceAnnotation;
    maxTokens: SourceAnnotation;
    timeoutMs: SourceAnnotation;
  };
  cascade: Array<{
    level: ConfigSource;
    label: string;
    values: Record<string, string | number | undefined>;
  }>;
}

// =====================================================
// HELPERS
// =====================================================

async function inspectCallPoint(
  cp: CallPointDef,
  dbConfigs: Map<string, { provider: string; model: string; maxTokens: number | null; temperature: number | null; timeoutMs: number | null; isActive: boolean }>,
  settingsConfigs: Record<string, { provider: string; model: string; maxTokens?: number; temperature?: number }>,
): Promise<InspectionResult> {
  const dbConfig = dbConfigs.get(cp.id);
  const settingsConfig = settingsConfigs[cp.id];
  const defaultConfig = cp.defaults;

  // Resolve each parameter through the cascade
  function resolve(param: "provider" | "model" | "temperature" | "maxTokens" | "timeoutMs"): SourceAnnotation {
    // 1. DB override (highest priority)
    if (dbConfig?.isActive) {
      const dbVal = dbConfig[param as keyof typeof dbConfig] as string | number | null;
      if (dbVal != null) {
        return { value: dbVal, source: "db-override" };
      }
    }
    // 2. SystemSettings fallback (timeoutMs not in SystemSettings — skip)
    if (param !== "timeoutMs" && settingsConfig) {
      const ssVal = settingsConfig[param as keyof typeof settingsConfig] as string | number | undefined;
      if (ssVal != null) {
        return { value: ssVal, source: "system-settings" };
      }
    }
    // 3. Compiled default
    const defVal = defaultConfig[param as keyof typeof defaultConfig] as string | number | undefined;
    if (defVal != null) {
      return { value: defVal, source: "system-default" };
    }
    return { value: undefined, source: "system-default" };
  }

  const providerSource = resolve("provider");
  const modelSource = resolve("model");
  const temperatureSource = resolve("temperature");
  const maxTokensSource = resolve("maxTokens");
  const timeoutMsSource = resolve("timeoutMs");

  // Build cascade layers (only include layers that have values)
  const cascade: InspectionResult["cascade"] = [];

  // System default (always present)
  cascade.push({
    level: "system-default",
    label: "Compiled Default",
    values: {
      provider: defaultConfig.provider,
      model: defaultConfig.model,
      temperature: defaultConfig.temperature,
      maxTokens: defaultConfig.maxTokens,
      timeoutMs: defaultConfig.timeoutMs,
    },
  });

  // SystemSettings (only if it has entries for this call point)
  if (settingsConfig) {
    cascade.push({
      level: "system-settings",
      label: "System Settings",
      values: {
        provider: settingsConfig.provider,
        model: settingsConfig.model,
        temperature: settingsConfig.temperature,
        maxTokens: settingsConfig.maxTokens,
      },
    });
  }

  // DB override (only if exists and active)
  if (dbConfig?.isActive) {
    cascade.push({
      level: "db-override",
      label: "Admin Override",
      values: {
        provider: dbConfig.provider,
        model: dbConfig.model,
        temperature: dbConfig.temperature ?? undefined,
        maxTokens: dbConfig.maxTokens ?? undefined,
        timeoutMs: dbConfig.timeoutMs ?? undefined,
      },
    });
  }

  return {
    callPoint: cp.id,
    label: cp.label,
    description: cp.description,
    category: cp.category,
    effective: {
      provider: providerSource.value as string ?? defaultConfig.provider,
      model: modelSource.value as string ?? defaultConfig.model,
      temperature: temperatureSource.value as number | undefined,
      maxTokens: maxTokensSource.value as number | undefined,
      timeoutMs: timeoutMsSource.value as number | undefined,
    },
    sources: {
      provider: providerSource,
      model: modelSource,
      temperature: temperatureSource,
      maxTokens: maxTokensSource,
      timeoutMs: timeoutMsSource,
    },
    cascade,
  };
}

// =====================================================
// HANDLER
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireEntityAccess("ai_config", "R");
    if (isEntityAuthError(authResult)) return authResult.error;

    const { searchParams } = new URL(request.url);
    const callPoint = searchParams.get("callPoint");
    const category = searchParams.get("category");

    // Determine which call points to inspect
    let targets: CallPointDef[];
    if (callPoint) {
      const def = getCallPointDef(callPoint);
      if (!def) {
        return NextResponse.json({ ok: false, error: `Unknown call point: ${callPoint}` }, { status: 400 });
      }
      targets = [def];
    } else if (category) {
      targets = CALL_POINTS.filter((cp) => cp.category === category);
      if (targets.length === 0) {
        return NextResponse.json({ ok: false, error: `No call points in category: ${category}` }, { status: 400 });
      }
    } else {
      // All call points
      targets = CALL_POINTS;
    }

    // Load all cascade sources in parallel
    const [dbConfigs, settingsConfigs] = await Promise.all([
      prisma.aIConfig.findMany({ where: { isActive: true } }).then((rows) => {
        const map = new Map<string, typeof rows[0]>();
        for (const row of rows) map.set(row.callPoint, row);
        return map;
      }),
      getAIModelConfigsFallback(),
    ]);

    // Inspect each target
    const inspections = await Promise.all(
      targets.map((cp) => inspectCallPoint(cp, dbConfigs, settingsConfigs))
    );

    return NextResponse.json({ ok: true, inspections });
  } catch (error) {
    console.error("[ai-config/inspect] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to inspect AI configurations" },
      { status: 500 }
    );
  }
}
