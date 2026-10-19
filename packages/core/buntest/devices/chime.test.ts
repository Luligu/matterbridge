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
  addDevice,
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

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(ChimeCluster, 'installedChimeSounds')).toEqual([{ chimeId: 0, name: 'Default Chime' }]);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(0);
    expect(device.getAttribute(ChimeCluster, 'enabled')).toBe(true);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new Chime('Chime Snapshot', 'CHIME-SNAPSHOT');
    expect(await addDevice(aggregator, defaultDevice, 0, 0, 0, 0)).toBeTruthy();
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 326, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 47, 1366 ]',
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

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.AudibleBeep);
  });

  it('should create a chime device with a rechargeable power source', async () => {
    const device = new Chime('Chime Rechargeable', 'CHIME-RECHARGEABLE', { powerSourceType: 'Rechargeable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a chime device with a replaceable power source', async () => {
    const device = new Chime('Chime Replaceable', 'CHIME-REPLACEABLE', { powerSourceType: 'Replaceable' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batReplacementDescription')).toBe('Battery type');
  });

  it('should create a chime device with a battery power source', async () => {
    const device = new Chime('Chime Battery', 'CHIME-BATTERY', { powerSourceType: 'Battery' });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
  });

  it('should create a chime device with no power source', async () => {
    const device = new Chime('Chime None', 'CHIME-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
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

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(ChimeCluster, 'installedChimeSounds')).toEqual([
      { chimeId: 0, name: 'Default Chime' },
      { chimeId: 1, name: 'Chime 1' },
    ]);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(1);
    expect(device.getAttribute(ChimeCluster, 'enabled')).toBe(false);
  });
});
