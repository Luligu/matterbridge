/* eslint-disable @typescript-eslint/no-loss-of-precision */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { Matterbridge } from './matterbridge.js';
import { deepEqual, deepCopy, waiter } from './utils';

import { promises as fs } from 'fs';
import path from 'path';
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

describe('Matterbridge test', () => {
  let matterbridge: Matterbridge;
  console.log('Matterbridge test', process.argv);

  beforeAll(async () => {
    console.log('Loading Matterbridge');
    process.argv = ['matterbridge', '-debug', '-frontend', '0'];
    matterbridge = await Matterbridge.loadInstance(true);
  });

  afterAll(async () => {
    console.log('Destroying Matterbridge');
    await matterbridge.destroyInstance();
    await waiter(
      'Matterbridge destroyed',
      () => {
        return (Matterbridge as any).instance === undefined;
      },
      false,
      20000,
    );
    await waiter('Matterbridge destroyed', () => {
      return false;
    });
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
    expect(matterbridge.sanitizeFabricInformations(fabricInfos).length).toBe(2);
    expect(JSON.stringify(matterbridge.sanitizeFabricInformations(fabricInfos)).length).toBe(367);
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
    expect(matterbridge.sanitizeSessionInformation(sessionInfos).length).toBe(1);
    expect(JSON.stringify(matterbridge.sanitizeSessionInformation(sessionInfos)).length).toBe(443);
  });
});
