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
    CREATE TABLE IF NOT EXISTS spec_index (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT,
      spec_role TEXT,
      domain TEXT,
      status TEXT,
      output_type TEXT,
      version TEXT,
      depends_on TEXT,
      param_count INTEGER DEFAULT 0,
      ac_count INTEGER DEFAULT 0,
      raw_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS code_todos (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL,
      line INTEGER NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS code_hardcoding (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL,
      line INTEGER NOT NULL,
      slug TEXT NOT NULL,
      context TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
    CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src_symbol_id);
    CREATE INDEX IF NOT EXISTS idx_hf_auth ON hf_context(requires_auth);
    CREATE INDEX IF NOT EXISTS idx_hf_specs ON hf_context(imports_config_specs);
    CREATE INDEX IF NOT EXISTS idx_spec_role ON spec_index(spec_role);
    CREATE INDEX IF NOT EXISTS idx_spec_domain ON spec_index(domain);
    CREATE INDEX IF NOT EXISTS idx_todo_kind ON code_todos(kind);
    CREATE INDEX IF NOT EXISTS idx_hardcoding_slug ON code_hardcoding(slug);
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

function indexSpecs(db: any) {
  const specsDir = path.join(REPO_ROOT, "apps/admin/docs-archive/bdd-specs");
  const files = fg.sync("*.json", {
    cwd: specsDir,
    ignore: ["**/*.registry.json", "**/*.config.json", "**/*.schema.json", "contracts/**"],
  });

  const insertSpec = db.prepare(`
    INSERT INTO spec_index(slug,title,spec_role,domain,status,output_type,version,depends_on,param_count,ac_count,raw_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET
      title=excluded.title,spec_role=excluded.spec_role,domain=excluded.domain,
      status=excluded.status,output_type=excluded.output_type,version=excluded.version,
      depends_on=excluded.depends_on,param_count=excluded.param_count,ac_count=excluded.ac_count,
      raw_json=excluded.raw_json
  `);

  let indexed = 0;
  for (const file of files) {
    try {
      const fullPath = path.join(specsDir, file);
      const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      const depends = json.context?.dependsOn || [];
      insertSpec.run(
        json.id,
        json.title || "",
        json.specRole || "",
        json.domain || "",
        json.status || "Active",
        json.outputType || "",
        json.version || "",
        JSON.stringify(depends),
        json.parameters?.length || 0,
        json.acceptanceCriteria?.length || 0,
        JSON.stringify(json)
      );
      indexed++;
    } catch (e) {
      console.error(`⚠ Error indexing spec ${file}: ${(e as Error).message}`);
    }
  }
  console.error(`✓ Indexed ${indexed} specs`);
}

function indexTodos(db: any, relPath: string, content: string) {
  const deleteExisting = db.prepare(
    `DELETE FROM code_todos WHERE file_path = ?`
  );
  deleteExisting.run(relPath);

  const insertTodo = db.prepare(`
    INSERT INTO code_todos(file_path,line,kind,text) VALUES(?,?,?,?)
  `);

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/\/\/\s*(TODO|FIXME|HACK|NOTE|XXX)[:\s](.+?)$/i);
    if (match) {
      insertTodo.run(relPath, i + 1, match[1].toUpperCase(), match[2].trim());
    }
  }
}

function indexHardcoding(db: any, relPath: string, content: string) {
  // Skip seed files, config, prisma, tests, and comments-only blocks
  if (
    relPath.includes("docs-archive") ||
    relPath.includes("lib/config.ts") ||
    relPath.includes("prisma/seed") ||
    relPath.includes("tests/")
  ) {
    return;
  }

  const deleteExisting = db.prepare(
    `DELETE FROM code_hardcoding WHERE file_path = ?`
  );
  deleteExisting.run(relPath);

  const insertHardcoding = db.prepare(`
    INSERT INTO code_hardcoding(file_path,line,slug,context) VALUES(?,?,?,?)
  `);

  const slugPattern = /["']([A-Z][A-Z0-9]*-\d+)["']/g;
  const lines = content.split("\n");
  const knownSlugs = new Set([
    "PERS-001", "VARK-001", "MEM-001", "INIT-001", "PIPELINE-001", "GUARD-001",
    "COMP-001", "TUT-001", "CONTENT-EXTRACT-001", "COURSE-READY-001",
    "DOMAIN-READY-001", "LEARN-ASSESS-001", "ADAPT-CURR-001", "ADAPT-ENG-001",
    "ADAPT-LEARN-001", "ADAPT-PERS-001", "ADAPT-VARK-001", "REW-001",
    "SESSION-001", "SUPV-001", "VOICE-001", "GOAL-001", "COACH-001",
    "QUICK-LAUNCH-001", "COURSE-SETUP-001", "CONTENT-SOURCE-SETUP-001",
    "CURR-001", "LEARN-PROF-001", "LEARN-STYLE-001", "STYLE-001",
    "ACTIVITY-001", "AIKNOW-001", "CA-001", "COMPANION-001",
    "CURR-FS-L2-001", "ERRMON-001", "FS-TEST-99", "GUARD-VOICEMAIL-001",
    "INJECT-001", "METER-001", "PIPELINE-001", "QM-CONTENT-001",
    "TRUST-001", "TUT-QM-001", "TUT-WNF-001", "WNF-CONTENT-001"
  ]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("//")) continue; // Skip comment lines

    let match;
    while ((match = slugPattern.exec(line)) !== null) {
      const slug = match[1];
      if (knownSlugs.has(slug)) {
        // Check if preceded by config.specs
        const before = line.substring(0, match.index);
        if (!before.includes("config.specs")) {
          insertHardcoding.run(relPath, i + 1, slug, line.trim().substring(0, 80));
        }
      }
    }
  }
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

        // Read file content for todos and hardcoding checks
        const content = fs.readFileSync(absPath, "utf-8");
        indexTodos(db, relPath, content);
        indexHardcoding(db, relPath, content);

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

  // Index specs first
  console.error(`Indexing BDD specs...`);
  indexSpecs(db);

  // Then index TypeScript files
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

function searchSpecs(q: string, role?: string, domain?: string) {
  const db = openDb();
  let query = `
    SELECT slug, title, spec_role, domain, status, output_type, param_count, ac_count
    FROM spec_index
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ` AND (slug LIKE ? OR title LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (role) {
    query += ` AND spec_role = ?`;
    params.push(role);
  }
  if (domain) {
    query += ` AND domain = ?`;
    params.push(domain);
  }

  query += ` ORDER BY spec_role, domain, slug`;

  const rows = db.prepare(query).all(...params);
  db.close();
  return rows;
}

function getSpecDetail(slug: string) {
  const db = openDb();
  const row = db.prepare(`SELECT raw_json FROM spec_index WHERE slug = ?`).get(slug) as any;
  db.close();
  return row ? JSON.parse(row.raw_json) : null;
}

function findTodos(kind?: string) {
  const db = openDb();
  let query = `
    SELECT file_path, line, kind, text
    FROM code_todos
  `;
  const params: any[] = [];

  if (kind) {
    query += ` WHERE kind = ?`;
    params.push(kind.toUpperCase());
  }

  query += ` ORDER BY kind, file_path, line`;

  const rows = db.prepare(query).all(...params);
  db.close();
  return rows;
}

function findHardcoding() {
  const db = openDb();
  const rows = db
    .prepare(
      `
    SELECT file_path, line, slug, context
    FROM code_hardcoding
    ORDER BY file_path, line
  `
    )
    .all();
  db.close();
  return rows;
}

function findTestGaps() {
  const apiRoutes = fg.sync("apps/admin/app/api/**/route.ts", {
    cwd: REPO_ROOT,
  });

  const gaps: any[] = [];

  for (const route of apiRoutes) {
    // Derive expected test file paths
    const parts = route.replace("apps/admin/app/api/", "").replace("/route.ts", "").split("/");
    const testPath1 = path.join(REPO_ROOT, `apps/admin/tests/api/${parts[0]}.test.ts`);
    const testPath2 = path.join(REPO_ROOT, `apps/admin/tests/api/${parts.join("-")}.test.ts`);

    if (!fs.existsSync(testPath1) && !fs.existsSync(testPath2)) {
      gaps.push({
        route: route.replace("apps/admin/", ""),
        expectedTest: `tests/api/${parts[0]}.test.ts or tests/api/${parts.join("-")}.test.ts`,
      });
    }
  }

  return gaps;
}

function parseSchema(modelName?: string) {
  const schemaPath = path.join(REPO_ROOT, "apps/admin/prisma/schema.prisma");
  const content = fs.readFileSync(schemaPath, "utf-8");

  if (modelName) {
    // Get specific model
    const modelRegex = new RegExp(
      `model\\s+${modelName}\\s*\\{([^}]+)\\}`,
      "s"
    );
    const match = content.match(modelRegex);
    if (!match) return null;

    const fields = match[1]
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("@@"));

    return {
      name: modelName,
      fieldCount: fields.length,
      fields: fields.map((f) => f.trim()),
    };
  }

  // List all models
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  const models: any[] = [];
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const fieldCount = match[2].split("\n").filter((l) => l.trim() && !l.trim().startsWith("@@"))
      .length;
    models.push({
      name: match[1],
      fieldCount,
    });
  }

  return models.sort((a, b) => a.name.localeCompare(b.name));
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

  server.tool(
    "hf_specs_search",
    {
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Search term (slug, title, keyword)" },
          role: {
            type: "string",
            enum: ["ORCHESTRATE", "EXTRACT", "SYNTHESISE", "IDENTITY", "CONSTRAIN", "OBSERVE"],
            description: "Filter by specRole",
          },
          domain: { type: "string", description: "Filter by domain" },
        },
        required: [],
      },
    },
    async ({ q, role, domain }: any) => {
      const results = searchSpecs(q || "", role, domain);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: results.length,
                results: results.slice(0, 20),
              },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_specs_detail",
    {
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Spec slug (e.g., PERS-001)" },
        },
        required: ["slug"],
      },
    },
    async ({ slug }: any) => {
      const spec = getSpecDetail(slug);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              spec || { error: `Spec ${slug} not found` },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_todos_list",
    {
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["TODO", "FIXME", "HACK", "NOTE", "XXX"],
            description: "Filter by comment type",
          },
        },
        required: [],
      },
    },
    async ({ kind }: any) => {
      const todos = findTodos(kind);
      const grouped = todos.reduce((acc: any, todo: any) => {
        const k = todo.kind;
        if (!acc[k]) acc[k] = [];
        acc[k].push(todo);
        return acc;
      }, {});

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: todos.length,
                byKind: Object.keys(grouped).map((k) => ({
                  kind: k,
                  count: grouped[k].length,
                })),
                sample: todos.slice(0, 15),
              },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_test_gaps",
    { inputSchema: {} },
    async () => {
      const gaps = findTestGaps();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: gaps.length,
                gaps: gaps.slice(0, 20),
              },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_hardcoding_check",
    { inputSchema: {} },
    async () => {
      const issues = findHardcoding();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: issues.length,
                issues: issues.slice(0, 20),
              },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_schema_models",
    { inputSchema: {} },
    async () => {
      const models = parseSchema();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: (models as any[]).length,
                models: (models as any[]).slice(0, 30),
              },
              null,
              1
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "hf_schema_model",
    {
      inputSchema: {
        type: "object",
        properties: {
          model: { type: "string", description: "Model name (e.g., Caller)" },
        },
        required: ["model"],
      },
    },
    async ({ model }: any) => {
      const detail = parseSchema(model);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              detail || { error: `Model ${model} not found` },
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
