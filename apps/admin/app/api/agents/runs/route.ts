import fs from "node:fs/promises";
import path from "node:path";

type AgentRunRow = {
  at?: string;
  agentId?: string;
  op?: string;
  ok?: boolean;
  [k: string]: any;
};

function getKbRoot() {
  const kb = process.env.HF_KB_PATH;
  if (!kb || !kb.trim()) throw new Error("HF_KB_PATH is not set");
  return kb.trim();
}

async function readRunsJsonl(filePath: string): Promise<AgentRunRow[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: AgentRunRow[] = [];
    for (const l of lines) {
      try {
        out.push(JSON.parse(l));
      } catch {
        // ignore bad lines
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const agentId = (url.searchParams.get("agentId") || "").trim();
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || "200")));

    const kbRoot = getKbRoot();
    const runsPath = path.join(kbRoot, ".hf", "agent_runs.jsonl");

    const all = await readRunsJsonl(runsPath);

    const filtered = agentId ? all.filter((r) => r?.agentId === agentId) : all;

    // newest first (best-effort on `at`)
    filtered.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

    return Response.json({
      ok: true,
      agentId: agentId || null,
      limit,
      runsPath,
      count: filtered.length,
      runs: filtered.slice(0, limit),
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}