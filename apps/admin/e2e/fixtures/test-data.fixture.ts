/**
 * Test data constants for E2E tests
 * Provides standard test users and entities
 */

export const TestUsers = {
  ADMIN: {
    email: 'admin@test.com',
    password: 'admin123',
    role: 'ADMIN',
    name: 'Admin User',
  },
  ALICE: {
    email: 'alice@test.com',
    password: 'admin123',
    role: 'USER',
    name: 'Alice Test',
  },
  BOB: {
    email: 'bob@test.com',
    password: 'admin123',
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
