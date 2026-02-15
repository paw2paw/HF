import { chromium, FullConfig } from '@playwright/test';

const AUTH_FILE = '.playwright/auth.json';

/**
 * Global Setup
 * Runs once before all tests to establish authenticated session state
 */
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;

  console.log('[Global Setup] Starting authentication...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Fill in credentials (using default admin user)
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill(process.env.SEED_ADMIN_PASSWORD || 'admin123');

    // Submit login form
    await page.locator('button[type="submit"]').click();

    // Wait for successful redirect to /x
    await page.waitForURL(/\/x/, { timeout: 15000 });

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
