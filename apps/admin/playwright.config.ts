import { defineConfig, devices } from '@playwright/test';

const AUTH_FILE = '.playwright/auth.json';

/**
 * Playwright Configuration for E2E Testing
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',

  /* Global setup for authentication */
  globalSetup: './e2e/global-setup.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Maximum time each action can take */
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    /* Authenticated tests - run with pre-established session */
    {
      name: 'authenticated',
      testMatch: /tests\/.+\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
    },

    /* Unauthenticated tests - for login flow testing */
    {
      name: 'unauthenticated',
      testMatch: /tests\/auth\/.+\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
    },

    /* Mobile viewport tests */
    {
      name: 'mobile',
      testMatch: /tests\/.+\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        storageState: AUTH_FILE,
      },
    },

    /* Legacy tests (deprecated routes) */
    {
      name: 'legacy',
      testMatch: /\d+-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
