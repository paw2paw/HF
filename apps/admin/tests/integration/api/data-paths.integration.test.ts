/**
 * Integration Tests: Data Paths
 *
 * Tests that the data node paths from agents.json resolve to existing directories.
 * This catches configuration mismatches early.
 *
 * Note: These tests call the server's API to get resolved paths, ensuring
 * they test the same environment the server is running in.
 */

import { describe, it, expect } from 'vitest';
import { apiGet } from '../setup';

describe('Data Paths (integration)', () => {
  describe('via /api/health', () => {
    it('should report HF_KB_PATH status', async () => {
      const { data } = await apiGet('/api/health');

      expect(data.checks).toHaveProperty('hf_kb_path');
      expect(data.checks.hf_kb_path).toHaveProperty('status');
    });

    it('should have accessible HF_KB_PATH', async () => {
      const { data } = await apiGet('/api/health');

      expect(data.checks.hf_kb_path.status).toBe('ok');
      expect(data.checks.hf_kb_path.details).toHaveProperty('path');
    });

    it('should have required KB subdirectories', async () => {
      const { data } = await apiGet('/api/health');

      if (data.checks.hf_kb_path.status === 'ok') {
        const subdirs = data.checks.hf_kb_path.details.subdirs;
        expect(subdirs).toHaveProperty('sources');
        expect(subdirs).toHaveProperty('derived');
      }
    });
  });

  describe('via /api/paths', () => {
    it('should return resolved paths', async () => {
      const { status, data } = await apiGet('/api/paths');

      expect(status).toBe(200);
      expect(data).toHaveProperty('ok', true);
      expect(data).toHaveProperty('resolved');
    });

    it('should include KB root path', async () => {
      const { data } = await apiGet('/api/paths');

      expect(data.resolved).toHaveProperty('root');
      expect(data.resolved.root).toHaveProperty('path');
      expect(data.resolved.root.path.startsWith('/')).toBe(true);
    });

    it('should include transcripts path in sources', async () => {
      const { data } = await apiGet('/api/paths');

      expect(data.resolved.sources).toHaveProperty('transcripts');
      expect(data.resolved.sources.transcripts.startsWith('/')).toBe(true);
    });

    it('should include validation status', async () => {
      const { data } = await apiGet('/api/paths');

      expect(data).toHaveProperty('validation');
      expect(data.validation).toHaveProperty('valid');
      expect(data.validation).toHaveProperty('root');
    });

    it('should report HF_KB_PATH env var', async () => {
      const { data } = await apiGet('/api/paths');

      expect(data).toHaveProperty('env');
      expect(data.env).toHaveProperty('HF_KB_PATH');
    });
  });

  describe('Transcripts Path Validation', () => {
    it('should have transcripts path that exists', async () => {
      const { data } = await apiGet('/api/paths');

      // Validation should pass (no missing critical paths)
      expect(data.validation.valid).toBe(true);
      expect(data.resolved.sources.transcripts).toBeDefined();
    });

    it('should find transcript files via API', async () => {
      const { data } = await apiGet('/api/transcripts');

      // Should find at least one transcript file
      expect(data.length).toBeGreaterThan(0);
    });

    it('should find files in subdirectories', async () => {
      const { data } = await apiGet('/api/transcripts');

      // Files in subdirs should have "/" in relativePath
      const filesInSubdirs = data.filter((f: any) => f.relativePath?.includes('/'));
      expect(filesInSubdirs.length).toBeGreaterThan(0);
    });
  });
});
