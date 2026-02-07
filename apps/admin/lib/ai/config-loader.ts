/**
 * AI Configuration Loader
 *
 * Loads AI configuration from the database for a given call point.
 * Used by the AI client to determine which provider/model to use.
 */

import { prisma } from "@/lib/prisma";
import type { AIEngine } from "./client";

// =====================================================
// TYPES
// =====================================================

export interface AIConfigResult {
  provider: AIEngine;
  model: string;
  maxTokens?: number;
  temperature?: number;
  isCustomized: boolean;
}

// Default configurations per call point
// These match the definitions in /api/ai-config/route.ts
const DEFAULT_CONFIGS: Record<string, { provider: AIEngine; model: string }> = {
  "pipeline.measure": { provider: "claude", model: "claude-sonnet-4-20250514" },
  "pipeline.learn": { provider: "claude", model: "claude-sonnet-4-20250514" },
  "pipeline.score_agent": { provider: "claude", model: "claude-sonnet-4-20250514" },
  "pipeline.adapt": { provider: "claude", model: "claude-sonnet-4-20250514" },
  "compose.prompt": { provider: "claude", model: "claude-sonnet-4-20250514" },
  "analysis.measure": { provider: "claude", model: "claude-3-haiku-20240307" },
  "analysis.learn": { provider: "claude", model: "claude-3-haiku-20240307" },
  "parameter.enrich": { provider: "claude", model: "claude-3-haiku-20240307" },
  "bdd.parse": { provider: "claude", model: "claude-sonnet-4-20250514" },
  "chat.stream": { provider: "claude", model: "claude-sonnet-4-20250514" },
};

// In-memory cache with TTL
let configCache: Map<string, { config: AIConfigResult; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute cache

// =====================================================
// LOADER FUNCTION
// =====================================================

/**
 * Get AI configuration for a call point.
 * Loads from database (with caching) and falls back to defaults.
 *
 * @param callPoint - The call point identifier (e.g., "pipeline.measure")
 * @returns The configuration to use for this call point
 */
export async function getAIConfig(callPoint: string): Promise<AIConfigResult> {
  // Check cache first
  const cached = configCache.get(callPoint);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  // Load from database
  try {
    const dbConfig = await prisma.aIConfig.findUnique({
      where: { callPoint },
    });

    if (dbConfig && dbConfig.isActive) {
      const result: AIConfigResult = {
        provider: dbConfig.provider as AIEngine,
        model: dbConfig.model,
        maxTokens: dbConfig.maxTokens ?? undefined,
        temperature: dbConfig.temperature ?? undefined,
        isCustomized: true,
      };

      // Cache the result
      configCache.set(callPoint, { config: result, fetchedAt: Date.now() });
      return result;
    }
  } catch (error) {
    // Log but don't fail - fall back to defaults
    console.warn(`[ai-config] Failed to load config for ${callPoint}:`, error);
  }

  // Fall back to defaults
  const defaultConfig = DEFAULT_CONFIGS[callPoint];
  if (defaultConfig) {
    const result: AIConfigResult = {
      ...defaultConfig,
      isCustomized: false,
    };
    configCache.set(callPoint, { config: result, fetchedAt: Date.now() });
    return result;
  }

  // Ultimate fallback
  return {
    provider: "claude",
    model: "claude-sonnet-4-20250514",
    isCustomized: false,
  };
}

/**
 * Clear the configuration cache.
 * Call this when configurations are updated.
 */
export function clearAIConfigCache(): void {
  configCache.clear();
}

/**
 * Preload all configurations into cache.
 * Useful for warming up at startup.
 */
export async function preloadAIConfigs(): Promise<void> {
  try {
    const allConfigs = await prisma.aIConfig.findMany({
      where: { isActive: true },
    });

    for (const config of allConfigs) {
      const result: AIConfigResult = {
        provider: config.provider as AIEngine,
        model: config.model,
        maxTokens: config.maxTokens ?? undefined,
        temperature: config.temperature ?? undefined,
        isCustomized: true,
      };
      configCache.set(config.callPoint, { config: result, fetchedAt: Date.now() });
    }

    // Also cache defaults for unconfigured call points
    for (const [callPoint, defaultConfig] of Object.entries(DEFAULT_CONFIGS)) {
      if (!configCache.has(callPoint)) {
        configCache.set(callPoint, {
          config: { ...defaultConfig, isCustomized: false },
          fetchedAt: Date.now(),
        });
      }
    }
  } catch (error) {
    console.warn("[ai-config] Failed to preload configs:", error);
  }
}
