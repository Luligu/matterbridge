/**
 * @file packages/core/buntest/behaviors/bindingServer.test.ts
 * @description This file contains the bun tests for bindingServer.
 * @author Luca Liguori
 */

const NAME = 'BindingServer';
const MATTER_PORT = 11400;

import { describe, expect, test, vi } from 'bun:test';

import { type ClusterBehavior, Endpoint } from '@matter/main/node';
import { type BindingResolution, BindingServer } from '@matter/node/behaviors/binding';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { OccupancySensingClient, OccupancySensingServer } from '@matter/node/behaviors/occupancy-sensing';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import { OnOffPlugInUnitDevice } from '@matter/node/devices/on-off-plug-in-unit';
import type { Binding } from '@matter/types/clusters/binding';
import { Identify } from '@matter/types/clusters/identify';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { OnOff } from '@matter/types/clusters/on-off';
import { EndpointNumber, FabricIndex, NodeId } from '@matter/types/datatype';
import { Namespace } from '@matter/types/globals';
import { flushAsync } from '@matterbridge/test-utils';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerInfoSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { debugStringify } from 'node-ansi-logger';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { MatterbridgeIdentifyServer } from '../../src/behaviors/identifyServer.js';
import { MatterbridgeOnOffServer } from '../../src/behaviors/onOffServer.js';
import { bridgedNode, occupancySensor, onOffLight, onOffLightSwitch, onOffPlugInUnit } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

/**
 * Builds the resolution BindingManager emits for a binding target.
 *
 * @param {BindingResolution['kind']} kind - 'server' for a local target, 'client' for a remote one.
 * @param {number} id - The node and endpoint number of the target.
 * @param {Endpoint} endpoint - The endpoint the binding resolves to.
 * @param {object} [node] - The node stub.
 * @param {number} [cluster] - The bound cluster id.
 * @returns {BindingResolution} The resolution.
 */
const resolutionOf = (kind: BindingResolution['kind'], id: number, endpoint: Endpoint, node: object = {}, cluster?: number): BindingResolution =>
  ({
    kind,
    entry: { node: NodeId(id), endpoint: EndpointNumber(id), ...(cluster === undefined ? {} : { cluster }) } as Binding.Target,
    node,
    endpoint,
  }) as unknown as BindingResolution;

/**
 * Reads whether a binding target is tracked in the server's boundEndpoints.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint with the Binding server.
 * @param {Binding.Target} entry - The binding target.
 * @returns {Promise<boolean>} True when the target is tracked.
 */
const isBound = async (endpoint: MatterbridgeEndpoint, entry: Binding.Target): Promise<boolean> => {
  let bound = false;
  await endpoint.act((agent) => {
    bound = (agent.get(MatterbridgeBindingServer) as unknown as { internal: { boundEndpoints: Map<Binding.Target, Endpoint> } }).internal.boundEndpoints.has(entry);
  });
  return bound;
};

/**
 * Checks that an endpoint advertises exactly the OccupancySensing client cluster, in its descriptor and in its type.
 *
 * @param {Endpoint} endpoint - The endpoint to check.
 * @returns {void}
 */
const expectOccupancyClientOnly = (endpoint: Endpoint): void => {
  expect(endpoint.stateOf(DescriptorServer).clientList).toEqual([OccupancySensing.id]);
  const clientClusters = endpoint.type.clientClusters as Record<string, ClusterBehavior.Type>;
  expect(Object.keys(clientClusters)).toEqual(['occupancySensing']);
  expect(clientClusters['occupancySensing'].cluster.id).toBe(OccupancySensing.id);
  // endpoint.type.behaviors stays in sync with behaviors.supported.
  expect((endpoint.type.behaviors as Record<string, ClusterBehavior.Type>)['onOff'].cluster.id).toBe(OnOff.id);
};

describe('MatterbridgeBindingServer', () => {
  useServerNode(MATTER_PORT);

  test('established and removed track the targets, client targets auto-subscribe, getEndpoint finds them by cluster', async () => {
    const device = new MatterbridgeEndpoint(onOffLightSwitch, { id: 'onOffSwitch' });
    device.behaviors.require(MatterbridgeBindingServer, { clientList: [Identify.id, OnOff.id] });
    device.behaviors.require(MatterbridgeIdentifyServer, { identifyTime: 5, identifyType: Identify.IdentifyType.AudibleBeep });
    device.behaviors.require(MatterbridgeOnOffServer, { onOff: false });
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    for (const behavior of [MatterbridgeBindingServer, MatterbridgeIdentifyServer, MatterbridgeOnOffServer]) expect(device.behaviors.has(behavior)).toBe(true);
    expect(device.stateOf(MatterbridgeIdentifyServer).identifyTime).toBe(5);
    // A live state array: copy it, bun's asymmetric matchers do not accept it as an array.
    expect([...device.stateOf(DescriptorServer).clientList]).toEqual(expect.arrayContaining([Identify.id, OnOff.id]));
    await device.setStateOf(MatterbridgeBindingServer, { binding: [{ node: NodeId(1), endpoint: EndpointNumber(1), fabricIndex: FabricIndex(1) }] });
    const events = device.eventsOf(MatterbridgeBindingServer);

    // A local (server) target is tracked without touching the node.
    const nodeSet = vi.fn(async () => {});
    const local = resolutionOf('server', 1, device, { set: nodeSet });
    await events.established.emit(local);
    expect(nodeSet).not.toHaveBeenCalled();
    expect(await isBound(device, local.entry)).toBe(true);
    // A remote (client) target is tracked and its node set to auto-subscribe.
    const remote = resolutionOf('client', 2, device, { set: nodeSet });
    await events.established.emit(remote);
    expect(nodeSet).toHaveBeenCalledWith({ network: { autoSubscribe: true } });
    expect(await isBound(device, remote.entry)).toBe(true);
    // removed forgets the target.
    const removed = resolutionOf('server', 3, device);
    await events.established.emit(removed);
    expect(await isBound(device, removed.entry)).toBe(true);
    await events.removed.emit(removed);
    expect(await isBound(device, removed.entry)).toBe(false);
    // getEndpoint looks a target up by its cluster.
    await events.established.emit(resolutionOf('server', 4, device, {}, OnOff.id));
    await device.act((agent) => {
      expect(agent.get(MatterbridgeBindingServer).getEndpoint(OnOff.id)).toBe(device);
      expect(agent.get(MatterbridgeBindingServer).getEndpoint(Identify.id)).toBeUndefined();
    });
  });

  test('initialization adds the clientList ids the endpoint type lacks and logs the active bindings', async () => {
    const light = new MatterbridgeEndpoint([onOffLight, bridgedNode], { id: 'BindingOnlyLight' });
    light.behaviors.require(MatterbridgeBindingServer, {
      clientList: [OccupancySensing.id],
      binding: [{ node: NodeId(99), endpoint: EndpointNumber(99), cluster: OccupancySensing.id, fabricIndex: FabricIndex(1) }],
    });
    light
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 'Light')
      .createDefaultIdentifyClusterServer()
      .createDefaultOnOffClusterServer(false)
      .addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
    await flushAsync(undefined, undefined, 0);
    expect(light.getAttribute(DescriptorServer, 'clientList')).toContain(OccupancySensing.id);
    const label = `(endpoint ${light.maybeId}.${light.maybeNumber})`;
    expect(loggerInfoSpy).toHaveBeenCalledWith(`MatterbridgeBindingServer: initializing with clientList ${OccupancySensing.id} ${label}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`MatterbridgeBindingServer: adding client clusters ${OccupancySensing.id} ${label}`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      `MatterbridgeBindingServer: active binding target ${debugStringify({ node: NodeId(99), group: undefined, endpoint: EndpointNumber(99), cluster: OccupancySensing.id, fabricIndex: FabricIndex(1) })} ${label}`,
    );
  });

  test('a local binding lets an OnOff light follow an occupancy sensor', async () => {
    const sensor = new MatterbridgeEndpoint(occupancySensor, { id: 'OccSensor' }).createDefaultIdentifyClusterServer().addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, sensor, 0, 0, 0, 0)).toBeTruthy();
    const light = new MatterbridgeEndpoint(onOffLight, { id: 'OccLight' })
      .createDefaultBindingClusterServer([OccupancySensing.id])
      .createDefaultIdentifyClusterServer()
      .createDefaultOnOffClusterServer(false)
      .addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
    expectOccupancyClientOnly(light);

    // The resolution BindingManager emits for a same-node binding.
    if (sensor.number === undefined) throw new Error('sensor endpoint number not assigned');
    await light.eventsOf(MatterbridgeBindingServer).established.emit(resolutionOf('server', sensor.number, sensor, {}, OccupancySensing.id));
    let pendingUpdate: Promise<boolean> = Promise.resolve(false);
    await light.act((agent) => {
      const boundSensor = agent.get(MatterbridgeBindingServer).getEndpoint(OccupancySensing.id);
      expect(boundSensor).toBe(sensor);
      expect(boundSensor?.stateOf(OccupancySensingServer).occupancy.occupied).toBe(false);
      boundSensor?.eventsOf(OccupancySensingServer).occupancy$Changed.on((newValue) => {
        pendingUpdate = light.setAttribute(OnOffServer, 'onOff', newValue.occupied ?? false);
      });
    });
    for (const occupied of [true, false]) {
      await sensor.setAttribute(OccupancySensingServer, 'occupancy', { occupied });
      await pendingUpdate;
      expect(light.getAttribute(OnOff.id, 'onOff')).toBe(occupied);
    }
  });

  test('addClusterClients and a plain matter.js endpoint register the OccupancySensing client cluster', async () => {
    const outlet = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'OnOffOutlet' }).addRequiredClusters().addClusterClients([OccupancySensing.id]);
    expect(await addBridgedDevice(aggregator, outlet, 0, 0, 0, 0)).toBeTruthy();
    expectOccupancyClientOnly(outlet);
    expect(outlet.type.clientClusters?.['occupancySensing']).toBe(OccupancySensingClient);
    expect(outlet.getAttribute(OnOffServer, 'onOff')).toBeDefined();

    // A plain matter.js endpoint gets no BridgedDeviceBasicInformation: the TagList disambiguates it from the outlet.
    const plugIn = new Endpoint(OnOffPlugInUnitDevice.with(BindingServer, DescriptorServer.with('TagList')).withClientClusters(OccupancySensingClient), {
      id: 'OnOffPlugIn',
      descriptor: { tagList: [{ mfgCode: null, namespaceId: Namespace.CommonPosition, tag: 0, label: 'Plug' }] },
      identify: { identifyTime: 0, identifyType: Identify.IdentifyType.None },
      onOff: { onOff: false },
    });
    expect(await addBridgedDevice(aggregator, plugIn, 0, 0, 0, 0)).toBeTruthy();
    expectOccupancyClientOnly(plugIn);
    expect(plugIn.type.clientClusters?.['occupancySensing']).toBe(OccupancySensingClient);
  });
});
