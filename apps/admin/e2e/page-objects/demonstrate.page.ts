import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object for the Demonstrate page (/x/demonstrate)
 *
 * Domain-driven course readiness checklist with Start Lesson CTA.
 */
export class DemonstratePage extends BasePage {
  readonly path = '/x/demonstrate';

  readonly heading: Locator;
  readonly domainSelector: Locator;
  readonly readinessSection: Locator;
  readonly startLessonButton: Locator;
  readonly viewDomainButton: Locator;
  readonly quickLaunchButton: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByRole('heading', { name: 'Demonstrate' });
    this.domainSelector = page.getByText('Domain').locator('..');
    this.readinessSection = page.getByText('Course Readiness').locator('..');
    this.startLessonButton = page.getByRole('button', { name: 'Start Lesson' });
    this.viewDomainButton = page.getByRole('button', { name: 'View Domain' });
    this.quickLaunchButton = page.getByRole('button', { name: 'Quick Launch' });
  }
}
