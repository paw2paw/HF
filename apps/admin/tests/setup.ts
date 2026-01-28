/**
 * Vitest Test Setup
 *
 * Sets up mocks and test utilities for ops testing
 */

import { vi } from 'vitest';

// Mock Prisma Client
vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    constructor: function() {},
    call: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    caller: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    analysisSpec: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    callerPersonality: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    callerPersonalityProfile: {
      upsert: vi.fn(),
    },
    personalityObservation: {
      create: vi.fn(),
    },
    parameter: {
      findMany: vi.fn(),
    },
    callerMemory: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    callerMemorySummary: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    callerIdentity: {
      findMany: vi.fn(),
    },
    callScore: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    compiledAnalysisSet: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    behaviorTarget: {
      count: vi.fn(),
    },
    processedFile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    failedCall: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    knowledgeDoc: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    knowledgeChunk: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  };

  // Create a mock class
  const MockPrismaClient = function(this: any) {
    Object.assign(this, mockPrismaClient);
  };

  return {
    PrismaClient: MockPrismaClient,
    AnalysisOutputType: {
      MEASURE: 'MEASURE',
      LEARN: 'LEARN',
      CLASSIFY: 'CLASSIFY',
    },
    MemoryCategory: {
      FACT: 'FACT',
      PREFERENCE: 'PREFERENCE',
      EVENT: 'EVENT',
      TOPIC: 'TOPIC',
      RELATIONSHIP: 'RELATIONSHIP',
      CONTEXT: 'CONTEXT',
    },
    MemorySource: {
      EXTRACTED: 'EXTRACTED',
      INFERRED: 'INFERRED',
      EXPLICIT: 'EXPLICIT',
    },
    FileType: {
      SINGLE_CALL: 'SINGLE_CALL',
      BATCH_EXPORT: 'BATCH_EXPORT',
    },
    ProcessingStatus: {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      PARTIAL: 'PARTIAL',
      FAILED: 'FAILED',
    },
    FailedCallErrorType: {
      NO_TRANSCRIPT: 'NO_TRANSCRIPT',
      INVALID_FORMAT: 'INVALID_FORMAT',
      DUPLICATE: 'DUPLICATE',
      NO_CUSTOMER: 'NO_CUSTOMER',
      DB_ERROR: 'DB_ERROR',
      UNKNOWN: 'UNKNOWN',
    },
  };
});

// Mock fs for transcript tests
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
  },
}));

// Setup for React Testing Library
import '@testing-library/jest-dom';

// Mock next/navigation for page tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  usePathname: () => '/',
}));

// Mock global fetch
global.fetch = vi.fn();
