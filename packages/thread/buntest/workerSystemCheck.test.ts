/**
 * @file packages/thread/buntest/workerSystemCheck.test.ts
 * @description This file contains the tests for the SystemCheck worker.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, type Mock, test, vi } from 'bun:test';
import os from 'node:os';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
// oxlint-disable-next-line import/no-namespace
import * as utilsBun from '@matterbridge/utils/bun';
// oxlint-disable-next-line import/no-namespace
import * as utilsError from '@matterbridge/utils/error';
import { LogLevel } from 'node-ansi-logger';

// Copies of the real modules, spread into the partial mocks below.
const actualUtilsBun = { ...utilsBun };
const actualUtilsError = { ...utilsError };

type FnMock = Mock<(...args: any[]) => any>;
type RunResult = { success: boolean; loggerMock: FnMock; snackBarMock: FnMock; fetchMock: FnMock; networkInterfacesMock: FnMock };
type RunOptions = Readonly<{
  nodeVersion: string;
  networkInterfaces: Record<string, unknown>;
  mdnsInterface?: string;
  fetchThrows?: boolean;
  nvm?: boolean;
}>;

// Setup the test environment
await setupTest('WorkerSystemCheck', false);

describe('workerSystemCheck', () => {
  const isBun = vi.fn<() => boolean>();
  const getBunVersion = vi.fn<() => string | undefined>();
  const getBunLatestVersion = vi.fn<() => Promise<string | undefined>>();
  const inspectError = vi.fn<(...args: any[]) => string>();
  const originalNodeVersion = Object.getOwnPropertyDescriptor(process.versions, 'node');
  const originalNvm = { NVM_BIN: process.env.NVM_BIN, NVM_DIR: process.env.NVM_DIR };
  let networkInterfacesSpy: FnMock | undefined;
  let wrapperName: string | undefined;
  let entrypoint: (worker: any) => Promise<boolean>;

  /**
   * Run the worker entrypoint with a fake ThreadsWrapper, a faked Node.js version, NVM environment and network interfaces.
   *
   * @param {RunOptions} options - The faked environment.
   * @returns {Promise<RunResult>} The entrypoint result and the fake worker mocks.
   */
  async function runWorker(options: RunOptions): Promise<RunResult> {
    Object.defineProperty(process.versions, 'node', { value: options.nodeVersion, configurable: true });
    delete process.env.NVM_BIN;
    delete process.env.NVM_DIR;
    if (options.nvm) {
      process.env.NVM_BIN = '/fake/nvm/bin';
      process.env.NVM_DIR = '/fake/nvm/dir';
    }
    const networkInterfacesMock = vi.spyOn(os, 'networkInterfaces').mockReturnValue(options.networkInterfaces as ReturnType<typeof os.networkInterfaces>);
    networkInterfacesSpy = networkInterfacesMock;
    const loggerMock = vi.fn<(...args: any[]) => any>();
    const snackBarMock = vi.fn<(...args: any[]) => any>();
    const fetchMock = options.fetchThrows
      ? vi.fn<(...args: any[]) => any>(async () => await Promise.reject(new Error('fetch failed')))
      : vi.fn<(...args: any[]) => any>(async () => await Promise.resolve({ result: { data: { mdnsInterface: options.mdnsInterface } } }));
    const worker = { logger: loggerMock, snackBar: snackBarMock, log: { debug: vi.fn<(...args: any[]) => any>() }, server: { fetch: fetchMock } };
    const success = await entrypoint(worker);
    return { success, loggerMock, snackBarMock, fetchMock, networkInterfacesMock };
  }

  /**
   * Set the Bun runtime the worker sees.
   *
   * @param {string | undefined} version - The running Bun version, undefined when not running on Bun.
   * @param {string | undefined} latest - The latest Bun version available.
   * @param {boolean} [bun] - Whether the worker runs on Bun. Defaults to true when a version is given.
   */
  function setBun(version: string | undefined, latest: string | undefined, bun: boolean = version !== undefined): void {
    isBun.mockReturnValue(bun);
    getBunVersion.mockReturnValue(version);
    getBunLatestVersion.mockResolvedValue(latest);
  }

  const fullInterfaces = {
    eth0: [
      { family: 'IPv4', internal: true },
      { family: 'IPv4', internal: false },
      { family: 'IPv6', internal: false },
    ],
  };

  beforeAll(async () => {
    await mock.module('../src/threadsWrapper.js', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Capture the entrypoint instead of starting a thread.
      ThreadsWrapper: class {
        constructor(name: string, fn: (worker: any) => Promise<boolean>) {
          wrapperName = name;
          entrypoint = fn;
        }
      },
    }));
    await mock.module('@matterbridge/utils/bun', () => ({ ...actualUtilsBun, isBun, getBunVersion, getBunLatestVersion }));
    await mock.module('@matterbridge/utils/error', () => ({ ...actualUtilsError, inspectError }));
    await import('../src/workerSystemCheck.js');
  });

  beforeEach(() => {
    isBun.mockReset().mockReturnValue(false);
    getBunVersion.mockReset();
    getBunLatestVersion.mockReset();
    inspectError.mockReset().mockReturnValue('inspected error');
  });

  afterEach(() => {
    if (originalNodeVersion) Object.defineProperty(process.versions, 'node', originalNodeVersion);
    if (originalNvm.NVM_BIN === undefined) delete process.env.NVM_BIN;
    else process.env.NVM_BIN = originalNvm.NVM_BIN;
    if (originalNvm.NVM_DIR === undefined) delete process.env.NVM_DIR;
    else process.env.NVM_DIR = originalNvm.NVM_DIR;
    networkInterfacesSpy?.mockRestore();
    networkInterfacesSpy = undefined;
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should report Node.js 20.18, NVM and an excluded interface when no mdns interface is set', async () => {
    const { success, loggerMock, snackBarMock, fetchMock } = await runWorker({
      nvm: true,
      nodeVersion: '20.18.0',
      mdnsInterface: '',
      networkInterfaces: { docker0: [{ family: 'IPv4', internal: false }], ...fullInterfaces },
    });

    expect(wrapperName).toBe('SystemCheck');
    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 1000);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting system check/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'You are running Node.js version: 20.18.0');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^System Check: NVM is a development tool/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^System Check: Node\.js version < 20\.19\.0 is not supported/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, expect.stringMatching(/^System Check: Found network interface 'docker0'.*Matter mDNS/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, expect.stringMatching(/^System Check: Use --mdnsinterface parameter or set Mdns interface in Settings.*Matter mDNS/));
    expect(snackBarMock).toHaveBeenCalledWith(
      'System Check: Use --mdnsinterface parameter or set Mdns interface in Settings to specify the correct local interface for Matter mDNS.',
      0,
      'warning',
    );
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('should log the inspected error and return false when the fetch fails', async () => {
    const { success, loggerMock } = await runWorker({ nodeVersion: '24.13.0', mdnsInterface: '', networkInterfaces: {}, fetchThrows: true });

    expect(success).toBe(false);
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to perform system check', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });

  test('should report Node.js 22.12 and every missing interface kind when there are no interfaces', async () => {
    const { success, loggerMock, snackBarMock } = await runWorker({ nodeVersion: '22.12.0', mdnsInterface: '', networkInterfaces: {} });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^System Check: Node\.js version < 22\.13\.0 is not supported/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/Please consider using the Node\.js LTS version/));
    for (const kind of ['internal', 'external', 'IPv4', 'IPv6']) {
      expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, `System Check: No ${kind} network interface found. Check your network configuration.`);
      expect(snackBarMock).toHaveBeenCalledWith(`System Check: No ${kind} network interface found. Check your network configuration.`, 0, 'error');
    }
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('should report an odd major version and skip the excluded interface warning when an mdns interface is set', async () => {
    const { success, loggerMock } = await runWorker({ nodeVersion: '21.0.0', mdnsInterface: 'eth0', networkInterfaces: { docker0: [{ family: 'IPv4', internal: false }] } });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^System Check: Node\.js odd major versions are not supported/));
    expect(loggerMock).not.toHaveBeenCalledWith(LogLevel.WARN, expect.stringMatching(/Found network interface 'docker0'/));
  });

  test('should only suggest the LTS version when running Node.js 26', async () => {
    const { success, loggerMock } = await runWorker({ nodeVersion: '26.0.0', mdnsInterface: 'eth0', networkInterfaces: fullInterfaces });

    expect(success).toBe(true);
    expect(loggerMock.mock.calls.filter((call) => call[0] === LogLevel.ERROR)).toHaveLength(0);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/Please consider using the Node\.js LTS version/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('should not suggest an upgrade or check Bun when running Node.js 24', async () => {
    const { success, loggerMock } = await runWorker({ nodeVersion: '24.13.0', mdnsInterface: 'eth0', networkInterfaces: fullInterfaces });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'You are running Node.js version: 24.13.0');
    expect(loggerMock).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Bun version:'));
    expect(getBunLatestVersion).not.toHaveBeenCalled();
    expect(loggerMock.mock.calls.filter((call) => call[0] === LogLevel.NOTICE)).toHaveLength(0);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test.each(['20.18.0', '22.12.0', '21.0.0'])('should log the Bun version and skip the Node.js warnings when Bun reports Node.js %s', async (nodeVersion) => {
    setBun('1.4.0', undefined);
    const { success, loggerMock, snackBarMock, networkInterfacesMock } = await runWorker({ nodeVersion, networkInterfaces: {} });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'You are running Bun version: 1.4.0');
    expect(loggerMock).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Node.js'));
    expect(snackBarMock).not.toHaveBeenCalledWith(expect.stringContaining('Node.js'), expect.anything(), expect.anything());
    expect(networkInterfacesMock).toHaveBeenCalledTimes(1);
    expect(snackBarMock).toHaveBeenCalledWith('System Check: No internal network interface found. Check your network configuration.', 0, 'error');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('should warn when a newer Bun version is available', async () => {
    setBun('1.3.0', '1.4.0');
    const { success, loggerMock } = await runWorker({ nodeVersion: '24.13.0', networkInterfaces: {} });

    expect(success).toBe(true);
    expect(getBunLatestVersion).toHaveBeenCalledTimes(1);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'You are running Bun version: 1.3.0');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, 'Latest Bun version available: 1.4.0. You are running an outdated version of Bun.');
  });

  test.each([
    { version: '1.4.0', latest: '1.4.0' },
    { version: '1.4.0', latest: undefined },
    { version: undefined, latest: '1.4.0' },
  ])('should skip the Bun update warning when the versions are $version and $latest', async ({ version, latest }) => {
    setBun(version, latest, true);
    const { success, loggerMock, networkInterfacesMock } = await runWorker({ nodeVersion: '24.13.0', networkInterfaces: {} });

    expect(success).toBe(true);
    expect(getBunLatestVersion).toHaveBeenCalledTimes(1);
    expect(loggerMock).not.toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('Latest Bun version available:'));
    expect(networkInterfacesMock).toHaveBeenCalledTimes(1);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('should succeed when there are repeated external IPv4 and IPv6 entries', async () => {
    const { success } = await runWorker({
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        eth0: [
          { family: 'IPv4', internal: true },
          { family: 'IPv4', internal: false },
          { family: 'IPv4', internal: false },
          { family: 'IPv6', internal: false },
          { family: 'IPv6', internal: false },
        ],
      },
    });

    expect(success).toBe(true);
  });

  test('should handle an interface with undefined details', async () => {
    const { success, loggerMock } = await runWorker({ nodeVersion: '24.13.0', mdnsInterface: '', networkInterfaces: { wlan0: undefined } });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^System Check: No internal network interface found/));
  });
});
