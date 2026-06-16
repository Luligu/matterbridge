/**
 * @description Local shared Matterbridge test helper for the checkUpdates vitest suite.
 * @file vitest/sharedMatterbridge.ts
 * @author Luca Liguori
 * @created 2026-06-12
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Instead of booting a real Matterbridge instance (as the jest harness does), this helper provides:
 * - a local mutable `matterbridge` instance built on top of vitest-utils `getMatterbridge()`;
 * - `startMatterbridge()` / `stopMatterbridge()` that spin up the minimal BroadcastServer responders
 *   (`matterbridge` and `plugins`) needed by checkUpdates, so the test server gets real answers.
 */

// oxlint-disable typescript/no-unsafe-type-assertion

import type { ApiPlugin, SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from '../src/broadcastServer.js';

/** Make a Readonly type mutable so the tests can update version fields. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Local mutable Matterbridge instance for the checkUpdates tests.
 * `SharedMatterbridge` is Readonly, but the tests mutate the version fields, so we expose a writable copy.
 * checkUpdates only reads version/logLevel fields, so the directory and system fields are placeholders.
 */
export const matterbridge: Writable<SharedMatterbridge> = {
  systemInformation: {
    interfaceName: 'eth0',
    macAddress: 'aa:bb:cc:dd:ee:ff',
    ipv4Address: '192.168.68.100',
    ipv6Address: 'fd78:cbf8:4939:46e2:51b2:2163:7f88:c33d',
    nodeVersion: '24.16.0',
    hostname: 'matterbridge',
    user: 'vitest',
    osType: 'Linux',
    osRelease: '6.8.0-xxxx',
    osPlatform: 'linux',
    osArch: 'arm64',
    totalMemory: '0 B',
    freeMemory: '0 B',
    systemUptime: '0s',
    processUptime: '0s',
    cpuUsage: '0%',
    processCpuUsage: '0%',
    rss: '0 B',
    heapTotal: '0 B',
    heapUsed: '0 B',
  },
  uuid: '00000000-0000-0000-0000-000000000000',
  rootDirectory: 'matterbridge',
  homeDirectory: 'matterbridge',
  matterbridgeDirectory: 'matterbridge/.matterbridge',
  matterbridgePluginDirectory: 'matterbridge/Matterbridge',
  matterbridgeCertDirectory: 'matterbridge/.mattercert',
  globalModulesDirectory: 'matterbridge/node_modules',
  matterbridgeVersion: '3.9.1',
  matterbridgeLatestVersion: '3.9.1',
  matterbridgeDevVersion: '3.9.1',
  frontendVersion: '3.9.1',
  dockerDev: undefined,
  dockerVersion: undefined,
  dockerLatestVersion: undefined,
  dockerDevVersion: undefined,
  bridgeMode: 'bridge',
  restartMode: '',
  virtualMode: 'mounted_switch',
  profile: undefined,
  logLevel: LogLevel.DEBUG,
  fileLogger: false,
  matterLogLevel: LogLevel.DEBUG,
  matterFileLogger: false,
  mdnsInterface: undefined,
  ipv4Address: undefined,
  ipv6Address: undefined,
  port: undefined,
  discriminator: undefined,
  passcode: undefined,
};

const log = new AnsiLogger({ logName: 'SharedMatterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

let matterbridgeServer: BroadcastServer | undefined;
let pluginsServer: BroadcastServer | undefined;

/** Plugins held by the fake `plugins` responder. */
const plugins: ApiPlugin[] = [];

/**
 * Start the minimal shared Matterbridge environment: the `matterbridge` and `plugins` BroadcastServer responders.
 * The boot parameters are accepted for call-site compatibility with the jest harness but are not used here.
 *
 * @returns {Promise<SharedMatterbridge>} The local matterbridge instance.
 */
// oxlint-disable-next-line typescript/require-await
export async function startMatterbridge(): Promise<SharedMatterbridge> {
  plugins.length = 0;

  // The 'matterbridge' responder updates the shared instance when checkUpdates broadcasts the resolved versions.
  matterbridgeServer = new BroadcastServer('matterbridge', log);
  matterbridgeServer.on('broadcast_message', (msg: WorkerMessage) => {
    const request = msg as Extract<WorkerMessage, { params: { version: string } }>;
    if (msg.type === 'matterbridge_latest_version') matterbridge.matterbridgeLatestVersion = request.params.version;
    else if (msg.type === 'matterbridge_dev_version') matterbridge.matterbridgeDevVersion = request.params.version;
  });

  // The 'plugins' responder answers plugins_add and plugins_apipluginarray fetches and stores the added plugins.
  pluginsServer = new BroadcastServer('plugins', log);
  pluginsServer.on('broadcast_message', (msg: WorkerMessage) => {
    if (msg.type === 'plugins_add') {
      const plugin = { name: 'matterbridge-mock1', version: '1.0.1' } as ApiPlugin;
      plugins.push(plugin);
      pluginsServer?.respond({ type: 'plugins_add', src: 'plugins', dst: msg.src, id: msg.id, timestamp: msg.timestamp, result: { plugin, success: true } } as never);
    } else if (msg.type === 'plugins_apipluginarray') {
      pluginsServer?.respond({ type: 'plugins_apipluginarray', src: 'plugins', dst: msg.src, id: msg.id, timestamp: msg.timestamp, result: { plugins, success: true } } as never);
    }
    // plugins_set_latest_version / plugins_set_dev_version: checkUpdates already mutates the passed plugin directly, so no response is required.
  });

  return matterbridge;
}

/**
 * Stop the shared Matterbridge environment, closing the BroadcastServer responders.
 * The pause parameters are accepted for call-site compatibility with the jest harness but are not used here.
 *
 * @returns {Promise<void>} Resolves once the responders are closed.
 */
// oxlint-disable-next-line typescript/require-await
export async function stopMatterbridge(): Promise<void> {
  matterbridgeServer?.close();
  pluginsServer?.close();
  matterbridgeServer = undefined;
  pluginsServer = undefined;
}
