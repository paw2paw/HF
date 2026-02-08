/**
 * Centralized Configuration
 *
 * Single source of truth for all environment variables.
 * - Validates required vars on first access
 * - Provides typed access with sensible defaults
 * - Fails fast if critical config is missing
 *
 * Usage:
 *   import { config } from '@/lib/config';
 *   const url = config.database.url;
 *   const model = config.ai.openai.model;
 */

// =============================================================================
// Helpers
// =============================================================================

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `See .env.example for configuration options.`
    );
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

function optionalInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid integer for ${name}: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function optionalFloat(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    console.warn(`Invalid float for ${name}: "${value}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function optionalBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

// =============================================================================
// Configuration Object
// =============================================================================

export const config = {
  // ---------------------------------------------------------------------------
  // Database
  // ---------------------------------------------------------------------------
  database: {
    /** PostgreSQL connection string [REQUIRED] */
    get url(): string {
      return required("DATABASE_URL");
    },
  },

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  auth: {
    /** Superadmin token for API access [REQUIRED] */
    get superadminToken(): string {
      return required("HF_SUPERADMIN_TOKEN");
    },
  },

  // ---------------------------------------------------------------------------
  // AI Services
  // ---------------------------------------------------------------------------
  ai: {
    openai: {
      /** OpenAI API key (uses HF_MVP_KEY if set, otherwise OPENAI_API_KEY) */
      get apiKey(): string | undefined {
        return process.env.OPENAI_HF_MVP_KEY || process.env.OPENAI_API_KEY;
      },
      /** OpenAI model ID */
      get model(): string {
        return optional("OPENAI_MODEL_ID", "gpt-4o");
      },
      /** Check if OpenAI is configured */
      get isConfigured(): boolean {
        return !!(process.env.OPENAI_HF_MVP_KEY || process.env.OPENAI_API_KEY);
      },
    },
    claude: {
      /** Anthropic API key */
      get apiKey(): string | undefined {
        return process.env.ANTHROPIC_API_KEY;
      },
      /** Claude model ID */
      get model(): string {
        return optional("CLAUDE_MODEL_ID", "claude-sonnet-4-20250514");
      },
      /** Check if Claude is configured */
      get isConfigured(): boolean {
        return !!process.env.ANTHROPIC_API_KEY;
      },
    },
    defaults: {
      /** Default max tokens for AI completions */
      get maxTokens(): number {
        return optionalInt("AI_DEFAULT_MAX_TOKENS", 1024);
      },
      /** Default temperature for AI completions */
      get temperature(): number {
        return optionalFloat("AI_DEFAULT_TEMPERATURE", 0.7);
      },
    },
  },

  // ---------------------------------------------------------------------------
  // File Paths
  // ---------------------------------------------------------------------------
  paths: {
    /** Knowledge base root directory */
    get kb(): string {
      return optional("HF_KB_PATH", "../../knowledge");
    },
    /** Parameters CSV path for import script */
    get parametersCsv(): string {
      return optional("HF_PARAMETERS_CSV", "./backlog/parameters.csv");
    },
    /** Transcripts directory (optional override) */
    get transcripts(): string | undefined {
      return process.env.HF_TRANSCRIPTS_PATH;
    },
  },

  // ---------------------------------------------------------------------------
  // Feature Flags
  // ---------------------------------------------------------------------------
  features: {
    /** Enable filesystem operations (agents, manifest sync, etc.) */
    get opsEnabled(): boolean {
      return process.env.HF_OPS_ENABLED === "true";
    },
  },

  // ---------------------------------------------------------------------------
  // Application
  // ---------------------------------------------------------------------------
  app: {
    /** Public-facing app URL */
    get url(): string {
      return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    },
    /** Server port */
    get port(): number {
      return optionalInt("PORT", 3000);
    },
    /** Node environment */
    get nodeEnv(): string {
      return optional("NODE_ENV", "development");
    },
    /** Is production environment */
    get isProduction(): boolean {
      return process.env.NODE_ENV === "production";
    },
    /** Is development environment */
    get isDevelopment(): boolean {
      return process.env.NODE_ENV !== "production";
    },
  },

  // ---------------------------------------------------------------------------
  // Polling & Timeouts
  // ---------------------------------------------------------------------------
  polling: {
    /** Health check interval (ms) */
    get healthCheckMs(): number {
      return optionalInt("HEALTH_CHECK_INTERVAL_MS", 30000);
    },
    /** Agent status polling interval (ms) */
    get agentPollMs(): number {
      return optionalInt("AGENTS_POLL_INTERVAL_MS", 5000);
    },
    /** System status polling interval (ms) */
    get statusPollMs(): number {
      return optionalInt("STATUS_POLL_INTERVAL_MS", 15000);
    },
    /** Docker command timeout (ms) */
    get dockerTimeoutMs(): number {
      return optionalInt("DOCKER_TIMEOUT_MS", 5000);
    },
  },

  // ---------------------------------------------------------------------------
  // Testing
  // ---------------------------------------------------------------------------
  testing: {
    /** Test API URL for integration tests */
    get apiUrl(): string {
      return optional("TEST_API_URL", "http://localhost:3000");
    },
    /** Playwright timeout (seconds) */
    get playwrightTimeoutS(): number {
      return optionalInt("PLAYWRIGHT_TIMEOUT_S", 120);
    },
    /** Is running in CI */
    get isCI(): boolean {
      return optionalBool("CI", false);
    },
  },
} as const;

// =============================================================================
// Validation (optional - call on app startup)
// =============================================================================

/**
 * Validate that all required environment variables are set.
 * Call this on app startup to fail fast if config is missing.
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required vars
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required");
  }
  if (!process.env.HF_SUPERADMIN_TOKEN) {
    errors.push("HF_SUPERADMIN_TOKEN is required");
  }

  // Warn if no AI keys
  if (!config.ai.openai.isConfigured && !config.ai.claude.isConfigured) {
    console.warn(
      "⚠️  No AI API keys configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for AI features."
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}\n\n` +
        `See .env.example for configuration options.`
    );
  }
}

// =============================================================================
// Debug helper
// =============================================================================

/**
 * Get a sanitized view of current config (safe to log, no secrets)
 */
export function getConfigSummary(): Record<string, unknown> {
  return {
    database: {
      configured: !!process.env.DATABASE_URL,
    },
    auth: {
      configured: !!process.env.HF_SUPERADMIN_TOKEN,
    },
    ai: {
      openai: {
        configured: config.ai.openai.isConfigured,
        model: config.ai.openai.model,
      },
      claude: {
        configured: config.ai.claude.isConfigured,
        model: config.ai.claude.model,
      },
      defaults: {
        maxTokens: config.ai.defaults.maxTokens,
        temperature: config.ai.defaults.temperature,
      },
    },
    paths: {
      kb: config.paths.kb,
      parametersCsv: config.paths.parametersCsv,
      transcripts: config.paths.transcripts || "(not set)",
    },
    features: {
      opsEnabled: config.features.opsEnabled,
    },
    app: {
      url: config.app.url,
      port: config.app.port,
      nodeEnv: config.app.nodeEnv,
    },
    polling: {
      healthCheckMs: config.polling.healthCheckMs,
      agentPollMs: config.polling.agentPollMs,
      statusPollMs: config.polling.statusPollMs,
    },
  };
}
