import { test, expect } from '../../fixtures';
import { SimPage } from '../../page-objects';
import { CloudTestData } from '../../fixtures/test-data.fixture';

/**
 * Call Simulation Cloud E2E Tests
 *
 * Tests the sim conversation flow using a seeded E2E caller:
 * Load page → AI greeting → Send message → Get response → End call
 *
 * Requires:
 *   - seed-e2e.ts has been run (E2E Test Caller exists)
 *   - AI API keys configured in cloud environment
 */
test.describe('Call Simulation', () => {
  let callerId: string;

  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin@test.com');

    // Look up the seeded E2E caller by searching
    const response = await page.request.get(
      `/api/callers?search=${encodeURIComponent(CloudTestData.E2E_CALLER.name)}`
    );
    const data = await response.json();
    const found = data.callers?.find(
      (c: any) => c.externalId === CloudTestData.E2E_CALLER.externalId
    );

    if (!found) {
      test.skip(true, 'E2E test caller not found — run seed-e2e.ts first');
      return;
    }
    callerId = found.id;
  });

  test('should load sim page for seeded caller', async ({ page }) => {
    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Should show caller name in header
    await expect(sim.headerTitle).toHaveText(CloudTestData.E2E_CALLER.name, { timeout: 15_000 });
  });

  test('should receive AI greeting on page load', async ({ page }) => {
    test.slow(); // AI response streaming

    const sim = new SimPage(page, callerId);
    await sim.goto();

    // AI sends greeting automatically
    await sim.waitForGreeting(45_000);

    // Should have at least one assistant message
    const count = await sim.getMessageCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should send message and receive AI response', async ({ page }) => {
    test.slow(); // Multiple AI round-trips

    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Wait for greeting
    await sim.waitForGreeting(45_000);
    const greetingCount = await sim.getMessageCount();

    // Send user message
    await sim.sendMessage('Hello, can you help me with basic algebra?');

    // Wait for AI response
    await sim.waitForResponse(45_000);

    // Should have more messages now (greeting + user msg + AI response)
    const newCount = await sim.getMessageCount();
    expect(newCount).toBeGreaterThan(greetingCount);
  });

  test('should end call and save transcript', async ({ page }) => {
    test.slow();

    const sim = new SimPage(page, callerId);
    await sim.goto();

    // Wait for greeting
    await sim.waitForGreeting(45_000);

    // Send a message so there's content to save
    await sim.sendMessage('Just testing the end call flow');
    await sim.waitForResponse(45_000);

    // End call without pipeline (faster for testing)
    await sim.endCall(false);

    // Should show success toast
    const toastText = await sim.waitForToast(15_000);
    expect(toastText).toMatch(/saved/i);
  });
});
