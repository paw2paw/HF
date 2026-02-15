/**
 * Test data constants for E2E tests
 * Provides standard test users and entities
 */

const seedPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';

export const TestUsers = {
  ADMIN: {
    email: 'admin@test.com',
    password: seedPassword,
    role: 'ADMIN',
    name: 'Admin User',
  },
  ALICE: {
    email: 'alice@test.com',
    password: seedPassword,
    role: 'USER',
    name: 'Alice Test',
  },
  BOB: {
    email: 'bob@test.com',
    password: seedPassword,
    role: 'USER',
    name: 'Bob Test',
  },
} as const;

export const TestCallers = {
  JOHN_DOE: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1-555-0101',
  },
  JANE_SMITH: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+1-555-0102',
  },
} as const;

export const TestDomains = {
  DEFAULT: {
    name: 'Default Domain',
    slug: 'default',
  },
  SALES: {
    name: 'Sales',
    slug: 'sales',
  },
} as const;

/**
 * Generate a unique test ID for data isolation
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Storage keys used for user preferences
 */
export const StorageKeys = {
  PIPELINE_TABS: 'pipeline-tabs',
  SIDEBAR_ORDER: 'sidebar-section-order',
  THEME: 'theme',
  PALETTE_LIGHT: 'palette-light',
  PALETTE_DARK: 'palette-dark',
  CHAT_LAYOUT: 'chatLayout',
  CHAT_MODE: 'chatMode',
} as const;

/**
 * Cloud E2E test data — matches entities created by prisma/seed-e2e.ts
 */
export const CloudTestData = {
  E2E_CALLER: {
    name: 'E2E Test Caller',
    externalId: 'e2e-sim-caller',
  },
  E2E_DOMAIN: {
    name: 'E2E Test Domain',
    slug: 'e2e-test-domain',
  },
  QUICK_LAUNCH_SUBJECT: `E2E Cloud Test`,
} as const;
