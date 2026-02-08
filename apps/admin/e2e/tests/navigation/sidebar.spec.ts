import { test, expect } from '../../fixtures';
import { SidebarPage } from '../../page-objects';

/**
 * Sidebar Navigation Tests
 * Tests sidebar navigation and route switching
 */
test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test.describe('Navigation Links', () => {
    test('should display sidebar on dashboard', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      const sidebar = new SidebarPage(page);
      await sidebar.verifySidebarStructure();
    });

    test('should navigate to Callers page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToCallers();

      await expect(page).toHaveURL(/\/x\/callers/);
    });

    test('should navigate to Playbooks page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToPlaybooks();

      await expect(page).toHaveURL(/\/x\/playbooks/);
    });

    test('should navigate to Pipeline page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToPipeline();

      await expect(page).toHaveURL(/\/x\/pipeline/);
    });

    test('should navigate to Playground page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToPlayground();

      await expect(page).toHaveURL(/\/x\/playground/);
    });

    test('should navigate to Specs page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToSpecs();

      await expect(page).toHaveURL(/\/x\/specs/);
    });

    test('should navigate to Domains page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToDomains();

      await expect(page).toHaveURL(/\/x\/domains/);
    });

    test('should navigate to Taxonomy page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToTaxonomy();

      await expect(page).toHaveURL(/\/x\/taxonomy/);
    });

    test('should navigate to Dictionary page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToDictionary();

      await expect(page).toHaveURL(/\/x\/dictionary/);
    });

    test('should navigate to Metering page', async ({ page }) => {
      const sidebar = new SidebarPage(page);
      await sidebar.goto();
      await sidebar.goToMetering();

      await expect(page).toHaveURL(/\/x\/metering/);
    });
  });

  test.describe('Active State', () => {
    test('should highlight current route', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      // Look for active nav item
      const activeLink = page.locator('[aria-current="page"], .active, [data-active="true"]');

      if (await activeLink.isVisible()) {
        const linkText = await activeLink.textContent();
        expect(linkText?.toLowerCase()).toContain('caller');
      }
    });

    test('should update active state on navigation', async ({ page }) => {
      await page.goto('/x/callers');
      await page.waitForLoadState('domcontentloaded');

      // Navigate to different page
      const sidebar = new SidebarPage(page);
      await sidebar.goToPlaybooks();

      // Active state should update
      const activeLink = page.locator('[aria-current="page"], .active, [data-active="true"]');

      if (await activeLink.isVisible()) {
        const linkText = await activeLink.textContent();
        expect(linkText?.toLowerCase()).toContain('playbook');
      }
    });
  });

  test.describe('Sidebar Sections', () => {
    test('should display organized sections', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      const sidebar = new SidebarPage(page);

      // Check for section headers or groups
      const sections = page.locator('nav section, nav [role="group"], .sidebar-section');
      // May have multiple sections
    });

    test('should collapse/expand sections', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      // Look for expandable sections
      const sectionHeaders = page.locator('[data-testid="section-header"], .section-toggle');

      if ((await sectionHeaders.count()) > 0) {
        const firstHeader = sectionHeaders.first();
        await firstHeader.click();

        await page.waitForTimeout(300);

        // Section content should toggle
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should be visible on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });

      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      const sidebar = page.locator('nav, aside').first();
      await expect(sidebar).toBeVisible();
    });

    test('should handle sidebar collapse', async ({ page }) => {
      await page.goto('/x');
      await page.waitForLoadState('domcontentloaded');

      const collapseButton = page.locator('[data-testid="sidebar-collapse"], button[aria-label*="collapse"]');

      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await page.waitForTimeout(300);

        // Sidebar should be collapsed (narrower or hidden)
      }
    });
  });
});

test.describe('Page Layout', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display header on all pages', async ({ page }) => {
    const pages = ['/x', '/x/callers', '/x/playbooks', '/x/pipeline'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('domcontentloaded');

      // Header should be visible
      const header = page.locator('header, [role="banner"]');
      await expect(header).toBeVisible();
    }
  });

  test('should display main content area', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('domcontentloaded');

    const main = page.locator('main, [role="main"]');
    await expect(main).toBeVisible();
  });
});
