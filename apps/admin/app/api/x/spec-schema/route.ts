import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const SPECS_DIR = path.join(process.cwd(), "bdd-specs");
const SCHEMA_PATH = path.join(SPECS_DIR, "feature-spec-schema.json");

/**
 * GET /api/x/spec-schema
 * Returns the BDD feature spec schema JSON
 */
export async function GET() {
  try {
    if (!fs.existsSync(SCHEMA_PATH)) {
      return NextResponse.json(
        { ok: false, error: "Schema file not found" },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const schema = JSON.parse(content);

    return NextResponse.json({ ok: true, schema });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to read schema" },
      { status: 500 }
    );
  }
}

/**
 * Validates a spec JSON object against basic structural requirements.
 * Returns an array of error strings (empty = valid).
 */
function validateSpec(spec: any): string[] {
  const errors: string[] = [];

  if (!spec || typeof spec !== "object") {
    return ["File is not a valid JSON object"];
  }

  // Required top-level fields
  if (!spec.id || typeof spec.id !== "string") {
    errors.push("Missing or invalid 'id' (string required)");
  } else if (!/^[A-Z]+-[A-Z]*-?[0-9]+$/.test(spec.id)) {
    errors.push(`'id' "${spec.id}" does not match pattern: PREFIX-NNN or PREFIX-SUB-NNN (uppercase + digits)`);
  }

  if (!spec.title || typeof spec.title !== "string") {
    errors.push("Missing or invalid 'title' (string required)");
  }

  if (!spec.version || typeof spec.version !== "string") {
    errors.push("Missing or invalid 'version' (string required, e.g. '1.0')");
  } else if (!/^[0-9]+\.[0-9]+$/.test(spec.version)) {
    errors.push(`'version' "${spec.version}" must be semver format: e.g. '1.0', '2.1'`);
  }

  // Story
  if (!spec.story || typeof spec.story !== "object") {
    errors.push("Missing 'story' object");
  } else {
    if (!spec.story.asA) errors.push("Missing 'story.asA'");
    if (!spec.story.iWant) errors.push("Missing 'story.iWant'");
    if (!spec.story.soThat) errors.push("Missing 'story.soThat'");
  }

  // Parameters
  if (!Array.isArray(spec.parameters) || spec.parameters.length === 0) {
    errors.push("'parameters' must be a non-empty array");
  } else {
    for (let i = 0; i < spec.parameters.length; i++) {
      const p = spec.parameters[i];
      if (!p.id) errors.push(`parameters[${i}]: missing 'id'`);
      if (!p.name) errors.push(`parameters[${i}]: missing 'name'`);
      if (!p.description) errors.push(`parameters[${i}]: missing 'description'`);
    }
  }

  // Optional but validated if present
  if (spec.status && !["Draft", "Review", "Approved", "Deprecated"].includes(spec.status)) {
    errors.push(`'status' must be one of: Draft, Review, Approved, Deprecated (got "${spec.status}")`);
  }

  if (spec.specType && !["SYSTEM", "DOMAIN", "ADAPT", "SUPERVISE"].includes(spec.specType)) {
    errors.push(`'specType' must be one of: SYSTEM, DOMAIN, ADAPT, SUPERVISE (got "${spec.specType}")`);
  }

  if (spec.specRole && !["IDENTITY", "CONTENT", "VOICE", "MEASURE", "ADAPT", "REWARD", "GUARDRAIL"].includes(spec.specRole)) {
    errors.push(`'specRole' must be one of: IDENTITY, CONTENT, VOICE, MEASURE, ADAPT, REWARD, GUARDRAIL (got "${spec.specRole}")`);
  }

  if (spec.outputType && !["MEASURE", "LEARN", "ADAPT", "MEASURE_AGENT", "REWARD", "COMPOSE", "AGGREGATE"].includes(spec.outputType)) {
    errors.push(`'outputType' must be one of: MEASURE, LEARN, ADAPT, MEASURE_AGENT, REWARD, COMPOSE, AGGREGATE (got "${spec.outputType}")`);
  }

  return errors;
}

/**
 * POST /api/x/spec-schema
 * Upload a .spec.json file, validate it, and save to bdd-specs/ directory
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.endsWith(".spec.json")) {
      return NextResponse.json(
        { ok: false, error: "File must have .spec.json extension" },
        { status: 400 }
      );
    }

    // Parse JSON
    let spec: any;
    let rawContent: string;
    try {
      rawContent = await file.text();
      spec = JSON.parse(rawContent);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON in uploaded file" },
        { status: 400 }
      );
    }

    // Validate structure
    const validationErrors = validateSpec(spec);
    if (validationErrors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "Validation failed",
        validationErrors,
      }, { status: 400 });
    }

    // Determine filename: use uploaded name or derive from spec ID
    const filename = file.name;
    const destPath = path.join(SPECS_DIR, filename);

    // Check if file already exists
    const isOverwrite = fs.existsSync(destPath);

    // Write to bdd-specs/ directory (pretty-printed)
    const prettyJson = JSON.stringify(spec, null, 2);
    fs.writeFileSync(destPath, prettyJson, "utf-8");

    return NextResponse.json({
      ok: true,
      message: isOverwrite
        ? `Updated existing spec: ${filename}`
        : `Saved new spec: ${filename}`,
      spec: {
        id: spec.id,
        title: spec.title,
        version: spec.version,
        domain: spec.domain,
        specType: spec.specType,
        parameterCount: spec.parameters?.length || 0,
      },
      filename,
      isOverwrite,
    });
  } catch (error: any) {
    console.error("POST /api/x/spec-schema error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to upload spec" },
      { status: 500 }
    );
  }
}
