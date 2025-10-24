import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { generateHistoryPage } from './cliHistory.js';
import { Tracker, type TrackerSnapshot } from './utils/tracker.js';

const zeroEntry: TrackerSnapshot = {
  timestamp: 0,
  freeMemory: 0,
  peakFreeMemory: 0,
  totalMemory: 0,
  peakTotalMemory: 0,
  osCpu: 0,
  peakOsCpu: 0,
  processCpu: 0,
  peakProcessCpu: 0,
  rss: 0,
  peakRss: 0,
  heapUsed: 0,
  peakHeapUsed: 0,
  heapTotal: 0,
  peakHeapTotal: 0,
  external: 0,
  peakExternal: 0,
  arrayBuffers: 0,
  peakArrayBuffers: 0,
};

const mutatedIndices = new Set<number>();

function configureHistoryEntry(index: number, overrides: Partial<TrackerSnapshot>) {
  Object.assign(Tracker.history[index], zeroEntry, overrides);
  mutatedIndices.add(index);
}

describe('cliHistory', () => {
  beforeEach(() => {
    Tracker.historyIndex = 0;
  });

  afterEach(() => {
    mutatedIndices.forEach((idx) => {
      Object.assign(Tracker.history[idx], zeroEntry);
    });
    mutatedIndices.clear();
    Tracker.historyIndex = 0;
  });

  describe('historyIndex', () => {
    test('accepts valid indices within bounds', () => {
      const validIndex = Tracker.historySize - 1;
      Tracker.historyIndex = validIndex;
      expect(Tracker.historyIndex).toBe(validIndex);
    });
  });

  describe('generateHistoryPage', () => {
    test('returns undefined when history buffer is empty', () => {
      const backup = Tracker.history.slice();
      // Emulate empty snapshots by zeroing timestamps
      for (let i = 0; i < Tracker.history.length; i++) {
        Tracker.history[i].timestamp = 0;
      }

      try {
        const result = generateHistoryPage();
        expect(result).toBeUndefined();
      } finally {
        for (let i = 0; i < backup.length; i++) {
          Tracker.history[i] = backup[i];
        }
      }
    });

    test('returns undefined when no samples are available', () => {
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cli-history-test-'));
      const outputPath = path.join(tempDir, 'history.html');

      try {
        const result = generateHistoryPage({ outputPath });

        expect(result).toBeUndefined();
        expect(existsSync(outputPath)).toBe(false);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    test('writes sanitized HTML when samples exist', () => {
      const now = Date.now();
      configureHistoryEntry(0, {
        osCpu: 10.1234,
        peakOsCpu: 15.9876,
        processCpu: 5.5,
        peakProcessCpu: 6.1,
        rss: 50 * 1024 * 1024,
        peakRss: 60 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        peakHeapUsed: 35 * 1024 * 1024,
        heapTotal: 40 * 1024 * 1024,
        peakHeapTotal: 45 * 1024 * 1024,
        timestamp: now - 1_000,
      });
      configureHistoryEntry(1, {
        osCpu: 20.4321,
        peakOsCpu: 25.6789,
        processCpu: 10.25,
        peakProcessCpu: 12.75,
        rss: 75 * 1024 * 1024,
        peakRss: 80 * 1024 * 1024,
        heapUsed: 55 * 1024 * 1024,
        peakHeapUsed: 65 * 1024 * 1024,
        heapTotal: 70 * 1024 * 1024,
        peakHeapTotal: 85 * 1024 * 1024,
        timestamp: now,
      });

      Tracker.historyIndex = 1;

      const pageTitle = '<Title & More>';
      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cli-history-test-'));
      const outputPath = path.join(tempDir, 'history.html');

      try {
        const resolvedPath = path.resolve(outputPath);

        const result = generateHistoryPage({ outputPath, pageTitle });

        expect(result).toBe(resolvedPath);
        expect(existsSync(outputPath)).toBe(true);

        const html = readFileSync(outputPath, 'utf-8');
        expect(html).toContain('<title>&lt;Title &amp; More&gt;</title>');
        expect(html).toContain('const HISTORY_DATA = ');
        expect(html).toContain('const SUMMARY_DATA = ');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
