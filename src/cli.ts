/**
 * This file contains the CLI entry point of Matterbridge.
 *
 * @file cli.ts
 * @author Luca Liguori
 * @created 2023-12-29
 * @version 3.0.0
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

/* eslint-disable no-console */
/* eslint-disable n/no-process-exit */

if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mCli loaded.\u001B[40;0m');

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

// Cli
import { cliEmitter } from './cliEmitter.js';
// Matterbridge
import type { Matterbridge } from './matterbridge.js';
import { hasParameter, hasAnyParameter } from './utils/commandLine.js';
import { inspectError } from './utils/error.js';
import { Tracker, TrackerSnapshot } from './utils/tracker.js';
import { Inspector } from './utils/inspector.js';
import { formatBytes, formatUptime } from './utils/format.js';

export let instance: Matterbridge | undefined;
export const tracker = new Tracker('Cli', false, false);
export const inspector = new Inspector('Cli', false, false);

const log = new AnsiLogger({ logName: 'Cli', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });

/**
 * Starts the CPU and memory tracker.
 */
function startCpuMemoryCheck() {
  log.debug(`Cpu memory check starting...`);
  tracker.start();
  tracker.on('uptime', (os: number, process: number) => {
    cliEmitter.emit('uptime', formatUptime(Math.floor(os)), formatUptime(Math.floor(process)));
  });
  tracker.on('snapshot', (snapshot: TrackerSnapshot) => {
    cliEmitter.emit(
      'memory',
      formatBytes(snapshot.totalMemory),
      formatBytes(snapshot.freeMemory),
      formatBytes(snapshot.rss),
      formatBytes(snapshot.heapTotal),
      formatBytes(snapshot.heapUsed),
      formatBytes(snapshot.external),
      formatBytes(snapshot.arrayBuffers),
    );

    cliEmitter.emit('cpu', snapshot.osCpu, snapshot.processCpu);
  });
  log.debug(`Cpu memory check started`);
}

/**
 * Stops the CPU and memory tracker.
 */
function stopCpuMemoryCheck() {
  log.debug(`Cpu memory check stopping...`);
  tracker.stop();
  tracker.removeAllListeners();
  log.debug(`Cpu memory check stopped`);
}

/**
 * Starts the inspector for heap sampling.
 * This function is called when the -inspect parameter is passed.
 */
async function startInspector() {
  await inspector.start();
}

/**
 * Stops the heap sampling and saves the profile.
 * This function is called when the -inspect parameter is passed.
 */
async function stopInspector() {
  await inspector.stop();
}

/**
 * Takes a heap snapshot
 */
async function takeHeapSnapshot() {
  await inspector.takeHeapSnapshot();
}

/**
 * Triggers a manual garbage collection.
 * This function is working only if the node process is started with --expose_gc.
 *
 * @remarks To check the effect of the garbage collection, add also --trace_gc or --trace_gc_verbose.
 */
function triggerGarbageCollection() {
  inspector.runGarbageCollector();
}

/**
 * Registers event handlers for the Matterbridge instance.
 */
function registerHandlers() {
  log.debug('Registering event handlers...');
  // istanbul ignore next cause registerHandlers is called only if instance is defined
  if (!instance) return;
  instance.on('shutdown', () => shutdown());
  instance.on('restart', () => restart());
  instance.on('update', () => update());
  instance.on('startmemorycheck', () => start());
  instance.on('stopmemorycheck', () => stop());
  instance.on('startinspector', () => startInspector());
  instance.on('stopinspector', () => stopInspector());
  instance.on('takeheapsnapshot', () => takeHeapSnapshot());
  instance.on('triggergarbagecollection', () => triggerGarbageCollection());
  log.debug('Registered event handlers');
}

/**
 * Shuts down the Matterbridge instance and exits the process.
 */
async function shutdown() {
  log.debug('Received shutdown event, exiting...');

  if (hasParameter('inspect')) await stopInspector();

  stopCpuMemoryCheck();

  cliEmitter.emit('shutdown');

  process.exit(0);
}

/**
 * Restarts the Matterbridge instance.
 */
async function restart() {
  log.debug('Received restart event, loading...');

  const { Matterbridge } = await import('./matterbridge.js');
  instance = await Matterbridge.loadInstance(true);

  registerHandlers();
}

/**
 * Updates the Matterbridge instance.
 */
async function update() {
  log.debug('Received update event, updating...');

  // TODO: Implement update logic outside of matterbridge
  const { Matterbridge } = await import('./matterbridge.js');
  instance = await Matterbridge.loadInstance(true);

  registerHandlers();
}

/**
 * Starts the CPU and memory check when the -startmemorycheck parameter is passed.
 */
function start() {
  log.debug('Received start memory check event');
  startCpuMemoryCheck();
}

/**
 * Stops the CPU and memory check when the -stopmemorycheck parameter is passed.
 */
function stop() {
  log.debug('Received stop memory check event');
  stopCpuMemoryCheck();
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
 * --verbose enables verbose logging.
 *
 * --loader enables loader logging.
 *
 * --inspect enables the inspector for heap sampling.
 *
 * --snapshotinterval <milliseconds> can be used to set the heap snapshot interval. Default is undefined. Minimum is 30000 ms.
 */
async function main() {
  log.debug(`Cli main() started`);

  startCpuMemoryCheck();

  if (hasParameter('inspect')) await startInspector();

  log.debug(`***Matterbridge.loadInstance(true) called`);

  const { Matterbridge } = await import('./matterbridge.js');
  instance = await Matterbridge.loadInstance(true);

  log.debug(`***Matterbridge.loadInstance(true) exited`);

  // Check if the instance needs to shut down from parseCommandLine()
  if (!instance || instance.shutdown) {
    shutdown();
  } else {
    registerHandlers();
    cliEmitter.emit('ready');
    log.debug(`Cli main() ready`);
  }
}

if (hasAnyParameter('help', 'h')) help();

if (hasAnyParameter('version', 'v')) await version();

main().catch((error) => {
  inspectError(log, 'Matterbridge.loadInstance() failed with error', error);
  shutdown();
});

/**
 * Displays the version.
 */
async function version(): Promise<void> {
  // Dynamic JSON import (Node >= 20) with import attributes
  const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
  console.log(`Matterbridge version ${pkg.version}`);
  process.exit(0);
}

/**
 * Displays the help.
 */
function help(): void {
  console.log(`
  Usage: matterbridge [options] [command] 

    Commands:
      --help:                  show the help
      --version:               show the version
      --add [plugin path]:     register the plugin from the given absolute or relative path
      --add [plugin name]:     register the globally installed plugin with the given name
      --remove [plugin path]:  remove the plugin from the given absolute or relative path
      --remove [plugin name]:  remove the globally installed plugin with the given name
      --enable [plugin path]:  enable the plugin from the given absolute or relative path
      --enable [plugin name]:  enable the globally installed plugin with the given name
      --disable [plugin path]: disable the plugin from the given absolute or relative path
      --disable [plugin name]: disable the globally installed plugin with the given name

    Reset Commands:
      --reset:                 remove the commissioning for Matterbridge (bridge mode and childbridge mode). Shutdown Matterbridge before using it!
      --reset [plugin path]:   remove the commissioning for the plugin from the given absolute or relative path (childbridge mode). Shutdown Matterbridge before using it!
      --reset [plugin name]:   remove the commissioning for the globally installed plugin (childbridge mode). Shutdown Matterbridge before using it!
      --factoryreset:          remove all commissioning information and reset all internal storages. Shutdown Matterbridge before using it!

    Options:
      --bridge:                start Matterbridge in bridge mode
      --childbridge:           start Matterbridge in childbridge mode
      --port [port]:           start the matter commissioning server on the given port (default 5540)
      --mdnsinterface [name]:  set the interface to use for the matter server mdnsInterface (default all interfaces)
      --ipv4address [address]: set the ipv4 interface address to use for the matter server listener (default all addresses)
      --ipv6address [address]: set the ipv6 interface address to use for the matter server listener (default all addresses)
      --frontend [port]:       start the frontend on the given port (default 8283)
      --logger:                set the matterbridge logger level: debug | info | notice | warn | error | fatal (default info)
      --filelogger:            enable the matterbridge file logger (matterbridge.log)
      --matterlogger:          set the matter.js logger level: debug | info | notice | warn | error | fatal (default info)
      --matterfilelogger:      enable the matter.js file logger (matter.log)
      --list:                  list the registered plugins
      --loginterfaces:         log the network interfaces (usefull for finding the name of the interface to use with -mdnsinterface option)
      --logstorage:            log the node storage
      --sudo:                  force the use of sudo to install or update packages if the internal logic fails
      --nosudo:                force not to use sudo to install or update packages if the internal logic fails
      --norestore:             force not to automatically restore the matterbridge node storage and the matter storage from backup if it is corrupted
      --novirtual:             disable the creation of the virtual devices Restart, Update and Reboot Matterbridge
      --ssl:                   enable SSL for the frontend and the WebSocketServer (the server will use the certificates and switch to https)
      --mtls:                  enable mTLS for the frontend and the WebSocketServer (both server and client will use and require the certificates and switch to https)
      --vendorId:              override the default vendorId 0xfff1
      --vendorName:            override the default vendorName "Matterbridge"
      --productId:             override the default productId 0x8000
      --productName:           override the default productName "Matterbridge aggregator"
      --service:               enable the service mode (used in the linux systemctl configuration file and macOS launchctl plist)
      --docker:                enable the docker mode (used in the docker image)
      --homedir:               override the home directory (default the os homedir)
      --delay [seconds]:       set a delay in seconds before starting Matterbridge in the first 5 minutes from a reboot (default 120)
      --fixed_delay [seconds]: set a fixed delay in seconds before starting Matterbridge (default 120)
  `);
  process.exit(0);
}
