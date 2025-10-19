/**
 * This file contains the Tracker class.
 *
 * @file tracker.ts
 * @author Luca Liguori
 * @created 2025-10-10
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mTracker loaded.\u001B[40;0m');

import os from 'node:os';
import EventEmitter from 'node:events';

import { AnsiLogger, LogLevel, TimestampFormat, BRIGHT, CYAN, RESET, YELLOW, db, RED } from 'node-ansi-logger';

// Memory snapshot focusing on cpu and rss, heapUsed, heapTotal, external and arrayBuffers plus peak values
export type TrackerSnapshot = {
  timestamp: number;
  freeMemory: number;
  peakFreeMemory: number;
  totalMemory: number;
  peakTotalMemory: number;
  osCpu: number;
  peakOsCpu: number;
  processCpu: number;
  peakProcessCpu: number;
  rss: number;
  peakRss: number;
  heapUsed: number;
  peakHeapUsed: number;
  heapTotal: number;
  peakHeapTotal: number;
  external: number;
  peakExternal: number;
  arrayBuffers: number;
  peakArrayBuffers: number;
};

// Tracker events
interface TrackerEvents {
  /** Start tracking */
  start: [];
  /** Stop tracking */
  stop: [];
  /** Uptime event */
  uptime: [os: number, process: number];
  /** CPU event */
  cpu: [os: number, process: number];
  /** Memory event */
  memory: [free: number, total: number, rss: number, heapUsed: number, heapTotal: number, external: number, arrayBuffers: number];
  /** Snapshot event */
  snapshot: [snapshot: TrackerSnapshot];
  /** Reset peaks */
  reset_peaks: [];
  /** Reset peaks done event */
  reset_peaks_done: [];
  /** Run garbage collection */
  gc: [];
  /** Garbage collection done event */
  gc_done: [type: 'major' | 'minor', execution: 'sync' | 'async'];
}

export class Tracker extends EventEmitter<TrackerEvents> {
  private trackerInterval?: NodeJS.Timeout;
  private historyIndex = 0;
  private readonly historySize = 1000;
  private readonly history: TrackerSnapshot[] = Array.from(
    { length: this.historySize },
    () =>
      ({
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
      }) as TrackerSnapshot,
  );
  private prevCpus = os.cpus();
  private prevCpuUsage = process.cpuUsage();
  private log: AnsiLogger;

  constructor(
    private readonly name: string = 'Tracker',
    private readonly debug: boolean = false,
    private readonly verbose: boolean = false,
  ) {
    super();
    if (process.argv.includes('--debug') || process.argv.includes('-debug')) {
      this.debug = true;
    }
    if (process.argv.includes('--verbose') || process.argv.includes('-verbose')) {
      this.verbose = true;
    }
    this.log = new AnsiLogger({ logName: name, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO });
    this.log.logNameColor = YELLOW;
    if (this.verbose) {
      this.log.debug(`os.cpus():\n${RESET}`, os.cpus());
      this.log.debug(`process.cpuUsage():\n${RESET}`, process.cpuUsage());
      this.log.debug(`process.memoryUsage():\n${RESET}`, process.memoryUsage());
    }

    this.on('start', () => {
      this.start();
    });

    this.on('stop', () => {
      this.stop();
    });

    this.on('reset_peaks', () => {
      this.resetPeaks();
    });

    this.on('gc', () => {
      this.runGarbageCollector();
    });
  }

  /**
   * Format a timestamp into a human-readable string.
   *
   * @param {number} timestamp - The timestamp in milliseconds since the Unix epoch.
   * @returns {string} - The formatted timestamp.
   */
  formatTimeStamp(timestamp: number): string {
    return `${new Date(timestamp).toLocaleString()}`;
  }

  /**
   * Format the OS uptime into a human-readable string.
   *
   * @param {number} seconds - The uptime in seconds.
   * @returns {string} - The formatted uptime.
   */
  formatOsUpTime(seconds: number): string {
    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  /**
   * Format a percentage into a human-readable string.
   *
   * @param {number} percent - The percentage value.
   * @returns {string} - The formatted percentage.
   */
  formatPercent(percent: number): string {
    return `${percent.toFixed(2)} %`;
  }

  /**
   * Format bytes into a human-readable string.
   *
   * @param {number} bytes - The number of bytes.
   * @returns {string} - The formatted byte string.
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, idx);
    return `${value.toFixed(2)} ${units[idx]}`;
  }

  /**
   * Start tracking cpu and memory usage with a given interval in ms
   *
   * @param {number} sampleIntervalMs Sample interval in milliseconds. Default is 10000 (10 seconds).
   */
  start(sampleIntervalMs: number = 10000) {
    if (this.trackerInterval) return;
    this.log.debug(`Tracker starting...`);
    let tryGcCount = 0;
    this.prevCpus = os.cpus();
    this.prevCpuUsage = process.cpuUsage();
    this.trackerInterval = setInterval(() => {
      // Increment tryGcCount and check if we can run garbage collector each hour cause memory might grow over time because of our even small allocations
      tryGcCount += sampleIntervalMs / 1000;
      if (tryGcCount > 60 * 60) {
        this.runGarbageCollector();
        tryGcCount = 0;
      }

      // Get current history entry in circular buffer
      const entry = this.history[this.historyIndex];

      // Get previous history entry in circular buffer
      const prevEntry = this.history[(this.historyIndex + this.historySize - 1) % this.historySize];

      // Set the timestamp
      entry.timestamp = Date.now();

      // Emit uptime event
      this.emit('uptime', os.uptime(), process.uptime());

      // Track CPU usage
      const currentCpus = os.cpus();
      const loads = currentCpus.map((cpu, idx) => {
        const prev = this.prevCpus[idx]?.times;
        if (!prev) return 0;
        const cur = cpu.times;
        const idleDelta = cur.idle - prev.idle;
        const busyDelta = cur.user - prev.user + (cur.nice - prev.nice) + (cur.sys - prev.sys) + (cur.irq - prev.irq);
        const totalDelta = busyDelta + idleDelta;
        if (totalDelta <= 0) return 0;
        // istanbul ignore next cause is practically impossible to hit this branch
        return busyDelta / totalDelta;
      });
      this.prevCpus = currentCpus;
      const avgLoad = loads.length === 0 ? 0 : loads.reduce((sum, value) => sum + value, 0) / loads.length;
      const osCpu = Number((avgLoad * 100).toFixed(2));
      entry.osCpu = osCpu;
      entry.peakOsCpu = Math.max(prevEntry.peakOsCpu, osCpu);

      // Track process CPU usage
      const diff = process.cpuUsage(this.prevCpuUsage);
      this.prevCpuUsage = process.cpuUsage();
      const totalMs = (diff.user + diff.system) / 1000;
      const processCpu = Number((((totalMs / sampleIntervalMs) * 100) / currentCpus.length).toFixed(2));
      entry.processCpu = processCpu;
      entry.peakProcessCpu = Math.max(prevEntry.peakProcessCpu, processCpu);

      // Emit cpu event
      this.emit('cpu', entry.osCpu, entry.processCpu);

      // Track memory usage
      entry.freeMemory = os.freemem();
      entry.peakFreeMemory = Math.max(prevEntry.peakFreeMemory, entry.freeMemory);
      entry.totalMemory = os.totalmem();
      entry.peakTotalMemory = Math.max(prevEntry.peakTotalMemory, entry.totalMemory);
      const mem = process.memoryUsage();
      entry.rss = mem.rss;
      entry.peakRss = Math.max(prevEntry.peakRss, mem.rss);
      entry.heapUsed = mem.heapUsed;
      entry.peakHeapUsed = Math.max(prevEntry.peakHeapUsed, mem.heapUsed);
      entry.heapTotal = mem.heapTotal;
      entry.peakHeapTotal = Math.max(prevEntry.peakHeapTotal, mem.heapTotal);
      entry.external = mem.external;
      entry.peakExternal = Math.max(prevEntry.peakExternal, mem.external);
      entry.arrayBuffers = mem.arrayBuffers;
      entry.peakArrayBuffers = Math.max(prevEntry.peakArrayBuffers, mem.arrayBuffers);
      this.emit('memory', entry.freeMemory, entry.totalMemory, entry.rss, entry.heapUsed, entry.heapTotal, entry.external, entry.arrayBuffers);

      // Emit tracker event with current snapshot
      this.emit('snapshot', entry);

      // Debug output
      if (this.debug) {
        this.log.debug(
          `Time: ${this.formatTimeStamp(entry.timestamp)} ` +
            `os ${CYAN}${BRIGHT}${this.formatPercent(entry.osCpu)}${RESET}${db} (${entry.peakOsCpu > prevEntry.peakOsCpu ? RED : ''}${this.formatPercent(entry.peakOsCpu)}${db}) ` +
            `process ${CYAN}${BRIGHT}${this.formatPercent(entry.processCpu)}${RESET}${db} (${entry.peakProcessCpu > prevEntry.peakProcessCpu ? RED : ''}${this.formatPercent(entry.peakProcessCpu)}${db}) ` +
            `rss: ${CYAN}${BRIGHT}${this.formatBytes(entry.rss)}${RESET}${db} (${entry.peakRss > prevEntry.peakRss ? RED : ''}${this.formatBytes(entry.peakRss)}${db}) ` +
            `heapUsed: ${CYAN}${BRIGHT}${this.formatBytes(entry.heapUsed)}${RESET}${db} (${entry.peakHeapUsed > prevEntry.peakHeapUsed ? RED : ''}${this.formatBytes(entry.peakHeapUsed)}${db}) ` +
            `heapTotal: ${CYAN}${BRIGHT}${this.formatBytes(entry.heapTotal)}${RESET}${db} (${entry.peakHeapTotal > prevEntry.peakHeapTotal ? RED : ''}${this.formatBytes(entry.peakHeapTotal)}${db}) ` +
            `external: ${CYAN}${BRIGHT}${this.formatBytes(entry.external)}${RESET}${db} (${entry.peakExternal > prevEntry.peakExternal ? RED : ''}${this.formatBytes(entry.peakExternal)}${db}) ` +
            `arrayBuffers: ${CYAN}${BRIGHT}${this.formatBytes(entry.arrayBuffers)}${RESET}${db} (${entry.peakArrayBuffers > prevEntry.peakArrayBuffers ? RED : ''}${this.formatBytes(entry.peakArrayBuffers)}${db})`,
        );
      }

      // Move to next history index of circular buffer
      this.historyIndex = (this.historyIndex + 1) % this.historySize;
    }, sampleIntervalMs);
    this.log.debug(`Tracker started`);
  }

  /**
   * Reset peak values to the currently stored values
   */
  resetPeaks() {
    const prevHistoryIndex = (this.historyIndex + this.historySize - 1) % this.historySize;
    this.history[prevHistoryIndex].peakOsCpu = 0;
    this.history[prevHistoryIndex].peakProcessCpu = 0;
    this.history[prevHistoryIndex].peakRss = 0;
    this.history[prevHistoryIndex].peakHeapUsed = 0;
    this.history[prevHistoryIndex].peakHeapTotal = 0;
    this.history[prevHistoryIndex].peakExternal = 0;
    this.history[prevHistoryIndex].peakArrayBuffers = 0;
    if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Peaks reset at ${new Date(Date.now()).toLocaleString()}.${RESET}${db}`);
    this.emit('reset_peaks_done');
  }

  /**
   * Manually trigger garbage collection to free memory (if exposed with --expose-gc)
   *
   * @param {'major' | 'minor'} type - The type of garbage collection to perform ('major' or 'minor'). Default is 'major'.
   * @param {'sync' | 'async'} execution - The execution mode of garbage collection ('sync' or 'async'). Default is 'async'.
   *
   * @remarks
   * - major collection refers to old-generation mark-sweep/mark-compact cycles.
   * - minor collection refers to young-generation collections (scavenges).
   * - sync execution blocks the main thread until GC is complete, which can cause pauses.
   */
  runGarbageCollector(type: 'major' | 'minor' = 'major', execution: 'sync' | 'async' = 'async') {
    if (global.gc && typeof global.gc === 'function') {
      try {
        global.gc({ type, execution });
        if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Garbage collection (${type}-${execution}) triggered at ${new Date(Date.now()).toLocaleString()}.${RESET}${db}`);
        this.emit('gc_done', type, execution);
      } catch {
        global.gc();
        if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Garbage collection (minor-async) triggered at ${new Date(Date.now()).toLocaleString()}.${RESET}${db}`);
        this.emit('gc_done', 'minor', 'async');
      }
    } else {
      if (this.debug) this.log.debug(`${CYAN}${BRIGHT}Garbage collection not exposed. Start Node.js with --expose-gc to enable manual garbage collection.${RESET}${db}`);
    }
  }

  /**
   * Stop tracking, clear interval, log history
   */
  stop() {
    this.log.debug(`Tracker stopping...`);
    if (this.trackerInterval) {
      clearInterval(this.trackerInterval);
      this.trackerInterval = undefined;
    }

    // Log all history entries
    if (this.debug) {
      this.log.debug(`Tracker history for ${YELLOW}${BRIGHT}${this.name}:${RESET}`);
      this.log.debug('Timestamp            Host cpu            Process cpu         Rss                   Heap Used             Heap Total            External              ArrayBuffers');
      //              10/10/2025, 20:52:12   4.76 % (  4.76 %)   0.16 % (  0.16 %)  38.45 MB ( 38.45 MB)   3.75 MB (  3.75 MB)   5.29 MB (  5.29 MB)   1.66 MB (  1.66 MB)  10.25 KB ( 10.25 KB)
      for (let i = 0; i < this.historySize; i++) {
        const index = (this.historyIndex + i) % this.historySize;
        const entry = this.history[index];
        if (entry.timestamp === 0) continue;
        this.log.debug(
          `${this.formatTimeStamp(entry.timestamp)} ` +
            `${CYAN}${BRIGHT}${this.formatPercent(entry.osCpu).padStart(8)}${RESET} (${this.formatPercent(entry.peakOsCpu).padStart(8)}) ` +
            `${CYAN}${BRIGHT}${this.formatPercent(entry.processCpu).padStart(8)}${RESET} (${this.formatPercent(entry.peakProcessCpu).padStart(8)}) ` +
            `${CYAN}${BRIGHT}${this.formatBytes(entry.rss).padStart(9)}${RESET} (${this.formatBytes(entry.peakRss).padStart(9)}) ` +
            `${CYAN}${BRIGHT}${this.formatBytes(entry.heapUsed).padStart(9)}${RESET} (${this.formatBytes(entry.peakHeapUsed).padStart(9)}) ` +
            `${CYAN}${BRIGHT}${this.formatBytes(entry.heapTotal).padStart(9)}${RESET} (${this.formatBytes(entry.peakHeapTotal).padStart(9)}) ` +
            `${CYAN}${BRIGHT}${this.formatBytes(entry.external).padStart(9)}${RESET} (${this.formatBytes(entry.peakExternal).padStart(9)}) ` +
            `${CYAN}${BRIGHT}${this.formatBytes(entry.arrayBuffers).padStart(9)}${RESET} (${this.formatBytes(entry.peakArrayBuffers).padStart(9)})`,
        );
      }
    }
    this.log.debug(`Tracker stopped`);
  }
}
