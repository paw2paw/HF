import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";
import { resolve } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runtime = "nodejs";

/**
 * GET /api/health
 *
 * Health check endpoint that verifies:
 * - Docker runtime (Colima or Docker Desktop)
 * - Database connectivity
 * - HF_KB_PATH exists and is accessible
 * - Required environment variables are set
 * - File system permissions
 *
 * Returns:
 * {
 *   ok: boolean,
 *   checks: {
 *     docker: { status: "ok" | "error" | "warning", message: string },
 *     database: { status: "ok" | "error" | "warning", message: string },
 *     hf_kb_path: { status: "ok" | "error" | "warning", message: string },
 *     env: { status: "ok" | "error" | "warning", message: string }
 *   }
 * }
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error" | "warning"; message: string; details?: any }> = {};

  // Check 0: Docker runtime
  try {
    const { stdout } = await execAsync("docker info --format '{{.Name}}'", { timeout: 5000 });
    const name = stdout.trim();

    // Detect runtime type
    let runtime = "Docker";
    try {
      const { stdout: contextOut } = await execAsync("docker context show", { timeout: 3000 });
      const context = contextOut.trim();
      if (context.includes("colima")) {
        runtime = "Colima";
      } else if (context.includes("desktop")) {
        runtime = "Docker Desktop";
      }
    } catch {
      // Ignore context detection errors
    }

    checks.docker = {
      status: "ok",
      message: `${runtime} running`,
      details: { runtime, name },
    };
  } catch (err: any) {
    checks.docker = {
      status: "error",
      message: "Docker not available",
      details: { error: err?.message },
    };
  }

  // Check 1: Database connectivity
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    checks.database = {
      status: "ok",
      message: "Database connection successful",
    };
  } catch (err: any) {
    checks.database = {
      status: "error",
      message: err?.message || "Database connection failed",
      details: {
        error: err?.message,
        code: err?.code,
      },
    };
  }

  // Check 2: HF_KB_PATH
  const kbPath = process.env.HF_KB_PATH?.trim();
  if (!kbPath) {
    checks.hf_kb_path = {
      status: "warning",
      message: "HF_KB_PATH not set (will use default)",
      details: {
        default: resolve(process.cwd(), "../../knowledge"),
      },
    };
  } else {
    try {
      if (existsSync(kbPath)) {
        // Check key subdirectories
        const sources = resolve(kbPath, "sources");
        const transcripts = resolve(kbPath, "transcripts", "raw");
        const parameters = resolve(kbPath, "parameters", "raw");

        const subdirs = {
          sources: existsSync(sources),
          transcripts: existsSync(transcripts),
          parameters: existsSync(parameters),
        };

        const allExist = Object.values(subdirs).every(Boolean);

        checks.hf_kb_path = {
          status: allExist ? "ok" : "warning",
          message: allExist
            ? `HF_KB_PATH accessible: ${kbPath}`
            : `HF_KB_PATH exists but missing subdirectories`,
          details: {
            path: kbPath,
            subdirs,
          },
        };
      } else {
        checks.hf_kb_path = {
          status: "error",
          message: `HF_KB_PATH does not exist: ${kbPath}`,
          details: {
            path: kbPath,
          },
        };
      }
    } catch (err: any) {
      checks.hf_kb_path = {
        status: "error",
        message: `Cannot access HF_KB_PATH: ${err?.message}`,
        details: {
          path: kbPath,
          error: err?.message,
        },
      };
    }
  }

  // Check 3: Environment variables
  const requiredEnv = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    HF_OPS_ENABLED: process.env.HF_OPS_ENABLED === "true",
    NODE_ENV: !!process.env.NODE_ENV,
  };

  const optionalEnv = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    HF_SUPERADMIN_TOKEN: !!process.env.HF_SUPERADMIN_TOKEN,
  };

  const allRequired = Object.values(requiredEnv).every(Boolean);
  const allOptional = Object.values(optionalEnv).every(Boolean);

  checks.env = {
    status: allRequired ? "ok" : "error",
    message: allRequired
      ? `All required environment variables set${!allOptional ? " (some optional missing)" : ""}`
      : "Missing required environment variables",
    details: {
      required: requiredEnv,
      optional: optionalEnv,
    },
  };

  // Check 4: File system write permissions (test in HF_KB_PATH if set)
  if (kbPath && existsSync(kbPath)) {
    try {
      const testFile = resolve(kbPath, ".hf", ".health_check_test");
      const fs = await import("fs/promises");
      const path = await import("path");

      await fs.mkdir(path.dirname(testFile), { recursive: true });
      await fs.writeFile(testFile, "test", "utf8");
      await fs.unlink(testFile);

      checks.fsPermissions = {
        status: "ok",
        message: "File system write permissions OK",
      };
    } catch (err: any) {
      checks.fsPermissions = {
        status: "error",
        message: `Cannot write to HF_KB_PATH: ${err?.message}`,
        details: {
          path: kbPath,
          error: err?.message,
        },
      };
    }
  }

  // Overall status
  const hasError = Object.values(checks).some(c => c.status === "error");
  const hasWarning = Object.values(checks).some(c => c.status === "warning");

  return NextResponse.json({
    ok: !hasError,
    status: hasError ? "error" : hasWarning ? "warning" : "ok",
    checks,
    timestamp: new Date().toISOString(),
  });
}
