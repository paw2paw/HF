import { NextResponse } from "next/server";
import {
  getKbRoot,
  loadPathsConfig,
  getResolvedPaths,
  validatePaths,
  ensureDerivedPaths,
  clearPathsCache,
} from "@/lib/paths";

export const runtime = "nodejs";

/**
 * GET /api/paths
 *
 * Returns the current paths configuration and validation status.
 */
export async function GET() {
  try {
    // Clear cache to always return fresh values
    clearPathsCache();
    const config = loadPathsConfig();
    const resolved = getResolvedPaths();
    const validation = validatePaths();

    return NextResponse.json({
      ok: true,
      config,
      resolved,
      validation,
      env: {
        HF_KB_PATH: process.env.HF_KB_PATH || null,
        NODE_ENV: process.env.NODE_ENV,
      },
    });
  } catch (err: any) {
    console.error("[Paths API Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load paths" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/paths
 *
 * Actions:
 * - action: "validate" - Validate all paths exist
 * - action: "ensure" - Create missing derived directories
 * - action: "init" - Initialize a new KB directory structure
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "validate";

    if (action === "validate") {
      const validation = validatePaths();
      return NextResponse.json({
        ok: validation.valid,
        validation,
      });
    }

    if (action === "ensure") {
      ensureDerivedPaths();
      const validation = validatePaths();
      return NextResponse.json({
        ok: true,
        message: "Derived directories ensured",
        validation,
      });
    }

    if (action === "init") {
      const root = body.root || getKbRoot();
      const fs = await import("node:fs");
      const path = await import("node:path");

      // Create the full directory structure
      const dirs = [
        "sources/knowledge",
        "sources/transcripts",
        "sources/parameters",
        "derived/knowledge",
        "derived/embeddings",
        "derived/transcripts",
        "derived/analysis",
        "exports/reports",
        "exports/snapshots",
      ];

      const created: string[] = [];
      for (const dir of dirs) {
        const fullPath = path.resolve(root, dir);
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
          created.push(dir);
        }
      }

      // Create default paths.json if it doesn't exist
      const pathsJsonPath = path.resolve(root, "paths.json");
      if (!fs.existsSync(pathsJsonPath)) {
        const defaultConfig = {
          version: 1,
          sources: {
            knowledge: "sources/knowledge",
            transcripts: "sources/transcripts",
            parameters: "sources/parameters/parameters.csv",
          },
          derived: {
            knowledge: "derived/knowledge",
            embeddings: "derived/embeddings",
            transcripts: "derived/transcripts",
            analysis: "derived/analysis",
          },
          exports: {
            reports: "exports/reports",
            snapshots: "exports/snapshots",
          },
        };
        fs.writeFileSync(pathsJsonPath, JSON.stringify(defaultConfig, null, 2));
        created.push("paths.json");
      }

      // Create a README
      const readmePath = path.resolve(root, "README.md");
      if (!fs.existsSync(readmePath)) {
        const readme = `# HF Knowledge Base

This directory contains the data for your HumanFirst deployment.

## Directory Structure

\`\`\`
${root}/
├── paths.json              # Path configuration (edit to customize)
├── sources/                # Raw input data
│   ├── knowledge/          # Drop knowledge documents here (MD, PDF, TXT)
│   ├── transcripts/        # Drop transcript JSON files here
│   └── parameters/         # Parameters CSV
├── derived/                # Processed data (auto-generated)
│   ├── knowledge/          # Chunked knowledge
│   ├── embeddings/         # Vector embeddings
│   ├── transcripts/        # Processed transcripts
│   └── analysis/           # Analysis outputs
└── exports/                # Generated outputs
    ├── reports/
    └── snapshots/
\`\`\`

## Setup

1. Set the environment variable:
   \`\`\`bash
   export HF_KB_PATH="${root}"
   \`\`\`

2. Or add to your \`.env.local\`:
   \`\`\`
   HF_KB_PATH=${root}
   \`\`\`

## Getting Started

1. Drop your knowledge documents in \`sources/knowledge/\`
2. Drop your transcript JSON files in \`sources/transcripts/\`
3. Place your parameters CSV at \`sources/parameters/parameters.csv\`
4. Run the pipeline agents to process data

## Customizing Paths

Edit \`paths.json\` to change where data is stored. All paths are relative to this directory.
`;
        fs.writeFileSync(readmePath, readme);
        created.push("README.md");
      }

      return NextResponse.json({
        ok: true,
        message: `Initialized KB at: ${root}`,
        root,
        created,
        validation: validatePaths(),
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[Paths API Error]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
