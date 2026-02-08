import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/admin/tests/report/html
 * Serve the Playwright HTML report
 */
export async function GET(request: NextRequest) {
  try {
    const adminRoot = path.resolve(process.cwd());
    const reportDir = path.join(adminRoot, "playwright-report");

    // Get the requested file from query params, default to index.html
    const file = request.nextUrl.searchParams.get("file") || "index.html";

    // Sanitize file path to prevent directory traversal
    const safePath = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(reportDir, safePath);

    // Ensure the file is within the report directory
    if (!filePath.startsWith(reportDir)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(filePath);

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error("Error serving report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to serve report" },
      { status: 500 }
    );
  }
}
