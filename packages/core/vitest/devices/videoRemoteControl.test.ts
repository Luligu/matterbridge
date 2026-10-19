/**
 * @file packages/core/vitest/devices/videoRemoteControl.test.ts
 * @description This file contains the tests for the VideoRemoteControl device.
 * @author Luca Liguori
 */

const NAME = 'VideoRemoteControl';
const MATTER_PORT = 8028;
const MATTER_CREATE_ONLY = true;

// @matter
import { KeypadInputClient } from '@matter/node/behaviors/keypad-input';
import { MediaPlaybackClient } from '@matter/node/behaviors/media-playback';
import { OnOffClient } from '@matter/node/behaviors/on-off';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { VideoRemoteControl } from '../../src/devices/videoRemoteControl.js';
import { videoRemoteControl } from '../../src/matterbridgeDeviceTypes.js';
import type { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, videoRemoteControl.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a video remote control device', () => {
    device = new VideoRemoteControl('VideoRemoteControl Test Device', 'VRC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('VideoRemoteControlTestDevice-VRC123456');

    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    // Defaults to powerSourceType 'Battery'.
    expect(device.getClusterServerOptions(PowerSource.id)).toHaveProperty('batChargeLevel');

    const clientList = (device.getClusterServerOptions(MatterbridgeBindingServer) as { clientList?: number[] } | undefined)?.clientList;
    expect(clientList).toContain(OnOff.id);
    expect(clientList).toContain(MediaPlayback.id);
    expect(clientList).toContain(KeypadInput.id);

    // createDefaultMediaBindingClusterServer populates endpoint.type.clientClusters directly, since these
    // client behaviors have no entry in matterbridgeEndpointHelpers.ts's generic lookup table.
    expect(device.type.clientClusters['onOff']).toBe(OnOffClient);
    expect(device.type.clientClusters['mediaPlayback']).toBe(MediaPlaybackClient);
    expect(device.type.clientClusters['keypadInput']).toBe(KeypadInputClient);
  });

  test('create a video remote control device with powerSourceType None', () => {
    const noneDevice = new VideoRemoteControl('VideoRemoteControl None Device', 'VRC000001', { powerSourceType: 'None' });
    expect(noneDevice.hasClusterServer(PowerSource.id)).toBeFalsy();
  });

  test('add a video remote control device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'descriptor(0x1d).clientList(0x2)=[ 6, 1286, 1289 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 42, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 30, 47 ]',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).activeBatFaults(0x12)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 11, 12, 14, 15, 16, 18, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).batChargeLevel(0xe)=0',
        'powerSource(0x2f).batPercentRemaining(0xc)=200',
        'powerSource(0x2f).batReplaceability(0x10)=0',
        'powerSource(0x2f).batReplacementNeeded(0xf)=false',
        'powerSource(0x2f).batVoltage(0xb)=1500',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='Primary battery'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: false, battery: true, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
      ].toSorted(),
    );
  });

  test('remove the video remote control device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
