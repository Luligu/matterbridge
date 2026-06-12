// src\behaviors\bindingServer.test.ts

const NAME = 'BindingServer';
const MATTER_PORT = 11400;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { Logger } from '@matter/general';
import { type ClusterBehavior, Endpoint } from '@matter/main/node';
import { type BindingResolution } from '@matter/node/behaviors/binding';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { OccupancySensingClient, OccupancySensingServer } from '@matter/node/behaviors/occupancy-sensing';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import { OnOffPlugInUnitDevice } from '@matter/node/devices/on-off-plug-in-unit';
import { EndpointNumber, FabricIndex, NodeId } from '@matter/types';
import { type Binding } from '@matter/types/clusters/binding';
import { Identify } from '@matter/types/clusters/identify';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { OnOff } from '@matter/types/clusters/on-off';
import { debugStringify } from 'node-ansi-logger';

import { flushAsync } from '../jestutils/flushAsync.js';
import {
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  matterbridge,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from '../jestutils/jestMatterbridgeTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setDebug, setupTest } from '../jestutils/jestSetupTest.js';
import { BindingServer } from '../matter/behaviors.js';
import { getClusterNameById } from '../matter/types.js';
import { bridgedNode, occupancySensor, onOffLight, onOffLightSwitch, onOffPlugInUnit } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { lowercaseFirstLetter } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeBindingServer } from './bindingServer.js';
import { MatterbridgeIdentifyServer } from './identifyServer.js';
import { MatterbridgeOnOffServer } from './onOffServer.js';

// Setup the test environment
await setupTest(NAME, false);

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

  afterEach(async () => {
    // eslint-disable-next-line jest/no-standalone-expect
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    // eslint-disable-next-line jest/no-standalone-expect
    expect(loggerFatalSpy).not.toHaveBeenCalled();
    // Clear debug
    await setDebug(false);
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Device type: onOffSwitch', async () => {
    device = new MatterbridgeEndpoint(onOffLightSwitch, { id: 'onOffSwitch' });
    expect(device).toBeDefined();
    device.behaviors.require(MatterbridgeBindingServer, {
      clientList: [Identify.id, OnOff.id],
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
    expect(device.stateOf(DescriptorServer).clientList).toContain(Identify.id);
    expect(device.stateOf(DescriptorServer).clientList).toContain(OnOff.id);
    await device.setStateOf(MatterbridgeBindingServer, { binding: [{ node: NodeId(1), endpoint: EndpointNumber(1) }] });

    Logger.get('client').notice('Device behaviors:\n', device);
  });

  test('MatterbridgeBindingServer established event - server kind does not call node.set', async () => {
    const mockNodeSet = jest.fn<() => Promise<void>>().mockResolvedValue();
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
    const mockNodeSet = jest.fn<() => Promise<void>>().mockResolvedValue();
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
      const binding = agent.get(MatterbridgeBindingServer);
      expect(binding.getEndpoint(OnOff.id)).toBe(device);
      expect(binding.getEndpoint(Identify.id)).toBeUndefined();
    });
  });

  test('MatterbridgeBindingServer onSuccess: adds uncovered clientList IDs and logs active bindings', async () => {
    // Create an onOffLight endpoint and manually require the binding server with a clientList that
    // contains OccupancySensing, which is NOT in endpoint.type.clientClusters (no addClusterClients
    // was called). This forces toAddClientList to be non-empty, covering lines 60-61 (addClientClusters).
    // Providing an initial binding entry at construction time covers lines 65 (active binding log).
    const sw = new MatterbridgeEndpoint([onOffLight, bridgedNode], { id: 'BindingOnlyLight' });
    sw.behaviors.require(MatterbridgeBindingServer, {
      clientList: [OccupancySensing.id],
      binding: [{ node: NodeId(99), endpoint: EndpointNumber(99), cluster: OccupancySensing.id, fabricIndex: FabricIndex(1) }],
    });
    sw.createDefaultBridgedDeviceBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 'Light')
      .createDefaultIdentifyClusterServer()
      .createDefaultOnOffClusterServer(false)
      .addRequiredClusterServers();
    expect(await matterbridge.aggregatorNode?.add(sw)).toBeDefined();
    await sw.construction.ready;
    await flushAsync(); // Wait for onSuccess to be processed
    // OccupancySensing must have been appended to the Descriptor clientList
    expect(sw.getAttribute(DescriptorServer, 'clientList')).toContain(OccupancySensing.id);
    // Logs must include initialization with the clientList, adding client clusters, and active binding
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Initializing MatterbridgeBindingServer (endpoint ${sw.maybeId}.${sw.maybeNumber}) with clientList: ${OccupancySensing.id}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Adding client clusters to endpoint ${sw.maybeId}.${sw.maybeNumber}: ${OccupancySensing.id}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      `Active binding for endpoint ${sw.maybeId}.${sw.maybeNumber}: target ${debugStringify({
        node: NodeId(99),
        group: undefined,
        endpoint: EndpointNumber(99),
        cluster: OccupancySensing.id,
        fabricIndex: FabricIndex(1),
      })}`,
    );
  });

  test('server-kind binding: occupancy sensor bound to OnOff light', async () => {
    // Create the occupancy sensor (the binding target)
    const sensor = new MatterbridgeEndpoint(occupancySensor, { id: 'OccSensor' }).createDefaultIdentifyClusterServer().addRequiredClusterServers();
    expect(await matterbridge.aggregatorNode?.add(sensor)).toBeDefined();
    await sensor.construction.ready;

    // Create the OnOff light with OccupancySensing advertised as a client cluster
    const light = new MatterbridgeEndpoint(onOffLight, { id: 'OccLight' })
      .createDefaultBindingClusterServer([OccupancySensing.id])
      .createDefaultIdentifyClusterServer()
      .createDefaultOnOffClusterServer(false)
      .addRequiredClusterServers();
    expect(await matterbridge.aggregatorNode?.add(light)).toBeDefined();
    await light.construction.ready;

    // Descriptor of the light must advertise OccupancySensing as a client cluster
    expect(light.getAttribute(DescriptorServer, 'clientList')).toContain(OccupancySensing.id);
    // endpoint.type.clientClusters must be populated so BindingManager can validate this endpoint
    const clientClusters = light.type.clientClusters as Record<string, ClusterBehavior.Type> | undefined;
    if (!clientClusters) throw new Error('clientClusters is undefined');
    expect(Object.keys(clientClusters)).toHaveLength(1);
    expect(clientClusters[lowercaseFirstLetter(getClusterNameById(OccupancySensing.id))].cluster.id).toBe(OccupancySensing.id);

    // Simulate what BindingManager emits for a local (same-node) binding: kind 'server'
    if (!sensor.number) throw new Error('sensor endpoint number not assigned');
    if (!light.number) throw new Error('light endpoint number not assigned');
    const resolution: BindingResolution = {
      kind: 'server',
      entry: { node: NodeId(sensor.number), endpoint: EndpointNumber(sensor.number), cluster: OccupancySensing.id } as Binding.Target,
      node: {} as any,
      endpoint: sensor as any,
    };
    await light.eventsOf(MatterbridgeBindingServer).established.emit(resolution);

    // getEndpoint must return the sensor and no node.set must have been called
    await light.act((agent) => {
      const binding = agent.get(MatterbridgeBindingServer);
      expect(binding.getEndpoint(OccupancySensing.id)).toBe(sensor);
    });

    // Read the sensor occupancy state directly through the bound endpoint (no wire transport)
    await light.act((agent) => {
      const binding = agent.get(MatterbridgeBindingServer);
      const boundSensor = binding.getEndpoint(OccupancySensing.id);
      expect(boundSensor?.stateOf(OccupancySensingServer).occupancy.occupied).toBe(false);
    });

    // Subscribe to occupancy changes through the bound sensor and automate the light.
    // pendingUpdate tracks the setAttribute promise so the test can await it after each trigger.
    let pendingUpdate: Promise<boolean> = Promise.resolve(false);
    await light.act((agent) => {
      const binding = agent.get(MatterbridgeBindingServer);
      const boundSensor = binding.getEndpoint(OccupancySensing.id);
      if (!boundSensor) throw new Error('bound sensor not found');
      boundSensor.eventsOf(OccupancySensingServer).occupancy$Changed.on((newValue) => {
        pendingUpdate = light.setAttribute(OnOffServer, 'onOff', newValue.occupied ?? false);
      });
    });

    // Simulate occupied: true — light must turn on
    await sensor.setAttribute(OccupancySensingServer, 'occupancy', { occupied: true });
    await pendingUpdate;
    expect(light.getAttribute(OnOff.id, 'onOff')).toBe(true);

    // Simulate occupied: false — light must turn off
    await sensor.setAttribute(OccupancySensingServer, 'occupancy', { occupied: false });
    await pendingUpdate;
    expect(light.getAttribute(OnOff.id, 'onOff')).toBe(false);
  });

  test('add onOffOutlet', async () => {
    const endpoint = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'OnOffOutlet' }).addRequiredClusters().addClusterClients([OccupancySensing.id]);
    expect(endpoint).toBeDefined();
    expect(await matterbridge.aggregatorNode?.add(endpoint)).toBeDefined();
    await endpoint.construction.ready;

    // Descriptor of the plug must advertise OccupancySensing as a client cluster
    expect(endpoint.stateOf(DescriptorServer).clientList).toHaveLength(1);
    expect(endpoint.stateOf(DescriptorServer).clientList).toContain(OccupancySensing.id);

    // OnOff is typed as supported, so it should be in endpoint.behaviors.supported
    expect(endpoint.stateOf(OnOffServer).onOff).toBeDefined();
    expect(endpoint.getCluster(OnOffServer)?.onOff).toBeDefined();
    expect(endpoint.getAttribute(OnOffServer, 'onOff')).toBeDefined();

    // endpoint.type.behaviors must be kept in sync with behaviors.supported by the inject wrapper
    const serverBehaviors = endpoint.type.behaviors as Record<string, ClusterBehavior.Type>;
    expect(serverBehaviors['onOff']).toBeDefined();
    expect(serverBehaviors['onOff'].cluster.id).toBe(OnOff.id);

    // endpoint.type.clientClusters must be populated with cluster info
    const clientClusters = endpoint.type.clientClusters as Record<string, ClusterBehavior.Type> | undefined;
    if (!clientClusters) throw new Error('clientClusters is undefined');
    expect(Object.keys(clientClusters)).toHaveLength(1);
    expect(clientClusters['occupancySensing']).toBe(OccupancySensingClient);
    expect(clientClusters['occupancySensing'].cluster.id).toBe(OccupancySensing.id);
  });

  test('add OnOffPlugInUnitDevice', async () => {
    const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(BindingServer).withClientClusters(OccupancySensingClient), {
      id: 'OnOffPlugIn',
      identify: {
        identifyTime: 0,
        identifyType: Identify.IdentifyType.None,
      },
      onOff: {
        onOff: false,
      },
    });
    expect(endpoint).toBeDefined();
    expect(await matterbridge.aggregatorNode?.add(endpoint)).toBeDefined();
    await endpoint.construction.ready;

    // Descriptor of the plug must advertise OccupancySensing as a client cluster
    expect(endpoint.stateOf(DescriptorServer).clientList).toHaveLength(1);
    expect(endpoint.stateOf(DescriptorServer).clientList).toContain(OccupancySensing.id);

    // OnOff is typed as supported, so it should be in endpoint.behaviors.supported
    expect(endpoint.stateOf(OnOffServer).onOff).toBeDefined();

    // endpoint.type.behaviors must be kept in sync with behaviors.supported by the inject wrapper
    const serverBehaviors = endpoint.type.behaviors as Record<string, ClusterBehavior.Type>;
    expect(serverBehaviors['onOff']).toBeDefined();
    expect(serverBehaviors['onOff'].cluster.id).toBe(OnOff.id);

    // endpoint.type.clientClusters must be populated with cluster info
    const clientClusters = endpoint.type.clientClusters as Record<string, ClusterBehavior.Type> | undefined;
    if (!clientClusters) throw new Error('clientClusters is undefined');
    expect(Object.keys(clientClusters)).toHaveLength(1);
    expect(clientClusters['occupancySensing']).toBe(OccupancySensingClient);
    expect(clientClusters['occupancySensing'].cluster.id).toBe(OccupancySensing.id);
  });
});
