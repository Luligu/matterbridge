/**
 * @file packages/core/buntest/devices/chime.test.ts
 * @description This file contains the tests for the Chime device.
 * @author Luca Liguori
 */

const NAME = 'ChimeDevice';
const MATTER_PORT = 6001;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { Chime as ChimeCluster } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import {
  addBridgedDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { stringify } from 'node-ansi-logger';

import { Chime } from '../../src/devices/chime.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Chime', () => {
  let defaultDevice: Chime;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT, undefined, 0, 0, 0);

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
    if (MATTER_CREATE_ONLY) await flushServerNode(0, 0, 0, 0);
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should create a chime device with default options', async () => {
    const device = new Chime('Chime Default', 'CHIME-DEFAULT');
    expect(device.id).toBe('ChimeDefault-CHIME-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(ChimeCluster.id)).toBeTruthy();

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(ChimeCluster, 'installedChimeSounds')).toEqual([{ chimeId: 0, name: 'Default Chime' }]);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(0);
    expect(device.getAttribute(ChimeCluster, 'enabled')).toBe(true);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new Chime('Chime Snapshot', 'CHIME-SNAPSHOT');
    expect(await addBridgedDevice(aggregator, defaultDevice, 0, 0, 0, 0)).toBeTruthy();
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
        'bridgedDeviceBasicInformation(0x39).acceptedCommandList(0xfff9)=[  ]',
        'bridgedDeviceBasicInformation(0x39).attributeList(0xfffb)=[ 1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 14, 15, 17, 18, 24, 65528, 65529, 65531, 65532, 65533 ]',
        'bridgedDeviceBasicInformation(0x39).clusterRevision(0xfffd)=6',
        'bridgedDeviceBasicInformation(0x39).configurationVersion(0x18)=1',
        'bridgedDeviceBasicInformation(0x39).featureMap(0xfffc)={ bridgedIcdSupport: false }',
        'bridgedDeviceBasicInformation(0x39).generatedCommandList(0xfff8)=[  ]',
        'bridgedDeviceBasicInformation(0x39).hardwareVersion(0x7)=1',
        "bridgedDeviceBasicInformation(0x39).hardwareVersionString(0x8)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).nodeLabel(0x5)='Chime Snapshot'",
        'bridgedDeviceBasicInformation(0x39).productId(0x4)=32768',
        "bridgedDeviceBasicInformation(0x39).productLabel(0xe)='Matter Endpoint'",
        "bridgedDeviceBasicInformation(0x39).productName(0x3)='Matterbridge Chime'",
        "bridgedDeviceBasicInformation(0x39).productUrl(0xd)='https://matterbridge.io'",
        'bridgedDeviceBasicInformation(0x39).reachable(0x11)=true',
        "bridgedDeviceBasicInformation(0x39).serialNumber(0xf)='CHIME-SNAPSHOT'",
        'bridgedDeviceBasicInformation(0x39).softwareVersion(0x9)=1',
        "bridgedDeviceBasicInformation(0x39).softwareVersionString(0xa)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).uniqueId(0x12)='55b78b6e547d3bea4824513181cca38f'",
        'bridgedDeviceBasicInformation(0x39).vendorId(0x2)=65521',
        "bridgedDeviceBasicInformation(0x39).vendorName(0x1)='Matterbridge'",
        'chime(0x556).acceptedCommandList(0xfff9)=[ 0 ]',
        'chime(0x556).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'chime(0x556).clusterRevision(0xfffd)=2',
        'chime(0x556).enabled(0x2)=true',
        'chime(0x556).featureMap(0xfffc)={  }',
        'chime(0x556).generatedCommandList(0xfff8)=[  ]',
        "chime(0x556).installedChimeSounds(0x0)=[ { chimeId: 0, name: 'Default Chime' } ]",
        'chime(0x556).selectedChime(0x1)=0',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 326, revision: 2 }, { deviceType: 17, revision: 1 }, { deviceType: 19, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 47, 57, 1366 ]',
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
      ].toSorted(),
    );
  });

  it('should create a chime device with identify enabled', async () => {
    const device = new Chime('Chime Identify', 'CHIME-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.AudibleBeep });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.AudibleBeep);
  });

  it('should create a chime device with a rechargeable power source', async () => {
    const device = new Chime('Chime Rechargeable', 'CHIME-RECHARGEABLE', { powerSourceType: 'Rechargeable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a chime device with a replaceable power source', async () => {
    const device = new Chime('Chime Replaceable', 'CHIME-REPLACEABLE', { powerSourceType: 'Replaceable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a chime device with a battery power source', async () => {
    const device = new Chime('Chime Battery', 'CHIME-BATTERY', { powerSourceType: 'Battery' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a chime device with no power source', async () => {
    const device = new Chime('Chime None', 'CHIME-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create a chime device with custom chime sounds', async () => {
    const device = new Chime('Chime Custom', 'CHIME-CUSTOM', {
      installedChimeSounds: [
        { chimeId: 0, name: 'Default Chime' },
        { chimeId: 1, name: 'Chime 1' },
      ],
      selectedChime: 1,
      enabled: false,
    });

    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(ChimeCluster, 'installedChimeSounds')).toEqual([
      { chimeId: 0, name: 'Default Chime' },
      { chimeId: 1, name: 'Chime 1' },
    ]);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(1);
    expect(device.getAttribute(ChimeCluster, 'enabled')).toBe(false);
  });
});
