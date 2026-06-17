// src\helpers.test.ts

/* eslint-disable no-console */

const NAME = 'Helpers';
const MATTER_PORT = 6600;
const MATTER_CREATE_ONLY = true;

import type { Endpoint } from '@matter/node';
import { BindingServer, BridgedDeviceBasicInformationServer, DescriptorServer, OnOffServer } from '@matter/node/behaviors';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { consoleLogSpy, log, setDebug, setupTest } from '@matterbridge/vitest-utils';
import {
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMatterbridge,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { addVirtualDevice, addVirtualDevices } from '../src/helpers.js';
import type { Matterbridge } from '../src/matterbridge.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let matterbridge: Matterbridge;
  let device: Endpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();

    matterbridge = { ...getMatterbridge(), log: log } as Matterbridge;
  }, 30000);

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug mode after each test
    await setDebug(false);
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  }, 30000);

  test('add a light virtual device', async () => {
    expect(aggregator).toBeDefined();
    // oxlint-disable-next-line typescript/require-await
    device = await addVirtualDevice(aggregator, 'Test Device', 'light', async () => {
      // Callback function when the device is turned on
      console.log('Device turned on');
    });
    expect(device).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.id).toBe('TestDevice:light');
    expect(device.stateOf(BridgedDeviceBasicInformationServer).nodeLabel).toBe('Test Device');
    expect(device.stateOf(OnOffServer).onOff).toBe(false);
    expect(aggregator.parts.has('TestDevice:light')).toBeTruthy();
    expect(aggregator.parts.size).toBe(1);
  });

  test('send command to the virtual device', async () => {
    expect(device).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      // oxlint-disable-next-line typescript/explicit-function-return-type
      const listener = (value: boolean) => {
        if (value) {
          (device as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (device as any).events.onOff.onOff$Changed.on(listener);
      void device.setStateOf(OnOffServer, { onOff: true });
    });
    // expect(await invokeBehaviorCommand(device as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(consoleLogSpy).toHaveBeenCalledWith('Device turned on');
    expect(device.stateOf(OnOffServer).onOff).toBe(false);
  });

  test('should not add the virtual devices', async () => {
    matterbridge.virtualMode = 'disabled';
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.size).toBe(1);
  });

  test('add all the light virtual devices', async () => {
    matterbridge.virtualMode = 'light';
    matterbridge.bridgeMode = 'bridge';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('TestDevice:light')).toBeTruthy();
    expect(aggregator.parts.has('UpdateMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:light')).toBeFalsy();
    expect(aggregator.parts.size).toBe(3);
  });

  test('add all the outlet virtual devices', async () => {
    matterbridge.virtualMode = 'outlet';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:outlet')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:outlet')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:outlet')).toBeFalsy();
    expect(aggregator.parts.size).toBe(5);
  });

  test('add all the switch virtual devices', async () => {
    matterbridge.virtualMode = 'switch';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:switch')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:switch')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:switch')).toBeFalsy();
    expect(aggregator.parts.size).toBe(7);

    // Logger.get('AggregatorNode').info(aggregator);
    expect(aggregator.parts.get('UpdateMatterbridge:switch')?.behaviors.has(BindingServer)).toBeTruthy();
    expect(aggregator.parts.get('UpdateMatterbridge:switch')?.stateOf(DescriptorServer).clientList).toEqual([Identify.id, OnOff.id]);
    expect(aggregator.parts.get('RestartMatterbridge:switch')?.behaviors.has(BindingServer)).toBeTruthy();
    expect(aggregator.parts.get('RestartMatterbridge:switch')?.stateOf(DescriptorServer).clientList).toEqual([Identify.id, OnOff.id]);
  });

  test('add all the mounted-switch virtual devices', async () => {
    matterbridge.virtualMode = 'mounted_switch';
    expect(matterbridge.log).toBeDefined();
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:mounted_switch')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:mounted_switch')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:mounted_switch')).toBeFalsy();
    expect(aggregator.parts.size).toBe(9);

    // await setDebug(true);
    // Logger.get('AggregatorNode').info(aggregator);

    expect(aggregator.parts.get('UpdateMatterbridge:mounted_switch')?.behaviors.has(BindingServer)).toBeFalsy();
    expect(aggregator.parts.get('UpdateMatterbridge:mounted_switch')?.stateOf(DescriptorServer).clientList).toEqual([]);
    // expect(aggregator.parts.get('UpdateMatterbridge:mounted_switch')?.stateOf(DescriptorServer).deviceTypeList).toEqual([{}]);
    expect(aggregator.parts.get('RestartMatterbridge:mounted_switch')?.behaviors.has(BindingServer)).toBeFalsy();
    expect(aggregator.parts.get('RestartMatterbridge:mounted_switch')?.stateOf(DescriptorServer).clientList).toEqual([]);
    // expect(aggregator.parts.get('RestartMatterbridge:mounted_switch')?.stateOf(DescriptorServer).deviceTypeList).toEqual([{}]);
  });

  test('send command restart to the virtual device', async () => {
    await setDebug(false);
    const restartDevice = aggregator.parts.get('RestartMatterbridge:light');
    expect(restartDevice).toBeDefined();
    if (!restartDevice) return;
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      // oxlint-disable-next-line typescript/explicit-function-return-type
      const listener = (value: boolean) => {
        if (value) {
          (restartDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (restartDevice as any).events.onOff.onOff$Changed.on(listener);
      void restartDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);

    matterbridge.restartMode = 'service';
    await new Promise<void>((resolve) => {
      // oxlint-disable-next-line typescript/explicit-function-return-type
      const listener = (value: boolean) => {
        if (value) {
          (restartDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (restartDevice as any).events.onOff.onOff$Changed.on(listener);
      void restartDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);
  });

  test('send command update to the virtual device', async () => {
    const updateDevice = aggregator.parts.get('UpdateMatterbridge:light');
    expect(updateDevice).toBeDefined();
    if (!updateDevice) return;
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      const listener = (value: boolean): void => {
        if (value) {
          (updateDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (updateDevice as any).events.onOff.onOff$Changed.on(listener);
      void updateDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);
  });
});
