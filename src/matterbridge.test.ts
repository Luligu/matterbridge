/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-loss-of-precision */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-debug'];

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

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { hasParameter } from '@project-chip/matter-node.js/util';
import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils';
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { FabricId, FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
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
  });

  test('hasParameter("debug") should return true', async () => {
    expect(hasParameter('debug')).toBeTruthy();
  });

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
