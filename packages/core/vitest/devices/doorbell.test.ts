/**
 * @file packages/core/vitest/devices/doorbell.test.ts
 * @description This file contains the tests for the Doorbell device.
 * @author Luca Liguori
 */

const NAME = 'DoorbellDevice';
const MATTER_PORT = 6006;
const MATTER_CREATE_ONLY = true;

import { ChimeClient } from '@matter/node/behaviors/chime';
import { Chime } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Switch } from '@matter/types/clusters/switch';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { Doorbell } from '../../src/devices/doorbell.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Doorbell', () => {
  let defaultDevice: Doorbell;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should create a doorbell device with default options', async () => {
    const device = new Doorbell('Doorbell Default', 'DOORBELL-DEFAULT');
    expect(device.id).toBe('DoorbellDefault-DOORBELL-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Switch.id)).toBeTruthy();

    // The required Chime client cluster is added automatically and should not trigger a "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([Chime.id]);
    expect(device.type.clientClusters['chime']).toBe(ChimeClient);

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Switch, 'numberOfPositions')).toBe(2);
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new Doorbell('Doorbell Snapshot', 'DOORBELL-SNAPSHOT');
    expect(await addDevice(aggregator, defaultDevice)).toBeTruthy();
  });

  it('should expose the expected attributes on the device', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    defaultDevice.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'binding(0x1e).acceptedCommandList(0xfff9)=[  ]',
        'binding(0x1e).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'binding(0x1e).binding(0x0)=[  ]',
        'binding(0x1e).clusterRevision(0xfffd)=1',
        'binding(0x1e).featureMap(0xfffc)={  }',
        'binding(0x1e).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1366 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 328, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 30, 47, 59 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 3 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'switch(0x3b).acceptedCommandList(0xfff9)=[  ]',
        'switch(0x3b).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'switch(0x3b).clusterRevision(0xfffd)=2',
        'switch(0x3b).currentPosition(0x1)=0',
        'switch(0x3b).featureMap(0xfffc)={ latchingSwitch: false, momentarySwitch: true, momentarySwitchRelease: false, momentarySwitchLongPress: false, momentarySwitchMultiPress: false, actionSwitch: false }',
        'switch(0x3b).generatedCommandList(0xfff8)=[  ]',
        'switch(0x3b).numberOfPositions(0x0)=2',
      ].toSorted(),
    );
  });

  it('should create a doorbell device with custom identify options', async () => {
    const device = new Doorbell('Doorbell Identify', 'DOORBELL-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it('should create a doorbell device with a rechargeable power source', async () => {
    const device = new Doorbell('Doorbell Rechargeable', 'DOORBELL-RECHARGEABLE', { powerSourceType: 'Rechargeable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a doorbell device with a replaceable power source', async () => {
    const device = new Doorbell('Doorbell Replaceable', 'DOORBELL-REPLACEABLE', { powerSourceType: 'Replaceable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a doorbell device with a battery power source', async () => {
    const device = new Doorbell('Doorbell Battery', 'DOORBELL-BATTERY', { powerSourceType: 'Battery' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a doorbell device with no power source', async () => {
    const device = new Doorbell('Doorbell None', 'DOORBELL-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should trigger a single press switch event', async () => {
    const device = new Doorbell('Doorbell Press', 'DOORBELL-PRESS', { powerSourceType: 'None' });
    expect(await addDevice(aggregator, device)).toBeTruthy();

    expect(await device.triggerSwitchEvent('Single', device.log)).toBeTruthy();
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
  });
});
