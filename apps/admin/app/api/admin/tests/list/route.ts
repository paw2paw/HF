import { NextResponse } from "next/server";
import { execSync } from "child_process";
import * as path from "path";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/admin/tests/list
 * @visibility internal
 * @scope admin:read
 * @auth bearer
 * @tags admin
 * @description List all Playwright E2E tests grouped by file
 * @response 200 { ok: true, totalTests: number, files: number, tests: Test[], grouped: Record<string, Test[]> }
 * @response 500 { ok: false, error: "...", stderr: "..." }
 */
export async function GET() {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

    const adminRoot = path.resolve(process.cwd());

    // Run playwright test --list to get all tests
    const output = execSync("npx playwright test --list 2>&1", {
      cwd: adminRoot,
      encoding: "utf-8",
      timeout: 30000,
    });

    // Parse the output to extract test info
    const lines = output.split("\n").filter((line) => line.includes("›"));

    const tests = lines.map((line) => {
      // Format: [project] › path › describe › test name
      const match = line.match(/\[(\w+)\]\s+›\s+(.+)/);
      if (match) {
        const [, project, testPath] = match;
        const parts = testPath.split(" › ");
        return {
          project,
          file: parts[0]?.trim() || "",
          suite: parts.slice(1, -1).join(" › ") || "",
          name: parts[parts.length - 1]?.trim() || "",
          fullPath: testPath,
        };
      }
      return null;
    }).filter(Boolean);

    // Group by file
    const grouped: Record<string, typeof tests> = {};
    for (const test of tests) {
      if (test) {
        const key = test.file;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(test);
      }
    }

    return NextResponse.json({
      ok: true,
      totalTests: tests.length,
      files: Object.keys(grouped).length,
      tests,
      grouped,
    });
  } catch (error: any) {
    console.error("Error listing tests:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to list tests",
        stderr: error?.stderr?.toString() || "",
      },
      { status: 500 }
    );
  }
}
