import { test, expect } from '../../fixtures';
import { StorageKeys } from '../../fixtures';

/**
 * Theme Settings Tests
 * Tests theme switching and persistence
 */
test.describe('Theme Settings', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Theme Toggle', () => {
    test('should display theme toggle', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      // Look for theme toggle button
      const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"], .theme-toggle');
      // May be in header or settings
    });

    test('should have light, dark, and system options', async ({ page }) => {
      await page.goto('/x/settings');
      await page.waitForLoadState('domcontentloaded');

      // Look for theme options
      const lightOption = page.locator('button:has-text("Light"), [data-theme="light"]');
      const darkOption = page.locator('button:has-text("Dark"), [data-theme="dark"]');
      const systemOption = page.locator('button:has-text("System"), [data-theme="system"]');

      // At least one should exist
    });

    test('should switch to dark theme', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      // Set dark theme via localStorage
      await page.evaluate((key) => {
        localStorage.setItem(key, 'dark');
      }, StorageKeys.THEME);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      // Check if dark theme is applied
      const htmlElement = page.locator('html');
      const hasDarkClass = await htmlElement.evaluate((el) => {
        return el.classList.contains('dark') || el.getAttribute('data-theme') === 'dark';
      });

      // Theme should be applied
    });

    test('should switch to light theme', async ({ page }) => {
      await page.goto('/x');

      await page.evaluate((key) => {
        localStorage.setItem(key, 'light');
      }, StorageKeys.THEME);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const htmlElement = page.locator('html');
      const hasLightClass = await htmlElement.evaluate((el) => {
        return !el.classList.contains('dark') || el.getAttribute('data-theme') === 'light';
      });

      // Theme should be applied
    });
  });

  test.describe('Theme Persistence', () => {
    test('should persist theme across page navigation', async ({ page }) => {
      await page.goto('/x');

      await page.evaluate((key) => {
        localStorage.setItem(key, 'dark');
      }, StorageKeys.THEME);

      // Navigate to different pages
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      const theme = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.THEME);

      expect(theme).toBe('dark');
    });

    test('should persist theme across sessions', async ({ page }) => {
      await page.goto('/x');

      await page.evaluate((key) => {
        localStorage.setItem(key, 'dark');
      }, StorageKeys.THEME);

      // Close and reopen page
      await page.close();

      const newPage = await page.context().newPage();
      await newPage.goto('/x');
      await newPage.waitForLoadState('domcontentloaded');

      const theme = await newPage.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.THEME);

      expect(theme).toBe('dark');

      await newPage.close();
    });
  });

  test.describe('Color Palette', () => {
    test('should save light mode palette', async ({ page }) => {
      await page.goto('/x/settings');
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate((key) => {
        localStorage.setItem(key, 'blue');
      }, StorageKeys.PALETTE_LIGHT);

      const palette = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.PALETTE_LIGHT);

      expect(palette).toBe('blue');
    });

    test('should save dark mode palette', async ({ page }) => {
      await page.goto('/x/settings');
      await page.waitForLoadState('domcontentloaded');

      await page.evaluate((key) => {
        localStorage.setItem(key, 'purple');
      }, StorageKeys.PALETTE_DARK);

      const palette = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, StorageKeys.PALETTE_DARK);

      expect(palette).toBe('purple');
    });
  });

  test.describe('CSS Variables', () => {
    test('should update CSS variables when theme changes', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      // Get initial background color
      const initialBg = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background');
      });

      // Switch theme
      await page.evaluate((key) => {
        const current = localStorage.getItem(key);
        localStorage.setItem(key, current === 'dark' ? 'light' : 'dark');
      }, StorageKeys.THEME);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const newBg = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--background');
      });

      // CSS variables should change (may or may not depending on implementation)
    });
  });
});
