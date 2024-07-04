/* eslint-disable jest/no-commented-out-tests */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-loss-of-precision */
/* eslint-disable @typescript-eslint/no-explicit-any */

// process.argv = ['node', 'matterbridge', '-debug', '-frontend', '0'];

import { jest } from '@jest/globals';

// Mock the node-ansi-logger module
jest.unstable_mockModule('node-ansi-logger', async () => {
  const originalModule = await import('node-ansi-logger');

  class AnsiLogger {
    log = jest.fn((level: string, message: string, ...parameters: any[]) => {
      // Optional: Implement mock behavior if needed, e.g., console.log for debugging
      console.log(`Mock log: ${level} - ${message}`, ...parameters);
    });
  }

  return {
    __esModule: true,
    ...originalModule,
    AnsiLogger,
  };
});

import { AnsiLogger } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils';

import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { FabricId, FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';

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

/*
describe('Matterbridge logging', () => {
  beforeAll(async () => {
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {
      //
    });
  });

  afterAll(async () => {
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  });

  it('should log the correct message when calling a specific function', async () => {
    const matterbridge = await Matterbridge.loadInstance(true);
    expect(AnsiLogger.prototype.log).toHaveBeenCalledTimes(1);
    matterbridge.destroyInstance();
  });
});
*/

describe('Matterbridge test', () => {
  let matterbridge: Matterbridge;
  // console.log('Matterbridge test', process.argv);

  beforeAll(async () => {
    // Mock the log function
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      console.log(`Mock log: ${level} - ${message}`, ...parameters);
    });

    // console.log('Loading Matterbridge');
    matterbridge = await Matterbridge.loadInstance(true);
  });

  afterAll(async () => {
    // console.log('Destroying Matterbridge');
    await matterbridge.destroyInstance();
    await waiter(
      'Matterbridge destroyed',
      () => {
        return (Matterbridge as any).instance === undefined;
      },
      false,
      20000,
    );
    await waiter(
      'Matterbridge destroyed',
      () => {
        return false;
      },
      false,
      20000,
    );
    // Restore the mock
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('Sanitize fabrics', () => {
    const fabricInfos: ExposedFabricInformation[] = [
      {
        fabricIndex: FabricIndex(1),
        fabricId: FabricId(456532423464656),
        nodeId: NodeId(556546442432656),
        rootNodeId: NodeId(5565442324264656),
        rootVendorId: VendorId(4996),
        label: 'Fabric 1 label',
      },
      {
        fabricIndex: FabricIndex(2),
        fabricId: FabricId(45654621214656),
        nodeId: NodeId(556546462112156),
        rootNodeId: NodeId(556546412212656),
        rootVendorId: VendorId(4937),
        label: 'Fabric 2 label',
      },
    ];
    expect((matterbridge as any).sanitizeFabricInformations(fabricInfos).length).toBe(2);
    expect(JSON.stringify((matterbridge as any).sanitizeFabricInformations(fabricInfos)).length).toBe(367);
  });

  test('Sanitize sessions', () => {
    const sessionInfos: SessionInformation[] = [
      {
        name: 'secure/64351',
        nodeId: NodeId(16784206195868397986),
        peerNodeId: NodeId(1604858123872676291),
        fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(45654621214656), nodeId: NodeId(16784206195868397986), rootNodeId: NodeId(18446744060824649729), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
        isPeerActive: false,
        secure: true,
        lastInteractionTimestamp: 1720035769019,
        lastActiveTimestamp: 1720035761934,
        numberOfActiveSubscriptions: 0,
      },
    ];
    expect((matterbridge as any).sanitizeSessionInformation(sessionInfos).length).toBe(1);
    expect(JSON.stringify((matterbridge as any).sanitizeSessionInformation(sessionInfos)).length).toBe(443);
  });
});
