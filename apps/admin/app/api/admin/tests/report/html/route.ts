import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { requireAuth, isAuthError } from "@/lib/permissions";

/**
 * @api GET /api/admin/tests/report/html
 * @visibility internal
 * @scope admin:read
 * @auth bearer
 * @tags admin
 * @description Serve Playwright HTML report files with appropriate content types
 * @query file string - Relative file path within the report directory (default: "index.html")
 * @response 200 File content with appropriate Content-Type header
 * @response 400 { error: "Invalid file path" }
 * @response 404 { error: "File not found" }
 * @response 500 { error: "..." }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth("ADMIN");
    if (isAuthError(authResult)) return authResult.error;

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
