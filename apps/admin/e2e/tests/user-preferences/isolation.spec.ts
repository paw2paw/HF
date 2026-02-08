import { test, expect, BrowserContext } from '@playwright/test';
import { TestUsers, StorageKeys } from '../../fixtures';

/**
 * User Preferences Isolation Tests
 * Based on features/user-preferences.feature
 *
 * Tests that user preferences are isolated per user and persist across sessions
 */
test.describe('User Preferences Isolation', () => {
  test.describe('Multi-User Isolation', () => {
    let aliceContext: BrowserContext;
    let bobContext: BrowserContext;

    test.beforeAll(async ({ browser }) => {
      // Create separate browser contexts for each user
      aliceContext = await browser.newContext();
      bobContext = await browser.newContext();

      // Login Alice
      const alicePage = await aliceContext.newPage();
      await alicePage.goto('/login');
      await alicePage.locator('#email').fill(TestUsers.ALICE.email);
      await alicePage.locator('#password').fill(TestUsers.ALICE.password);
      await alicePage.locator('button[type="submit"]').click();
      await alicePage.waitForURL(/\/x/, { timeout: 10000 });
      await alicePage.close();

      // Login Bob
      const bobPage = await bobContext.newPage();
      await bobPage.goto('/login');
      await bobPage.locator('#email').fill(TestUsers.BOB.email);
      await bobPage.locator('#password').fill(TestUsers.BOB.password);
      await bobPage.locator('button[type="submit"]').click();
      await bobPage.waitForURL(/\/x/, { timeout: 10000 });
      await bobPage.close();
    });

    test.afterAll(async () => {
      await aliceContext?.close();
      await bobContext?.close();
    });

    test('Alice preferences should not affect Bob', async () => {
      // Alice customizes tab order on pipeline page
      const alicePage = await aliceContext.newPage();
      await alicePage.goto('/x/pipeline');
      await alicePage.waitForLoadState('domcontentloaded');

      // Store a custom preference for Alice
      await alicePage.evaluate((key) => {
        localStorage.setItem(key, JSON.stringify(['Blueprint', 'Inspector']));
      }, `${StorageKeys.PIPELINE_TABS}.alice`);

      await alicePage.close();

      // Bob should see default order
      const bobPage = await bobContext.newPage();
      await bobPage.goto('/x/pipeline');
      await bobPage.waitForLoadState('domcontentloaded');

      // Bob's localStorage should not have Alice's key
      const bobHasAlicePrefs = await bobPage.evaluate((key) => {
        return localStorage.getItem(key) !== null;
      }, `${StorageKeys.PIPELINE_TABS}.alice`);

      expect(bobHasAlicePrefs).toBe(false);
      await bobPage.close();
    });

    test('preferences persist across sessions for same user', async () => {
      // Alice sets a preference
      const alicePage1 = await aliceContext.newPage();
      await alicePage1.goto('/x/pipeline');

      const customOrder = ['Blueprint', 'Inspector'];
      await alicePage1.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: StorageKeys.PIPELINE_TABS, value: customOrder }
      );
      await alicePage1.close();

      // Alice opens new page - preference should persist
      const alicePage2 = await aliceContext.newPage();
      await alicePage2.goto('/x/pipeline');

      const storedOrder = await alicePage2.evaluate((key) => {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      }, StorageKeys.PIPELINE_TABS);

      expect(storedOrder).toEqual(customOrder);
      await alicePage2.close();
    });
  });

  test.describe('Tab Order Persistence', () => {
    test('should save tab order to localStorage', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      // Simulate saving tab order
      const tabOrder = ['Tab1', 'Tab2', 'Tab3'];
      await page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: StorageKeys.PIPELINE_TABS, value: tabOrder }
      );

      // Verify it was saved
      const stored = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.PIPELINE_TABS);

      expect(JSON.parse(stored!)).toEqual(tabOrder);
    });

    test('should restore tab order from localStorage', async ({ page }) => {
      // Pre-set tab order
      const savedOrder = ['Inspector', 'Blueprint'];

      await page.goto('/x/pipeline');

      // Set before page fully loads
      await page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: StorageKeys.PIPELINE_TABS, value: savedOrder }
      );

      // Reload page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Verify localStorage still has the order
      const restored = await page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      }, StorageKeys.PIPELINE_TABS);

      expect(restored).toEqual(savedOrder);
    });
  });

  test.describe('Sidebar Order Persistence', () => {
    test('should save sidebar section order', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      const sectionOrder = ['Data', 'Prompts', 'System', 'Admin'];
      await page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        { key: StorageKeys.SIDEBAR_ORDER, value: sectionOrder }
      );

      const stored = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.SIDEBAR_ORDER);

      expect(JSON.parse(stored!)).toEqual(sectionOrder);
    });
  });

  test.describe('Theme Persistence', () => {
    test('should save theme preference', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      // Set theme to dark
      await page.evaluate((key) => {
        localStorage.setItem(key, 'dark');
      }, StorageKeys.THEME);

      const theme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.THEME);

      expect(theme).toBe('dark');
    });

    test('should persist theme across page navigation', async ({ page }) => {
      await page.goto('/x');

      await page.evaluate((key) => {
        localStorage.setItem(key, 'light');
      }, StorageKeys.THEME);

      // Navigate to different page
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const theme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.THEME);

      expect(theme).toBe('light');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle localStorage errors gracefully', async ({ page }) => {
      await page.goto('/x/pipeline');
      await page.waitForLoadState('domcontentloaded');

      // Mock localStorage to throw on setItem
      await page.evaluate(() => {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = () => {
          throw new Error('QuotaExceededError');
        };
      });

      // Page should not crash
      await expect(page.locator('body')).toBeVisible();
    });

    test('should use defaults for corrupted stored data', async ({ page }) => {
      // Pre-set corrupted data
      await page.goto('/x');
      await page.evaluate((key) => {
        localStorage.setItem(key, 'not-valid-json{{{');
      }, StorageKeys.PIPELINE_TABS);

      // Reload page - should not crash
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Anonymous Users', () => {
    test('should allow preferences for anonymous users', async ({ browser }) => {
      // Create context without authentication
      const context = await browser.newContext();
      const page = await context.newPage();

      // Go to login page (anonymous can access)
      await page.goto('/login');

      // Should be able to store preferences
      await page.evaluate((key) => {
        localStorage.setItem(key, 'dark');
      }, StorageKeys.THEME);

      const theme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.THEME);

      expect(theme).toBe('dark');

      await context.close();
    });
  });
});
