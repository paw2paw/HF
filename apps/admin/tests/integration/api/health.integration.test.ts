/**
 * Integration Tests: /api/health
 *
 * Tests that the health check API returns correct status.
 * This is critical for the cockpit page System Status.
 */

import { describe, it, expect } from 'vitest';
import { apiGet } from '../setup';

describe('/api/health (integration)', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const { status, data } = await apiGet('/api/health');

      expect(status).toBe(200);
      expect(data).toHaveProperty('ok');
      expect(data).toHaveProperty('checks');
    });

    it('should include Docker status check', async () => {
      const { data } = await apiGet('/api/health');

      expect(data.checks).toHaveProperty('docker');
      expect(data.checks.docker).toHaveProperty('status');
      expect(data.checks.docker).toHaveProperty('message');
    });

    it('should include database status check', async () => {
      const { data } = await apiGet('/api/health');

      expect(data.checks).toHaveProperty('database');
      expect(data.checks.database).toHaveProperty('status');
      expect(data.checks.database).toHaveProperty('message');
    });

    it('should include HF_KB_PATH status check', async () => {
      const { data } = await apiGet('/api/health');

      expect(data.checks).toHaveProperty('hf_kb_path');
      expect(data.checks.hf_kb_path).toHaveProperty('status');
      expect(data.checks.hf_kb_path).toHaveProperty('message');
      // Should include actual path in details
      expect(data.checks.hf_kb_path.details).toHaveProperty('path');
    });

    it('should validate KB subdirectories exist', async () => {
      const { data } = await apiGet('/api/health');

      if (data.checks.hf_kb_path.status === 'ok') {
        expect(data.checks.hf_kb_path.details.subdirs).toHaveProperty('sources');
        expect(data.checks.hf_kb_path.details.subdirs).toHaveProperty('derived');
      }
    });

    it('should include environment variables check', async () => {
      const { data } = await apiGet('/api/health');

      expect(data.checks).toHaveProperty('env');
      expect(data.checks.env.details).toHaveProperty('required');
      expect(data.checks.env.details.required).toHaveProperty('DATABASE_URL');
    });

    it('should include timestamp', async () => {
      const { data } = await apiGet('/api/health');

      expect(data).toHaveProperty('timestamp');
      // Should be a valid ISO date
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });
  });
});
