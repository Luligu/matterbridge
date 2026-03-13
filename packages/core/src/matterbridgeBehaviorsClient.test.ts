// src\matterbridgeBehaviorsClient.test.ts

const NAME = 'MatterbridgeBehaviorsClient';
const MATTER_PORT = 11400;
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { Logger } from '@matter/general';
import { EndpointNumber, NodeId } from '@matter/main/types';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';

import {
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { MatterbridgeIdentifyServer, MatterbridgeOnOffServer } from './matterbridgeBehaviorsServer.js';
import { MatterbridgeBindingServer } from './matterbridgeBehaviorsClient.js';
import { onOffSwitch } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME, MATTER_CREATE_ONLY);
    await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment(undefined, undefined, !MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Device type: onOffSwitch', async () => {
    device = new MatterbridgeEndpoint(onOffSwitch, { id: 'onOffSwitch' });
    expect(device).toBeDefined();
    device.behaviors.require(MatterbridgeBindingServer, {
      clientList: [Identify.Cluster.id, OnOff.Cluster.id],
    });
    device.behaviors.require(MatterbridgeIdentifyServer, {
      identifyTime: 5,
      identifyType: Identify.IdentifyType.AudibleBeep,
    });
    device.behaviors.require(MatterbridgeOnOffServer, {
      onOff: false,
    });
    expect(await aggregator.add(device)).toBeDefined();
    await device.construction.ready;
    Logger.get('client').notice(`Device clientList: ${device.stateOf(DescriptorServer).clientList.join(', ')}`);
    Logger.get('client').notice('Device behaviors:', device.behaviors);
    expect(device.behaviors.has('binding')).toBe(true);
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBe(true);
    expect(device.behaviors.has('identify')).toBe(true);
    expect(device.behaviors.has(MatterbridgeIdentifyServer)).toBe(true);
    expect(device.behaviors.has('onOff')).toBe(true);
    expect(device.behaviors.has(MatterbridgeOnOffServer)).toBe(true);
    expect(device.behaviors.supported['binding']).toBeDefined();
    expect(device.behaviors.supported['identify']).toBeDefined();
    expect(device.behaviors.supported['onOff']).toBeDefined();
    expect(device.stateOf(MatterbridgeIdentifyServer).identifyTime).toBe(5);
    await device.setStateOf(MatterbridgeBindingServer, { binding: [{ node: NodeId(1), endpoint: EndpointNumber(1) }] });

    Logger.get('client').notice('Device behaviors:\n', device);
  });
});
