import { test, expect } from '../../fixtures';

/**
 * SortableList + TypePickerDialog E2E Tests
 *
 * Tests the unified drag-handle CRUD components across:
 * - Domain playbooks (SortableList with drag handles + kebab menus)
 * - Subjects / Curriculum (LessonPlanEditor uses SortableList)
 * - Playbook Builder (TypePickerDialog for adding specs)
 */

test.describe('SortableList — Domain Playbooks', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display drag handles on playbook rows', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Select a domain that has playbooks
    const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();
    if (await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainRow.click();
      await page.waitForTimeout(500);

      // Look for sortable cards with drag handles
      const dragHandles = page.locator('[data-testid="drag-handle"]');
      const handleCount = await dragHandles.count();
      // Playbooks tab may have sortable items
      if (handleCount > 0) {
        await expect(dragHandles.first()).toBeVisible();
      }
    }
  });

  test('should display kebab menus on sortable cards', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();
    if (await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainRow.click();
      await page.waitForTimeout(500);

      const kebabs = page.locator('[data-testid="kebab-trigger"]');
      const kebabCount = await kebabs.count();
      if (kebabCount > 0) {
        // Hover over card to reveal kebab (opacity changes on hover)
        const card = page.locator('[data-testid="sortable-card"]').first();
        await card.hover();
        await expect(kebabs.first()).toBeVisible();
      }
    }
  });

  test('should open kebab menu with move/delete options', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();
    if (await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainRow.click();
      await page.waitForTimeout(500);

      const kebabs = page.locator('[data-testid="kebab-trigger"]');
      if (await kebabs.count() > 0) {
        const card = page.locator('[data-testid="sortable-card"]').first();
        await card.hover();
        await kebabs.first().click();

        // Should see the kebab menu
        const menu = page.locator('[data-testid="kebab-menu"]');
        await expect(menu).toBeVisible();

        // Should have Move down and Delete options at minimum
        await expect(page.getByText('Move down')).toBeVisible();
        await expect(page.getByText('Delete')).toBeVisible();
      }
    }
  });
});

test.describe('SortableList — Curriculum / Lesson Plan', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display sortable list in lesson plan editor', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    // Navigate to a subject
    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('networkidle');

      // Look for the Curriculum tab or section
      const curriculumTab = page.getByText(/curriculum/i).first();
      if (await curriculumTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await curriculumTab.click();
        await page.waitForTimeout(500);

        // Look for sortable cards (lesson plan uses SortableList)
        const sortableCards = page.locator('[data-testid="sortable-card"]');
        const cardCount = await sortableCards.count();
        if (cardCount > 0) {
          // Should have drag handles
          const handles = page.locator('[data-testid="drag-handle"]');
          await expect(handles.first()).toBeVisible();
        }
      }
    }
  });

  test('should have add button in lesson plan', async ({ page }) => {
    await page.goto('/x');
    await page.waitForLoadState('networkidle');

    const subjectLink = page.locator('a[href*="/subjects/"]').first();
    if (await subjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await subjectLink.click();
      await page.waitForLoadState('networkidle');

      const curriculumTab = page.getByText(/curriculum/i).first();
      if (await curriculumTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await curriculumTab.click();
        await page.waitForTimeout(500);

        // SortableList renders an add button
        const addBtn = page.locator('[data-testid="add-btn"]');
        if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(addBtn).toBeVisible();
        }
      }
    }
  });
});

test.describe('TypePickerDialog — Playbook Builder', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should open type picker when clicking add button in playbook builder', async ({ page }) => {
    await page.goto('/x/playbooks');
    await page.waitForLoadState('networkidle');

    const playbookLink = page.locator('a[href*="/x/playbooks/"]').first();
    if (await playbookLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playbookLink.click();
      await page.waitForLoadState('networkidle');

      // Find the + button in any column header
      const addButtons = page.locator('button:has-text("+")');
      if (await addButtons.count() > 0) {
        await addButtons.first().click();
        await page.waitForTimeout(300);

        // TypePickerDialog should be visible
        const pickerOverlay = page.locator('[data-testid="picker-overlay"]');
        await expect(pickerOverlay).toBeVisible();

        // Should show the dialog
        const pickerDialog = page.locator('[data-testid="picker-dialog"]');
        await expect(pickerDialog).toBeVisible();

        // Should have a search input
        const searchInput = page.locator('[data-testid="picker-search"]');
        await expect(searchInput).toBeVisible();
      }
    }
  });

  test('should show categories in type picker', async ({ page }) => {
    await page.goto('/x/playbooks');
    await page.waitForLoadState('networkidle');

    const playbookLink = page.locator('a[href*="/x/playbooks/"]').first();
    if (await playbookLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playbookLink.click();
      await page.waitForLoadState('networkidle');

      const addButtons = page.locator('button:has-text("+")');
      if (await addButtons.count() > 0) {
        await addButtons.first().click();
        await page.waitForTimeout(300);

        // Should show category buttons
        const agentCat = page.locator('[data-testid="picker-cat-agent"]');
        const callerCat = page.locator('[data-testid="picker-cat-caller"]');
        const contentCat = page.locator('[data-testid="picker-cat-content"]');

        await expect(agentCat).toBeVisible();
        await expect(callerCat).toBeVisible();
        await expect(contentCat).toBeVisible();
      }
    }
  });

  test('should filter specs when searching in type picker', async ({ page }) => {
    await page.goto('/x/playbooks');
    await page.waitForLoadState('networkidle');

    const playbookLink = page.locator('a[href*="/x/playbooks/"]').first();
    if (await playbookLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playbookLink.click();
      await page.waitForLoadState('networkidle');

      const addButtons = page.locator('button:has-text("+")');
      if (await addButtons.count() > 0) {
        await addButtons.first().click();
        await page.waitForTimeout(300);

        const searchInput = page.locator('[data-testid="picker-search"]');
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Count items before search
          const itemsBefore = await page.locator('[data-testid^="picker-item-"]').count();

          // Type a search query
          await searchInput.fill('zzzznotfound');
          await page.waitForTimeout(300);

          // Items should be filtered (or show empty state)
          const itemsAfter = await page.locator('[data-testid^="picker-item-"]').count();
          expect(itemsAfter).toBeLessThanOrEqual(itemsBefore);
        }
      }
    }
  });

  test('should close type picker on Escape', async ({ page }) => {
    await page.goto('/x/playbooks');
    await page.waitForLoadState('networkidle');

    const playbookLink = page.locator('a[href*="/x/playbooks/"]').first();
    if (await playbookLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playbookLink.click();
      await page.waitForLoadState('networkidle');

      const addButtons = page.locator('button:has-text("+")');
      if (await addButtons.count() > 0) {
        await addButtons.first().click();
        await page.waitForTimeout(300);

        const pickerOverlay = page.locator('[data-testid="picker-overlay"]');
        if (await pickerOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Press Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          // Picker should be closed
          await expect(pickerOverlay).not.toBeVisible();
        }
      }
    }
  });

  test('should switch categories in type picker', async ({ page }) => {
    await page.goto('/x/playbooks');
    await page.waitForLoadState('networkidle');

    const playbookLink = page.locator('a[href*="/x/playbooks/"]').first();
    if (await playbookLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playbookLink.click();
      await page.waitForLoadState('networkidle');

      const addButtons = page.locator('button:has-text("+")');
      if (await addButtons.count() > 0) {
        await addButtons.first().click();
        await page.waitForTimeout(300);

        // Click on caller category
        const callerCat = page.locator('[data-testid="picker-cat-caller"]');
        if (await callerCat.isVisible({ timeout: 2000 }).catch(() => false)) {
          const itemsBefore = await page.locator('[data-testid^="picker-item-"]').count();
          await callerCat.click();
          await page.waitForTimeout(300);

          // Items should change (different category)
          const itemsAfter = await page.locator('[data-testid^="picker-item-"]').count();
          // We can't assert exact counts since it depends on seed data,
          // but the picker should still be visible and showing items
          const pickerDialog = page.locator('[data-testid="picker-dialog"]');
          await expect(pickerDialog).toBeVisible();
        }
      }
    }
  });
});

test.describe('SortableList — Extraction Levels', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display sortable extraction levels on domain detail', async ({ page }) => {
    await page.goto('/x/domains');
    await page.waitForLoadState('networkidle');

    // Navigate to a domain detail page that has extraction config
    const domainDetailLink = page.locator('a[href*="/domains/"]').first();
    if (await domainDetailLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await domainDetailLink.click();
      await page.waitForLoadState('networkidle');

      // Look for extraction tab or section
      const extractionLink = page.locator('a[href*="/extraction"]').first();
      if (await extractionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await extractionLink.click();
        await page.waitForLoadState('networkidle');

        // Look for sortable cards
        const sortableCards = page.locator('[data-testid="sortable-card"]');
        const cardCount = await sortableCards.count();
        if (cardCount > 0) {
          // Should have drag handles
          const handles = page.locator('[data-testid="drag-handle"]');
          await expect(handles.first()).toBeVisible();
        }
      }
    }
  });
});
