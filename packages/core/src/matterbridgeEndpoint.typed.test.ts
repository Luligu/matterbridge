// src\matterbridgeEndpoint.typed.test.ts

const MATTER_PORT = 11100;
const NAME = 'EndpointTypeChecks';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const CREATE_ONLY = true;

process.argv = [
  'node',
  'matterbridge.js',
  '-mdnsInterface',
  'Wi-Fi',
  '-frontend',
  '0',
  '-port',
  MATTER_PORT.toString(),
  '-homedir',
  HOMEDIR,
  '-bridge',
  '-logger',
  'info',
  '-matterlogger',
  'info',
];

import path from 'node:path';

import { jest } from '@jest/globals';
import { ActionContext } from '@matter/node';
import { BooleanStateBehavior, BooleanStateServer } from '@matter/node/behaviors';
import { EndpointNumber } from '@matter/types';
import { BooleanState } from '@matter/types/clusters';

import { addDevice, aggregator, createTestEnvironment, deleteDevice, destroyTestEnvironment, server, setupTest, startServerNode, stopServerNode } from './jestutils/jestHelpers.js';
import { rainSensor } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

await setupTest(NAME, false);

describe('Matterbridge Endpoint Typed Checks', () => {
  beforeAll(async () => {
    createTestEnvironment(NAME, CREATE_ONLY);
    await startServerNode(NAME, MATTER_PORT, undefined, CREATE_ONLY);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await stopServerNode(server, CREATE_ONLY);
    await destroyTestEnvironment(CREATE_ONLY);
    jest.restoreAllMocks();
  });

  test('getAttribute type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorTypeCheck', number: EndpointNumber(900) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(true);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      await device.setAttribute(BooleanState.Cluster, 'stateValue', true, device.log);

      const stateFromBehavior: boolean | undefined = device.getAttribute(BooleanStateBehavior, 'stateValue', device.log);
      const stateFromServer: boolean | undefined = device.getAttribute(BooleanStateServer, 'stateValue', device.log);
      const stateFromCluster: boolean | undefined = device.getAttribute(BooleanState.Cluster, 'stateValue', device.log);
      const stateFromClusterId = device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log);
      const stateFromString = device.getAttribute('BooleanState', 'stateValue', device.log);

      expect(device.hasAttributeServer(BooleanStateBehavior, 'stateValue')).toBe(true);
      expect(device.hasAttributeServer(BooleanStateServer, 'stateValue')).toBe(true);
      expect(device.hasAttributeServer(BooleanState.Cluster, 'stateValue')).toBe(true);
      expect(stateFromBehavior).toBe(true);
      expect(stateFromServer).toBe(true);
      expect(stateFromCluster).toBe(true);
      expect(stateFromClusterId).toBe(true);
      expect(stateFromString).toBe(true);

      // @ts-expect-error intentional type-check guard for Behavior.Type overload
      device.getAttribute(BooleanStateBehavior, 'stateValueXX', device.log);
      // @ts-expect-error intentional type-check guard for ClusterType overload
      device.getAttribute(BooleanState.Cluster, 'stateValueXX', device.log);
      // @ts-expect-error intentional type-check guard for typed return value
      const invalidStateType: string | undefined = device.getAttribute(BooleanStateBehavior, 'stateValue', device.log);
      void invalidStateType;
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('setAttribute type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorSetTypeCheck', number: EndpointNumber(901) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(false);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const setFromBehavior: boolean = await device.setAttribute(BooleanStateBehavior, 'stateValue', true, device.log);
      expect(setFromBehavior).toBe(true);
      expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);

      const setFromServer: boolean = await device.setAttribute(BooleanStateServer, 'stateValue', false, device.log);
      expect(setFromServer).toBe(true);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);

      const setFromCluster: boolean = await device.setAttribute(BooleanState.Cluster, 'stateValue', true, device.log);
      expect(setFromCluster).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(true);

      const setFromClusterId: boolean = await device.setAttribute(BooleanState.Cluster.id, 'stateValue', false, device.log);
      expect(setFromClusterId).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(false);

      const setFromString: boolean = await device.setAttribute('BooleanState', 'stateValue', true, device.log);
      expect(setFromString).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type overload
        device.setAttribute(BooleanStateBehavior, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType overload
        device.setAttribute(BooleanState.Cluster, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for typed value
        device.setAttribute(BooleanStateBehavior, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidSetType: Promise<string> = device.setAttribute(BooleanStateBehavior, 'stateValue', true, device.log);
        void invalidSetType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('updateAttribute type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorUpdateTypeCheck', number: EndpointNumber(902) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(false);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const updateFromBehavior: boolean = await device.updateAttribute(BooleanStateBehavior, 'stateValue', true, device.log);
      expect(updateFromBehavior).toBe(true);
      expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);

      const updateFromServer: boolean = await device.updateAttribute(BooleanStateServer, 'stateValue', false, device.log);
      expect(updateFromServer).toBe(true);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);

      const updateFromCluster: boolean = await device.updateAttribute(BooleanState.Cluster, 'stateValue', true, device.log);
      expect(updateFromCluster).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(true);

      const updateFromClusterId: boolean = await device.updateAttribute(BooleanState.Cluster.id, 'stateValue', false, device.log);
      expect(updateFromClusterId).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(false);

      const updateFromString: boolean = await device.updateAttribute('BooleanState', 'stateValue', true, device.log);
      expect(updateFromString).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type overload
        device.updateAttribute(BooleanStateBehavior, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType overload
        device.updateAttribute(BooleanState.Cluster, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for typed value
        device.updateAttribute(BooleanStateBehavior, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidUpdateType: Promise<string> = device.updateAttribute(BooleanStateBehavior, 'stateValue', true, device.log);
        void invalidUpdateType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('subscribeAttribute type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorSubscribeTypeCheck', number: EndpointNumber(903) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(true);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      let behaviorState: boolean | undefined;
      let behaviorOldState: boolean | undefined;
      let behaviorOfflineState: boolean | undefined;
      const behaviorListener = (newValue: boolean, oldValue: boolean, context: ActionContext) => {
        behaviorState = newValue;
        behaviorOldState = oldValue;
        behaviorOfflineState = context.offline;
      };

      const subscribeFromBehavior: boolean = await device.subscribeAttribute(BooleanStateBehavior, 'stateValue', behaviorListener, device.log);
      expect(subscribeFromBehavior).toBe(true);

      let serverState: boolean | undefined;
      const subscribeFromServer: boolean = await device.subscribeAttribute(
        BooleanStateServer,
        'stateValue',
        (newValue: boolean) => {
          serverState = newValue;
        },
        device.log,
      );
      expect(subscribeFromServer).toBe(true);

      let clusterState: boolean | undefined;
      const subscribeFromCluster: boolean = await device.subscribeAttribute(
        BooleanState.Cluster,
        'stateValue',
        (newValue: boolean) => {
          clusterState = newValue;
        },
        device.log,
      );
      expect(subscribeFromCluster).toBe(true);

      let clusterIdState: boolean | undefined;
      const subscribeFromClusterId: boolean = await device.subscribeAttribute(
        BooleanState.Cluster.id,
        'stateValue',
        (newValue) => {
          clusterIdState = newValue as boolean;
        },
        device.log,
      );
      expect(subscribeFromClusterId).toBe(true);

      let stringState: boolean | undefined;
      const subscribeFromString: boolean = await device.subscribeAttribute(
        'BooleanState',
        'stateValue',
        (newValue) => {
          stringState = newValue as boolean;
        },
        device.log,
      );
      expect(subscribeFromString).toBe(true);

      await device.setAttribute(BooleanState.Cluster, 'stateValue', false, device.log);
      expect(behaviorState).toBe(false);
      expect(behaviorOldState).toBe(true);
      expect(behaviorOfflineState).toBe(true);
      expect(serverState).toBe(false);
      expect(clusterState).toBe(false);
      expect(clusterIdState).toBe(false);
      expect(stringState).toBe(false);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type overload
        device.subscribeAttribute(BooleanStateBehavior, 'stateValueXX', behaviorListener, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType overload
        device.subscribeAttribute(BooleanState.Cluster, 'stateValueXX', behaviorListener, device.log);
        // @ts-expect-error intentional type-check guard for typed listener values
        device.subscribeAttribute(BooleanStateBehavior, 'stateValue', (newValue: string, oldValue: string, context: ActionContext) => {}, device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidSubscribeType: Promise<string> = device.subscribeAttribute(BooleanStateBehavior, 'stateValue', behaviorListener, device.log);
        void invalidSubscribeType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });
});
