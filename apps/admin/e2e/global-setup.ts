import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

const AUTH_FILE = '.playwright/auth.json';

/**
 * Ensure test database is migrated (local only — CI handles its own DB).
 * Runs prisma migrate deploy which is fast and idempotent.
 */
function ensureTestDb() {
  if (process.env.CI) return;

  console.log('[Global Setup] Running Prisma migrate deploy on test DB...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'pipe' });
    console.log('[Global Setup] Migrations up to date.');
  } catch (error) {
    console.error(
      '\n[Global Setup] Database migration failed.\n' +
      'Run this first: npm run test:e2e:setup\n'
    );
    throw error;
  }
}

/**
 * Global Setup
 * Runs once before all tests to establish authenticated session state
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  ensureTestDb();

  console.log('[Global Setup] Starting authentication...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page and wait for full render (cloud tunnel can be slow)
    const isCloud = !!process.env.CLOUD_E2E;
    await page.goto(`${baseURL}/login`, { timeout: isCloud ? 60000 : 30000 });
    await page.waitForLoadState('networkidle', { timeout: isCloud ? 30000 : 15000 });

    // Fill in credentials (using default admin user)
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill(process.env.SEED_ADMIN_PASSWORD || 'admin123');

    // Submit login form
    await page.locator('button[type="submit"]').click();

    // Wait for successful redirect to /x (domcontentloaded — dashboard has long-lived connections that block 'load')
    await page.waitForURL(/\/x/, { timeout: isCloud ? 60000 : 15000, waitUntil: 'domcontentloaded' });

    console.log('[Global Setup] Login successful, saving auth state...');

    // Save storage state (cookies, localStorage) for reuse
    await context.storageState({ path: AUTH_FILE });

    console.log('[Global Setup] Auth state saved to:', AUTH_FILE);
  } catch (error) {
    console.error('[Global Setup] Authentication failed:', error);
    // Take screenshot on failure for debugging
    await page.screenshot({ path: 'playwright-report/global-setup-failure.png' });
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
