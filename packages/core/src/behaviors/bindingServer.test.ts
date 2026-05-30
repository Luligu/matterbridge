// src\behaviors\bindingServer.test.ts

const NAME = 'BindingServer';
const MATTER_PORT = 11400;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { Logger } from '@matter/general';
import { BindingResolution } from '@matter/node/behaviors/binding';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { EndpointNumber, NodeId } from '@matter/types';
import { Binding } from '@matter/types/clusters/binding';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';

import {
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  matterbridge,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from '../jestutils/jestMatterbridgeTest.js';
import { setupTest } from '../jestutils/jestSetupTest.js';
import { onOffSwitch } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeBindingServer } from './bindingServer.js';
import { MatterbridgeIdentifyServer } from './identifyServer.js';
import { MatterbridgeOnOffServer } from './onOffServer.js';

// Setup the test environment
await setupTest(NAME, true);

describe('Client clusters and behaviors', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment();
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
    device.addRequiredClusterServers();
    expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
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
    expect(device.stateOf(DescriptorServer).clientList).toContain(Identify.Cluster.id);
    expect(device.stateOf(DescriptorServer).clientList).toContain(OnOff.Cluster.id);
    await device.setStateOf(MatterbridgeBindingServer, { binding: [{ node: NodeId(1), endpoint: EndpointNumber(1) }] });

    Logger.get('client').notice('Device behaviors:\n', device);
  });

  test('MatterbridgeBindingServer established event - server kind does not call node.set', async () => {
    const mockNodeSet = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const resolution: BindingResolution = {
      kind: 'server',
      entry: { node: NodeId(1), endpoint: EndpointNumber(1) } as Binding.Target,
      node: { set: mockNodeSet } as any,
      endpoint: device as any,
    };

    await device.eventsOf(MatterbridgeBindingServer).established.emit(resolution);
    expect(mockNodeSet).not.toHaveBeenCalled();
    await device.act((agent) => {
      expect((agent.get(MatterbridgeBindingServer) as any).internal.boundEndpoints.has(resolution.entry)).toBe(true);
    });
  });

  test('MatterbridgeBindingServer established event - client kind calls node.set with autoSubscribe', async () => {
    const mockNodeSet = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const resolution: BindingResolution = {
      kind: 'client',
      entry: { node: NodeId(2), endpoint: EndpointNumber(2) } as Binding.Target,
      node: { set: mockNodeSet } as any,
      endpoint: device as any,
    };

    await device.eventsOf(MatterbridgeBindingServer).established.emit(resolution);
    expect(mockNodeSet).toHaveBeenCalledWith({ network: { autoSubscribe: true } });
    await device.act((agent) => {
      expect((agent.get(MatterbridgeBindingServer) as any).internal.boundEndpoints.has(resolution.entry)).toBe(true);
    });
  });

  test('MatterbridgeBindingServer removed event - deletes entry from boundEndpoints', async () => {
    const resolution: BindingResolution = {
      kind: 'server',
      entry: { node: NodeId(3), endpoint: EndpointNumber(3) } as Binding.Target,
      node: {} as any,
      endpoint: device as any,
    };

    await device.eventsOf(MatterbridgeBindingServer).established.emit(resolution);
    await device.act((agent) => {
      expect((agent.get(MatterbridgeBindingServer) as any).internal.boundEndpoints.has(resolution.entry)).toBe(true);
    });
    await device.eventsOf(MatterbridgeBindingServer).removed.emit(resolution);
    await device.act((agent) => {
      expect((agent.get(MatterbridgeBindingServer) as any).internal.boundEndpoints.has(resolution.entry)).toBe(false);
    });
  });

  test('MatterbridgeBindingServer getEndpoint - returns endpoint by clusterId or undefined', async () => {
    const resolution: BindingResolution = {
      kind: 'server',
      entry: { node: NodeId(4), endpoint: EndpointNumber(4), cluster: OnOff.id } as Binding.Target,
      node: {} as any,
      endpoint: device as any,
    };

    await device.eventsOf(MatterbridgeBindingServer).established.emit(resolution);
    await device.act((agent) => {
      const binding = agent.get(MatterbridgeBindingServer) as MatterbridgeBindingServer;
      expect(binding.getEndpoint(OnOff.id)).toBe(device);
      expect(binding.getEndpoint(Identify.id)).toBeUndefined();
    });
  });
});
