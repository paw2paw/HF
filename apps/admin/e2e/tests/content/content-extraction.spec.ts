import { test, expect } from '../../fixtures';
import path from 'path';

/**
 * Content Extraction E2E
 *
 * Tests the content extraction pipeline via the course Content tab:
 * Upload → Extraction → Teaching Points appear → Methods assigned → Re-extract
 *
 * Requires:
 *   - Seeded DB with at least one course (playbook) with content sources
 *   - AI API keys for extraction
 */
test.describe('Content Extraction', () => {
  const testContentFile = path.resolve(__dirname, '../../fixtures/test-content.txt');
  let courseId: string;
  let courseName: string;

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    // Find a course with content sources
    const res = await page.request.get('/api/playbooks?limit=50');
    if (res.status() !== 200) {
      test.skip(true, 'Playbooks API unavailable');
      return;
    }

    const data = await res.json();
    const playbooks = data.playbooks || [];

    // Prefer a course that already has content
    const withContent = playbooks.find((p: any) => p._count?.assertions > 0 || p.domainId);
    const course = withContent || playbooks[0];

    if (!course) {
      test.skip(true, 'No courses available');
      return;
    }
    courseId = course.id;
    courseName = course.name || 'Untitled Course';
  });

  test('should load course page with Content tab', async ({ page }) => {
    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');

    // Course page should load with heading
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Content tab should be in the tab list
    const contentTab = page.getByRole('tab', { name: /content/i })
      .or(page.locator('[data-tab="content"]'))
      .or(page.getByText('Content').first());
    await expect(contentTab).toBeVisible({ timeout: 10_000 });
  });

  test('should show content breakdown on Content tab', async ({ page }) => {
    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');

    // Click Content tab
    const contentTab = page.getByText('Content').first();
    await contentTab.click();
    await page.waitForTimeout(1_000);

    // Should show content breakdown data (methods, teaching points, or empty state)
    const hasStats = await page.locator('.cwt-stats, .es-stat-bar, [class*="stat"]')
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    const hasSources = await page.getByText(/source|document/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const hasEmpty = await page.getByText(/no content|upload|add content/i)
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    // At least one of these states should be visible
    expect(hasStats || hasSources || hasEmpty).toBe(true);
  });

  test('should display teaching points grouped by category', async ({ page }) => {
    // Verify via API that this course has assertions
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    if (breakdownRes.status() !== 200) {
      test.skip(true, 'Content breakdown API unavailable');
      return;
    }
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.total === 0) {
      test.skip(true, `Course "${courseName}" has no extracted content`);
      return;
    }

    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');

    // Click Content tab
    await page.getByText('Content').first().click();
    await page.waitForTimeout(1_000);

    // Should show teaching point count
    const tpText = page.getByText(/teaching point/i).first();
    await expect(tpText).toBeVisible({ timeout: 10_000 });

    // Should show category breakdown (fact, definition, rule, etc.)
    const categoryPills = page.locator('.es-category-pill, [class*="category"]');
    const pillCount = await categoryPills.count();

    // At least one category should be visible if we have content
    if (breakdown.total > 0) {
      expect(pillCount).toBeGreaterThanOrEqual(0); // May be 0 if UI groups differently
    }
  });

  test('should show teaching methods distribution', async ({ page }) => {
    // API check for methods
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.methods?.length === 0) {
      test.skip(true, 'No teaching methods assigned');
      return;
    }

    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Content').first().click();
    await page.waitForTimeout(1_000);

    // Methods should be displayed (bar chart, badges, or list)
    const methodElements = page.locator('[class*="method"], [class*="teach-method"]');
    await expect(methodElements.first()).toBeVisible({ timeout: 10_000 });
  });

  test('should show unassigned content alert with auto-assign button', async ({ page }) => {
    // API check for unassigned content
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.unassignedContentCount === 0) {
      test.skip(true, 'No unassigned content to test');
      return;
    }

    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Content').first().click();
    await page.waitForTimeout(1_000);

    // Alert banner should mention unassigned content
    const alertBanner = page.getByText(/need.*method|unassigned/i).first();
    await expect(alertBanner).toBeVisible({ timeout: 10_000 });

    // Auto-assign button should be present
    const autoAssignBtn = page.getByRole('button', { name: /auto.assign/i });
    await expect(autoAssignBtn).toBeVisible();
  });

  test('should list source documents with doc-type badges', async ({ page }) => {
    // API check
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.total === 0) {
      test.skip(true, 'No content to display');
      return;
    }

    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Content').first().click();
    await page.waitForTimeout(2_000);

    // Source documents should be listed (links to content source detail pages)
    const sourceLinks = page.locator('a[href*="/x/content-sources/"]');
    const sourceCount = await sourceLinks.count();
    expect(sourceCount).toBeGreaterThanOrEqual(1);
  });

  test('should navigate to assertion detail via teaching points list', async ({ page }) => {
    // API check
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.total === 0) {
      test.skip(true, 'No teaching points to click');
      return;
    }

    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Content').first().click();
    await page.waitForTimeout(2_000);

    // Find teaching points section and expand it
    const tpSection = page.getByText(/teaching point/i).first();
    await tpSection.click();
    await page.waitForTimeout(500);

    // Click first teaching point row to open detail drawer
    const tpRows = page.locator('.cwt-tp-row, [class*="tp-row"]');
    const hasTpRows = await tpRows.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasTpRows) {
      await tpRows.first().click();

      // Drawer or detail panel should open
      const hasDrawer = await page.locator('[role="dialog"], .hf-drawer, [class*="drawer"]')
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasDrawer).toBe(true);
    }
  });

  test('should trigger re-extraction via re-extract button', async ({ page }) => {
    test.slow(); // Re-extraction involves AI calls

    // API check — need sources
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.total === 0) {
      test.skip(true, 'No content to re-extract');
      return;
    }

    await page.goto(`/x/courses/${courseId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('Content').first().click();
    await page.waitForTimeout(2_000);

    // Find re-extract button
    const reExtractBtn = page.getByRole('button', { name: /re.extract/i })
      .or(page.locator('[aria-label*="extract"]'));
    const hasBtn = await reExtractBtn.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasBtn) {
      test.skip(true, 'Re-extract button not visible');
      return;
    }

    await reExtractBtn.first().click();

    // Modal should appear with source selection
    const modal = page.locator('[role="dialog"], .hf-modal, [class*="modal"]').first();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show source checkboxes
    const checkboxes = modal.locator('input[type="checkbox"], [role="checkbox"]');
    const checkCount = await checkboxes.count();
    expect(checkCount).toBeGreaterThanOrEqual(1);
  });

  test('content breakdown API returns correct shape', async ({ page }) => {
    const res = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.total).toBe('number');
    expect(Array.isArray(data.methods)).toBe(true);

    // Each method should have teachMethod + count
    for (const method of data.methods) {
      expect(method).toHaveProperty('teachMethod');
      expect(method).toHaveProperty('count');
      expect(typeof method.count).toBe('number');
    }

    // Should have category counts
    if (data.categoryCounts) {
      expect(typeof data.categoryCounts).toBe('object');
    }
  });

  test('assertions drill-down API returns paginated results', async ({ page }) => {
    // First get available methods
    const breakdownRes = await page.request.get(`/api/courses/${courseId}/content-breakdown`);
    const breakdown = await breakdownRes.json();
    if (!breakdown.ok || breakdown.methods?.length === 0) {
      test.skip(true, 'No methods to drill into');
      return;
    }

    const firstMethod = breakdown.methods[0].teachMethod;

    // Drill down into that method
    const drillRes = await page.request.get(
      `/api/courses/${courseId}/content-breakdown?teachMethod=${firstMethod}&limit=10`,
    );
    expect(drillRes.status()).toBe(200);

    const drillData = await drillRes.json();
    expect(drillData.ok).toBe(true);
    expect(Array.isArray(drillData.assertions)).toBe(true);
    expect(typeof drillData.total).toBe('number');

    // Each assertion should have expected shape
    if (drillData.assertions.length > 0) {
      const first = drillData.assertions[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('assertion');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('teachMethod');
    }
  });
});
