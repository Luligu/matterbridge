import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  debugParam: boolean;
  verboseParam: boolean;
  debugWorkerParam?: boolean;
  verboseWorkerParam?: boolean;
  isMainThread?: boolean;
  parentPortPresent?: boolean;
  nodeVersion: string;
  mdnsInterface?: string;
  // @ts-expect-error Partial type for testing purposes
  networkInterfaces: ReturnType<(typeof import('node:os'))['default']['networkInterfaces']>;
  fetchThrows?: boolean;
  nvmEnv?: 'BIN' | 'DIR' | 'VERSION' | 'BOTH' | 'NONE';
}>;

function setProcessNodeVersion(nodeVersion: string): () => void {
  const original = Object.getOwnPropertyDescriptor(process.versions, 'node');
  Object.defineProperty(process.versions, 'node', { value: nodeVersion, configurable: true });
  return () => {
    if (original) Object.defineProperty(process.versions, 'node', original);
  };
}

function setNvmEnv(mode: RunOptions['nvmEnv']): () => void {
  const original = {
    NVM_BIN: process.env.NVM_BIN,
    NVM_DIR: process.env.NVM_DIR,
    NVM_VERSION: process.env.NVM_VERSION,
  };

  delete process.env.NVM_BIN;
  delete process.env.NVM_DIR;
  delete process.env.NVM_VERSION;

  if (mode === 'BIN') process.env.NVM_BIN = '/fake/nvm/bin';
  if (mode === 'DIR') process.env.NVM_DIR = '/fake/nvm/dir';
  if (mode === 'VERSION') process.env.NVM_VERSION = '0.0.0';
  if (mode === 'BOTH') {
    process.env.NVM_BIN = '/fake/nvm/bin';
    process.env.NVM_DIR = '/fake/nvm/dir';
  }

  return () => {
    if (original.NVM_BIN === undefined) delete process.env.NVM_BIN;
    else process.env.NVM_BIN = original.NVM_BIN;

    if (original.NVM_DIR === undefined) delete process.env.NVM_DIR;
    else process.env.NVM_DIR = original.NVM_DIR;

    if (original.NVM_VERSION === undefined) delete process.env.NVM_VERSION;
    else process.env.NVM_VERSION = original.NVM_VERSION;
  };
}

async function runWorkerSystemCheck(options: RunOptions) {
  jest.resetModules();

  const parentPost = jest.fn();
  const parentLog = jest.fn();
  const threadLogger = jest.fn();
  const logWorkerInfo = jest.fn();

  const networkInterfacesMock = jest.fn(() => options.networkInterfaces);

  const fetchMock = options.fetchThrows
    ? jest.fn(async () => {
        throw new Error('fetch failed');
      })
    : jest.fn(async () => ({ result: { data: { mdnsInterface: options.mdnsInterface } } }));
  const closeMock = jest.fn();

  const hasParameter = jest.fn((parameter: string) => {
    if (parameter === 'debug') return options.debugParam;
    if (parameter === 'verbose') return options.verboseParam;
    if (parameter === 'debug-worker') return options.debugWorkerParam ?? false;
    if (parameter === 'verbose-worker') return options.verboseWorkerParam ?? false;
    return false;
  });

  const inspectError = jest.fn(() => 'inspected error');

  const excludedInterfaceNamePattern =
    /(tailscale|wireguard|openvpn|zerotier|hamachi|\bwg\d+\b|\btun\d+\b|\btap\d+\b|\butun\d+\b|docker|podman|\bveth[a-z0-9]*\b|\bbr-[a-z0-9]+\b|cni|kube|flannel|calico|virbr\d*\b|vmware|vmnet\d*\b|virtualbox|vboxnet\d*\b|teredo|isatap)/i;

  const isMainThread = options.isMainThread ?? false;
  const parentPort = (options.parentPortPresent ?? true) ? {} : null;

  jest.unstable_mockModule('node:worker_threads', () => ({
    threadId: 1,
    isMainThread,
    parentPort,
    workerData: { threadName: 'SystemCheck' },
  }));

  jest.unstable_mockModule('node:os', () => ({
    default: {
      networkInterfaces: networkInterfacesMock,
    },
  }));

  jest.unstable_mockModule('@matterbridge/utils', () => ({
    hasParameter,
    inspectError,
    excludedInterfaceNamePattern,
  }));

  jest.unstable_mockModule('./worker.js', () => ({
    logWorkerInfo,
    parentLog,
    parentPost,
    threadLogger,
  }));

  jest.unstable_mockModule('./broadcastServer.js', () => ({
    BroadcastServer: class {
      public name: string;
      public log: unknown;
      public fetch = fetchMock;
      public close = closeMock;

      constructor(name: string, log: unknown) {
        this.name = name;
        this.log = log;
      }
    },
  }));

  const restoreNodeVersion = setProcessNodeVersion(options.nodeVersion);
  const restoreNvm = setNvmEnv(options.nvmEnv ?? 'NONE');

  try {
    await import('./workerSystemCheck.js');
  } finally {
    restoreNvm();
    restoreNodeVersion();
  }

  return {
    parentPost,
    parentLog,
    threadLogger,
    logWorkerInfo,
    hasParameter,
    inspectError,
    networkInterfacesMock,
    fetchMock,
    closeMock,
  };
}

describe('workerSystemCheck', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success path: init/exit, node 20 warnings, excluded interface warn, closes server', async () => {
    const { parentPost, parentLog, threadLogger, fetchMock, closeMock } = await runWorkerSystemCheck({
      debugParam: true,
      verboseParam: false,
      nvmEnv: 'BOTH',
      nodeVersion: '20.18.0',
      mdnsInterface: '',
      networkInterfaces: {
        docker0: [{ address: '172.17.0.1', netmask: '255.255.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '172.17.0.1/16' } as any],
        eth0: [
          { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' } as any,
          { address: '192.168.1.2', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.2/24' } as any,
          { address: '192.168.1.3', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.3/24' } as any,
          { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:00', internal: false, cidr: 'fe80::1/64', scopeid: 0 } as any,
          { address: 'fe80::2', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:00', internal: false, cidr: 'fe80::2/64', scopeid: 0 } as any,
        ],
        wlan0: undefined as any,
      } as any,
    });

    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 1000);
    expect(closeMock).toHaveBeenCalledTimes(1);

    expect(parentPost).toHaveBeenCalledWith({ type: 'init', threadId: 1, threadName: 'SystemCheck', success: true });
    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'SystemCheck', success: true });

    expect(parentLog).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.INFO, expect.stringMatching(/initialized/));
    expect(parentLog).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.INFO, expect.stringMatching(/exiting with success: true/));

    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.WARN, expect.stringMatching(/Found network interface 'docker0'/));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/NVM is a development tool/));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/Node\.js version < 20\.19\.0 is not supported/));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.INFO, 'System check succeeded');
  });

  test('verbose path: logs worker info and node 24 does not emit upgrade notice', async () => {
    const { logWorkerInfo, threadLogger } = await runWorkerSystemCheck({
      debugParam: false,
      verboseParam: true,
      nvmEnv: 'NONE',
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        docker0: [{ family: 'IPv4', internal: false } as any],
        eth0: [{ family: 'IPv4', internal: false } as any, { family: 'IPv6', internal: false } as any, { family: 'IPv4', internal: true } as any],
      } as any,
    });

    expect(logWorkerInfo).toHaveBeenCalledWith(expect.anything(), true);

    const upgradeNoticeCalls = (threadLogger as jest.Mock).mock.calls.filter(
      (call) => call[1] === LogLevel.NOTICE && String(call[2]).includes('Please consider upgrading to Node.js LTS version'),
    );
    expect(upgradeNoticeCalls).toHaveLength(0);
  });

  test('node odd major and missing interfaces: logs errors but still succeeds', async () => {
    const { threadLogger, parentPost } = await runWorkerSystemCheck({
      debugParam: false,
      verboseParam: false,
      nvmEnv: 'NONE',
      nodeVersion: '21.0.0',
      mdnsInterface: '',
      networkInterfaces: {} as any,
    });

    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/Node\.js odd major versions are not supported/));

    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/No internal network interface found/));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/No external network interface found/));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/No IPv4 network interface found/));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/No IPv6 network interface found/));

    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.INFO, 'System check succeeded');
    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'SystemCheck', success: true });
  });

  test('fetch failure: logs inspected error and exits with success false', async () => {
    const { inspectError, threadLogger, parentPost, closeMock } = await runWorkerSystemCheck({
      debugParam: false,
      verboseParam: false,
      nvmEnv: 'NONE',
      nodeVersion: '24.13.0',
      mdnsInterface: '',
      networkInterfaces: {} as any,
      fetchThrows: true,
    });

    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to perform system check', expect.any(Error));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, 'inspected error');
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'SystemCheck', success: false });
  });

  test('covers debug-worker short-circuit and NVM warning when both env vars are set', async () => {
    const { hasParameter, threadLogger } = await runWorkerSystemCheck({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: true,
      verboseWorkerParam: false,
      nvmEnv: 'BOTH',
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        eth0: [{ family: 'IPv4', internal: true } as any, { family: 'IPv4', internal: false } as any, { family: 'IPv6', internal: false } as any],
      } as any,
    });

    expect(hasParameter).toHaveBeenCalledWith('debug-worker');
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/NVM is a development tool/));
  });

  test('covers verbose-worker short-circuit and NVM warning when both env vars are set', async () => {
    const { hasParameter, logWorkerInfo, threadLogger } = await runWorkerSystemCheck({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: true,
      nvmEnv: 'BOTH',
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        eth0: [{ family: 'IPv4', internal: true } as any, { family: 'IPv4', internal: false } as any, { family: 'IPv6', internal: false } as any],
      } as any,
    });

    expect(hasParameter).toHaveBeenCalledWith('verbose-worker');
    expect(logWorkerInfo).toHaveBeenCalledWith(expect.anything(), true);
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.ERROR, expect.stringMatching(/NVM is a development tool/));
  });

  test('main thread: does not post init/exit messages', async () => {
    const { parentPost, parentLog, threadLogger, closeMock } = await runWorkerSystemCheck({
      debugParam: false,
      verboseParam: false,
      isMainThread: true,
      parentPortPresent: false,
      nvmEnv: 'NONE',
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        eth0: [{ family: 'IPv4', internal: true } as any, { family: 'IPv4', internal: false } as any, { family: 'IPv6', internal: false } as any],
      } as any,
    });

    expect(parentPost).not.toHaveBeenCalled();
    expect(parentLog).not.toHaveBeenCalled();
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeSystemCheck', LogLevel.INFO, 'System check succeeded');
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
