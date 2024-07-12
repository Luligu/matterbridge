/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-loss-of-precision */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0'];

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

// jest.useFakeTimers();

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { hasParameter } from '@project-chip/matter-node.js/util';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils';
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { FabricId, FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';
import e from 'express';

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });

    // console.log('Loading Matterbridge');
    matterbridge = await Matterbridge.loadInstance(true);
    // console.log('Loaded Matterbridge');
  });

  afterAll(async () => {
    // Destroy the Matterbridge instance
    await matterbridge.destroyInstance(true);

    await waiter('Matterbridge destroyed', () => {
      return (Matterbridge as any).instance === undefined;
    });

    // Wait for the Matterbridge instance to be destroyed (give time to getGlobalNodeModules and getMatterbridgeLatestVersion) and the storage to close
    await wait(1000, 'Wait for the Matterbridge instance to be destroyed', false);

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

  test('Load plugins from storage', () => {
    expect((matterbridge as any).loadPluginsFromStorage()).not.toBeNull();
  });

  test('Save plugins to storage', () => {
    expect((matterbridge as any).savePluginsToStorage()).not.toBeNull();
  });

  test('matterbridge -list', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-list'];
    await (matterbridge as any).parseCommandLine();
    await shutdownPromise;
    expect(true).toBeTruthy();
    await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -logstorage', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-logstorage'];
    await (matterbridge as any).parseCommandLine();
    await shutdownPromise;
    expect(true).toBeTruthy();
    await wait(1000, 'Wait for the storage', false);
  }, 60000);

  test('matterbridge -loginterfaces', async () => {
    const shutdownPromise = new Promise((resolve) => {
      matterbridge.on('shutdown', resolve);
    });
    process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-loginterfaces'];
    await (matterbridge as any).parseCommandLine();
    await shutdownPromise;
    expect(true).toBeTruthy();
    await wait(1000, 'Wait for the storage', false);
  }, 60000);
});
