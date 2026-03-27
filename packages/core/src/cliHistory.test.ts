import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Tracker, type TrackerSnapshot } from '@matterbridge/utils';

import { generateHistoryPage } from './cliHistory.js';

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

    test('falls back to non-peak values when peak fields are undefined', () => {
      configureHistoryEntry(0, {
        timestamp: undefined as unknown as number,
        osCpu: 11,
        peakOsCpu: undefined as unknown as number,
        processCpu: 3,
        peakProcessCpu: undefined as unknown as number,
        rss: 10,
        peakRss: undefined as unknown as number,
        heapUsed: 20,
        peakHeapUsed: undefined as unknown as number,
        heapTotal: 30,
        peakHeapTotal: undefined as unknown as number,
        external: 40,
        peakExternal: undefined as unknown as number,
        arrayBuffers: 50,
        peakArrayBuffers: undefined as unknown as number,
      });
      configureHistoryEntry(1, {
        timestamp: undefined as unknown as number,
        osCpu: 22,
        peakOsCpu: undefined as unknown as number,
        processCpu: 6,
        peakProcessCpu: undefined as unknown as number,
        rss: 100,
        peakRss: undefined as unknown as number,
        heapUsed: 200,
        peakHeapUsed: undefined as unknown as number,
        heapTotal: 300,
        peakHeapTotal: undefined as unknown as number,
        external: 400,
        peakExternal: undefined as unknown as number,
        arrayBuffers: 500,
        peakArrayBuffers: undefined as unknown as number,
      });

      Tracker.historyIndex = 0;

      const tempDir = mkdtempSync(path.join(os.tmpdir(), 'cli-history-test-'));
      const outputPath = path.join(tempDir, 'history.html');

      try {
        const result = generateHistoryPage({ outputPath });

        expect(result).toBe(path.resolve(outputPath));
        expect(existsSync(outputPath)).toBe(true);

        const html = readFileSync(outputPath, 'utf-8');
        expect(html).toContain('<title>Matterbridge CPU &amp; Memory History</title>');

        const summaryMatch = html.match(/const SUMMARY_DATA = (\{.*?\});/s);
        expect(summaryMatch?.[1]).toBeTruthy();

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const summary = JSON.parse(summaryMatch![1]) as {
          entries: number;
          timeRange: string;
          peakOsCpu: number;
          peakProcessCpu: number;
          peakRss: number;
          peakHeapUsed: number;
          peakHeapTotal: number;
          peakExternal: number;
          peakArrayBuffers: number;
        };

        expect(summary.entries).toBe(2);
        expect(summary.timeRange).toContain('→');

        expect(summary.peakOsCpu).toBe(22);
        expect(summary.peakProcessCpu).toBe(6);
        expect(summary.peakRss).toBe(100);
        expect(summary.peakHeapUsed).toBe(200);
        expect(summary.peakHeapTotal).toBe(300);
        expect(summary.peakExternal).toBe(400);
        expect(summary.peakArrayBuffers).toBe(500);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
