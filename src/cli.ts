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

import type { Session } from 'node:inspector';
import type os from 'node:os';

let instance: Matterbridge | undefined;
let session: Session;
let memoryCheckInterval: NodeJS.Timeout;
let prevCpus: os.CpuInfo[];
let lastCpuUsage = 0;

const cli = '\u001B[32m';
const er = '\u001B[38;5;9m';
const rs = '\u001B[40;0m';
const db = '\u001B[38;5;245m';
const CYAN = '\u001B[36m';
const YELLOW = '\u001B[33m';
const BRIGHT = '\u001B[1m';

async function main() {
  if (process.argv.includes('-memorycheck')) await startMemoryCheck();

  if (process.argv.includes('-inspector')) await startInspector();

  if (process.argv.includes('-debug')) console.log(cli + `CLI: ${process.argv.includes('-edge') ? 'MatterbridgeEdge' : 'Matterbridge'}.loadInstance() called` + rs);
  instance = await Matterbridge.loadInstance(true);
  registerHandlers();
  if (process.argv.includes('-debug')) console.log(cli + `CLI: ${process.argv.includes('-edge') ? 'MatterbridgeEdge' : 'Matterbridge'}.loadInstance() exited` + rs);
}

async function startMemoryCheck() {
  const os = await import('node:os');
  console.log(cli + `CLI: Memory check started` + rs);
  prevCpus = os.cpus();

  const formatMemoryUsage = (bytes: number): string => {
    if (bytes >= 1024 ** 3) {
      return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    } else if (bytes >= 1024 ** 2) {
      return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    } else {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
  };

  const interval = () => {
    // Get the cpu usage
    const currCpus = os.cpus();
    let cpuUsageLog: string;
    if (currCpus.length !== prevCpus.length) {
      prevCpus = currCpus; // Reset the previous cpus
      cpuUsageLog = lastCpuUsage.toFixed(2);
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
      cpuUsageLog = lastCpuUsage.toFixed(2);
    }
    prevCpus = currCpus;
    lastCpuUsage = cpuUsage;
    cpuUsageLog = cpuUsage.toFixed(2);

    // Get the memory usage
    const memoryUsageRaw = process.memoryUsage();
    const memoryUsage = {
      rss: formatMemoryUsage(memoryUsageRaw.rss),
      heapTotal: formatMemoryUsage(memoryUsageRaw.heapTotal),
      heapUsed: formatMemoryUsage(memoryUsageRaw.heapUsed),
      external: formatMemoryUsage(memoryUsageRaw.external),
      arrayBuffers: formatMemoryUsage(memoryUsageRaw.arrayBuffers),
    };
    console.log(
      `${YELLOW}${BRIGHT}Cpu usage:${db} ${CYAN}${cpuUsageLog.padStart(6, ' ')} %${db} ${YELLOW}${BRIGHT}Memory usage:${db} rss ${CYAN}${memoryUsage.rss}${db} heapTotal ${CYAN}${memoryUsage.heapTotal}${db} heapUsed ${CYAN}${memoryUsage.heapUsed}${db} external ${memoryUsage.external} arrayBuffers ${memoryUsage.arrayBuffers}` +
        rs,
    );
  };
  interval();
  memoryCheckInterval = setInterval(interval, 1000);
}

async function stopMemoryCheck() {
  console.log(cli + `CLI: Stopping memory check in 5 minute` + rs);
  instance = undefined;
  setTimeout(
    () => {
      console.log(cli + `CLI: Memory check stopped` + rs);
      clearInterval(memoryCheckInterval);
      process.exit(0);
    },
    5 * 60 * 1000,
  );
}

async function startInspector() {
  const { Session } = await import('node:inspector');

  session = new Session();
  session.connect();
  session.post('HeapProfiler.startSampling', {}, (err) => {
    if (err) console.error(err);
    else console.log(cli + `CLI: Heap sampling started` + rs);
  });
}

async function stopInspector() {
  const { writeFileSync } = await import('node:fs');

  session.post('HeapProfiler.stopSampling', (err, result) => {
    if (err) {
      console.error(err);
    } else {
      const profile = JSON.stringify(result.profile, null, 2);
      writeFileSync('heap-sampling-profile.heapsampling.json', profile);
      console.log(cli + `CLI: Heap sampling profile saved to heap-sampling-profile.heapsnapshot` + rs);
    }
  });
}

function registerHandlers() {
  if (instance) instance.on('shutdown', async () => shutdown());
  if (instance) instance.on('restart', async () => restart());
  if (instance) instance.on('update', async () => update());
}

async function shutdown() {
  if (process.argv.includes('-debug')) console.log(cli + 'CLI: received shutdown event, exiting...' + rs);

  if (process.argv.includes('-inspector')) await stopInspector();

  if (process.argv.includes('-memorycheck')) {
    await stopMemoryCheck();
  } else {
    process.exit(0);
  }
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

process.title = 'matterbridge';

// Run the main function
main().catch((error) => {
  console.error(er + `CLI: Matterbridge.loadInstance() failed with error: ${error}` + rs);
});
