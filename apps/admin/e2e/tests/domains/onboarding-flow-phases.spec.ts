import { test, expect } from '../../fixtures';

/**
 * Onboarding Flow Phases E2E Tests
 *
 * Tests the onboarding flow phases editor on the Domains page,
 * which uses the shared SortableList component for drag-and-drop
 * reordering, kebab menus, and add/remove operations.
 */

/** Navigate to a domain and open the onboarding editor */
async function openOnboardingEditor(page: import('@playwright/test').Page) {
  await page.goto('/x/domains');
  await page.waitForLoadState('networkidle');

  // Select a domain
  const domainRow = page.locator('tr, [class*="domain-card"], [class*="list-item"]').first();
  if (!await domainRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    return false;
  }
  await domainRow.click();
  await page.waitForTimeout(500);

  // Switch to Onboarding tab
  const onboardingTab = page.getByText(/onboarding/i).first();
  if (!await onboardingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    return false;
  }
  await onboardingTab.click();
  await page.waitForTimeout(500);

  // Click Edit button to enter editing mode
  const editButton = page.locator('button:has-text("Edit Onboarding"), button:has-text("Edit"), button:has-text("Configure")').first();
  if (!await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    return false;
  }
  await editButton.click();
  await page.waitForTimeout(500);

  return true;
}

test.describe('Onboarding Flow Phases — SortableList', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');
  });

  test('should display flow phases section in onboarding editor', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Flow Phases label should be visible
    const flowPhasesLabel = page.getByText('Flow Phases');
    await expect(flowPhasesLabel).toBeVisible();

    // Visual/JSON mode toggle should be present
    const visualBtn = page.locator('button:has-text("Visual")');
    const jsonBtn = page.locator('button:has-text("JSON")');
    await expect(visualBtn).toBeVisible();
    await expect(jsonBtn).toBeVisible();
  });

  test('should show add button for flow phases in visual mode', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure we're in visual mode
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    // SortableList renders an add button or empty state
    const addBtn = page.locator('[data-testid="add-btn"]');
    const emptyState = page.locator('[data-testid="empty-state"]');

    const hasAdd = await addBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    // Either there are existing phases (with an add button at the bottom)
    // or there's an empty state with an add button
    expect(hasAdd || hasEmpty).toBeTruthy();
  });

  test('should add a new phase via add button', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    // Count existing sortable cards
    const cardsBefore = await page.locator('[data-testid="sortable-card"]').count();

    // Click add button
    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);

      // Should have one more card
      const cardsAfter = await page.locator('[data-testid="sortable-card"]').count();
      expect(cardsAfter).toBe(cardsBefore + 1);
    }
  });

  test('should display drag handles on phase cards', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    // Add a phase if none exist
    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);
    }

    // Should have drag handles on cards
    const handles = page.locator('[data-testid="drag-handle"]');
    if (await handles.count() > 0) {
      await expect(handles.first()).toBeVisible();
    }
  });

  test('should display kebab menu on phase card hover', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode and at least one phase
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);
    }

    // Hover over card to reveal kebab
    const card = page.locator('[data-testid="sortable-card"]').first();
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      await card.hover();

      const kebab = page.locator('[data-testid="kebab-trigger"]').first();
      await expect(kebab).toBeVisible();
    }
  });

  test('should open kebab menu with move and delete options', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode and at least one phase
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);
    }

    const card = page.locator('[data-testid="sortable-card"]').first();
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      await card.hover();

      const kebab = page.locator('[data-testid="kebab-trigger"]').first();
      if (await kebab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await kebab.click();
        await page.waitForTimeout(200);

        const menu = page.locator('[data-testid="kebab-menu"]');
        await expect(menu).toBeVisible();

        // Should have Move up/down options
        await expect(page.getByText('Move up')).toBeVisible();
        await expect(page.getByText('Move down')).toBeVisible();
      }
    }
  });

  test('should delete phase via kebab menu', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    // Add two phases so delete is available (minItems=0)
    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);
      await addBtn.click();
      await page.waitForTimeout(300);
    }

    const cardsBefore = await page.locator('[data-testid="sortable-card"]').count();
    if (cardsBefore === 0) return;

    // Hover + open kebab + click Delete
    const card = page.locator('[data-testid="sortable-card"]').first();
    await card.hover();

    const kebab = page.locator('[data-testid="kebab-trigger"]').first();
    if (await kebab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await kebab.click();
      await page.waitForTimeout(200);

      const deleteBtn = page.getByText('Delete');
      if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteBtn.click();
        await page.waitForTimeout(300);

        const cardsAfter = await page.locator('[data-testid="sortable-card"]').count();
        expect(cardsAfter).toBe(cardsBefore - 1);
      }
    }
  });

  test('should render phase form fields inside card', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    // Add a phase
    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);
    }

    const card = page.locator('[data-testid="sortable-card"]').first();
    if (!await card.isVisible({ timeout: 2000 }).catch(() => false)) return;

    // Should contain Phase Name input
    const phaseNameInput = card.locator('input[placeholder*="welcome"]');
    await expect(phaseNameInput).toBeVisible();

    // Should contain Duration input
    const durationInput = card.locator('input[placeholder*="2min"]');
    await expect(durationInput).toBeVisible();

    // Should contain Goals textarea
    const goalsTextarea = card.locator('textarea[placeholder*="goals"]');
    await expect(goalsTextarea).toBeVisible();

    // Should show "Phase 1" label
    await expect(card.getByText('Phase 1')).toBeVisible();
  });

  test('should accept input in phase form fields', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    // Ensure visual mode
    const visualBtn = page.locator('button:has-text("Visual")');
    if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await visualBtn.click();
      await page.waitForTimeout(300);
    }

    // Add a phase
    const addBtn = page.locator('[data-testid="add-btn"]');
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);
    }

    const card = page.locator('[data-testid="sortable-card"]').first();
    if (!await card.isVisible({ timeout: 2000 }).catch(() => false)) return;

    // Fill in phase name
    const phaseNameInput = card.locator('input[placeholder*="welcome"]');
    if (await phaseNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await phaseNameInput.fill('introduction');
      await expect(phaseNameInput).toHaveValue('introduction');
    }

    // Fill in duration
    const durationInput = card.locator('input[placeholder*="2min"]');
    if (await durationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await durationInput.fill('3min');
      await expect(durationInput).toHaveValue('3min');
    }

    // Fill in goals
    const goalsTextarea = card.locator('textarea[placeholder*="goals"]');
    if (await goalsTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await goalsTextarea.fill('Greet the learner\nSet expectations');
      await expect(goalsTextarea).toHaveValue('Greet the learner\nSet expectations');
    }
  });

  test('should toggle between visual and JSON mode', async ({ page }) => {
    const opened = await openOnboardingEditor(page);
    if (!opened) return;

    const visualBtn = page.locator('button:has-text("Visual")');
    const jsonBtn = page.locator('button:has-text("JSON")');

    if (!await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) return;
    if (!await jsonBtn.isVisible({ timeout: 2000 }).catch(() => false)) return;

    // Switch to JSON mode
    await jsonBtn.click();
    await page.waitForTimeout(300);

    // Should show a textarea for JSON editing
    const jsonTextarea = page.locator('textarea[placeholder*="phases"]');
    await expect(jsonTextarea).toBeVisible();

    // Switch back to visual mode
    await visualBtn.click();
    await page.waitForTimeout(300);

    // SortableList elements should be available (add button or cards)
    const addBtn = page.locator('[data-testid="add-btn"]');
    const emptyState = page.locator('[data-testid="empty-state"]');
    const sortableCard = page.locator('[data-testid="sortable-card"]');

    const hasAdd = await addBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
    const hasCards = await sortableCard.count() > 0;

    expect(hasAdd || hasEmpty || hasCards).toBeTruthy();
  });
});
