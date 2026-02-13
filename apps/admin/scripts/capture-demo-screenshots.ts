/**
 * Capture Demo Screenshots
 *
 * Reads demo spec JSON files and automatically captures screenshots
 * for each step using Playwright. Saves them to public/demos/<demoId>/
 * matching the `content.src` paths in the spec.
 *
 * Usage:
 *   npx tsx scripts/capture-demo-screenshots.ts [options]
 *
 * Options:
 *   --base-url URL     Dev server URL (default: http://localhost:3000)
 *   --demo DEMO-ID     Capture only this demo
 *   --caller NAME      Override default caller name
 *   --domain SLUG      Override default domain slug
 *   --playbook NAME    Override default playbook name
 *   --spec SLUG        Override default spec slug
 *
 * Entity resolution priority:
 *   1. CLI args (highest)
 *   2. SystemSettings from DB (demo.default_*)
 *   3. Hardcoded fallbacks (Paul, qm-tutor, etc.)
 *
 * Prerequisites:
 *   - Dev server running (npm run dev) or specify --base-url
 *   - Playwright browsers installed (npx playwright install chromium)
 *   - Auth state at .playwright/auth.json (or auto-login)
 *   - Demo fixtures seeded (npm run seed:demo)
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const AUTH_FILE = path.join(ROOT, ".playwright", "auth.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const DEMO_CONTENT_DIR = path.join(ROOT, "lib", "demo", "content");

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

// Login credentials (same as e2e/global-setup.ts)
const LOGIN_EMAIL = "admin@test.com";
const LOGIN_PASSWORD = "admin123";

// Fallback entity defaults (used when DB + CLI don't specify)
const FALLBACK_DEFAULTS = {
  caller: "Paul",
  domain: "qm-tutor",
  playbook: "",
  spec: "PERS-001",
};

// ---------------------------------------------------------------------------
// Types (inline — avoids importing from lib/ which needs tsconfig aliases)
// ---------------------------------------------------------------------------

interface DemoSpec {
  id: string;
  title: string;
  steps: DemoStep[];
}

interface DemoStep {
  id: string;
  title: string;
  content: StepContent;
  sidebarHighlight?: { href: string };
  aiContext?: { assistantLocation?: { page?: string } };
  capture?: DemoCaptureConfig;
}

interface DemoCaptureConfig {
  /** URL template with placeholders: "/x/callers/{callerId}" */
  url: string;
  /** Ordered actions before screenshotting */
  actions?: DemoCaptureAction[];
  /** Wait for this selector to be visible before capture */
  waitFor?: string;
  /** Extra delay in ms after page settled */
  delay?: number;
}

type DemoCaptureAction =
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "hover"; selector: string }
  | { type: "wait"; selector: string }
  | { type: "waitMs"; ms: number }
  | { type: "keyboard"; key: string };

type StepContent =
  | { type: "screenshot"; src: string }
  | { type: "markdown" }
  | { type: "split"; left: StepContent; right: StepContent };

interface EntityContext {
  callerId: string | null;
  callerName: string;
  domainId: string | null;
  domainSlug: string;
  playbookId: string | null;
  playbookName: string;
  specId: string | null;
  specSlug: string;
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_BASE_URL;
  let demoId: string | null = null;
  let caller: string | null = null;
  let domain: string | null = null;
  let playbook: string | null = null;
  let spec: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--base-url" && next) { baseUrl = next; i++; }
    else if (arg === "--demo" && next) { demoId = next; i++; }
    else if (arg === "--caller" && next) { caller = next; i++; }
    else if (arg === "--domain" && next) { domain = next; i++; }
    else if (arg === "--playbook" && next) { playbook = next; i++; }
    else if (arg === "--spec" && next) { spec = next; i++; }
  }

  return { baseUrl, demoId, caller, domain, playbook, spec };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load all .demo.json files from the content directory */
function loadDemoSpecs(filterDemoId: string | null): DemoSpec[] {
  const files = fs.readdirSync(DEMO_CONTENT_DIR).filter((f) => f.endsWith(".demo.json"));
  const specs: DemoSpec[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DEMO_CONTENT_DIR, file), "utf-8");
    const spec = JSON.parse(raw) as DemoSpec;
    if (!filterDemoId || spec.id === filterDemoId) {
      specs.push(spec);
    }
  }

  return specs;
}

/** Extract screenshot entries from a step (handles split content) */
function extractScreenshots(step: DemoStep): { src: string }[] {
  const results: { src: string }[] = [];

  function walk(content: StepContent) {
    if (content.type === "screenshot") {
      results.push({ src: content.src });
    } else if (content.type === "split") {
      walk(content.left);
      walk(content.right);
    }
  }

  walk(step.content);
  return results;
}

/** Resolve page URL for a step: capture.url > sidebarHighlight.href > assistantLocation.page */
function resolvePageUrl(step: DemoStep, entities: EntityContext): string | null {
  let url: string | null = null;

  if (step.capture?.url) {
    url = step.capture.url;
  } else if (step.sidebarHighlight?.href) {
    url = step.sidebarHighlight.href;
  } else if (step.aiContext?.assistantLocation?.page) {
    url = step.aiContext.assistantLocation.page;
  }

  if (!url) return null;

  // Interpolate entity placeholders
  return interpolateUrl(url, entities);
}

/** Replace {callerId}, {domainId}, etc. with actual values */
function interpolateUrl(url: string, entities: EntityContext): string {
  return url
    .replace(/\{callerId\}/g, entities.callerId || "")
    .replace(/\{domainId\}/g, entities.domainId || "")
    .replace(/\{domainSlug\}/g, entities.domainSlug)
    .replace(/\{playbookId\}/g, entities.playbookId || "")
    .replace(/\{specId\}/g, entities.specId || "")
    .replace(/\{callerName\}/g, entities.callerName)
    .replace(/\{specSlug\}/g, entities.specSlug);
}

/** Ensure the auth state file exists, or create it by logging in */
async function ensureAuth(baseUrl: string): Promise<void> {
  if (fs.existsSync(AUTH_FILE)) {
    console.log("  Auth state found at", AUTH_FILE);
    return;
  }

  console.log("  No auth state found — logging in...");

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState("domcontentloaded");
    await page.locator("#email").fill(LOGIN_EMAIL);
    await page.locator("#password").fill(LOGIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/x/, { timeout: 15000 });

    // Save auth state
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    await context.storageState({ path: AUTH_FILE });
    console.log("  Login successful, auth state saved.");
  } catch (err) {
    console.error("  Login failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

/** Wait for the page to settle (network idle + no spinners) */
async function waitForPageSettled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Give any transition animations time to finish
  await page.waitForTimeout(500);
}

/** Fetch JSON from an API endpoint using the page's authenticated context */
async function fetchApi(page: Page, baseUrl: string, apiPath: string): Promise<unknown> {
  return page.evaluate(async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  }, `${baseUrl}${apiPath}`);
}

/** Load demo defaults from SystemSettings via API */
async function loadDbDefaults(page: Page, baseUrl: string): Promise<Record<string, string>> {
  const defaults: Record<string, string> = {};
  try {
    // Navigate to establish session cookies first
    await page.goto(`${baseUrl}/x`, { waitUntil: "domcontentloaded", timeout: 10000 });
    await page.waitForTimeout(500);

    const data = await fetchApi(page, baseUrl, "/api/system-settings") as { ok?: boolean; settings?: { key: string; value: string }[] } | null;
    if (data?.ok && Array.isArray(data.settings)) {
      for (const item of data.settings) {
        if (item.key?.startsWith("demo.")) {
          try {
            defaults[item.key] = JSON.parse(item.value);
          } catch {
            defaults[item.key] = item.value;
          }
        }
      }
    }
  } catch (err) {
    console.log("  Warning: Could not load DB defaults:", (err as Error).message);
  }

  return defaults;
}

/** Resolve entity names/slugs to UUIDs */
async function resolveEntities(
  page: Page,
  baseUrl: string,
  callerName: string,
  domainSlug: string,
  playbookName: string,
  specSlug: string,
): Promise<EntityContext> {
  const ctx: EntityContext = {
    callerId: null,
    callerName,
    domainId: null,
    domainSlug,
    playbookId: null,
    playbookName,
    specId: null,
    specSlug,
  };

  // Resolve caller
  try {
    const data = await fetchApi(page, baseUrl, "/api/callers?limit=500") as { ok?: boolean; callers?: { id: string; name: string }[] } | null;
    if (data?.ok && Array.isArray(data.callers)) {
      const match = data.callers.find((c) => c.name === callerName);
      if (match) {
        ctx.callerId = match.id;
      } else if (data.callers.length > 0) {
        console.log(`  Warning: Caller "${callerName}" not found, using first: "${data.callers[0].name}"`);
        ctx.callerId = data.callers[0].id;
        ctx.callerName = data.callers[0].name;
      }
    }
  } catch { /* ignore */ }

  // Resolve domain
  try {
    const data = await fetchApi(page, baseUrl, "/api/domains") as { ok?: boolean; domains?: { id: string; slug: string }[] } | null;
    if (data?.ok && Array.isArray(data.domains)) {
      const match = data.domains.find((d) => d.slug === domainSlug);
      if (match) {
        ctx.domainId = match.id;
      } else if (data.domains.length > 0) {
        console.log(`  Warning: Domain "${domainSlug}" not found, using first: "${data.domains[0].slug}"`);
        ctx.domainId = data.domains[0].id;
        ctx.domainSlug = data.domains[0].slug;
      }
    }
  } catch { /* ignore */ }

  // Resolve playbook (optional)
  if (playbookName) {
    try {
      const data = await fetchApi(page, baseUrl, "/api/playbooks") as { ok?: boolean; playbooks?: { id: string; name: string }[] } | null;
      if (data?.ok && Array.isArray(data.playbooks)) {
        const match = data.playbooks.find((p) => p.name === playbookName);
        if (match) ctx.playbookId = match.id;
      }
    } catch { /* ignore */ }
  }

  // Resolve spec (optional)
  if (specSlug) {
    try {
      const data = await fetchApi(page, baseUrl, "/api/specs") as { ok?: boolean; specs?: { id: string; slug: string }[] } | null;
      if (data?.ok && Array.isArray(data.specs)) {
        const match = data.specs.find((s) => s.slug === specSlug);
        if (match) ctx.specId = match.id;
      }
    } catch { /* ignore */ }
  }

  return ctx;
}

/** Execute pre-capture actions on the page */
async function executeCaptureActions(page: Page, actions: DemoCaptureAction[]): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case "click":
          await page.locator(action.selector).first().click({ timeout: 5000 });
          break;
        case "fill":
          await page.locator(action.selector).first().fill(action.value, { timeout: 5000 });
          break;
        case "hover":
          await page.locator(action.selector).first().hover({ timeout: 5000 });
          break;
        case "wait":
          await page.locator(action.selector).first().waitFor({ state: "visible", timeout: 5000 });
          break;
        case "waitMs":
          await page.waitForTimeout(action.ms);
          break;
        case "keyboard":
          await page.keyboard.press(action.key);
          break;
      }
      await page.waitForTimeout(200); // settle between actions
    } catch (err) {
      console.log(`    Action ${action.type} failed: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cliArgs = parseArgs();

  console.log("\n=== Demo Screenshot Capture ===");
  console.log(`  Base URL: ${cliArgs.baseUrl}`);
  console.log(`  Demo filter: ${cliArgs.demoId || "(all)"}`);
  console.log(`  Output: ${PUBLIC_DIR}/demos/\n`);

  // Ensure auth
  await ensureAuth(cliArgs.baseUrl);

  // Load specs
  const specs = loadDemoSpecs(cliArgs.demoId);
  if (specs.length === 0) {
    console.error(cliArgs.demoId ? `No demo found with ID "${cliArgs.demoId}"` : "No demo specs found");
    process.exit(1);
  }

  // Launch browser
  const browser: Browser = await chromium.launch();
  const context: BrowserContext = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: DEFAULT_VIEWPORT,
  });
  const page: Page = await context.newPage();

  // Load DB defaults
  console.log("  Loading entity defaults...");
  const dbDefaults = await loadDbDefaults(page, cliArgs.baseUrl);

  // Merge: CLI > DB > fallback
  const callerName = cliArgs.caller || dbDefaults["demo.default_caller"] || FALLBACK_DEFAULTS.caller;
  const domainSlug = cliArgs.domain || dbDefaults["demo.default_domain"] || FALLBACK_DEFAULTS.domain;
  const playbookName = cliArgs.playbook || dbDefaults["demo.default_playbook"] || FALLBACK_DEFAULTS.playbook;
  const specSlug = cliArgs.spec || dbDefaults["demo.default_spec"] || FALLBACK_DEFAULTS.spec;

  console.log(`  Caller: ${callerName}`);
  console.log(`  Domain: ${domainSlug}`);
  if (playbookName) console.log(`  Playbook: ${playbookName}`);
  if (specSlug) console.log(`  Spec: ${specSlug}`);

  // Resolve names/slugs → IDs
  console.log("  Resolving entities...\n");
  const entities = await resolveEntities(page, cliArgs.baseUrl, callerName, domainSlug, playbookName, specSlug);

  console.log(`  Resolved — caller: ${entities.callerId || "NONE"}, domain: ${entities.domainId || "NONE"}`);
  if (entities.playbookId) console.log(`             playbook: ${entities.playbookId}`);
  if (entities.specId) console.log(`             spec: ${entities.specId}`);

  let captured = 0;
  let skipped = 0;

  for (const spec of specs) {
    console.log(`\nDemo: ${spec.id} — "${spec.title}" (${spec.steps.length} steps)`);

    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i];
      const screenshots = extractScreenshots(step);

      if (screenshots.length === 0) {
        // Markdown-only step, no screenshots needed
        continue;
      }

      const pageUrl = resolvePageUrl(step, entities);

      for (const { src } of screenshots) {
        const stepLabel = `  [${i + 1}/${spec.steps.length}] "${step.title}"`;

        if (!pageUrl) {
          console.log(`${stepLabel} — SKIP (no page URL for ${src})`);
          skipped++;
          continue;
        }

        // Navigate
        const fullUrl = `${cliArgs.baseUrl}${pageUrl}`;
        console.log(`${stepLabel} → ${pageUrl}`);

        try {
          await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
          await waitForPageSettled(page);

          // Execute pre-capture actions
          if (step.capture?.actions?.length) {
            await executeCaptureActions(page, step.capture.actions);
          }

          // Wait for specific selector
          if (step.capture?.waitFor) {
            try {
              await page.locator(step.capture.waitFor).first().waitFor({ state: "visible", timeout: 5000 });
            } catch {
              console.log(`    waitFor "${step.capture.waitFor}" timed out, capturing anyway`);
            }
          }

          // Extra delay
          if (step.capture?.delay) {
            await page.waitForTimeout(step.capture.delay);
          }

          // Save screenshot
          const outputPath = path.join(PUBLIC_DIR, src);
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          await page.screenshot({ path: outputPath, type: "png" });

          console.log(`    ✓ Saved ${src}`);
          captured++;
        } catch (err) {
          console.log(`    ✗ Failed: ${(err as Error).message}`);
          skipped++;
        }
      }
    }
  }

  await browser.close();

  console.log(`\n=== Done ===`);
  console.log(`  Captured: ${captured}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Output:   ${PUBLIC_DIR}/demos/\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
