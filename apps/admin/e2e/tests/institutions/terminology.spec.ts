import { test, expect } from '../../fixtures';

/**
 * Terminology Profiles E2E Tests
 *
 * Tests the per-institution configurable terminology feature:
 *   - Terminology editor on institution settings page
 *   - Preset picker (School, Corporate, Coaching, Healthcare)
 *   - Custom term overrides
 *   - Save + persistence
 *   - Propagation to educator dashboard + classrooms page
 */

test.describe('Terminology Editor', () => {
  let institutionId: string;

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    // Find the first institution from the API
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/institutions');
      return r.json();
    });

    if (res?.ok && res.institutions?.length > 0) {
      institutionId = res.institutions[0].id;
    }
  });

  test('should load institution settings with terminology section', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // The "Terminology Profile" heading should be visible
    const heading = page.getByText('Terminology Profile');
    await expect(heading).toBeVisible();

    // Description text should be visible
    const description = page.getByText(/choose how your institution labels/i);
    await expect(description).toBeVisible();
  });

  test('should display all four preset buttons', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // All four presets should be visible
    await expect(page.getByText('School', { exact: false }).locator('xpath=ancestor::button').first()).toBeVisible();
    await expect(page.getByText('Corporate').locator('xpath=ancestor::button').first()).toBeVisible();
    await expect(page.getByText('Coaching').locator('xpath=ancestor::button').first()).toBeVisible();
    await expect(page.getByText('Healthcare').locator('xpath=ancestor::button').first()).toBeVisible();
  });

  test('should show preview table with resolved terms', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // The preview section should show all 5 term keys
    const preview = page.getByText('Preview').locator('..');
    await expect(preview).toBeVisible();

    // All term keys should appear
    for (const key of ['institution', 'cohort', 'learner', 'instructor', 'supervisor']) {
      await expect(page.getByText(key, { exact: true }).first()).toBeVisible();
    }
  });

  test('should switch presets and update preview', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // Click "Corporate" preset
    const corporateBtn = page.locator('button').filter({ hasText: 'Corporate' }).first();
    await corporateBtn.click();

    // Preview should now show corporate terms
    await expect(page.getByText('Organization').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
    await expect(page.getByText('Employee').first()).toBeVisible();
    await expect(page.getByText('Trainer').first()).toBeVisible();

    // Click "Coaching" preset
    const coachingBtn = page.locator('button').filter({ hasText: 'Coaching' }).first();
    await coachingBtn.click();

    // Preview should now show coaching terms
    await expect(page.getByText('Practice').first()).toBeVisible();
    await expect(page.getByText('Group').first()).toBeVisible();
    await expect(page.getByText('Client').first()).toBeVisible();
    await expect(page.getByText('Coach', { exact: true }).first()).toBeVisible();

    // Click "Healthcare" preset
    const healthcareBtn = page.locator('button').filter({ hasText: 'Healthcare' }).first();
    await healthcareBtn.click();

    // Preview should now show healthcare terms
    await expect(page.getByText('Facility').first()).toBeVisible();
    await expect(page.getByText('Patient').first()).toBeVisible();
    await expect(page.getByText('Provider').first()).toBeVisible();
  });

  test('should toggle customize fields', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // Customize toggle should be visible
    const customizeToggle = page.getByText('Customize individual terms');
    await expect(customizeToggle).toBeVisible();

    // Click to expand customization
    await customizeToggle.click();

    // 5 text inputs should appear (one for each term key)
    const termInputs = page.locator('input[type="text"][placeholder]');
    // Wait for at least one override input to be visible
    await expect(page.getByText('Hide customization')).toBeVisible();

    // Click to hide
    await page.getByText('Hide customization').click();
    await expect(page.getByText('Customize individual terms')).toBeVisible();
  });

  test('should apply custom overrides and show "custom" badge', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // Select School preset first
    await page.locator('button').filter({ hasText: 'School' }).first().click();

    // Open customize
    await page.getByText('Customize individual terms').click();

    // Override the "learner" field — find the input with "Student" placeholder
    const learnerInput = page.locator('input[placeholder="Student"]');
    await learnerInput.fill('Pupil');

    // The preview should now show "Pupil" instead of "Student"
    // and a "custom" badge should appear
    await expect(page.getByText('Pupil').first()).toBeVisible();
    await expect(page.getByText('custom').first()).toBeVisible();
  });

  test('should save terminology and show success message', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // Select Corporate preset
    await page.locator('button').filter({ hasText: 'Corporate' }).first().click();

    // Save
    await page.getByText('Save Changes').click();

    // Should see "Saved" confirmation
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });
  });

  test('should persist saved terminology on page reload', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');

    // Select Coaching preset and save
    await page.locator('button').filter({ hasText: 'Coaching' }).first().click();
    await page.getByText('Save Changes').click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Coaching terms should still be displayed in the preview
    await expect(page.getByText('Practice').first()).toBeVisible();
    await expect(page.getByText('Group').first()).toBeVisible();
    await expect(page.getByText('Client').first()).toBeVisible();
  });
});

test.describe('Terminology Propagation', () => {
  let institutionId: string;

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    // Find the first institution
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/institutions');
      return r.json();
    });

    if (res?.ok && res.institutions?.length > 0) {
      institutionId = res.institutions[0].id;
    }
  });

  test('should reflect terminology on educator dashboard', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    // Set Corporate terminology
    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: 'Corporate' }).first().click();
    await page.getByText('Save Changes').click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Navigate to educator dashboard
    await page.goto('/x/educator');
    await page.waitForLoadState('networkidle');

    // The dashboard should use corporate terminology
    // Heading could be "My Organization" or "Select a Organization"
    const pageContent = await page.locator('main, [role="main"]').textContent();
    // At least one corporate term should appear somewhere on the page
    const hasCorporateTerm =
      pageContent?.includes('Organization') ||
      pageContent?.includes('Team') ||
      pageContent?.includes('Employee') ||
      pageContent?.includes('Trainer');
    expect(hasCorporateTerm).toBeTruthy();
  });

  test('should reflect terminology on classrooms page', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    // Set Corporate terminology
    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: 'Corporate' }).first().click();
    await page.getByText('Save Changes').click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Navigate to classrooms page
    await page.goto('/x/educator/classrooms');
    await page.waitForLoadState('networkidle');

    // The heading should say "Teams" (plural of corporate cohort "Team")
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(headingText).toContain('Teams');

    // The "New" button should say "+ New Team"
    const newBtn = page.getByText(/\+ New Team/);
    await expect(newBtn).toBeVisible();
  });

  test('should reflect terminology on new classroom page', async ({ page }) => {
    test.skip(!institutionId, 'No institutions seeded');

    // Set Coaching terminology
    await page.goto(`/x/institutions/${institutionId}`);
    await page.waitForLoadState('networkidle');
    await page.locator('button').filter({ hasText: 'Coaching' }).first().click();
    await page.getByText('Save Changes').click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Navigate to new classroom page
    await page.goto('/x/educator/classrooms/new');
    await page.waitForLoadState('networkidle');

    // Should use coaching terminology — "Group" instead of "Classroom"
    const pageContent = await page.locator('main, [role="main"]').textContent();
    const hasCoachingTerm =
      pageContent?.includes('Group') || pageContent?.includes('group');
    expect(hasCoachingTerm).toBeTruthy();
  });

  test.afterAll(async ({ browser }) => {
    // Reset terminology back to school defaults to avoid polluting other tests
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#email').fill('admin@test.com');
    await page.locator('#password').fill(process.env.SEED_ADMIN_PASSWORD || 'admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/x/, { timeout: 10000 });

    // Find institution
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/institutions');
      return r.json();
    });

    if (res?.ok && res.institutions?.length > 0) {
      const id = res.institutions[0].id;
      await page.goto(`/x/institutions/${id}`);
      await page.waitForLoadState('networkidle');

      // Reset to School preset
      await page.locator('button').filter({ hasText: 'School' }).first().click();
      await page.getByText('Save Changes').click();
      await page.waitForTimeout(1000);
    }

    await context.close();
  });
});
