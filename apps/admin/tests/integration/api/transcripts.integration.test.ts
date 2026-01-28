/**
 * Integration Tests: /api/transcripts
 *
 * Tests that the transcripts API correctly reads from the filesystem.
 * Requires:
 * - Server running on localhost:3000
 * - HF_KB_PATH configured with actual transcript files
 */

import { describe, it, expect } from 'vitest';
import { apiGet, API_BASE_URL } from '../setup';

describe('/api/transcripts (integration)', () => {
  describe('GET /api/transcripts', () => {
    it('should return an array of transcript files', async () => {
      const { status, data } = await apiGet('/api/transcripts');

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should find JSON files in subdirectories', async () => {
      const { status, data } = await apiGet('/api/transcripts');

      expect(status).toBe(200);
      // Should find files in raw/ subdirectory
      const filesInSubdirs = data.filter((f: any) => f.relativePath?.includes('/'));
      expect(filesInSubdirs.length).toBeGreaterThan(0);
    });

    it('should return file metadata for each transcript', async () => {
      const { data } = await apiGet('/api/transcripts');

      if (data.length > 0) {
        const file = data[0];
        expect(file).toHaveProperty('id');
        expect(file).toHaveProperty('filename');
        expect(file).toHaveProperty('relativePath');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('sizeBytes');
        expect(file).toHaveProperty('sizeMB');
        expect(file).toHaveProperty('modifiedAt');
        expect(file).toHaveProperty('callCount');
        expect(file).toHaveProperty('type');
        expect(file).toHaveProperty('status');
      }
    });

    it('should count calls in batch files', async () => {
      const { data } = await apiGet('/api/transcripts');

      const batchFiles = data.filter((f: any) => f.type === 'Batch');
      if (batchFiles.length > 0) {
        expect(batchFiles[0].callCount).toBeGreaterThan(1);
      }
    });

    it('should support pagination via range parameter', async () => {
      const { status, data, headers } = await apiGet(
        '/api/transcripts?range=[0,1]'
      );

      expect(status).toBe(200);
      expect(data.length).toBeLessThanOrEqual(2);
      expect(headers.get('Content-Range')).toMatch(/^transcripts \d+-\d+\/\d+$/);
    });

    it('should support sorting', async () => {
      const { data: descData } = await apiGet(
        '/api/transcripts?sort=["modifiedAtMs","DESC"]'
      );
      const { data: ascData } = await apiGet(
        '/api/transcripts?sort=["modifiedAtMs","ASC"]'
      );

      if (descData.length > 1 && ascData.length > 1) {
        expect(descData[0].modifiedAtMs).toBeGreaterThanOrEqual(descData[1].modifiedAtMs);
        expect(ascData[0].modifiedAtMs).toBeLessThanOrEqual(ascData[1].modifiedAtMs);
      }
    });

    it('should support filtering by filename', async () => {
      const { data: allData } = await apiGet('/api/transcripts');

      if (allData.length > 0) {
        const searchTerm = allData[0].filename.substring(0, 10);
        const { data: filteredData } = await apiGet(
          `/api/transcripts?filter={"q":"${searchTerm}"}`
        );

        expect(filteredData.length).toBeGreaterThan(0);
        expect(filteredData.every((f: any) =>
          f.filename.toLowerCase().includes(searchTerm.toLowerCase())
        )).toBe(true);
      }
    });
  });
});
