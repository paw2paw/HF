import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Call Simulation
 *
 * Tests the call simulation workflow through the chat panel
 */

test.describe('Call Simulation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a caller page
    await page.goto('/callers');
    await page.waitForSelector('[data-testid="caller-card"]');
    await page.locator('[data-testid="caller-card"]').first().click();

    // Open chat panel
    await page.keyboard.press('Meta+K');
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
  });

  test('should start a simulated call', async ({ page }) => {
    // Switch to CALL mode
    await page.click('text=CALL');

    // Verify Start Call button is visible
    const startButton = page.locator('button:has-text("Start Call")');
    await expect(startButton).toBeVisible();
    await expect(startButton).toBeEnabled();

    // Start the call
    await startButton.click();

    // Verify call started
    await expect(page.locator('text=CALL IN PROGRESS')).toBeVisible();

    // Verify message input is enabled
    const messageInput = page.locator('textarea[placeholder*="Message"]');
    await expect(messageInput).toBeEnabled();
  });

  test('should send messages during call', async ({ page }) => {
    // Start call
    await page.click('text=CALL');
    await page.click('button:has-text("Start Call")');

    // Wait for call to start
    await expect(page.locator('text=CALL IN PROGRESS')).toBeVisible();

    // Type a message
    const messageInput = page.locator('textarea[placeholder*="Message"]');
    await messageInput.fill('Hello, I need help with something');

    // Send message
    await page.click('button:has-text("Send")');

    // Verify message appears in chat
    await expect(page.locator('text=Hello, I need help with something')).toBeVisible();

    // Wait for AI response (with timeout)
    await expect(page.locator('.ai-message').first()).toBeVisible({ timeout: 15000 });
  });

  test('should end a call', async ({ page }) => {
    // Start and send a message
    await page.click('text=CALL');
    await page.click('button:has-text("Start Call")');

    await expect(page.locator('text=CALL IN PROGRESS')).toBeVisible();

    // End the call
    const endButton = page.locator('button:has-text("End Call")');
    await expect(endButton).toBeVisible();
    await endButton.click();

    // Verify call ended
    await expect(page.locator('text=CALL IN PROGRESS')).not.toBeVisible();

    // Verify Start Call button is back
    await expect(page.locator('button:has-text("Start Call")')).toBeVisible();
  });
});
