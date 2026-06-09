// src\matterbridgeEndpoint.typed.test.ts

const MATTER_PORT = 11700;
const NAME = 'EndpointTypeChecks';
const HOMEDIR = path.join('.cache', 'jest', NAME);

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
import { OnOffServer } from '@matter/main/behaviors/on-off';
import { ActionContext } from '@matter/node';
import { BooleanStateBehavior, BooleanStateServer, IdentifyBehavior, IdentifyServer, PowerSourceBehavior, SwitchServer } from '@matter/node/behaviors';
import { OnOffBehavior } from '@matter/node/behaviors/on-off';
import { ThermostatServer } from '@matter/node/behaviors/thermostat';
import { EndpointNumber } from '@matter/types';
import { BooleanState, Identify, PowerSource, Switch, Thermostat } from '@matter/types/clusters';
import { OnOff } from '@matter/types/clusters/on-off';

import { addDevice, aggregator, createServerNode, createTestEnvironment, deleteDevice, destroyTestEnvironment, flushServerNode } from './jestutils/jestMatterTest.js';
import { setupTest } from './jestutils/jestSetupTest.js';
import { genericSwitch, onOffPlugInUnit, rainSensor, thermostat } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { internalFor } from './matterbridgeEndpointHelpers.js';

await setupTest(NAME, false);

describe('Matterbridge Endpoint Typed Checks', () => {
  beforeAll(async () => {
    await createTestEnvironment();
    await createServerNode(MATTER_PORT);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await flushServerNode();
    await destroyTestEnvironment();
    jest.restoreAllMocks();
  });

  test('getAttribute type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorTypeCheck', number: EndpointNumber(900) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(true);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      await device.setAttribute(BooleanState, 'stateValue', true, device.log);

      const stateFromBehavior: boolean | undefined = device.getAttribute(BooleanStateBehavior, 'stateValue', device.log);
      const stateFromServer: boolean | undefined = device.getAttribute(BooleanStateServer, 'stateValue', device.log);
      const stateFromCluster: boolean | undefined = device.getAttribute(BooleanState, 'stateValue', device.log);
      const stateFromClusterId = device.getAttribute(BooleanState.id, 'stateValue', device.log);
      const stateFromString = device.getAttribute('BooleanState', 'stateValue', device.log);

      expect(device.hasAttributeServer(BooleanStateBehavior, 'stateValue')).toBe(true);
      expect(device.hasAttributeServer(BooleanStateServer, 'stateValue')).toBe(true);
      expect(device.hasAttributeServer(BooleanState, 'stateValue')).toBe(true);
      expect(stateFromBehavior).toBe(true);
      expect(stateFromServer).toBe(true);
      expect(stateFromCluster).toBe(true);
      expect(stateFromClusterId).toBe(true);
      expect(stateFromString).toBe(true);

      // @ts-expect-error intentional type-check guard for Behavior.Type overload
      device.getAttribute(BooleanStateBehavior, 'stateValueXX', device.log);
      // @ts-expect-error intentional type-check guard for Behavior.Type server overload
      device.getAttribute(BooleanStateServer, 'stateValueXX', device.log);
      // @ts-expect-error intentional type-check guard for ClusterType overload
      device.getAttribute(BooleanState, 'stateValueXX', device.log);
      // @ts-expect-error intentional type-check guard for typed return value
      const invalidStateType: string | undefined = device.getAttribute(BooleanStateBehavior, 'stateValue', device.log);
      // @ts-expect-error intentional type-check guard for typed server return value
      const invalidServerStateType: string | undefined = device.getAttribute(BooleanStateServer, 'stateValue', device.log);
      // @ts-expect-error intentional type-check guard for typed cluster return value
      const invalidClusterStateType: string | undefined = device.getAttribute(BooleanState, 'stateValue', device.log);
      void invalidStateType;
      void invalidServerStateType;
      void invalidClusterStateType;
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

      const setFromCluster: boolean = await device.setAttribute(BooleanState, 'stateValue', true, device.log);
      expect(setFromCluster).toBe(true);
      expect(device.getAttribute(BooleanState, 'stateValue', device.log)).toBe(true);

      const setFromClusterId: boolean = await device.setAttribute(BooleanState.id, 'stateValue', false, device.log);
      expect(setFromClusterId).toBe(true);
      expect(device.getAttribute(BooleanState.id, 'stateValue', device.log)).toBe(false);

      const setFromString: boolean = await device.setAttribute('BooleanState', 'stateValue', true, device.log);
      expect(setFromString).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type overload
        device.setAttribute(BooleanStateBehavior, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type server overload
        device.setAttribute(BooleanStateServer, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType overload
        device.setAttribute(BooleanState, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for typed value
        device.setAttribute(BooleanStateBehavior, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed server value
        device.setAttribute(BooleanStateServer, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed cluster value
        device.setAttribute(BooleanState, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidSetType: Promise<string> = device.setAttribute(BooleanStateBehavior, 'stateValue', true, device.log);
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerSetType: Promise<string> = device.setAttribute(BooleanStateServer, 'stateValue', true, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidClusterSetType: Promise<string> = device.setAttribute(BooleanState, 'stateValue', true, device.log);
        void invalidSetType;
        void invalidServerSetType;
        void invalidClusterSetType;
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

      const updateFromCluster: boolean = await device.updateAttribute(BooleanState, 'stateValue', true, device.log);
      expect(updateFromCluster).toBe(true);
      expect(device.getAttribute(BooleanState, 'stateValue', device.log)).toBe(true);

      const updateFromClusterId: boolean = await device.updateAttribute(BooleanState.id, 'stateValue', false, device.log);
      expect(updateFromClusterId).toBe(true);
      expect(device.getAttribute(BooleanState.id, 'stateValue', device.log)).toBe(false);

      const updateFromString: boolean = await device.updateAttribute('BooleanState', 'stateValue', true, device.log);
      expect(updateFromString).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type overload
        device.updateAttribute(BooleanStateBehavior, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type server overload
        device.updateAttribute(BooleanStateServer, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType overload
        device.updateAttribute(BooleanState, 'stateValueXX', true, device.log);
        // @ts-expect-error intentional type-check guard for typed value
        device.updateAttribute(BooleanStateBehavior, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed server value
        device.updateAttribute(BooleanStateServer, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed cluster value
        device.updateAttribute(BooleanState, 'stateValue', 'true', device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidUpdateType: Promise<string> = device.updateAttribute(BooleanStateBehavior, 'stateValue', true, device.log);
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerUpdateType: Promise<string> = device.updateAttribute(BooleanStateServer, 'stateValue', true, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidClusterUpdateType: Promise<string> = device.updateAttribute(BooleanState, 'stateValue', true, device.log);
        void invalidUpdateType;
        void invalidServerUpdateType;
        void invalidClusterUpdateType;
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
        behaviorOfflineState = context?.fabric === undefined;
      };

      const subscribeFromBehavior: MatterbridgeEndpoint = device.subscribeAttribute(BooleanStateBehavior, 'stateValue', behaviorListener, device.log);
      expect(subscribeFromBehavior).toBe(device);

      let serverState: boolean | undefined;
      const subscribeFromServer: MatterbridgeEndpoint = device.subscribeAttribute(
        BooleanStateServer,
        'stateValue',
        (newValue: boolean) => {
          serverState = newValue;
        },
        device.log,
      );
      expect(subscribeFromServer).toBe(device);

      let clusterState: boolean | undefined;
      const subscribeFromCluster: MatterbridgeEndpoint = device.subscribeAttribute(
        BooleanState,
        'stateValue',
        (newValue: boolean) => {
          clusterState = newValue;
        },
        device.log,
      );
      expect(subscribeFromCluster).toBe(device);

      let clusterIdState: boolean | undefined;
      const subscribeFromClusterId: MatterbridgeEndpoint = device.subscribeAttribute(
        BooleanState.id,
        'stateValue',
        (newValue) => {
          clusterIdState = newValue as boolean;
        },
        device.log,
      );
      expect(subscribeFromClusterId).toBe(device);

      let stringState: boolean | undefined;
      const subscribeFromString: MatterbridgeEndpoint = device.subscribeAttribute(
        'BooleanState',
        'stateValue',
        (newValue) => {
          stringState = newValue as boolean;
        },
        device.log,
      );
      expect(subscribeFromString).toBe(device);

      await device.setAttribute(BooleanState, 'stateValue', false, device.log);
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
        // @ts-expect-error intentional type-check guard for Behavior.Type server overload
        device.subscribeAttribute(BooleanStateServer, 'stateValueXX', behaviorListener, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType overload
        device.subscribeAttribute(BooleanState, 'stateValueXX', behaviorListener, device.log);
        // @ts-expect-error intentional type-check guard for typed listener values
        device.subscribeAttribute(BooleanStateBehavior, 'stateValue', (newValue: string, oldValue: string, context: ActionContext) => {}, device.log);
        // @ts-expect-error intentional type-check guard for typed server listener values
        device.subscribeAttribute(BooleanStateServer, 'stateValue', (newValue: string, oldValue: string, context: ActionContext) => {}, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster listener values
        device.subscribeAttribute(BooleanState, 'stateValue', (newValue: string, oldValue: string, context: ActionContext) => {}, device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidSubscribeType: string = device.subscribeAttribute(BooleanStateBehavior, 'stateValue', behaviorListener, device.log);
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerSubscribeType: string = device.subscribeAttribute(BooleanStateServer, 'stateValue', behaviorListener, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidClusterSubscribeType: string = device.subscribeAttribute(BooleanState, 'stateValue', behaviorListener, device.log);
        void invalidSubscribeType;
        void invalidServerSubscribeType;
        void invalidClusterSubscribeType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('getCluster type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorGetClusterTypeCheck', number: EndpointNumber(904) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(true);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const clusterFromBehavior: { stateValue: boolean } | undefined = device.getCluster(BooleanStateBehavior, device.log);
      const clusterFromServer: { stateValue: boolean } | undefined = device.getCluster(BooleanStateServer, device.log);
      const clusterFromCluster: { stateValue: boolean } | undefined = device.getCluster(BooleanState, device.log);
      const clusterFromClusterId = device.getCluster(BooleanState.id, device.log);
      const clusterFromString = device.getCluster('BooleanState', device.log);

      expect(clusterFromBehavior?.stateValue).toBe(true);
      expect(clusterFromServer?.stateValue).toBe(true);
      expect(clusterFromCluster?.stateValue).toBe(true);
      expect(clusterFromClusterId?.stateValue).toBe(true);
      expect(clusterFromString?.stateValue).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidClusterType: { stateValue: string } | undefined = device.getCluster(BooleanStateBehavior, device.log);
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerClusterType: { stateValue: string } | undefined = device.getCluster(BooleanStateServer, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidTypedClusterType: { stateValue: string } | undefined = device.getCluster(BooleanState, device.log);
        void invalidClusterType;
        void invalidServerClusterType;
        void invalidTypedClusterType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('setCluster type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorSetClusterTypeCheck', number: EndpointNumber(905) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(false);
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const setFromBehavior: boolean = await device.setCluster(BooleanStateBehavior, { stateValue: true }, device.log);
      expect(setFromBehavior).toBe(true);
      expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);

      const setFromServer: boolean = await device.setCluster(BooleanStateServer, { stateValue: false }, device.log);
      expect(setFromServer).toBe(true);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);

      const setFromCluster: boolean = await device.setCluster(BooleanState, { stateValue: true }, device.log);
      expect(setFromCluster).toBe(true);
      expect(device.getAttribute(BooleanState, 'stateValue', device.log)).toBe(true);

      const setFromClusterId: boolean = await device.setCluster(BooleanState.id, { stateValue: false }, device.log);
      expect(setFromClusterId).toBe(true);
      expect(device.getAttribute(BooleanState.id, 'stateValue', device.log)).toBe(false);

      const setFromString: boolean = await device.setCluster('BooleanState', { stateValue: true }, device.log);
      expect(setFromString).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type cluster payload overload
        device.setCluster(BooleanStateBehavior, { stateValue: 'true' }, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type server cluster payload overload
        device.setCluster(BooleanStateServer, { stateValue: 'true' }, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType cluster payload overload
        device.setCluster(BooleanState, { stateValue: 'true' }, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type cluster missing payload property overload
        device.setCluster(BooleanStateBehavior, {}, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type server cluster missing payload property overload
        device.setCluster(BooleanStateServer, {}, device.log);
        device.setCluster(BooleanState, {}, device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidSetClusterType: Promise<string> = device.setCluster(BooleanStateBehavior, { stateValue: true }, device.log);
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerSetClusterType: Promise<string> = device.setCluster(BooleanStateServer, { stateValue: true }, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidTypedSetClusterType: Promise<string> = device.setCluster(BooleanState, { stateValue: true }, device.log);
        void invalidSetClusterType;
        void invalidServerSetClusterType;
        void invalidTypedSetClusterType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('setCluster type checks with OnOff', async () => {
    const device = new MatterbridgeEndpoint(onOffPlugInUnit, { id: 'OnOffOutletSetClusterTypeCheck', number: EndpointNumber(1001) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const setFromBehavior: boolean = await device.setCluster(OnOffBehavior, { onOff: true }, device.log);
      expect(setFromBehavior).toBe(true);
      expect(device.getAttribute(OnOffBehavior, 'onOff', device.log)).toBe(true);

      const setFromServer: boolean = await device.setCluster(OnOffServer, { onOff: false }, device.log);
      expect(setFromServer).toBe(true);
      expect(device.getAttribute(OnOffServer, 'onOff', device.log)).toBe(false);

      const setFromCluster: boolean = await device.setCluster(OnOff, { onOff: true }, device.log);
      expect(setFromCluster).toBe(true);
      expect(device.getAttribute(OnOff, 'onOff', device.log)).toBe(true);

      const setFromClusterId: boolean = await device.setCluster(OnOff.id, { onOff: false }, device.log);
      expect(setFromClusterId).toBe(true);
      expect(device.getAttribute(OnOff.id, 'onOff', device.log)).toBe(false);

      const setFromString: boolean = await device.setCluster('OnOff', { onOff: true }, device.log);
      expect(setFromString).toBe(true);
      expect(device.getAttribute('OnOff', 'onOff', device.log)).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type cluster payload overload
        device.setCluster(OnOffBehavior, { onOff: 'true' }, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type server cluster payload overload
        device.setCluster(OnOffServer, { onOff: 'true' }, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType cluster payload overload
        device.setCluster(OnOff, { onOff: 'true' }, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type cluster missing payload property overload
        device.setCluster(OnOffBehavior, {}, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type server cluster missing payload property overload
        device.setCluster(OnOffServer, {}, device.log);
        device.setCluster(OnOff, {}, device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidSetClusterType: Promise<string> = device.setCluster(OnOffBehavior, { onOff: true }, device.log);
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerSetClusterType: Promise<string> = device.setCluster(OnOffServer, { onOff: true }, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidTypedSetClusterType: Promise<string> = device.setCluster(OnOff, { onOff: true }, device.log);
        void invalidSetClusterType;
        void invalidServerSetClusterType;
        void invalidTypedSetClusterType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('internalFor type checks', async () => {
    const device = new MatterbridgeEndpoint(thermostat, { id: 'ThermostatInternalTypeCheck', number: EndpointNumber(906) }, true);
    expect(device).toBeDefined();
    device.createDefaultThermostatClusterServer();
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      type ThermostatInternal = InstanceType<(typeof ThermostatServer)['Internal']>;

      const internalFromBehavior = await internalFor(device, ThermostatServer);
      const internalFromCluster: ThermostatInternal | undefined = await internalFor<ThermostatInternal>(device, Thermostat);
      const internalFromClusterId: ThermostatInternal | undefined = await internalFor<ThermostatInternal>(device, Thermostat.id);
      const internalFromString: ThermostatInternal | undefined = await internalFor<ThermostatInternal>(device, 'Thermostat');

      expect(internalFromBehavior).toBeDefined();
      expect(internalFromCluster).toBeDefined();
      expect(internalFromClusterId).toBeDefined();
      expect(internalFromString).toBeDefined();

      const minSetpointDeadBand: number | undefined = internalFromBehavior?.minSetpointDeadBand;
      expect(minSetpointDeadBand).toBeGreaterThanOrEqual(0);
      expect(internalFromCluster?.minSetpointDeadBand).toBe(minSetpointDeadBand);
      expect(internalFromClusterId?.minSetpointDeadBand).toBe(minSetpointDeadBand);
      expect(internalFromString?.minSetpointDeadBand).toBe(minSetpointDeadBand);

      expect(internalFromCluster).toBe(internalFromBehavior);
      expect(internalFromClusterId).toBe(internalFromBehavior);
      expect(internalFromString).toBe(internalFromBehavior);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type overload generic parameter
        internalFor<ThermostatInternal>(device, ThermostatServer);
        // @ts-expect-error intentional type-check guard for inferred Behavior.Type return value
        const invalidBehaviorInternal: { missing: true } | undefined = await internalFor(device, ThermostatServer);
        // @ts-expect-error intentional type-check guard for string overload return value
        const invalidStringInternal: { missing: true } | undefined = await internalFor<ThermostatInternal>(device, 'Thermostat');
        void invalidBehaviorInternal;
        void invalidStringInternal;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('invokeBehaviorCommand type checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorInvokeTypeCheck', number: EndpointNumber(907) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const invokeFromBehavior: Promise<void> = device.invokeBehaviorCommand(IdentifyBehavior, 'identify', { identifyTime: 5 });
      await invokeFromBehavior;

      const invokeFromServer: Promise<void> = device.invokeBehaviorCommand(IdentifyServer, 'identify', { identifyTime: 5 });
      await invokeFromServer;

      const invokeTriggerFromBehavior: Promise<void> = device.invokeBehaviorCommand(IdentifyBehavior, 'triggerEffect', {
        effectIdentifier: Identify.EffectIdentifier.Okay,
        effectVariant: Identify.EffectVariant.Default,
      });
      await invokeTriggerFromBehavior;

      const invokeFromCluster: Promise<void> = device.invokeBehaviorCommand(Identify, 'identify', { identifyTime: 5 });
      await invokeFromCluster;

      const invokeTriggerFromCluster: Promise<void> = device.invokeBehaviorCommand(Identify, 'triggerEffect', {
        effectIdentifier: Identify.EffectIdentifier.Blink,
        effectVariant: Identify.EffectVariant.Default,
      });
      await invokeTriggerFromCluster;

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for Behavior.Type command overload
        device.invokeBehaviorCommand(IdentifyBehavior, 'moveToLevel', { level: 1 });
        // @ts-expect-error intentional type-check guard for Behavior.Type server command overload
        device.invokeBehaviorCommand(IdentifyServer, 'moveToLevel', { level: 1 });
        // @ts-expect-error intentional type-check guard for Behavior.Type payload overload
        device.invokeBehaviorCommand(IdentifyBehavior, 'identify', { effectIdentifier: Identify.EffectIdentifier.Blink });
        // @ts-expect-error intentional type-check guard for Behavior.Type server payload overload
        device.invokeBehaviorCommand(IdentifyServer, 'identify', { effectIdentifier: Identify.EffectIdentifier.Blink });
        // @ts-expect-error intentional type-check guard for ClusterType command overload
        device.invokeBehaviorCommand(Identify, 'moveToLevel', { level: 1 });
        // @ts-expect-error intentional type-check guard for ClusterType payload overload
        device.invokeBehaviorCommand(Identify, 'triggerEffect', { identifyTime: 5 });
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidInvokeType: Promise<boolean> = device.invokeBehaviorCommand(IdentifyBehavior, 'identify', { identifyTime: 5 });
        // @ts-expect-error intentional type-check guard for typed server return value
        const invalidServerInvokeType: Promise<boolean> = device.invokeBehaviorCommand(IdentifyServer, 'identify', { identifyTime: 5 });
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidClusterInvokeType: Promise<boolean> = device.invokeBehaviorCommand(Identify, 'identify', { identifyTime: 5 });
        void invalidInvokeType;
        void invalidServerInvokeType;
        void invalidClusterInvokeType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('triggerEvent type checks', async () => {
    const device = new MatterbridgeEndpoint(genericSwitch, { id: 'GenericSwitchTriggerEventTypeCheck', number: EndpointNumber(907) }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultSwitchClusterServer();
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const triggerFromBehavior: boolean = await device.triggerEvent(
        SwitchServer.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress),
        'initialPress',
        { newPosition: 1 },
        device.log,
      );
      expect(triggerFromBehavior).toBe(true);

      const triggerFromCluster: boolean = await device.triggerEvent(Switch, 'initialPress', { newPosition: 1 }, device.log);
      expect(triggerFromCluster).toBe(true);

      const triggerFromClusterId: boolean = await device.triggerEvent(Switch.id, 'initialPress', { newPosition: 1 }, device.log);
      expect(triggerFromClusterId).toBe(true);

      const triggerFromString: boolean = await device.triggerEvent('Switch', 'initialPress', { newPosition: 1 }, device.log);
      expect(triggerFromString).toBe(true);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // Feature-gated event with proper feature selection will not fail type checks
        device
          .eventsOf(
            SwitchServer.with(
              Switch.Feature.MomentarySwitch,
              Switch.Feature.MomentarySwitchRelease,
              Switch.Feature.MomentarySwitchLongPress,
              Switch.Feature.MomentarySwitchMultiPress,
            ).enable({
              events: { initialPress: true, longPress: true, shortRelease: true, longRelease: true, multiPressOngoing: true, multiPressComplete: true },
            }),
          )
          .initialPress.emit({ newPosition: 1 }, {} as any);
        // @ts-expect-error intentional type-check error for feature-gated event without feature selection
        device.eventsOf(SwitchServer).initialPress.emit({ newPosition: 1 }, {} as any);
        // @ts-expect-error intentional type-check guard for Behavior.Type event overload
        device.triggerEvent(SwitchServer, 'identify', { identifyTime: 5 }, device.log);
        // @ts-expect-error intentional type-check guard for Behavior.Type payload overload
        device.triggerEvent(SwitchServer, 'initialPress', { previousPosition: 1 }, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType event overload
        device.triggerEvent(Switch, 'identify', { identifyTime: 5 }, device.log);
        // @ts-expect-error intentional type-check guard for ClusterType payload overload
        device.triggerEvent(Switch, 'initialPress', { previousPosition: 1 }, device.log);
        // @ts-expect-error intentional type-check guard for typed return value
        const invalidTriggerType: Promise<string> = device.triggerEvent(SwitchServer, 'initialPress', { newPosition: 1 }, device.log);
        // @ts-expect-error intentional type-check guard for typed cluster return value
        const invalidClusterTriggerType: Promise<string> = device.triggerEvent(Switch, 'initialPress', { newPosition: 1 }, device.log);
        void invalidTriggerType;
        void invalidClusterTriggerType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });

  test('feature-gated behavior typing checks', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorPowerSourceTypeCheck', number: EndpointNumber(908) }, true);
    expect(device).toBeDefined();
    device.createDefaultPowerSourceBatteryClusterServer();
    expect(await addDevice(aggregator, device)).toBe(true);
    try {
      const batteryBehavior = PowerSourceBehavior.with(PowerSource.Feature.Battery);
      const wiredBehavior = PowerSourceBehavior.with(PowerSource.Feature.Wired);

      const chargeLevel: PowerSource.BatChargeLevel | undefined = device.getAttribute(batteryBehavior, 'batChargeLevel', device.log);
      expect(chargeLevel).toBe(PowerSource.BatChargeLevel.Ok);

      const setBatteryChargeLevel: boolean = await device.setAttribute(batteryBehavior, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, device.log);
      expect(setBatteryChargeLevel).toBe(true);

      const batteryCluster:
        | {
            status: PowerSource.PowerSourceStatus;
            order: number;
            description: string;
            endpointList: EndpointNumber[];
            batChargeLevel: PowerSource.BatChargeLevel;
            batReplacementNeeded: boolean;
            batReplaceability: PowerSource.BatReplaceability;
          }
        | undefined = device.getCluster(batteryBehavior, device.log);
      expect(batteryCluster?.batChargeLevel).toBe(PowerSource.BatChargeLevel.Warning);
      expect(batteryCluster?.batReplaceability).toBe(PowerSource.BatReplaceability.Unspecified);

      if (await Promise.resolve(process.env.MATTERBRIDGE_TYPECHECK_NEGATIVE === '1')) {
        // @ts-expect-error intentional type-check guard for missing Behavior.with feature selection
        device.getAttribute(PowerSourceBehavior, 'batChargeLevel', device.log);
        // @ts-expect-error intentional type-check guard for wrong feature selection
        device.getAttribute(wiredBehavior, 'batChargeLevel', device.log);
        // @ts-expect-error intentional type-check guard for unavailable wired attribute on battery feature set
        device.getAttribute(batteryBehavior, 'wiredCurrentType', device.log);
        // @ts-expect-error intentional type-check guard for typed feature-gated value
        device.setAttribute(batteryBehavior, 'batChargeLevel', PowerSource.WiredCurrentType.Ac, device.log);
        // @ts-expect-error intentional type-check guard for typed feature-gated cluster payload
        device.setCluster(batteryBehavior, { status: PowerSource.PowerSourceStatus.Active, order: 0, description: 'Battery power', endpointList: [] }, device.log);
        // @ts-expect-error intentional type-check guard for typed feature-gated cluster return value
        const invalidBatteryClusterType: { wiredCurrentType: PowerSource.WiredCurrentType } | undefined = device.getCluster(batteryBehavior, device.log);
        void invalidBatteryClusterType;
      }
    } finally {
      await deleteDevice(aggregator, device);
    }
  });
});
