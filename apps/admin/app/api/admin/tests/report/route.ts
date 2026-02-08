import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/admin/tests/report
 * Get the latest Playwright test report data
 */
export async function GET(request: NextRequest) {
  try {
    const adminRoot = path.resolve(process.cwd());
    const reportDir = path.join(adminRoot, "playwright-report");

    // Check if report exists
    if (!fs.existsSync(reportDir)) {
      return NextResponse.json({
        ok: false,
        error: "No report found. Run tests first.",
        hasReport: false,
      });
    }

    // Try to read the JSON report
    const jsonReportPath = path.join(reportDir, "results.json");
    let jsonReport = null;

    if (fs.existsSync(jsonReportPath)) {
      const content = fs.readFileSync(jsonReportPath, "utf-8");
      jsonReport = JSON.parse(content);
    }

    // Get report index.html stats
    const indexPath = path.join(reportDir, "index.html");
    const hasHtmlReport = fs.existsSync(indexPath);

    // Get report modification time
    const stats = fs.statSync(reportDir);

    // Parse summary from JSON report
    let summary = null;
    if (jsonReport) {
      const suites = jsonReport.suites || [];
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      let total = 0;

      const countTests = (suite: any) => {
        for (const spec of suite.specs || []) {
          for (const test of spec.tests || []) {
            total++;
            const status = test.results?.[0]?.status;
            if (status === "passed" || status === "expected") passed++;
            else if (status === "failed" || status === "unexpected") failed++;
            else if (status === "skipped") skipped++;
          }
        }
        for (const child of suite.suites || []) {
          countTests(child);
        }
      };

      for (const suite of suites) {
        countTests(suite);
      }

      summary = {
        total,
        passed,
        failed,
        skipped,
        duration: jsonReport.stats?.duration || 0,
        startTime: jsonReport.stats?.startTime,
      };
    }

    return NextResponse.json({
      ok: true,
      hasReport: true,
      hasHtmlReport,
      hasJsonReport: !!jsonReport,
      lastModified: stats.mtime,
      summary,
      reportPath: "/api/admin/tests/report/html",
    });
  } catch (error: any) {
    console.error("Error reading report:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to read report" },
      { status: 500 }
    );
  }
}
