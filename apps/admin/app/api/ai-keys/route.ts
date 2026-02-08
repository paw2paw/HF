import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Path to .env.local (where secrets should live - not committed to git)
const ENV_PATH = path.join(process.cwd(), ".env.local");

// Provider key mapping
const PROVIDER_KEYS: Record<string, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

// Mask a key for display (show first 8 and last 4 chars)
function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}••••${key.slice(-4)}`;
}

// Read .env file and parse into object
function readEnvFile(): Record<string, string> {
  try {
    if (!fs.existsSync(ENV_PATH)) return {};
    const content = fs.readFileSync(ENV_PATH, "utf-8");
    const env: Record<string, string> = {};

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

// Write updated values to .env file
function writeEnvFile(updates: Record<string, string>): void {
  let content = "";

  try {
    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, "utf-8");
    }
  } catch {
    // Start fresh if can't read
  }

  const lines = content.split("\n");
  const updatedKeys = new Set<string>();

  // Update existing lines
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return line;

    const key = trimmed.slice(0, eqIndex).trim();

    if (key in updates) {
      updatedKeys.add(key);
      return `${key}="${updates[key]}"`;
    }

    return line;
  });

  // Add new keys that weren't in the file
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      // Add a blank line before if file doesn't end with one
      if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== "") {
        newLines.push("");
      }
      newLines.push(`${key}="${value}"`);
    }
  }

  fs.writeFileSync(ENV_PATH, newLines.join("\n"));
}

// GET - Return key status for all providers
export async function GET() {
  const envVars = readEnvFile();

  const keyStatus: Record<string, {
    envVar: string;
    configured: boolean;
    masked: string | null;
    fromEnv: boolean; // true if loaded from process.env (already in runtime)
  }> = {};

  for (const [provider, envVar] of Object.entries(PROVIDER_KEYS)) {
    // Check both file and runtime env
    const fileValue = envVars[envVar];
    const runtimeValue = process.env[envVar];
    const value = fileValue || runtimeValue;

    keyStatus[provider] = {
      envVar,
      configured: !!value,
      masked: value ? maskKey(value) : null,
      fromEnv: !!runtimeValue && !fileValue,
    };
  }

  return NextResponse.json({
    ok: true,
    keys: keyStatus,
    envPath: ENV_PATH,
  });
}

// POST - Save a key to .env file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, key } = body;

    if (!provider || !key) {
      return NextResponse.json(
        { ok: false, error: "Provider and key are required" },
        { status: 400 }
      );
    }

    const envVar = PROVIDER_KEYS[provider];
    if (!envVar) {
      return NextResponse.json(
        { ok: false, error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    // Write to .env file
    writeEnvFile({ [envVar]: key });

    return NextResponse.json({
      ok: true,
      message: `Saved ${envVar} to .env. Restart the server to apply.`,
      envVar,
      masked: maskKey(key),
    });
  } catch (error) {
    console.error("Failed to save API key:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save API key" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a key from .env file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { ok: false, error: "Provider is required" },
        { status: 400 }
      );
    }

    const envVar = PROVIDER_KEYS[provider];
    if (!envVar) {
      return NextResponse.json(
        { ok: false, error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    // Read current content
    if (!fs.existsSync(ENV_PATH)) {
      return NextResponse.json({ ok: true, message: "Nothing to delete" });
    }

    const content = fs.readFileSync(ENV_PATH, "utf-8");
    const lines = content.split("\n");

    // Remove lines that start with the env var
    const newLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${envVar}=`) || trimmed.startsWith(`${envVar} =`)) {
        return false;
      }
      return true;
    });

    fs.writeFileSync(ENV_PATH, newLines.join("\n"));

    return NextResponse.json({
      ok: true,
      message: `Removed ${envVar} from .env. Restart the server to apply.`,
    });
  } catch (error) {
    console.error("Failed to delete API key:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
