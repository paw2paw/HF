/**
 * Tests for seedContracts() in seed-from-specs.ts
 *
 * Covers:
 * - Reads .contract.json files from docs-archive/bdd-specs/contracts/
 * - Upserts each contract into SystemSetting with contract:{id} key
 * - Skips contracts missing contractId or version
 * - Reports errors for malformed JSON
 * - Handles missing contracts directory gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock systemSetting on the PrismaClient mock
const mockSystemSettingUpsert = vi.fn();

// Mock @prisma/client to include systemSetting
vi.mock('@prisma/client', () => {
  const MockPrismaClient = function(this: any) {
    this.systemSetting = { upsert: mockSystemSettingUpsert };
    this.$disconnect = vi.fn();
    // Include other models the module might reference at import time
    this.bDDFeatureSet = { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
    this.analysisSpec = { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() };
    this.parameter = { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() };
    this.parameterScoringAnchor = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() };
    this.promptSlug = { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() };
  };
  return {
    PrismaClient: MockPrismaClient,
    AnalysisOutputType: { MEASURE: 'MEASURE', LEARN: 'LEARN', ADAPT: 'ADAPT', CLASSIFY: 'CLASSIFY', MEASURE_AGENT: 'MEASURE_AGENT', REWARD: 'REWARD', COMPOSE: 'COMPOSE', AGGREGATE: 'AGGREGATE' },
    ScaleType: { CONTINUOUS_0_1: 'CONTINUOUS_0_1', CONTINUOUS_0_10: 'CONTINUOUS_0_10', DISCRETE: 'DISCRETE', CATEGORICAL: 'CATEGORICAL', BINARY: 'BINARY' },
    Directionality: { HIGHER_BETTER: 'HIGHER_BETTER', LOWER_BETTER: 'LOWER_BETTER', NEUTRAL: 'NEUTRAL', TARGET_SPECIFIC: 'TARGET_SPECIFIC' },
    ComputedBy: { AI_INFERRED: 'AI_INFERRED', SYSTEM_CALCULATED: 'SYSTEM_CALCULATED', USER_SET: 'USER_SET' },
    SpecRole: { IDENTITY: 'IDENTITY', CONTENT: 'CONTENT', VOICE: 'VOICE', MEASURE: 'MEASURE', ADAPT: 'ADAPT', REWARD: 'REWARD', GUARDRAIL: 'GUARDRAIL' },
  };
});

// Mock fs - must be before import
const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readdirSync: (...args: any[]) => mockReaddirSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Sample contract data
const VALID_CONTRACT = JSON.stringify({
  contractId: 'TEST_CONTRACT_V1',
  version: '1.0',
  description: 'Test contract',
  status: 'active',
  storage: { keyPattern: 'test:{key}', keys: { name: 'name' } },
});

const VALID_CONTRACT_2 = JSON.stringify({
  contractId: 'ANOTHER_CONTRACT_V1',
  version: '2.0',
  description: 'Another test contract',
  status: 'active',
});

const INVALID_CONTRACT_NO_ID = JSON.stringify({
  version: '1.0',
  description: 'Missing contractId',
});

const INVALID_CONTRACT_NO_VERSION = JSON.stringify({
  contractId: 'NO_VERSION',
  description: 'Missing version',
});

describe('seedContracts()', () => {
  let seedContracts: () => Promise<{ seeded: number; errors: string[] }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mocks
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue('{}');
    mockSystemSettingUpsert.mockResolvedValue({});

    // Import the function fresh each test
    const mod = await import('@/prisma/seed-from-specs');
    seedContracts = mod.seedContracts;
  });

  it('reads .contract.json files from contracts/ directory', async () => {
    mockReaddirSync.mockReturnValue([
      'TEST_CONTRACT_V1.contract.json',
      'ANOTHER.contract.json',
      'README.md', // should be filtered out
    ]);
    mockReadFileSync
      .mockReturnValueOnce(VALID_CONTRACT)
      .mockReturnValueOnce(VALID_CONTRACT_2);

    const result = await seedContracts();

    expect(result.seeded).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('upserts contracts into SystemSetting with contract:{id} key', async () => {
    mockReaddirSync.mockReturnValue(['TEST.contract.json']);
    mockReadFileSync.mockReturnValue(VALID_CONTRACT);

    await seedContracts();

    expect(mockSystemSettingUpsert).toHaveBeenCalledWith({
      where: { key: 'contract:TEST_CONTRACT_V1' },
      update: { value: VALID_CONTRACT },
      create: { key: 'contract:TEST_CONTRACT_V1', value: VALID_CONTRACT },
    });
  });

  it('skips contracts missing contractId', async () => {
    mockReaddirSync.mockReturnValue(['bad.contract.json']);
    mockReadFileSync.mockReturnValue(INVALID_CONTRACT_NO_ID);

    const result = await seedContracts();

    expect(result.seeded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('missing contractId or version');
    expect(mockSystemSettingUpsert).not.toHaveBeenCalled();
  });

  it('skips contracts missing version', async () => {
    mockReaddirSync.mockReturnValue(['bad.contract.json']);
    mockReadFileSync.mockReturnValue(INVALID_CONTRACT_NO_VERSION);

    const result = await seedContracts();

    expect(result.seeded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('missing contractId or version');
  });

  it('handles missing contracts/ directory gracefully', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await seedContracts();

    expect(result.seeded).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('reports errors for malformed JSON files', async () => {
    mockReaddirSync.mockReturnValue(['bad.contract.json']);
    mockReadFileSync.mockReturnValue('not valid json{{{');

    const result = await seedContracts();

    expect(result.seeded).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it('continues processing after individual file errors', async () => {
    mockReaddirSync.mockReturnValue([
      'bad.contract.json',
      'good.contract.json',
    ]);
    mockReadFileSync
      .mockReturnValueOnce('invalid json')
      .mockReturnValueOnce(VALID_CONTRACT);

    const result = await seedContracts();

    expect(result.seeded).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('handles DB upsert failure', async () => {
    mockReaddirSync.mockReturnValue(['test.contract.json']);
    mockReadFileSync.mockReturnValue(VALID_CONTRACT);
    mockSystemSettingUpsert.mockRejectedValue(new Error('DB write failed'));

    const result = await seedContracts();

    expect(result.seeded).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('DB write failed');
  });
});
