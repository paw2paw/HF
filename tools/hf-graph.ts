import fg from "fast-glob";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { Project, SyntaxKind, Node } from "ts-morph";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const REPO_ROOT = process.cwd();
const DB_PATH = path.join(REPO_ROOT, ".cache", "hf-graph.sqlite");

const FILE_GLOB = [
  "apps/admin/lib/**/*.ts",
  "apps/admin/app/**/*.ts",
  "apps/admin/app/**/*.tsx",
  "apps/admin/prisma/**/*.ts",
  "!**/node_modules/**",
  "!**/.next/**",
  "!**/dist/**",
];

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function openDb() {
  ensureDir(path.dirname(DB_PATH));
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      mtime_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS symbols (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      fqname TEXT NOT NULL UNIQUE,
      file_id INTEGER NOT NULL,
      line INTEGER NOT NULL,
      exported INTEGER NOT NULL,
      meta_json TEXT
    );
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY,
      src_symbol_id INTEGER NOT NULL,
      dst_ref TEXT NOT NULL,
      edge_kind TEXT NOT NULL,
      label TEXT
    );
    CREATE TABLE IF NOT EXISTS hf_context (
      id INTEGER PRIMARY KEY,
      fqname TEXT UNIQUE,
      requires_auth TEXT,
      imports_config_specs INTEGER,
      is_api_route INTEGER,
      pipeline_role TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
    CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src_symbol_id);
    CREATE INDEX IF NOT EXISTS idx_hf_auth ON hf_context(requires_auth);
    CREATE INDEX IF NOT EXISTS idx_hf_specs ON hf_context(imports_config_specs);
  `);
  return db;
}

function fq(relPath: string, name: string) {
  return `${relPath}#${name}`;
}

function extractHfContext(relPath: string, sf: any) {
  const context: Record<string, any> = {};

  // 1. requireAuth usage
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  const authCalls = calls.filter((c: any) => {
    const expr = c.getExpression();
    return Node.isIdentifier(expr) && expr.getText() === "requireAuth";
  });

  if (authCalls.length > 0) {
    const roles = new Set<string>();
    for (const c of authCalls) {
      const args = c.getArguments();
      if (args.length > 0) {
        const arg = args[0].getText().replace(/["']/g, "");
        roles.add(arg);
      }
    }
    context.requires_auth = Array.from(roles).join(",");
  }

  // 2. Imports from config.specs
  const imports = sf.getImportDeclarations();
  const configImports = imports.filter((imp: any) =>
    imp.getModuleSpecifierValue().includes("config")
  );
  if (configImports.length > 0) {
    context.imports_config_specs = 1;
  }

  // 3. Is API route?
  if (relPath.includes("app/api/") && relPath.endsWith("route.ts")) {
    context.is_api_route = 1;
  }

  // 4. Pipeline role imports
  const pipelineImports = imports.filter((imp: any) =>
    imp.getModuleSpecifierValue().includes("pipeline")
  );
  if (pipelineImports.length > 0) {
    context.pipeline_role = "uses-pipeline";
  }

  return context;
}

function indexRepo() {
  const db = openDb();
  const start = Date.now();

  const upsertFile = db.prepare(`
    INSERT INTO files(path, mtime_ms) VALUES(?, ?)
    ON CONFLICT(path) DO UPDATE SET mtime_ms=excluded.mtime_ms
    RETURNING id
  `);
  const getFile = db.prepare(`SELECT id, mtime_ms FROM files WHERE path=?`);
  const deleteFileSymbols = db.prepare(`DELETE FROM symbols WHERE file_id=?`);
  const deleteFileEdges = db.prepare(`
    DELETE FROM edges WHERE src_symbol_id IN (SELECT id FROM symbols WHERE file_id=?)
  `);
  const deleteFileHf = db.prepare(`
    DELETE FROM hf_context WHERE fqname LIKE ?
  `);

  const upsertSymbol = db.prepare(`
    INSERT INTO symbols(kind,name,fqname,file_id,line,exported,meta_json)
    VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(fqname) DO UPDATE SET
      kind=excluded.kind, name=excluded.name, line=excluded.line, exported=excluded.exported
    RETURNING id
  `);

  const insertEdge = db.prepare(`
    INSERT INTO edges(src_symbol_id,dst_ref,edge_kind,label) VALUES(?,?,?,?)
  `);

  const upsertHf = db.prepare(`
    INSERT INTO hf_context(fqname,requires_auth,imports_config_specs,is_api_route,pipeline_role)
    VALUES(?,?,?,?,?)
    ON CONFLICT(fqname) DO UPDATE SET
      requires_auth=excluded.requires_auth,imports_config_specs=excluded.imports_config_specs,
      is_api_route=excluded.is_api_route,pipeline_role=excluded.pipeline_role
  `);

  const files = fg.sync(FILE_GLOB, { cwd: REPO_ROOT, absolute: true });
  console.error(`Indexing ${files.length} files...`);

  const project = new Project({
    tsConfigFilePath: path.join(REPO_ROOT, "apps/admin/tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  for (const abs of files) {
    try {
      project.addSourceFileAtPath(abs);
    } catch (e) {
      console.error(`⚠ Could not parse ${abs}`);
    }
  }

  const tx = db.transaction(() => {
    let indexed = 0;
    for (const absPath of files) {
      try {
        const relPath = path.relative(REPO_ROOT, absPath);
        const mtime = fs.statSync(absPath).mtimeMs;
        const existing = getFile.get(relPath) as any;

        if (existing && existing.mtime_ms === mtime) continue;

        const fileId = (upsertFile.get(relPath, mtime) as any).id;
        deleteFileEdges.run(fileId);
        deleteFileSymbols.run(fileId);
        deleteFileHf.run(relPath + "%");

        const sf = project.getSourceFileOrThrow(absPath);
        const hfCtx = extractHfContext(relPath, sf);

        // Exported symbols
        for (const [name, decls] of sf.getExportedDeclarations()) {
          const decl = decls[0];
          const pos = decl.getStartLinePos();
          const { line } = sf.getLineAndColumnAtPos(pos);

          const kind = Node.isClassDeclaration(decl)
            ? "class"
            : Node.isFunctionDeclaration(decl)
              ? "function"
              : Node.isVariableDeclaration(decl)
                ? "var"
                : "export";

          const symbolFq = fq(relPath, name);
          const symId = (upsertSymbol.get(kind, name, symbolFq, fileId, line, 1, null) as any)
            .id;

          // Track HF context per symbol
          if (Object.keys(hfCtx).length > 0) {
            upsertHf.run(
              symbolFq,
              hfCtx.requires_auth || null,
              hfCtx.imports_config_specs || 0,
              hfCtx.is_api_route || 0,
              hfCtx.pipeline_role || null
            );
          }
        }

        indexed++;
      } catch (e) {
        console.error(`✗ Error indexing ${absPath}: ${(e as Error).message}`);
      }
    }
    console.error(`✓ Indexed ${indexed} files`);
  });

  tx();
  db.close();
  console.error(`Done in ${Date.now() - start}ms`);
}

function search(q: string, limit = 30) {
  const db = openDb();
  const rows = db
    .prepare(
      `
    SELECT s.kind, s.name, s.fqname, f.path, s.line, s.exported
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    WHERE s.name LIKE ? OR s.fqname LIKE ? OR f.path LIKE ?
    ORDER BY f.path ASC, s.line ASC
    LIMIT ?
  `
    )
    .all(`%${q}%`, `%${q}%`, `%${q}%`, limit);
  db.close();
  return rows;
}

function findApiRoutes() {
  const db = openDb();
  const rows = db
    .prepare(
      `
    SELECT DISTINCT 
      f.path,
      COALESCE(h.requires_auth, 'UNPROTECTED') as auth_role
    FROM symbols s
    JOIN files f ON f.id = s.file_id
    LEFT JOIN hf_context h ON h.fqname LIKE (f.path || '%')
    WHERE f.path LIKE 'apps/admin/app/api/%/route.ts'
    ORDER BY f.path ASC
  `
    )
    .all();
  db.close();
  return rows;
}

function findConfigUsage() {
  const db = openDb();
  const rows = db
    .prepare(
      `
    SELECT DISTINCT f.path, COUNT(*) as count
    FROM hf_context h
    JOIN symbols s ON s.fqname = h.fqname
    JOIN files f ON f.id = s.file_id
    WHERE h.imports_config_specs = 1
    GROUP BY f.path
    ORDER BY count DESC
  `
    )
    .all();
  db.close();
  return rows;
}

async function mcp() {
  const server = new McpServer({ name: "hf-graph", version: "0.2.0" });

  server.tool("hf_graph_index", { inputSchema: {} }, async () => {
    indexRepo();
    return { content: [{ type: "text", text: "Indexing complete" }] };
  });

  server.tool(
    "hf_graph_search",
    {
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search query (name, path, symbol)" },
          limit: { type: "number", description: "Max results (default 30)" },
        },
        required: ["q"],
      },
    },
    async ({ q, limit }: any) => {
      const results = search(q, limit || 30);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { count: results.length, results: results.slice(0, 10) },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_graph_api_routes",
    { inputSchema: {} },
    async () => {
      const routes = findApiRoutes();
      const summary = routes.reduce(
        (acc: any, r: any) => {
          acc[r.auth_role] = (acc[r.auth_role] || 0) + 1;
          return acc;
        },
        {}
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { total: routes.length, summary, sample: routes.slice(0, 15) },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_graph_config_usage",
    { inputSchema: {} },
    async () => {
      const usage = findConfigUsage();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { count: usage.length, top: usage.slice(0, 20) },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  await server.connect(new StdioServerTransport());
}

const cmd = process.argv[2];
if (cmd === "index") indexRepo();
else if (cmd === "mcp") void mcp();
else
  console.log(
    "Usage:\n" +
      "  npx tsx tools/hf-graph.ts index    # Index repo\n" +
      "  npx tsx tools/hf-graph.ts mcp      # Run MCP server\n"
  );
