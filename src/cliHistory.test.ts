import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { generateHistoryPage, history, historyIndex, historySize, setHistoryIndex, type HistoryEntry } from './cliHistory.js';

const zeroEntry: HistoryEntry = {
  cpu: 0,
  peakCpu: 0,
  processCpu: 0,
  peakProcessCpu: 0,
  rss: 0,
  peakRss: 0,
  heapUsed: 0,
  peakHeapUsed: 0,
  heapTotal: 0,
  peakHeapTotal: 0,
  timestamp: 0,
};

const mutatedIndices = new Set<number>();

function configureHistoryEntry(index: number, overrides: Partial<HistoryEntry>) {
  Object.assign(history[index], zeroEntry, overrides);
  mutatedIndices.add(index);
}

describe('cliHistory', () => {
  beforeEach(() => {
    setHistoryIndex(0);
  });

  afterEach(() => {
    mutatedIndices.forEach((idx) => {
      Object.assign(history[idx], zeroEntry);
    });
    mutatedIndices.clear();
    setHistoryIndex(0);
  });

  describe('setHistoryIndex', () => {
    test('accepts valid indices within bounds', () => {
      const validIndex = historySize - 1;
      setHistoryIndex(validIndex);
      expect(historyIndex).toBe(validIndex);
    });

    test('throws TypeError for non-finite or non-integer values', () => {
      expect(() => setHistoryIndex(Number.NaN)).toThrow(TypeError);
      expect(() => setHistoryIndex(1.5)).toThrow(TypeError);
      expect(() => setHistoryIndex(Number.MAX_SAFE_INTEGER + 2)).toThrow(TypeError);
    });

    test('throws RangeError for values outside the buffer length', () => {
      expect(() => setHistoryIndex(-1)).toThrow(RangeError);
      expect(() => setHistoryIndex(historySize)).toThrow(RangeError);
    });
  });

  describe('generateHistoryPage', () => {
    test('returns undefined when history buffer is empty', () => {
      const backup = history.slice();
      history.length = 0;

      try {
        const result = generateHistoryPage();
        expect(result).toBeUndefined();
      } finally {
        history.push(...backup);
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
        cpu: 10.1234,
        peakCpu: 15.9876,
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
        cpu: 20.4321,
        peakCpu: 25.6789,
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

      setHistoryIndex(1);

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
