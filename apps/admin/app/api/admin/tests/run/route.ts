import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Store for active test runs
const activeRuns = new Map<string, {
  status: "running" | "completed" | "failed";
  output: string[];
  startedAt: Date;
  completedAt?: Date;
  exitCode?: number;
}>();

/**
 * POST /api/admin/tests/run
 * Start a Playwright test run
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { file, project, testName } = body;

    const runId = `run-${Date.now()}`;
    const adminRoot = path.resolve(process.cwd());

    // Build the command
    let args = ["playwright", "test"];

    if (file) {
      args.push(file);
    }

    if (project) {
      args.push(`--project=${project}`);
    }

    if (testName) {
      args.push("-g", testName);
    }

    // Add reporter for JSON output
    args.push("--reporter=list,json");

    // Initialize run state
    activeRuns.set(runId, {
      status: "running",
      output: [],
      startedAt: new Date(),
    });

    // Spawn the process
    const child = spawn("npx", args, {
      cwd: adminRoot,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    child.stdout.on("data", (data) => {
      const run = activeRuns.get(runId);
      if (run) {
        run.output.push(data.toString());
      }
    });

    child.stderr.on("data", (data) => {
      const run = activeRuns.get(runId);
      if (run) {
        run.output.push(`[stderr] ${data.toString()}`);
      }
    });

    child.on("close", (code) => {
      const run = activeRuns.get(runId);
      if (run) {
        run.status = code === 0 ? "completed" : "failed";
        run.completedAt = new Date();
        run.exitCode = code ?? undefined;
      }
    });

    return NextResponse.json({
      ok: true,
      runId,
      message: "Test run started",
      command: `npx ${args.join(" ")}`,
    });
  } catch (error: any) {
    console.error("Error starting test run:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to start tests" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/tests/run?runId=xxx
 * Get status of a test run
 */
export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    // Return list of all runs
    const runs = Array.from(activeRuns.entries()).map(([id, run]) => ({
      id,
      ...run,
      output: run.output.length, // Just count, not full output
    }));

    return NextResponse.json({ ok: true, runs });
  }

  const run = activeRuns.get(runId);

  if (!run) {
    return NextResponse.json(
      { ok: false, error: "Run not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    runId,
    status: run.status,
    output: run.output.join(""),
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    exitCode: run.exitCode,
    duration: run.completedAt
      ? run.completedAt.getTime() - run.startedAt.getTime()
      : Date.now() - run.startedAt.getTime(),
  });
}
