/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { Matterbridge } from './matterbridge.js';
import { deepEqual, deepCopy, waiter } from './utils';

import { promises as fs } from 'fs';
import path from 'path';
import { FabricId, FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';

describe('Matterbridge test', () => {
  let matterbridge: Matterbridge;
  beforeAll(async () => {
    matterbridge = await Matterbridge.loadInstance(true);
  });

  afterAll(async () => {
    await matterbridge.destroyInstance();
    await waiter(
      'Matterbridge destroyed',
      () => {
        return (Matterbridge as any).instance === undefined;
      },
      false,
      20000,
    );
  }, 35000);

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
    expect(matterbridge.sanitizeFabricInformation(fabricInfos).length).toBe(2);
    expect(JSON.stringify(matterbridge.sanitizeFabricInformation(fabricInfos)).length).toBe(367);
  });
});
