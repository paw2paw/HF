import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { requireAuth, isAuthError } from "@/lib/permissions";

export const runtime = "nodejs";

const prisma = new PrismaClient();

// Prerequisite types supported
interface CountPrerequisite {
  type: "count";
  table: string;
  min: number;
  required: boolean;
  message?: string;
}

interface PathPrerequisite {
  type: "path";
  path: string;
  min: number;
  required: boolean;
  message?: string;
}

type Prerequisite = CountPrerequisite | PathPrerequisite;

interface PrerequisiteResult {
  prerequisite: Prerequisite;
  passed: boolean;
  actual: number;
  message: string;
}

interface PreflightResponse {
  ok: boolean;
  canRun: boolean;
  hasWarnings: boolean;
  checks: PrerequisiteResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
  };
}

// Load agents.json manifest
function loadAgentsManifest() {
  const manifestPath = path.resolve(process.cwd(), "../../lib/agents.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const content = fs.readFileSync(manifestPath, "utf-8");
  return JSON.parse(content);
}

// Get count from database table
async function getTableCount(tableName: string): Promise<number> {
  try {
    // Dynamically query the table using Prisma's $queryRawUnsafe
    // Note: This is safe since tableName comes from our manifest, not user input
    const validTables = [
      "Parameter",
      "ParameterSet",
      "AnalysisProfile",
      "Call",
      "Caller",
      "KnowledgeDoc",
      "KnowledgeChunk",
      "VectorEmbedding",
      "ProcessedFile",
      "PersonalityObservation",
      "CallerPersonality",
      "PromptTemplate",
      "AgentInstance",
      "AgentRun",
      "AnalysisSpec",
      "CallerMemory",
      "CallScore",
      "BehaviorTarget",
    ];

    if (!validTables.includes(tableName)) {
      console.warn(`Unknown table in prerequisite: ${tableName}`);
      return 0;
    }

    // Use model-specific queries for type safety
    switch (tableName) {
      case "Parameter":
        return await prisma.parameter.count();
      case "ParameterSet":
      case "AnalysisProfile":
        return await prisma.analysisProfile.count();
      case "Call":
        return await prisma.call.count();
      case "Caller":
        return await prisma.caller.count();
      case "KnowledgeDoc":
        return await prisma.knowledgeDoc.count();
      case "KnowledgeChunk":
        return await prisma.knowledgeChunk.count();
      case "VectorEmbedding":
        return await prisma.vectorEmbedding.count();
      case "ProcessedFile":
        return await prisma.processedFile.count();
      case "PersonalityObservation":
        return await prisma.personalityObservation.count();
      case "CallerPersonality":
        return await prisma.callerPersonality.count();
      case "BehaviorTarget":
        return await prisma.behaviorTarget.count();
      case "PromptTemplate":
        return await prisma.promptTemplate.count();
      case "AgentInstance":
        return await prisma.agentInstance.count();
      case "AgentRun":
        return await prisma.agentRun.count();
      case "AnalysisSpec":
        return await prisma.analysisSpec.count();
      case "CallerMemory":
        return await prisma.callerMemory.count();
      case "CallScore":
        return await prisma.callScore.count();
      default:
        return 0;
    }
  } catch (err) {
    console.error(`Failed to count ${tableName}:`, err);
    return 0;
  }
}

// Get file count from path pattern
function getPathCount(pathPattern: string): number {
  try {
    // Resolve path relative to HF_KB_PATH or CWD
    const basePath = process.env.HF_KB_PATH || process.cwd();
    const fullPath = path.resolve(basePath, pathPattern);

    // Handle glob-like patterns (simple implementation)
    const dir = path.dirname(fullPath);
    const pattern = path.basename(fullPath);

    if (!fs.existsSync(dir)) {
      return 0;
    }

    const files = fs.readdirSync(dir);

    // Simple pattern matching (handles *.json, *.md, etc.)
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
      );
      return files.filter((f) => regex.test(f)).length;
    }

    // Exact match or directory
    const targetPath = fullPath;
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        return fs.readdirSync(targetPath).length;
      }
      return 1;
    }

    return 0;
  } catch (err) {
    console.error(`Failed to count path ${pathPattern}:`, err);
    return 0;
  }
}

// Evaluate a single prerequisite
async function evaluatePrerequisite(
  prereq: Prerequisite
): Promise<PrerequisiteResult> {
  let actual = 0;

  if (prereq.type === "count") {
    actual = await getTableCount(prereq.table);
  } else if (prereq.type === "path") {
    actual = getPathCount(prereq.path);
  }

  const passed = actual >= prereq.min;

  // Generate message
  let message = prereq.message || "";
  if (!message) {
    if (prereq.type === "count") {
      message = passed
        ? `${prereq.table} has ${actual} records`
        : `${prereq.table} needs at least ${prereq.min} records (has ${actual})`;
    } else {
      message = passed
        ? `Found ${actual} files at ${prereq.path}`
        : `Need at least ${prereq.min} files at ${prereq.path} (found ${actual})`;
    }
  }

  return {
    prerequisite: prereq,
    passed,
    actual,
    message,
  };
}

/**
 * @api GET /api/agents/:agentId/preflight
 * @visibility internal
 * @scope agents:read
 * @auth session
 * @tags agents
 * @description Check if all prerequisites are met for running an agent (DB table counts, file paths)
 * @pathParam agentId string - The agent identifier
 * @response 200 { ok: true, canRun: boolean, hasWarnings: boolean, checks: PrerequisiteResult[], summary: { passed, failed, warnings } }
 * @response 404 { ok: false, error: "Agent not found: ..." }
 * @response 500 { ok: false, error: "..." }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authResult = await requireAuth("OPERATOR");
    if (isAuthError(authResult)) return authResult.error;

    const { agentId } = await params;

    // Load manifest
    const manifest = loadAgentsManifest();
    if (!manifest) {
      return NextResponse.json(
        { ok: false, error: "agents.json manifest not found" },
        { status: 500 }
      );
    }

    // Find agent in manifest
    const agent = manifest.agents?.find(
      (a: { id: string; agentId: string }) =>
        a.id === agentId || a.agentId === agentId
    );

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      );
    }

    // Get prerequisites from agent definition
    const prerequisites: Prerequisite[] = agent.prerequisites || [];

    // No prerequisites = can always run
    if (prerequisites.length === 0) {
      return NextResponse.json({
        ok: true,
        canRun: true,
        hasWarnings: false,
        checks: [],
        summary: {
          passed: 0,
          failed: 0,
          warnings: 0,
        },
      } as PreflightResponse);
    }

    // Evaluate all prerequisites
    const checks = await Promise.all(
      prerequisites.map((prereq) => evaluatePrerequisite(prereq))
    );

    // Calculate summary
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const check of checks) {
      if (check.passed) {
        passed++;
      } else if (check.prerequisite.required) {
        failed++;
      } else {
        warnings++;
      }
    }

    // Can run if no required prerequisites failed
    const canRun = failed === 0;
    const hasWarnings = warnings > 0;

    return NextResponse.json({
      ok: true,
      canRun,
      hasWarnings,
      checks,
      summary: {
        passed,
        failed,
        warnings,
      },
    } as PreflightResponse);
  } catch (err: any) {
    console.error("[Preflight Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Preflight check failed" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
