/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-loss-of-precision */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest'];

interface SessionInformation {
  name: string;
  nodeId: NodeId;
  peerNodeId: NodeId;
  fabric?: ExposedFabricInformation;
  isPeerActive: boolean;
  secure: boolean;
  lastInteractionTimestamp?: number;
  lastActiveTimestamp?: number;
  numberOfActiveSubscriptions: number;
}

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, LogLevel, nf } from 'node-ansi-logger';
import { hasParameter } from '@project-chip/matter-node.js/util';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils';
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { FabricId, FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';
import e from 'express';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('Matterbridge loadInstance() and cleanup()', () => {
  let matterbridge: Matterbridge;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
  });

  afterAll(async () => {
    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('Matterbridge.loadInstance(false)', async () => {
    console.log('Loading Matterbridge.loadInstance(false)');
    matterbridge = await Matterbridge.loadInstance(false);
    console.log('Loaded Matterbridge.loadInstance(false)');

    expect(matterbridge).toBeDefined();
    expect(matterbridge.initialized).toBeFalsy();
    expect((matterbridge as any).log).toBeUndefined();
    expect((matterbridge as any).homeDirectory).toBe('');
    expect((matterbridge as any).matterbridgeDirectory).toBe('');
    expect((matterbridge as any).nodeStorage).toBeUndefined();
    expect((matterbridge as any).nodeContext).toBeUndefined();
    expect((matterbridge as any).registeredPlugins).toHaveLength(0);
    expect((matterbridge as any).registeredDevices).toHaveLength(0);
    expect((matterbridge as any).globalModulesDirectory).toBe('');
    expect((matterbridge as any).matterbridgeLatestVersion).toBe('');

    // Destroy the Matterbridge instance
    console.log('Destroying Matterbridge.loadInstance(false)');
    matterbridge.globalModulesDirectory = 'xxx';
    matterbridge.matterbridgeLatestVersion = 'xxx';
    await matterbridge.destroyInstance();
    console.log('Destroyed Matterbridge.loadInstance(false)');
  });
});

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });

    console.log('Loading Matterbridge.loadInstance(true)');
    matterbridge = await Matterbridge.loadInstance(true);
    if (!matterbridge.initialized) await matterbridge.initialize();
    console.log('Loaded Matterbridge.loadInstance(true)');
  });

  afterAll(async () => {
    // Destroy the Matterbridge instance
    console.log('Destroying Matterbridge.loadInstance(true)');
    await matterbridge.destroyInstance();
    console.log('Destroyed Matterbridge.loadInstance(true)');

    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('should do a partial mock of AnsiLogger', () => {
    const log = new AnsiLogger({ logName: 'Mocked log' });
    expect(log).toBeDefined();
    log.log(LogLevel.INFO, 'Hello, world!');
    log.setLogDebug(true);
    expect(log.log).toBeDefined();
    expect(log.log).toHaveBeenCalled();
    expect(log.log).toHaveBeenLastCalledWith(LogLevel.INFO, 'Hello, world!');
  });

  test('hasParameter("debug") should return true', async () => {
    expect(hasParameter('debug')).toBeFalsy();
  });

  test('Sanitize fabrics', () => {
    const fabricInfos: ExposedFabricInformation[] = [
      {
        fabricIndex: FabricIndex(1),
        fabricId: FabricId(45653242346465555556n),
        nodeId: NodeId(556546442432656555556n),
        rootNodeId: NodeId(5565442324264656555556n),
        rootVendorId: VendorId(4996),
        label: 'Fabric 1 label',
      },
      {
        fabricIndex: FabricIndex(2),
        fabricId: FabricId(45654621214656555556n),
        nodeId: NodeId(556546462112156555556n),
        rootNodeId: NodeId(556546412212656555556n),
        rootVendorId: VendorId(4937),
        label: 'Fabric 2 label',
      },
    ];
    expect((matterbridge as any).sanitizeFabricInformations(fabricInfos).length).toBe(2);
    expect(() => {
      JSON.stringify(fabricInfos);
    }).toThrow();
    expect(JSON.stringify((matterbridge as any).sanitizeFabricInformations(fabricInfos)).length).toBe(402);
  });

  test('Sanitize sessions', () => {
    const sessionInfos: SessionInformation[] = [
      {
        name: 'secure/64351',
        nodeId: NodeId(16784206195868397986n),
        peerNodeId: NodeId(1604858123872676291n),
        fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
        isPeerActive: false,
        secure: true,
        lastInteractionTimestamp: 1720035723121269019,
        lastActiveTimestamp: 1720035761223121934,
        numberOfActiveSubscriptions: 0,
      },
    ];
    expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(1);
    expect(() => {
      JSON.stringify(sessionInfos);
    }).toThrow();
    expect(JSON.stringify((matterbridge as any).sanitizeSessionInformation(sessionInfos)).length).toBe(471);
  });

  test('Load plugins from storage', async () => {
    expect(await (matterbridge as any).loadPluginsFromStorage()).toHaveLength(0);
    // await wait(1000, 'Wait for the storage', false);
  });

  test('Save plugins to storage', async () => {
    expect(await (matterbridge as any).savePluginsToStorage()).toHaveLength(0);
    // await wait(1000, 'Wait for the storage', false);
  });

  test('matterbridge -list', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-list'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered plugins (0)`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `│ Registered devices (0)`);
    await shutdownPromise;
    // await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -logstorage', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-logstorage'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} storage log`);
    await shutdownPromise;
    // await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -loginterfaces', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-loginterfaces'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `${plg}Matterbridge${nf} network interfaces log`);
    await shutdownPromise;
    // await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -reset', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-reset'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, 'Reset done! Remove the device from the controller.');
    await shutdownPromise;
    // await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -reset xxx', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-reset', 'xxx'];
    (matterbridge as any).log.setLogDebug(true);
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, 'Reset plugin xxx');
    (matterbridge as any).log.setLogDebug(false);
    await shutdownPromise;
    // await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -factoryreset', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-factoryreset'];
    await (matterbridge as any).parseCommandLine();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired devices from the controllers.');
    await shutdownPromise;
    // await wait(1000, 'Wait for the storage', false);
  }, 60000);
});
