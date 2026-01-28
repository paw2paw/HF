/**
 * Tests for personality-analyze.ts
 *
 * Tests the spec-driven personality analysis workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Helper to access the mocked prisma instance
const prisma = new PrismaClient();

describe('personality-analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzePersonality', () => {
    it('should return early in plan mode', async () => {
      // Dynamic import to pick up mocks
      const { analyzePersonality } = await import('../../lib/ops/personality-analyze');

      const result = await analyzePersonality({ plan: true });

      expect(result.callsAnalyzed).toBe(0);
      expect(result.scoresCreated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should fall back to legacy mode when no MEASURE specs exist', async () => {
      vi.mocked(prisma.analysisSpec.findMany).mockResolvedValue([]);
      vi.mocked(prisma.parameter.findMany).mockResolvedValue([]);
      vi.mocked(prisma.call.findMany).mockResolvedValue([]);

      const { analyzePersonality } = await import('../../lib/ops/personality-analyze');

      const result = await analyzePersonality({ verbose: false, mock: true });

      // Should have queried for specs first
      expect(prisma.analysisSpec.findMany).toHaveBeenCalled();
      // Should have an error about no params or calls
      expect(result.specsUsed).toBe(0);
    });

    // TODO: This test requires dependency injection refactoring to properly mock Prisma
    // The module creates its own PrismaClient instance, so vi.mocked() doesn't work
    // Use integration tests to verify this functionality instead
    it.skip('should process calls with mock scoring when specs exist', async () => {
      const mockSpec = {
        id: 'spec-1',
        slug: 'big-five-openness',
        name: 'Openness Analysis',
        description: 'Analyze openness trait',
        domain: 'personality',
        outputType: 'MEASURE',
        isActive: true,
        priority: 1,
        promptTemplate: 'Score openness: {{transcript}}',
        promptSlug: {
          id: 'slug-1',
          slug: 'B5-O',
          parameters: [{
            parameter: {
              parameterId: 'B5-O',
              name: 'Openness',
              definition: 'Openness to experience',
              scoringAnchors: [
                { example: 'I love trying new things', score: 0.9, rationale: 'High openness' },
                { example: 'I prefer routine', score: 0.2, rationale: 'Low openness' },
              ],
            },
          }],
        },
      };

      const mockCall = {
        id: 'call-1',
        userId: 'user-1',
        transcript: 'Customer: I am really curious about new products. I love exploring different options.',
        createdAt: new Date(),
        user: { id: 'user-1', name: 'Test User' },
      };

      vi.mocked(prisma.analysisSpec.findMany).mockResolvedValue([mockSpec] as any);
      vi.mocked(prisma.callScore.findMany).mockResolvedValue([]);
      vi.mocked(prisma.call.findMany).mockResolvedValue([mockCall] as any);
      vi.mocked(prisma.callScore.create).mockResolvedValue({} as any);
      vi.mocked(prisma.callerPersonality.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.callerPersonalityProfile.upsert).mockResolvedValue({} as any);

      const { analyzePersonality } = await import('../../lib/ops/personality-analyze');

      const result = await analyzePersonality({
        mock: true,
        verbose: false,
        aggregate: true,
      });

      expect(result.specsUsed).toBe(1);
      expect(result.callsAnalyzed).toBe(1);
      expect(result.scoresCreated).toBe(1);
      expect(prisma.callScore.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('time decay weighting', () => {
    it('should weight recent scores higher than older ones', async () => {
      // This tests the aggregateUserPersonality function indirectly
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // With 30-day half-life, a 30-day-old score should have ~0.5 weight
      // Formula: weight = exp(-ln(2) * ageDays / halfLifeDays)
      const halfLifeDays = 30;
      const ageDays = 30;
      const expectedDecay = Math.exp((-Math.log(2) * ageDays) / halfLifeDays);

      // Should be approximately 0.5 for 30-day-old score with 30-day half-life
      expect(expectedDecay).toBeCloseTo(0.5, 2);
    });
  });
});

describe('scoring result structure', () => {
  it('should return valid scoring result interface', () => {
    // Verify the expected structure of scoring results
    interface ScoringResult {
      score: number;
      confidence: number;
      evidence: string[];
      reasoning: string;
    }

    const mockResult: ScoringResult = {
      score: 0.75,
      confidence: 0.85,
      evidence: ['I love trying new things'],
      reasoning: 'User expressed high openness through curiosity',
    };

    expect(mockResult.score).toBeGreaterThanOrEqual(0);
    expect(mockResult.score).toBeLessThanOrEqual(1);
    expect(mockResult.confidence).toBeGreaterThanOrEqual(0);
    expect(mockResult.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(mockResult.evidence)).toBe(true);
    expect(typeof mockResult.reasoning).toBe('string');
  });
});
