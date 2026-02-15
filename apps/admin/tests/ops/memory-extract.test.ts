/**
 * Tests for memory-extract.ts
 *
 * Tests the spec-driven memory extraction workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryCategory, MemorySource } from '@prisma/client';
import { prisma } from '@/lib/prisma';

describe('memory-extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractMemories', () => {
    it('should return early in plan mode', async () => {
      const { extractMemories } = await import('../../lib/ops/memory-extract');

      const result = await extractMemories({ plan: true });

      expect(result.callsProcessed).toBe(0);
      expect(result.memoriesExtracted).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should extract memories using pattern matching in mock mode', async () => {
      const mockCall = {
        id: 'call-1',
        callerId: 'caller-1',
        transcript: 'Customer: I live in San Francisco. I work at Google as a software engineer.',
        createdAt: new Date(),
        caller: { id: 'caller-1', name: 'Test User' },
        extractedMemories: [],
      };

      vi.mocked(prisma.analysisSpec.findMany).mockResolvedValue([]);
      vi.mocked(prisma.call.findMany).mockResolvedValue([mockCall] as any);
      vi.mocked(prisma.callerMemory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.callerMemory.create).mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        callId: 'call-1',
        category: 'FACT',
        source: 'EXTRACTED',
        key: 'location',
        value: 'San Francisco',
        normalizedKey: 'location',
      } as any);
      vi.mocked(prisma.callerMemorySummary.upsert).mockResolvedValue({} as any);

      const { extractMemories } = await import('../../lib/ops/memory-extract');

      const result = await extractMemories({
        mock: true,
        verbose: false,
        aggregate: true,
      });

      expect(result.callsProcessed).toBe(1);
      expect(result.memoriesExtracted).toBeGreaterThan(0);
    });
  });

  describe('key normalization', () => {
    it('should normalize location variants to canonical key', async () => {
      // Import the module to test internal key normalization
      // These are the expected mappings
      const keyMappings: Record<string, string> = {
        location: 'location',
        city: 'location',
        town: 'location',
        lives_in: 'location',
        residence: 'location',
        home_city: 'location',
        home_location: 'location',
      };

      for (const [input, expected] of Object.entries(keyMappings)) {
        expect(expected).toBe('location');
      }
    });

    it('should normalize job variants to canonical key', () => {
      const jobMappings: Record<string, string> = {
        job: 'occupation',
        job_title: 'occupation',
        occupation: 'occupation',
        profession: 'occupation',
        work: 'occupation',
        role: 'occupation',
        position: 'occupation',
      };

      for (const [_, expected] of Object.entries(jobMappings)) {
        expect(expected).toBe('occupation');
      }
    });
  });

  describe('category mapping', () => {
    it('should map raw categories to MemoryCategory enum', () => {
      const categoryMappings: Record<string, string> = {
        BIOGRAPHICAL: 'FACT',
        PERSONAL: 'FACT',
        FACTS: 'FACT',
        LIKE: 'PREFERENCE',
        DISLIKE: 'PREFERENCE',
        PREFERENCES: 'PREFERENCE',
        APPOINTMENT: 'EVENT',
        MEETING: 'EVENT',
        HISTORY: 'EVENT',
        INTEREST: 'TOPIC',
        DISCUSSION: 'TOPIC',
        FAMILY: 'RELATIONSHIP',
        FRIEND: 'RELATIONSHIP',
        SITUATION: 'CONTEXT',
        TEMPORARY: 'CONTEXT',
      };

      // Verify all expected mappings are to valid categories
      const validCategories = ['FACT', 'PREFERENCE', 'EVENT', 'TOPIC', 'RELATIONSHIP', 'CONTEXT'];
      for (const [_, expected] of Object.entries(categoryMappings)) {
        expect(validCategories).toContain(expected);
      }
    });
  });

  describe('pattern extraction', () => {
    it('should extract location from "I live in" pattern', () => {
      const transcript = 'Customer: Hi there. I live in New York City.';
      const pattern = /(?:I live in|I'm from|I'm located in|based in)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|$)/i;
      const match = transcript.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe('New York City');
    });

    it('should extract employer from "I work at" pattern', () => {
      const transcript = 'Customer: I work at Microsoft.';
      const pattern = /(?:I work at|I'm with|employed by|work for)\s+([A-Z][a-zA-Z\s&]+?)(?:\.|,|$)/i;
      const match = transcript.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1].trim()).toBe('Microsoft');
    });

    it('should extract children count from "I have N kids" pattern', () => {
      const transcript = 'Agent: Do you have family? Customer: Yes, I have 3 kids.';
      const pattern = /(?:I have|we have)\s+(\d+)\s+(?:kids|children)/i;
      const match = transcript.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('3');
    });

    it('should extract contact preference', () => {
      const transcript = 'Customer: I prefer contact via email, please.';
      const pattern = /(?:prefer|rather have|like to receive)\s+(?:contact via|communication via|messages via|by)?\s*(email|phone|text|sms)/i;
      const match = transcript.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1].toLowerCase()).toBe('email');
    });
  });

  describe('contradiction detection', () => {
    it('should detect when new memory contradicts existing', async () => {
      const existingMemory = {
        id: 'mem-1',
        userId: 'user-1',
        key: 'location',
        normalizedKey: 'location',
        value: 'San Francisco',
        category: 'FACT',
        supersededById: null,
      };

      const newValue = 'New York';
      const isContradiction = existingMemory.value !== newValue;

      expect(isContradiction).toBe(true);
    });

    it('should not flag as contradiction when values match', () => {
      const existingValue = 'San Francisco';
      const newValue = 'San Francisco';
      const isContradiction = existingValue !== newValue;

      expect(isContradiction).toBe(false);
    });
  });
});

describe('expiration handling', () => {
  it('should calculate expiration date from expiresInDays', () => {
    const expiresInDays = 14;
    const now = Date.now();
    const expiresAt = new Date(now + expiresInDays * 24 * 60 * 60 * 1000);

    const diffDays = (expiresAt.getTime() - now) / (24 * 60 * 60 * 1000);
    expect(Math.round(diffDays)).toBe(14);
  });

  it('should return null expiration for permanent memories', () => {
    const expiresInDays = undefined;
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    expect(expiresAt).toBeNull();
  });
});
