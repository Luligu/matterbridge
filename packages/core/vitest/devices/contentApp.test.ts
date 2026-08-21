/**
 * @file packages/core/vitest/devices/contentApp.test.ts
 * @description This file contains the tests for the ContentApp device.
 * @author Luca Liguori
 */

const NAME = 'ContentApp';
const MATTER_PORT = 8026;
const MATTER_CREATE_ONLY = true;

// @matter
import { ApplicationBasicServer } from '@matter/node/behaviors/application-basic';
import { ApplicationLauncherServer } from '@matter/node/behaviors/application-launcher';
import { KeypadInputServer } from '@matter/node/behaviors/keypad-input';
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { ApplicationLauncher } from '@matter/types/clusters/application-launcher';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { PowerSource } from '@matter/types/clusters/power-source';
import { VendorId } from '@matter/types/datatype';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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
} from '@matterbridge/vitest-utils/matter';
import { LogLevel } from 'node-ansi-logger';

import { ContentApp } from '../../src/devices/contentApp.js';
import { contentApp } from '../../src/matterbridgeDeviceTypes.js';
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
    await createServerNode(MATTER_PORT, contentApp.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a content app device (defaults)', () => {
    device = new ContentApp('ContentApp Test Device', 'CA123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ContentAppTestDevice-CA123456');

    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(KeypadInput.id)).toBeTruthy();
    expect(device.hasClusterServer(ApplicationLauncher.id)).toBeTruthy();
    expect(device.hasClusterServer(ApplicationBasic.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'powerSource', 'keypadInput', 'applicationLauncher', 'applicationBasic']);

    expect(device.getClusterServerOptions(ApplicationBasic.id)).toEqual({
      applicationName: 'ContentApp Test Device',
      application: new ApplicationBasic.Application({ catalogVendorId: 0xfff1, applicationId: 'matterbridge-content-app' }),
      status: ApplicationBasic.ApplicationStatus.ActiveVisibleFocus,
      applicationVersion: '1.0.0',
      allowedVendorList: [VendorId(0xfff1)],
    });
    expect(device.getClusterServerOptions(ApplicationLauncher.id)).toEqual({ currentApp: null });
  });

  test('create a content app device (custom options)', () => {
    const custom = new ContentApp('Custom Content App', 'CA654321', {
      applicationName: 'Custom App',
      catalogVendorId: 0x1234,
      applicationId: 'custom-app',
      status: ApplicationBasic.ApplicationStatus.ActiveHidden,
      applicationVersion: '2.0.0',
      allowedVendorList: [VendorId(0x1234)],
    });
    expect(custom.getClusterServerOptions(ApplicationBasic.id)).toEqual({
      applicationName: 'Custom App',
      application: new ApplicationBasic.Application({ catalogVendorId: 0x1234, applicationId: 'custom-app' }),
      status: ApplicationBasic.ApplicationStatus.ActiveHidden,
      applicationVersion: '2.0.0',
      allowedVendorList: [VendorId(0x1234)],
    });
  });

  test('create a content app device with powerSourceType None', () => {
    const noneDevice = new ContentApp('ContentApp None Device', 'CA000001', { powerSourceType: 'None' });
    expect(noneDevice.hasClusterServer(PowerSource.id)).toBeFalsy();
  });

  test('add a content app device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('invoke commands', async () => {
    expect(device.behaviors.has(KeypadInputServer)).toBeTruthy();
    expect(device.behaviors.has(ApplicationLauncherServer)).toBeTruthy();
    expect(device.behaviors.has(ApplicationBasicServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(KeypadInputServer).commands.has('sendKey')).toBeTruthy();
    expect(device.behaviors.elementsOf(ApplicationLauncherServer).commands.has('launchApp')).toBeTruthy();
    expect(device.behaviors.elementsOf(ApplicationLauncherServer).commands.has('stopApp')).toBeTruthy();
    expect(device.behaviors.elementsOf(ApplicationLauncherServer).commands.has('hideApp')).toBeTruthy();

    vi.clearAllMocks();
    await device.invokeBehaviorCommand('keypadInput', 'KeypadInput.sendKey', { keyCode: KeypadInput.CecKeyCode.Down });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `SendKey keyCode ${KeypadInput.CecKeyCode.Down} (endpoint ${device.id}.${device.number})`);

    vi.clearAllMocks();
    const launchAppResponse = await device.act(async (agent) => agent.get(ApplicationLauncherServer).launchApp({}));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `LaunchApp (endpoint ${device.id}.${device.number})`);
    expect(launchAppResponse).toEqual({ status: ApplicationLauncher.Status.Success });

    vi.clearAllMocks();
    const stopAppResponse = await device.act(async (agent) => agent.get(ApplicationLauncherServer).stopApp({}));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `StopApp (endpoint ${device.id}.${device.number})`);
    expect(stopAppResponse).toEqual({ status: ApplicationLauncher.Status.Success });

    vi.clearAllMocks();
    const hideAppResponse = await device.act(async (agent) => agent.get(ApplicationLauncherServer).hideApp({}));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `HideApp (endpoint ${device.id}.${device.number})`);
    expect(hideAppResponse).toEqual({ status: ApplicationLauncher.Status.Success });
  });

  test('remove the content app device', async () => {
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
