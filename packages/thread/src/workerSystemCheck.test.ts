import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  nodeVersion: string;
  mdnsInterface?: string;
  // @ts-expect-error Partial type for testing purposes
  networkInterfaces: ReturnType<(typeof import('node:os'))['default']['networkInterfaces']>;
  fetchThrows?: boolean;
  nvmBin?: boolean;
  nvmDir?: boolean;
}>;

function setProcessNodeVersion(nodeVersion: string): () => void {
  const original = Object.getOwnPropertyDescriptor(process.versions, 'node');
  Object.defineProperty(process.versions, 'node', { value: nodeVersion, configurable: true });
  return () => {
    if (original) Object.defineProperty(process.versions, 'node', original);
  };
}

function setNvmEnv(options: Pick<RunOptions, 'nvmBin' | 'nvmDir'>): () => void {
  const original = {
    NVM_BIN: process.env.NVM_BIN,
    NVM_DIR: process.env.NVM_DIR,
  };

  delete process.env.NVM_BIN;
  delete process.env.NVM_DIR;

  if (options.nvmBin) process.env.NVM_BIN = '/fake/nvm/bin';
  if (options.nvmDir) process.env.NVM_DIR = '/fake/nvm/dir';

  return () => {
    if (original.NVM_BIN === undefined) delete process.env.NVM_BIN;
    else process.env.NVM_BIN = original.NVM_BIN;

    if (original.NVM_DIR === undefined) delete process.env.NVM_DIR;
    else process.env.NVM_DIR = original.NVM_DIR;
  };
}

async function runWorkerSystemCheck(options: RunOptions) {
  jest.resetModules();

  const loggerMock = jest.fn();
  const fetchMock = options.fetchThrows
    ? jest.fn(async () => {
        throw new Error('fetch failed');
      })
    : jest.fn(async () => ({ result: { data: { mdnsInterface: options.mdnsInterface } } }));

  const worker = {
    logger: loggerMock,
    log: { debug: jest.fn() },
    server: { fetch: fetchMock },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  jest.unstable_mockModule('./workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  const networkInterfacesMock = jest.fn(() => options.networkInterfaces);
  jest.unstable_mockModule('node:os', () => ({
    default: {
      networkInterfaces: networkInterfacesMock,
    },
  }));

  const inspectError = jest.fn(() => 'inspected error');
  jest.unstable_mockModule('@matterbridge/utils/error', () => ({ inspectError }));

  const excludedInterfaceNamePattern =
    /(tailscale|wireguard|openvpn|zerotier|hamachi|\bwg\d+\b|\btun\d+\b|\btap\d+\b|\butun\d+\b|docker|podman|\bveth[a-z0-9]*\b|\bbr-[a-z0-9]+\b|cni|kube|flannel|calico|virbr\d*\b|vmware|vmnet\d*\b|virtualbox|vboxnet\d*\b|teredo|isatap)/i;
  jest.unstable_mockModule('@matterbridge/utils/network', () => ({ excludedInterfaceNamePattern }));

  const restoreNodeVersion = setProcessNodeVersion(options.nodeVersion);
  const restoreNvm = setNvmEnv(options);

  try {
    await import('./workerSystemCheck.js');
    const success = await runPromise;
    return { wrapperName, success, loggerMock, fetchMock, inspectError, networkInterfacesMock };
  } finally {
    restoreNvm();
    restoreNodeVersion();
  }
}

describe('workerSystemCheck', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: covers node 20 branch, NVM warning, excluded interface warn, interface scan', async () => {
    const { wrapperName, success, loggerMock, fetchMock } = await runWorkerSystemCheck({
      nvmBin: true,
      nvmDir: true,
      nodeVersion: '20.18.0',
      mdnsInterface: '',
      networkInterfaces: {
        docker0: [{ family: 'IPv4', internal: false } as any],
        eth0: [{ family: 'IPv4', internal: true } as any, { family: 'IPv4', internal: false } as any, { family: 'IPv6', internal: false } as any],
      } as any,
    });

    expect(wrapperName).toBe('SystemCheck');
    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 1000);

    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting system check/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/NVM is a development tool/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/Node\.js version < 20\.19\.0 is not supported/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, expect.stringMatching(/Found network interface 'docker0'/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('fetch failure: logs inspected error and returns success false', async () => {
    const { success, loggerMock, inspectError } = await runWorkerSystemCheck({
      nodeVersion: '24.13.0',
      mdnsInterface: '',
      networkInterfaces: {} as any,
      fetchThrows: true,
    });

    expect(success).toBe(false);
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to perform system check', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });

  test('node 22.12: logs unsupported 22.x and missing-interface errors (still succeeds)', async () => {
    const { success, loggerMock } = await runWorkerSystemCheck({
      nodeVersion: '22.12.0',
      mdnsInterface: '',
      networkInterfaces: {} as any,
    });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/Node\.js version < 22\.13\.0 is not supported/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/Please consider upgrading to Node\.js LTS version/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/No internal network interface found/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/No external network interface found/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/No IPv4 network interface found/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/No IPv6 network interface found/));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('odd major version + mdnsInterface provided: does not warn about excluded interface name', async () => {
    const { success, loggerMock } = await runWorkerSystemCheck({
      nodeVersion: '21.0.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        docker0: [{ family: 'IPv4', internal: false } as any],
      } as any,
    });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/odd major versions are not supported/));
    expect(loggerMock).not.toHaveBeenCalledWith(LogLevel.WARN, expect.stringMatching(/Found network interface 'docker0'/));
  });

  test('node 24: does not emit NOTICE upgrade suggestion', async () => {
    const { success, loggerMock } = await runWorkerSystemCheck({
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        eth0: [{ family: 'IPv4', internal: true } as any, { family: 'IPv4', internal: false } as any, { family: 'IPv6', internal: false } as any],
      } as any,
    });

    expect(success).toBe(true);
    const noticeCalls = (loggerMock as jest.Mock).mock.calls.filter((c) => c[0] === LogLevel.NOTICE);
    expect(noticeCalls).toHaveLength(0);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'System check succeeded');
  });

  test('multiple external IPv4/IPv6 entries cover repeat-detection branches', async () => {
    const { success } = await runWorkerSystemCheck({
      nodeVersion: '24.13.0',
      mdnsInterface: 'eth0',
      networkInterfaces: {
        eth0: [
          { family: 'IPv4', internal: true } as any,
          { family: 'IPv4', internal: false } as any,
          { family: 'IPv4', internal: false } as any,
          { family: 'IPv6', internal: false } as any,
          { family: 'IPv6', internal: false } as any,
        ],
      } as any,
    });

    expect(success).toBe(true);
  });

  test('handles interfaces with undefined details', async () => {
    const { success, loggerMock } = await runWorkerSystemCheck({
      nodeVersion: '24.13.0',
      mdnsInterface: '',
      networkInterfaces: {
        wlan0: undefined as any,
      } as any,
    });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/No internal network interface found/));
  });
});
