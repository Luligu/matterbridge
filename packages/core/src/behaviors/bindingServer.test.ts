// src\behaviors\bindingServer.test.ts

const NAME = 'BindingServer';
const MATTER_PORT = 11400;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { Logger } from '@matter/general';
import { EndpointNumber, NodeId } from '@matter/main/types';
import { Endpoint, ServerNode } from '@matter/node';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';

import { createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, startMatterbridgeEnvironment, stopMatterbridgeEnvironment } from '../jestutils/jestMatterbridgeTest.js';
import { setupTest } from '../jestutils/jestSetupTest.js';
import { onOffSwitch } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeBindingServer } from './bindingServer.js';
import { MatterbridgeIdentifyServer } from './identifyServer.js';
import { MatterbridgeOnOffServer } from './onOffServer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Client clusters and behaviors', () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment();
    [server, aggregator] = await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment();
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
