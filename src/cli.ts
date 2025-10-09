/**
 * This file contains the CLI entry point of Matterbridge.
 *
 * @file cli.ts
 * @author Luca Liguori
 * @created 2023-12-29
 * @version 2.1.0
 * @license Apache-2.0
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
 * limitations under the License.
 */

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mCli loaded.\u001B[40;0m');

// Node modules
import type { HeapProfiler, InspectorNotification, Session } from 'node:inspector';
import os from 'node:os';
import { inspect } from 'node:util';

// AnsiLogger module
import { AnsiLogger, BRIGHT, CYAN, db, LogLevel, RED, TimestampFormat, YELLOW } from 'node-ansi-logger';

// Matterbridge
import { getIntParameter, hasParameter } from './utils/commandLine.js';
import { Matterbridge } from './matterbridge.js';
import { cliEmitter, setLastCpuUsage, setLastProcessCpuUsage } from './cliEmitter.js';

export let instance: Matterbridge | undefined;

// Inspectop
let session: Session | undefined;
let snapshotInterval: NodeJS.Timeout;

// Cpu and memory check
const trace = hasParameter('trace');
let memoryCheckInterval: NodeJS.Timeout;
const memoryCheckIntervalMs = getIntParameter('memoryinterval') ?? 10 * 1000;
let memoryPeakResetTimeout: NodeJS.Timeout;
let prevCpus: os.CpuInfo[];
let prevProcessCpu: NodeJS.CpuUsage;

let peakCpu = 0;
let peakProcessCpu = 0;
let peakRss = 0;
let peakHeapUsed = 0;
let peakHeapTotal = 0;

// History
const historySize: number = 1000;
let historyIndex: number = 0;

type CpuMemoryEntry = {
  cpu: number;
  peakCpu: number;
  processCpu: number;
  peakProcessCpu: number;
  rss: number;
  peakRss: number;
  heapUsed: number;
  peakHeapUsed: number;
  heapTotal: number;
  peakHeapTotal: number;
  timestamp: number;
};

const history: CpuMemoryEntry[] = Array.from({ length: historySize }, () => ({
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
}));

const log = new AnsiLogger({ logName: 'Cli', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });

const formatCpuUsage = (percent: number): string => {
  return `${percent.toFixed(2).padStart(5, ' ')} %`;
};

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

/**
 * Starts the CPU and memory check interval.
 *
 * @remarks
 * Debug parameter
 *
 * -memoryinterval <milliseconds> can be used to set the interval. Default is 10 seconds.
 */
async function startCpuMemoryCheck() {
  // const os = await import('node:os');

  log.debug(`Cpu memory check started`);
  prevCpus = os.cpus();
  prevProcessCpu = process.cpuUsage();

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
    if (memoryUsageRaw.rss > peakRss) {
      if (peakRss && trace) log.debug(`****${RED}${BRIGHT}Rss peak detected.${db} Peak rss from ${CYAN}${formatMemoryUsage(peakRss)}${db} to ${CYAN}${formatMemoryUsage(memoryUsageRaw.rss)}${db}`);
      peakRss = memoryUsageRaw.rss;
    }
    if (memoryUsageRaw.heapUsed > peakHeapUsed) {
      if (peakHeapUsed && trace) log.debug(`****${RED}${BRIGHT}HeapUsed peak detected.${db} Peak heapUsed from ${CYAN}${formatMemoryUsage(peakHeapUsed)}${db} to ${CYAN}${formatMemoryUsage(memoryUsageRaw.heapUsed)}${db}`);
      peakHeapUsed = memoryUsageRaw.heapUsed;
    }
    if (memoryUsageRaw.heapTotal > peakHeapTotal) {
      if (peakHeapTotal && trace) log.debug(`****${RED}${BRIGHT}HeapTotal peak detected.${db} Peak heapTotal from ${CYAN}${formatMemoryUsage(peakHeapTotal)}${db} to ${CYAN}${formatMemoryUsage(memoryUsageRaw.heapTotal)}${db}`);
      peakHeapTotal = memoryUsageRaw.heapTotal;
    }
    cliEmitter.emit('memory', totalMememory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers);

    // Get the host cpu usage
    const currCpus = os.cpus();
    // log.debug(`Cpus: ${JSON.stringify(currCpus)}`);
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
      log.debug(`Cpu check failed, using previous cpus`);
    } else {
      setLastCpuUsage(cpuUsage);
      if (cpuUsage > peakCpu) {
        peakCpu = cpuUsage;
        if (peakCpu && trace) log.debug(`****${RED}${BRIGHT}Cpu peak detected.${db} Peak cpu from ${CYAN}${formatCpuUsage(peakCpu)}${db} to ${CYAN}${formatCpuUsage(cpuUsage)}${db}`);
      }
    }
    prevCpus = currCpus;

    // Get the process cpu usage https://cdn.jsdelivr.net/npm/chart.js
    const diff = process.cpuUsage(prevProcessCpu);
    const userMs = diff.user / 1000;
    const systemMs = diff.system / 1000;
    const totalMs = userMs + systemMs;
    const processCpuUsage = Number(((totalMs / memoryCheckIntervalMs) * 100).toFixed(2));
    peakProcessCpu = Math.max(peakProcessCpu, processCpuUsage);
    prevProcessCpu = process.cpuUsage();
    setLastProcessCpuUsage(processCpuUsage);

    cliEmitter.emit('cpu', cpuUsage, processCpuUsage);

    // Update preallocated history entry in place to avoid per-interval allocations. Keep the same object reference.
    const entry = history[historyIndex];
    entry.cpu = cpuUsage;
    entry.peakCpu = peakCpu;
    entry.processCpu = processCpuUsage;
    entry.peakProcessCpu = peakProcessCpu;
    entry.rss = memoryUsageRaw.rss;
    entry.peakRss = peakRss;
    entry.heapUsed = memoryUsageRaw.heapUsed;
    entry.peakHeapUsed = peakHeapUsed;
    entry.heapTotal = memoryUsageRaw.heapTotal;
    entry.peakHeapTotal = peakHeapTotal;
    entry.timestamp = Date.now();
    historyIndex = (historyIndex + 1) % historySize;

    // Show the cpu and memory usage
    if (trace)
      log.debug(
        `***${YELLOW}${BRIGHT}Host cpu:${db} ${CYAN}${formatCpuUsage(cpuUsage)}${db} (peak ${formatCpuUsage(peakCpu)}) ${YELLOW}${BRIGHT}Process cpu:${db} ${CYAN}${formatCpuUsage(processCpuUsage)}${db} (peak ${formatCpuUsage(peakProcessCpu)}) ${YELLOW}${BRIGHT}Process memory:${db} rss ${CYAN}${rss}${db} (peak ${formatMemoryUsage(peakRss)}) heapUsed ${CYAN}${heapUsed}${db} (peak ${formatMemoryUsage(peakHeapUsed)}) heapTotal ${CYAN}${heapTotal}${db} (peak ${formatMemoryUsage(peakHeapTotal)}) external ${external} arrayBuffers ${arrayBuffers}`,
      );
  };

  clearInterval(memoryCheckInterval);
  memoryCheckInterval = setInterval(interval, memoryCheckIntervalMs).unref();

  clearTimeout(memoryPeakResetTimeout);
  memoryPeakResetTimeout = setTimeout(
    () => {
      log.debug(`****${RED}${BRIGHT}Cpu and memory peaks reset after first 5 minutes.${db}`);
      peakCpu = 0;
      peakProcessCpu = 0;
      peakRss = 0;
      peakHeapUsed = 0;
      peakHeapTotal = 0;
    },
    5 * 60 * 1000,
  ).unref(); // Reset peaks every 5 minutes
}

/**
 * Stops the CPU and memory check interval.
 */
async function stopCpuMemoryCheck() {
  try {
    const generateHistoryPage = await import('./cliHistory.js');
    generateHistoryPage.generateHistoryPage(history, historyIndex);
  } catch (err) {
    log.error(`Failed to generate history page: ${inspect(err)}`);
  }
  if (trace) {
    log.debug(
      `***Cpu memory check stopped. Peak cpu: ${CYAN}${peakCpu.toFixed(2)} %${db}. Peak rss: ${CYAN}${formatMemoryUsage(peakRss)}${db}. Peak heapUsed: ${CYAN}${formatMemoryUsage(peakHeapUsed)}${db}. Peak heapTotal: ${CYAN}${formatMemoryUsage(peakHeapTotal)}${db}`,
    );

    for (let i = 0; i < historySize; i++) {
      const index = (historyIndex + i) % historySize;
      const entry = history[index];
      // Skip entries where all values are 0 (unfilled history slots)
      if (entry.cpu === 0 && entry.peakCpu === 0 && entry.timestamp === 0) continue;
      log.debug(
        `Time: ${new Date(entry.timestamp).toLocaleString()} host cpu: ${CYAN}${formatCpuUsage(entry.cpu)}${db} (peak ${formatCpuUsage(entry.peakCpu)}) process cpu: ${CYAN}${formatCpuUsage(entry.processCpu)}${db} (peak ${formatCpuUsage(entry.peakProcessCpu)}) rss: ${CYAN}${formatMemoryUsage(entry.rss)}${db} (peak ${formatMemoryUsage(entry.peakRss)}) heapUsed: ${CYAN}${formatMemoryUsage(entry.heapUsed)}${db} (peak ${formatMemoryUsage(entry.peakHeapUsed)}) heapTotal: ${CYAN}${formatMemoryUsage(entry.heapTotal)}${db} (peak ${formatMemoryUsage(entry.peakHeapTotal)})`,
      );
    }
  }
  clearInterval(memoryCheckInterval);
  clearTimeout(memoryPeakResetTimeout);
}

/**
 * Starts the inspector for heap sampling.
 * This function is called when the -inspect parameter is passed.
 * The -snapshotinterval parameter can be used to set the heap snapshot interval. Default is undefined. Minimum is 30000 ms.
 * The snapshot is saved in the heap_profile directory that is created in the current working directory.
 * The snapshot can be analyzed using vscode or Chrome DevTools or other tools that support heap snapshots.
 *
 * @remarks To use the inspector, Node.js must be started with --inspect.
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
      clearInterval(snapshotInterval);
      snapshotInterval = setInterval(async () => {
        log.debug(`Run heap snapshot interval`);
        await takeHeapSnapshot();
      }, interval).unref();
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

  log.debug(`Taking heap snapshot...`);

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
 * This function is working only if the process is started with --expose_gc.
 *
 * @remarks To check the effect of the garbage collection, add --trace_gc or --trace_gc_verbose.
 */
function triggerGarbageCollection() {
  if (typeof global.gc === 'function') {
    global.gc();
    log.debug('Manual garbage collection triggered via global.gc().');
  } else {
    log.debug('Garbage collection is not exposed. Start Node.js with --expose-gc to enable manual GC.');
  }
}

/**
 * Registers event handlers for the Matterbridge instance.
 */
function registerHandlers() {
  log.debug('Registering event handlers...');
  if (instance) instance.on('shutdown', async () => shutdown());
  if (instance) instance.on('restart', async () => restart());
  if (instance) instance.on('update', async () => update());
  if (instance) instance.on('startmemorycheck', async () => start());
  if (instance) instance.on('stopmemorycheck', async () => stop());
  if (instance) instance.on('startinspector', async () => startInspector());
  if (instance) instance.on('stopinspector', async () => stopInspector());
  if (instance) instance.on('takeheapsnapshot', async () => takeHeapSnapshot());
  if (instance) instance.on('triggergarbagecollection', async () => triggerGarbageCollection());
  log.debug('Registered event handlers');
}

/**
 * Shuts down the Matterbridge instance and exits the process.
 */
async function shutdown() {
  log.debug('Received shutdown event, exiting...');

  if (hasParameter('inspect')) await stopInspector();

  await stopCpuMemoryCheck();

  cliEmitter.emit('shutdown');
  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
}

/**
 *
 */
async function restart() {
  log.debug('Received restart event, loading...');
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

/**
 *
 */
async function update() {
  log.debug('Received update event, updating...');
  // TODO: Implement update logic outside of matterbridge
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

/**
 * Starts the CPU and memory check when the -startmemorycheck parameter is passed.
 */
async function start() {
  log.debug('Received start memory check event');
  await startCpuMemoryCheck();
}

/**
 * Stops the CPU and memory check when the -stopmemorycheck parameter is passed.
 */
async function stop() {
  log.debug('Received stop memory check event');
  await stopCpuMemoryCheck();
}

/**
 * Main function that initializes the Matterbridge instance and starts the CLI.
 *
 * @remarks
 *
 * Debug parameters:
 *
 * --debug enables debug logging.
 *
 * --loader enables loader logging.
 *
 * --trace enables cpu and memory logging and history logging on shutdown.
 *
 * --memoryinterval <milliseconds> can be used to set the CPU and memory check interval. Default is 10 seconds.
 *
 * --inspect enables the inspector for heap sampling.
 *
 * --snapshotinterval <milliseconds> can be used to set the heap snapshot interval. Default is undefined. Minimum is 30000 ms.
 */
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
    cliEmitter.emit('ready');
  }
}

// Run the main function
process.title = 'matterbridge';
main().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorInspect = inspect(error, { depth: 10 });
  log.error(`Matterbridge.loadInstance() failed with error: ${errorMessage}\nstack: ${errorInspect}`);
});
