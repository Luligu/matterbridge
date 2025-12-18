// src\helpers.test.ts

/* eslint-disable no-console */
const MATTER_PORT = 6004;
const NAME = 'Helpers';
const HOMEDIR = path.join('jest', NAME);

// Mock the function getShellySysUpdate and getShellyMainUpdate
jest.unstable_mockModule('./shelly.js', () => ({
  getShelly: jest.fn(),
  postShelly: jest.fn(),
}));
// Load the mocked module
const { getShelly, postShelly } = await import('./shelly.js');
// Set the return value for the mocked functions
(getShelly as jest.MockedFunction<(api: string, timeout?: number) => Promise<void>>).mockResolvedValue();
(postShelly as jest.MockedFunction<(api: string, data: any, timeout?: number) => Promise<void>>).mockResolvedValue();

import path from 'node:path';

import { jest } from '@jest/globals';
import { Logger } from '@matter/general';
import { Endpoint } from '@matter/node';
import { BridgedDeviceBasicInformationServer, OnOffServer } from '@matter/node/behaviors';

import { invokeBehaviorCommand } from './matterbridgeEndpointHelpers.js';
import { addVirtualDevice, addVirtualDevices } from './helpers.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { aggregator, consoleLogSpy, createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, matterbridge, server, setupTest, startMatterbridgeEnvironment, stopMatterbridgeEnvironment } from './jestutils/jestHelpers.js';
import { Matterbridge } from './matterbridge.js';

const shutdownProcessSpy = jest.spyOn(Matterbridge.prototype, 'shutdownProcess').mockImplementation(async () => {
  console.log('Mocked shutdownProcess called');
  return Promise.resolve();
});
const restartProcessSpy = jest.spyOn(Matterbridge.prototype, 'restartProcess').mockImplementation(async () => {
  console.log('Mocked restartProcess called');
  return Promise.resolve();
});
const updateProcessSpy = jest.spyOn(Matterbridge.prototype, 'updateProcess').mockImplementation(async () => {
  console.log('Mocked updateProcess called');
  return Promise.resolve();
});

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + HOMEDIR, () => {
  let device: Endpoint;

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('log the server node', async () => {
    expect(server).toBeDefined();
    Logger.get('ServerNode').info(server);
  });

  test('add a light virtual device', async () => {
    expect(aggregator).toBeDefined();
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
  });

  test('send command to the virtual device', async () => {
    expect(device).toBeDefined();
    expect(device.lifecycle.isReady).toBeTruthy();
    expect(device.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      const listener = (value: boolean) => {
        if (value === true) {
          (device as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (device as any).events.onOff.onOff$Changed.on(listener);
      device.setStateOf(OnOffServer, { onOff: true });
    });
    // expect(await invokeBehaviorCommand(device as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:outlet')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:outlet')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:outlet')).toBeFalsy();
    expect(aggregator.parts.size).toBe(5);
  });

  test('add all the switch virtual devices', async () => {
    matterbridge.virtualMode = 'switch';
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:switch')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:switch')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:switch')).toBeFalsy();
    expect(aggregator.parts.size).toBe(7);
  });

  test('add all the mounted-switch virtual devices', async () => {
    matterbridge.virtualMode = 'mounted_switch';
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('UpdateMatterbridge:mounted_switch')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:mounted_switch')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:mounted_switch')).toBeFalsy();
    expect(aggregator.parts.size).toBe(9);
  });

  test('send command restart to the virtual device', async () => {
    const restartDevice = aggregator.parts.get('RestartMatterbridge:light');
    expect(restartDevice).toBeDefined();
    if (!restartDevice) return;
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      const listener = (value: boolean) => {
        if (value === true) {
          (restartDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (restartDevice as any).events.onOff.onOff$Changed.on(listener);
      restartDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(restartProcessSpy).toHaveBeenCalled();
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);

    matterbridge.restartMode = 'service';
    await new Promise<void>((resolve) => {
      const listener = (value: boolean) => {
        if (value === true) {
          (restartDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (restartDevice as any).events.onOff.onOff$Changed.on(listener);
      restartDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(shutdownProcessSpy).toHaveBeenCalled();
    expect(restartDevice.stateOf(OnOffServer).onOff).toBe(false);
  });

  test('send command update to the virtual device', async () => {
    const updateDevice = aggregator.parts.get('UpdateMatterbridge:light');
    expect(updateDevice).toBeDefined();
    if (!updateDevice) return;
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);

    await new Promise<void>((resolve) => {
      const listener = (value: boolean) => {
        if (value === true) {
          (updateDevice as any).events.onOff.onOff$Changed.off(listener);
          resolve();
        }
      };
      (updateDevice as any).events.onOff.onOff$Changed.on(listener);
      updateDevice.setStateOf(OnOffServer, { onOff: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(matterbridge.updateProcess).toHaveBeenCalled();
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);

    // expect(await invokeBehaviorCommand(updateDevice as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
  });

  test('add all the virtual devices with shelly parameter', async () => {
    matterbridge.virtualMode = 'light';
    const restartDevice = aggregator.parts.get('RestartMatterbridge:light');
    await restartDevice?.delete();
    const updateDevice = aggregator.parts.get('UpdateMatterbridge:light');
    await updateDevice?.delete();

    process.argv.push('-shelly');
    expect(aggregator).toBeDefined();
    await addVirtualDevices(matterbridge, aggregator);
    expect(aggregator.parts.has('TestDevice:light')).toBeTruthy();
    expect(aggregator.parts.has('UpdateMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.has('RestartMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.has('RebootMatterbridge:light')).toBeTruthy();
    expect(aggregator.parts.size).toBe(10);
  });

  test('send command update to the shelly device', async () => {
    const updateDevice = aggregator.parts.get('UpdateMatterbridge:light');
    expect(updateDevice).toBeDefined();
    if (!updateDevice) return;
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);
    expect(await invokeBehaviorCommand(updateDevice as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(getShelly).toHaveBeenCalledWith('/api/updates/sys/perform', 10 * 1000);
    expect(getShelly).toHaveBeenCalledWith('/api/updates/main/perform', 10 * 1000);
    expect(updateDevice.stateOf(OnOffServer).onOff).toBe(false);

    jest.clearAllMocks();
    (getShelly as jest.MockedFunction<(api: string, timeout?: number) => Promise<void>>).mockRejectedValue(Error('Jest error'));
    expect(await invokeBehaviorCommand(updateDevice as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(getShelly).toHaveBeenCalledWith('/api/updates/sys/perform', 10 * 1000);
    expect(getShelly).toHaveBeenCalledWith('/api/updates/main/perform', 10 * 1000);
  });

  test('send command reboot to the shelly device', async () => {
    const rebootDevice = aggregator.parts.get('RebootMatterbridge:light');
    expect(rebootDevice).toBeDefined();
    if (!rebootDevice) return;
    expect(rebootDevice.stateOf(OnOffServer).onOff).toBe(false);
    expect(await invokeBehaviorCommand(rebootDevice as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(postShelly).toHaveBeenCalledWith('/api/system/reboot', {}, 60 * 1000);
    expect(rebootDevice.stateOf(OnOffServer).onOff).toBe(false);

    jest.clearAllMocks();
    (postShelly as jest.MockedFunction<(api: string, data: any, timeout?: number) => Promise<void>>).mockRejectedValue(Error('Jest error'));
    expect(await invokeBehaviorCommand(rebootDevice as unknown as MatterbridgeEndpoint, OnOffServer, 'on')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(postShelly).toHaveBeenCalledWith('/api/system/reboot', {}, 60 * 1000);
  });
});
