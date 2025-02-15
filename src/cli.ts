#!/usr/bin/env node
/**
 * This file contains the CLI entry point of Matterbridge.
 *
 * @file cli.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.11
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

/* eslint-disable no-console */
import { Matterbridge } from './matterbridge.js';

// Node modules type import
import type { Session } from 'node:inspector';
import type os from 'node:os';

import { EventEmitter } from 'events';

export const cliEmitter = new EventEmitter();

export let instance: Matterbridge | undefined;

// Inspectop
let session: Session | undefined;

// Cpu and memory check
let memoryCheckInterval: NodeJS.Timeout;
let prevCpus: os.CpuInfo[];
export let lastCpuUsage = 0;

const cli = '\u001B[32m';
const er = '\u001B[38;5;9m';
const rs = '\u001B[40;0m';
const db = '\u001B[38;5;245m';
const CYAN = '\u001B[36m';
const YELLOW = '\u001B[33m';
const BRIGHT = '\u001B[1m';

async function main() {
  await startCpuMemoryCheck();

  if (process.argv.includes('-inspector')) await startInspector();

  if (process.argv.includes('-debug')) console.log(cli + `CLI: Matterbridge.loadInstance() called` + rs);

  instance = await Matterbridge.loadInstance(true);

  registerHandlers();

  if (process.argv.includes('-debug')) console.log(cli + `CLI: Matterbridge.loadInstance() exited` + rs);
}

async function startCpuMemoryCheck() {
  const os = await import('node:os');

  if (process.argv.includes('-debug')) console.log(cli + `CLI: Cpu memory check started` + rs);
  prevCpus = os.cpus();
  clearInterval(memoryCheckInterval);

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
    cliEmitter.emit('memory', totalMememory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers);

    // Get the cpu usage
    const currCpus = os.cpus();
    let cpuUsageLog: string;
    if (currCpus.length !== prevCpus.length) {
      prevCpus = currCpus; // Reset the previous cpus
      if (process.argv.includes('-debug')) console.log(cli + `CLI: Cpu check length failed, resetting previous cpus` + rs);
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
      if (process.argv.includes('-debug') && lastCpuUsage != 0) console.log(cli + `CLI: Cpu check failed, using previous cpus` + rs);
      cpuUsageLog = lastCpuUsage.toFixed(2);
    } else {
      cpuUsageLog = cpuUsage.toFixed(2);
      lastCpuUsage = cpuUsage;
      cliEmitter.emit('cpu', lastCpuUsage);
    }
    prevCpus = currCpus;

    // Show the cpu and memory usage
    if (process.argv.includes('-debug'))
      console.log(
        `${YELLOW}${BRIGHT}Cpu usage:${db} ${CYAN}${cpuUsageLog.padStart(6, ' ')} %${db} ${YELLOW}${BRIGHT}Memory usage:${db} rss ${CYAN}${rss}${db} heapTotal ${CYAN}${heapTotal}${db} heapUsed ${CYAN}${heapUsed}${db} external ${external} arrayBuffers ${arrayBuffers}` +
          rs,
      );
  };
  interval();
  memoryCheckInterval = setInterval(interval, 10 * 1000);
}

async function stopCpuMemoryCheck() {
  if (process.argv.includes('-debug')) console.log(cli + `CLI: Cpu memory check stopped` + rs);
  clearInterval(memoryCheckInterval);
}

async function startInspector() {
  const { Session } = await import('node:inspector');

  if (process.argv.includes('-debug')) console.log(cli + `CLI: Starting heap sampling...` + rs);

  session = new Session();
  session.connect();
  session.post('HeapProfiler.startSampling', {}, (err) => {
    if (err) console.error(err);
    else console.log(cli + `CLI: Heap sampling started` + rs);
  });
}

async function stopInspector() {
  const { writeFileSync } = await import('node:fs');

  if (process.argv.includes('-debug')) console.log(cli + `CLI: Stopping heap sampling...` + rs);

  session?.post('HeapProfiler.stopSampling', (err, result) => {
    if (err) {
      console.error(err);
    } else {
      const profile = JSON.stringify(result.profile, null, 2);
      writeFileSync('heap-sampling-profile.heapsnapshot', profile);
      console.log(cli + `CLI: Heap sampling profile saved to heap-sampling-profile.heapsnapshot` + rs);
    }
    session?.disconnect();
    session = undefined;
  });
}

function registerHandlers() {
  if (instance) instance.on('shutdown', async () => shutdown());
  if (instance) instance.on('restart', async () => restart());
  if (instance) instance.on('update', async () => update());
  if (instance) instance.on('startmemorycheck', async () => start());
  if (instance) instance.on('stopmemorycheck', async () => stop());
}

async function shutdown() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received shutdown event, exiting...' + rs);

  if (process.argv.includes('-inspector')) await stopInspector();

  await stopCpuMemoryCheck();

  process.exit(0);
}

async function restart() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received restart event, loading...' + rs);
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

async function update() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received update event, updating...' + rs);
  // TODO: Implement update logic outside of matterbridge
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
}

async function start() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received start memory check event' + rs);
  startCpuMemoryCheck();
}

async function stop() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received stop memory check event' + rs);
  stopCpuMemoryCheck();
}

process.title = 'matterbridge';

// Run the main function
main().catch((error) => {
  console.error(er + `CLI: Matterbridge.loadInstance() failed with error: ${error}` + rs);
});
