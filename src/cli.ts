#!/usr/bin/env node
/**
 * This file contains the CLI entry point of Matterbridge.
 *
 * @file cli.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 2.0.0
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
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
 * limitations under the License. *
 */

// Matterbridge
import { Matterbridge } from './matterbridge.js';
import { getIntParameter, hasParameter } from './utils/export.js';

// AnsiLogger module
import { AnsiLogger, BRIGHT, CYAN, db, LogLevel, TimestampFormat, YELLOW } from './logger/export.js';

// Node modules
import type { HeapProfiler, InspectorNotification, Session } from 'node:inspector';
import type os from 'node:os';
import { EventEmitter } from 'node:events';
import { inspect } from 'node:util';

export const cliEmitter = new EventEmitter();

export let instance: Matterbridge | undefined;

// Inspectop
let session: Session | undefined;
let snapshotInterval: NodeJS.Timeout;

// Cpu and memory check
let memoryCheckInterval: NodeJS.Timeout;
let prevCpus: os.CpuInfo[];
export let lastCpuUsage = 0;
let peakCpu = 0;
let peakRss = 0;

const log = new AnsiLogger({ logName: 'Cli', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });

const formatMemoryUsage = (bytes: number): string => {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  } else if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  } else {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
};

const formatOsUpTime = (seconds: number): string => {
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
};

async function startCpuMemoryCheck() {
  const os = await import('node:os');

  log.debug(`Cpu memory check started`);
  prevCpus = os.cpus();
  clearInterval(memoryCheckInterval);

  const interval = () => {
    // Get the os uptime
    const systemUptime = formatOsUpTime(Math.floor(os.uptime()));
    const processUptime = formatOsUpTime(Math.floor(process.uptime()));
    cliEmitter.emit('uptime', systemUptime, processUptime);

    // Get the memory usage
    const totalMememory = formatMemoryUsage(os.totalmem());
    const freeMemory = formatMemoryUsage(os.freemem());
    const memoryUsageRaw = process.memoryUsage();
    const rss = formatMemoryUsage(memoryUsageRaw.rss);
    const heapTotal = formatMemoryUsage(memoryUsageRaw.heapTotal);
    const heapUsed = formatMemoryUsage(memoryUsageRaw.heapUsed);
    const external = formatMemoryUsage(memoryUsageRaw.external);
    const arrayBuffers = formatMemoryUsage(memoryUsageRaw.arrayBuffers);
    if (memoryUsageRaw.rss > peakRss) peakRss = memoryUsageRaw.rss;
    cliEmitter.emit('memory', totalMememory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers);

    // Get the cpu usage
    const currCpus = os.cpus();
    let cpuUsageLog: string;
    if (currCpus.length !== prevCpus.length) {
      prevCpus = currCpus; // Reset the previous cpus
      log.debug(`Cpu check length failed, resetting previous cpus`);
      return;
    }
    let totalIdle = 0,
      totalTick = 0;

    prevCpus.forEach((prevCpu, i) => {
      const currCpu = currCpus[i];
      const idleDiff = currCpu.times.idle - prevCpu.times.idle;
      const totalDiff = (Object.keys(currCpu.times) as (keyof typeof currCpu.times)[]).reduce((acc, key) => acc + (currCpu.times[key] - prevCpu.times[key]), 0);
      totalIdle += idleDiff;
      totalTick += totalDiff;
    });
    const cpuUsage = 100 - (totalIdle / totalTick) * 100;
    if (totalTick === 0 || isNaN(cpuUsage) || !isFinite(cpuUsage) || cpuUsage <= 0) {
      if (lastCpuUsage != 0) log.debug(`Cpu check failed, using previous cpus`);
      cpuUsageLog = lastCpuUsage.toFixed(2);
    } else {
      cpuUsageLog = cpuUsage.toFixed(2);
      lastCpuUsage = cpuUsage;
      if (lastCpuUsage > peakCpu) peakCpu = lastCpuUsage;
      cliEmitter.emit('cpu', lastCpuUsage);
    }
    prevCpus = currCpus;

    // Show the cpu and memory usage
    log.debug(
      `***${YELLOW}${BRIGHT}Cpu usage:${db} ${CYAN}${cpuUsageLog.padStart(6, ' ')} %${db} ${YELLOW}${BRIGHT}Memory usage:${db} rss ${CYAN}${rss}${db} heapTotal ${CYAN}${heapTotal}${db} heapUsed ${CYAN}${heapUsed}${db} external ${external} arrayBuffers ${arrayBuffers}`,
    );
  };
  interval();
  memoryCheckInterval = setInterval(interval, getIntParameter('memoryinterval') ?? 10 * 1000);
}

async function stopCpuMemoryCheck() {
  log.debug(`***Cpu memory check stopped. Peak cpu: ${CYAN}${peakCpu.toFixed(2)} %${db}. Peak rss: ${CYAN}${formatMemoryUsage(peakRss)}${db}.`);
  clearInterval(memoryCheckInterval);
}

/**
 * Starts the inspector for heap sampling.
 * This function is called when the -inspect parameter is passed.
 */
async function startInspector() {
  const { Session } = await import('node:inspector');
  const { mkdirSync } = await import('node:fs');

  log.debug(`***Starting heap sampling...`);

  // Create the heap snapshots directory if it doesn't exist
  mkdirSync('heap_profile', { recursive: true });

  try {
    session = new Session();
    session.connect();
    await new Promise<void>((resolve, reject) => {
      session?.post('HeapProfiler.startSampling', (err) => (err ? reject(err) : resolve()));
    });
    log.debug(`***Started heap sampling`);

    // Set an interval to take heap snapshots
    const interval = getIntParameter('snapshotinterval');
    if (interval && interval >= 30000) {
      log.debug(`***Started heap snapshot interval of ${CYAN}${interval}${db} ms`);
      snapshotInterval = setInterval(async () => {
        await takeHeapSnapshot();
      }, interval);
    }
  } catch (err) {
    log.error(`***Failed to start heap sampling: ${err instanceof Error ? err.message : err}`);
    session?.disconnect();
    session = undefined;
    return;
  }
}

/**
 * Stops the heap sampling and saves the profile to a file.
 * This function is called when the inspector is stopped.
 */
async function stopInspector() {
  const { writeFileSync } = await import('node:fs');
  const path = await import('node:path');

  log.debug(`***Stopping heap sampling...`);

  if (snapshotInterval) {
    log.debug(`***Clearing heap snapshot interval...`);
    // Clear the snapshot interval if it exists
    clearInterval(snapshotInterval);
    // Take a final heap snapshot before stopping
    await takeHeapSnapshot();
  }

  if (!session) {
    log.error('***No active inspector session.');
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await new Promise<any>((resolve, reject) => {
      session?.post('HeapProfiler.stopSampling', (err, result) => (err ? reject(err) : resolve(result)));
    });

    const profile = JSON.stringify(result.profile);
    const filename = path.join('heap_profile', `Heap-profile-${new Date().toISOString().replace(/[:]/g, '-')}.heapprofile`);
    writeFileSync(filename, profile);

    log.debug(`***Heap sampling profile saved to ${CYAN}${filename}${db}`);
  } catch (err) {
    log.error(`***Failed to stop heap sampling: ${err instanceof Error ? err.message : err}`);
  } finally {
    session.disconnect();
    session = undefined;
    log.debug(`***Stopped heap sampling`);
  }
}

/**
 * Takes a heap snapshot and saves it to the file name Heap-snapshot-<timestamp>.heapsnapshot.
 * This function is called periodically based on the -snapshotinterval parameter.
 * The -snapshotinterval parameter must at least 30000 ms.
 * The snapshot is saved in the heap_profile directory that is created in the current working directory.
 * The snapshot can be analyzed using vscode or Chrome DevTools or other tools that support heap snapshots.
 */
async function takeHeapSnapshot() {
  const { writeFileSync } = await import('node:fs');
  const path = await import('node:path');

  const filename = path.join('heap_profile', `Heap-snapshot-${new Date().toISOString().replace(/[:]/g, '-')}.heapsnapshot`);
  if (!session) {
    log.error('No active inspector session.');
    return;
  }

  const chunks: Buffer[] = [];
  const chunksListener = (notification: InspectorNotification<HeapProfiler.AddHeapSnapshotChunkEventDataType>) => {
    chunks.push(Buffer.from(notification.params.chunk));
  };
  session.on('HeapProfiler.addHeapSnapshotChunk', chunksListener);
  await new Promise<void>((resolve) => {
    session?.post('HeapProfiler.takeHeapSnapshot', (err) => {
      if (!err) {
        session?.off('HeapProfiler.addHeapSnapshotChunk', chunksListener);
        writeFileSync(filename, Buffer.concat(chunks));
        log.debug(`***Heap sampling snapshot saved to ${CYAN}${filename}${db}`);
        triggerGarbageCollection();
        resolve();
      } else {
        session?.off('HeapProfiler.addHeapSnapshotChunk', chunksListener);
        log.error(`***Failed to take heap snapshot: ${err instanceof Error ? err.message : err}`);
        resolve();
      }
    });
  });
}

/**
 * Triggers a manual garbage collection.
 * This function is working only if the process is started with --expose-gc.
 */
function triggerGarbageCollection() {
  if (typeof global.gc === 'function') {
    global.gc();
    log.debug('***Manual garbage collection triggered via global.gc().');
  } else {
    log.debug('***Garbage collection is not exposed. Start Node.js with --expose-gc to enable manual GC.');
  }
}

function registerHandlers() {
  log.debug('Registering event handlers...');
  if (instance) instance.on('shutdown', async () => shutdown());
  if (instance) instance.on('restart', async () => restart());
  if (instance) instance.on('update', async () => update());
  if (instance) instance.on('startmemorycheck', async () => start());
  if (instance) instance.on('stopmemorycheck', async () => stop());
  log.debug('Registered event handlers');
}

async function shutdown() {
  log.debug('Received shutdown event, exiting...');

  if (hasParameter('inspect')) await stopInspector();

  await stopCpuMemoryCheck();

  process.exit(0);
}

async function restart() {
  log.debug('Received restart event, loading...');
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

async function update() {
  log.debug('Received update event, updating...');
  // TODO: Implement update logic outside of matterbridge
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

async function start() {
  log.debug('Received start memory check event');
  await startCpuMemoryCheck();
}

async function stop() {
  log.debug('Received stop memory check event');
  await stopCpuMemoryCheck();
}

async function main() {
  log.debug(`Cli main() started`);

  await startCpuMemoryCheck();

  if (hasParameter('inspect')) await startInspector();

  log.debug(`***Matterbridge.loadInstance(true) called`);

  instance = await Matterbridge.loadInstance(true);

  log.debug(`***Matterbridge.loadInstance(true) exited`);

  // Check if the instance needs to shut down from parseCommandLine()
  if (!instance || instance.shutdown) {
    shutdown();
  } else {
    registerHandlers();
  }
}

// Run the main function
process.title = 'matterbridge';
main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorInspect = inspect(error, { depth: 10 });
  log.error(`Matterbridge.loadInstance() failed with error: ${errorMessage}\nstack: ${errorInspect}`);
});
