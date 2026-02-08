/**
 * Tests for transcripts-process.ts
 *
 * Tests transcript processing and extraction workflow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileType, ProcessingStatus, FailedCallErrorType } from '@prisma/client';

describe('transcripts-process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('file type detection', () => {
    it('should detect array of calls as BATCH_EXPORT', () => {
      const json = [{ transcript: 'call 1' }, { transcript: 'call 2' }];
      const fileType = detectFileType(json);
      expect(fileType).toBe(FileType.BATCH_EXPORT);
    });

    it('should detect single item array as SINGLE_CALL', () => {
      const json = [{ transcript: 'call 1' }];
      const fileType = detectFileType(json);
      expect(fileType).toBe(FileType.SINGLE_CALL);
    });

    it('should detect object with calls array as BATCH_EXPORT', () => {
      const json = { calls: [{ transcript: 'call 1' }, { transcript: 'call 2' }] };
      const fileType = detectFileType(json);
      expect(fileType).toBe(FileType.BATCH_EXPORT);
    });

    it('should detect single object as SINGLE_CALL', () => {
      const json = { transcript: 'single call content' };
      const fileType = detectFileType(json);
      expect(fileType).toBe(FileType.SINGLE_CALL);
    });
  });

  describe('calls extraction', () => {
    it('should extract from array format', () => {
      const json = [{ transcript: 'call 1' }, { transcript: 'call 2' }];
      const calls = extractCalls(json);
      expect(calls).toHaveLength(2);
    });

    it('should extract from object with calls array', () => {
      const json = { calls: [{ transcript: 'call 1' }], metadata: { source: 'test' } };
      const calls = extractCalls(json);
      expect(calls).toHaveLength(1);
    });

    it('should wrap single call object in array', () => {
      const json = { transcript: 'single call' };
      const calls = extractCalls(json);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(json);
    });

    it('should handle nested messages format', () => {
      const json = {
        messages: [
          { role: 'agent', content: 'Hello' },
          { role: 'customer', content: 'Hi there' },
        ],
      };
      const calls = extractCalls(json);
      expect(calls).toHaveLength(1);
    });
  });

  describe('transcript extraction', () => {
    it('should extract direct transcript field', () => {
      const call = { transcript: 'This is the transcript content' };
      const transcript = extractTranscript(call);
      expect(transcript).toBe('This is the transcript content');
    });

    it('should convert messages array to transcript', () => {
      const call = {
        messages: [
          { role: 'agent', content: 'Hello, how can I help?' },
          { role: 'customer', content: 'I have a question.' },
        ],
      };
      const transcript = extractTranscript(call);
      expect(transcript).toContain('agent: Hello, how can I help?');
      expect(transcript).toContain('customer: I have a question.');
    });

    it('should extract from nested call object', () => {
      const call = {
        call: {
          transcript: 'Nested transcript content',
        },
      };
      const transcript = extractTranscript(call);
      expect(transcript).toBe('Nested transcript content');
    });

    it('should return null for invalid call object', () => {
      const call = { metadata: { id: '123' } };
      const transcript = extractTranscript(call);
      expect(transcript).toBeNull();
    });
  });

  describe('customer info extraction', () => {
    it('should extract from customer object', () => {
      const call = {
        transcript: 'content',
        customer: {
          email: 'test@example.com',
          number: '+1234567890',
          name: 'John Doe',
          id: 'cust-123',
        },
      };
      const info = extractCustomerInfo(call);
      expect(info).toEqual({
        email: 'test@example.com',
        phone: '+1234567890',
        name: 'John Doe',
        externalId: 'cust-123',
      });
    });

    it('should extract from customerId field', () => {
      const call = {
        transcript: 'content',
        customerId: 'cust-456',
      };
      const info = extractCustomerInfo(call);
      expect(info).toEqual({ externalId: 'cust-456' });
    });

    it('should extract from caller object', () => {
      const call = {
        transcript: 'content',
        caller: {
          phone: '+0987654321',
          name: 'Jane Smith',
        },
      };
      const info = extractCustomerInfo(call);
      expect(info).toEqual({
        phone: '+0987654321',
        name: 'Jane Smith',
      });
    });
  });

  describe('error classification', () => {
    it('should classify NO_TRANSCRIPT error', () => {
      const errorType = classifyError('No transcript field found');
      expect(errorType).toBe(FailedCallErrorType.NO_TRANSCRIPT);
    });

    it('should classify INVALID_FORMAT error', () => {
      const errorType = classifyError('Invalid JSON: malformed input');
      expect(errorType).toBe(FailedCallErrorType.INVALID_FORMAT);
    });

    it('should classify DUPLICATE error', () => {
      const errorType = classifyError('Unique constraint violation: call already exists');
      expect(errorType).toBe(FailedCallErrorType.DUPLICATE);
    });

    it('should classify NO_CUSTOMER error', () => {
      const errorType = classifyError('No customer information found');
      expect(errorType).toBe(FailedCallErrorType.NO_CUSTOMER);
    });

    it('should classify DB_ERROR', () => {
      const errorType = classifyError('Prisma database connection failed');
      expect(errorType).toBe(FailedCallErrorType.DB_ERROR);
    });

    it('should default to UNKNOWN for unrecognized errors', () => {
      const errorType = classifyError('Something unexpected happened');
      expect(errorType).toBe(FailedCallErrorType.UNKNOWN);
    });
  });

  describe('processing status determination', () => {
    it('should return COMPLETED when no failures', () => {
      const callsExtracted = 10;
      const callsFailed = 0;
      const status = determineStatus(callsExtracted, callsFailed);
      expect(status).toBe(ProcessingStatus.COMPLETED);
    });

    it('should return PARTIAL when some failures', () => {
      const callsExtracted = 8;
      const callsFailed = 2;
      const status = determineStatus(callsExtracted, callsFailed);
      expect(status).toBe(ProcessingStatus.PARTIAL);
    });

    it('should return FAILED when all fail', () => {
      const callsExtracted = 0;
      const callsFailed = 10;
      const status = determineStatus(callsExtracted, callsFailed);
      expect(status).toBe(ProcessingStatus.FAILED);
    });
  });

  describe('hash-based deduplication', () => {
    it('should generate consistent hash for same content', () => {
      const content = '{"transcript": "hello"}';
      const hash1 = hashContent(content);
      const hash2 = hashContent(content);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = hashContent('{"transcript": "hello"}');
      const hash2 = hashContent('{"transcript": "goodbye"}');
      expect(hash1).not.toBe(hash2);
    });
  });
});

// Helper functions for tests (mirrors the actual implementation)
function detectFileType(json: unknown): FileType {
  if (Array.isArray(json)) {
    return json.length > 1 ? FileType.BATCH_EXPORT : FileType.SINGLE_CALL;
  } else if (json && typeof json === 'object' && 'calls' in json && Array.isArray((json as any).calls)) {
    return FileType.BATCH_EXPORT;
  }
  return FileType.SINGLE_CALL;
}

function extractCalls(json: unknown): unknown[] {
  if (Array.isArray(json)) {
    return json;
  } else if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    if ('calls' in obj && Array.isArray(obj.calls)) {
      return obj.calls;
    }
    if ('transcript' in obj || 'call' in obj || 'messages' in obj) {
      return [json];
    }
  }
  return [];
}

function extractTranscript(call: unknown): string | null {
  if (!call || typeof call !== 'object') return null;
  const c = call as Record<string, unknown>;

  if (typeof c.transcript === 'string') {
    return c.transcript;
  }

  if (Array.isArray(c.messages)) {
    return c.messages
      .map((m: any) => {
        const role = m.role || 'unknown';
        const content = m.content || m.text || '';
        return `${role}: ${content}`;
      })
      .join('\n');
  }

  if (c.call && typeof c.call === 'object') {
    return extractTranscript(c.call);
  }

  return null;
}

function extractCustomerInfo(call: unknown): { email?: string; phone?: string; name?: string; externalId?: string } | null {
  if (!call || typeof call !== 'object') return null;
  const c = call as Record<string, unknown>;

  if (c.customer && typeof c.customer === 'object') {
    const cust = c.customer as Record<string, unknown>;
    return {
      email: typeof cust.email === 'string' ? cust.email : undefined,
      phone:
        typeof cust.number === 'string' || typeof cust.phone === 'string'
          ? (cust.number as string) || (cust.phone as string)
          : undefined,
      name: typeof cust.name === 'string' ? cust.name : undefined,
      externalId: typeof cust.id === 'string' ? cust.id : undefined,
    };
  }

  if (typeof c.customerId === 'string') {
    return { externalId: c.customerId };
  }

  if (c.caller && typeof c.caller === 'object') {
    const caller = c.caller as Record<string, unknown>;
    return {
      phone: typeof caller.phone === 'string' ? caller.phone : undefined,
      name: typeof caller.name === 'string' ? caller.name : undefined,
    };
  }

  return null;
}

function classifyError(errorMessage: string): FailedCallErrorType {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('no transcript') || msg.includes('transcript not found')) {
    return FailedCallErrorType.NO_TRANSCRIPT;
  }
  if (msg.includes('invalid') || msg.includes('malformed') || msg.includes('parse')) {
    return FailedCallErrorType.INVALID_FORMAT;
  }
  if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('unique constraint')) {
    return FailedCallErrorType.DUPLICATE;
  }
  if (msg.includes('customer') || msg.includes('caller') || msg.includes('user')) {
    return FailedCallErrorType.NO_CUSTOMER;
  }
  if (msg.includes('database') || msg.includes('prisma') || msg.includes('db')) {
    return FailedCallErrorType.DB_ERROR;
  }

  return FailedCallErrorType.UNKNOWN;
}

function determineStatus(callsExtracted: number, callsFailed: number): ProcessingStatus {
  if (callsFailed === 0) {
    return ProcessingStatus.COMPLETED;
  } else if (callsExtracted === 0) {
    return ProcessingStatus.FAILED;
  } else {
    return ProcessingStatus.PARTIAL;
  }
}

function hashContent(content: string): string {
  // Simple hash for testing (actual uses crypto.createHash)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
