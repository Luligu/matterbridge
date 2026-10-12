/**
 * @file packages/core/buntest/devices/contentApp.test.ts
 * @description This file contains the tests for the ContentApp device.
 * @author Luca Liguori
 */

const NAME = 'ContentApp';
const MATTER_PORT = 8026;
const MATTER_CREATE_ONLY = true;

// @matter
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';

import { ApplicationBasicServer } from '@matter/node/behaviors/application-basic';
import { ApplicationLauncherServer } from '@matter/node/behaviors/application-launcher';
import { KeypadInputServer } from '@matter/node/behaviors/keypad-input';
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { ApplicationLauncher } from '@matter/types/clusters/application-launcher';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { PowerSource } from '@matter/types/clusters/power-source';
import { VendorId } from '@matter/types/datatype';
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
} from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel, stringify } from 'node-ansi-logger';

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
    await createServerNode(MATTER_PORT, contentApp.code, 0, 0, 0);
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
    expect(await addDevice(server, device, 0, 0, 0, 0)).toBeTruthy();
  });

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'applicationBasic(0x50d).acceptedCommandList(0xfff9)=[  ]',
        'applicationBasic(0x50d).allowedVendorList(0x7)=[ 65521 ]',
        "applicationBasic(0x50d).application(0x4)={ catalogVendorId: 65521, applicationId: 'matterbridge-content-app' }",
        "applicationBasic(0x50d).applicationName(0x2)='ContentApp Test Device'",
        "applicationBasic(0x50d).applicationVersion(0x6)='1.0.0'",
        'applicationBasic(0x50d).attributeList(0xfffb)=[ 2, 4, 5, 6, 7, 65528, 65529, 65531, 65532, 65533 ]',
        'applicationBasic(0x50d).clusterRevision(0xfffd)=1',
        'applicationBasic(0x50d).featureMap(0xfffc)={  }',
        'applicationBasic(0x50d).generatedCommandList(0xfff8)=[  ]',
        'applicationBasic(0x50d).status(0x5)=1',
        'applicationLauncher(0x50c).acceptedCommandList(0xfff9)=[ 0, 1, 2 ]',
        'applicationLauncher(0x50c).attributeList(0xfffb)=[ 1, 65528, 65529, 65531, 65532, 65533 ]',
        'applicationLauncher(0x50c).clusterRevision(0xfffd)=2',
        'applicationLauncher(0x50c).currentApp(0x1)=null',
        'applicationLauncher(0x50c).featureMap(0xfffc)={ applicationPlatform: false }',
        'applicationLauncher(0x50c).generatedCommandList(0xfff8)=[ 3 ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 36, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 47, 1289, 1292, 1293 ]',
        'keypadInput(0x509).acceptedCommandList(0xfff9)=[ 0 ]',
        'keypadInput(0x509).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'keypadInput(0x509).clusterRevision(0xfffd)=1',
        'keypadInput(0x509).featureMap(0xfffc)={ navigationKeyCodes: false, locationKeys: false, numberKeys: false }',
        'keypadInput(0x509).generatedCommandList(0xfff8)=[ 1 ]',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].toSorted(),
    );
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
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeKeypadInputServer: sendKey keyCode ${KeypadInput.CecKeyCode.Down} (endpoint ${device.id}.${device.number})`,
    );

    vi.clearAllMocks();
    const launchAppResponse = await device.act(async (agent) => agent.get(ApplicationLauncherServer).launchApp({}));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeApplicationLauncherServer: launchApp (endpoint ${device.id}.${device.number})`);
    expect(launchAppResponse).toEqual({ status: ApplicationLauncher.Status.Success });

    vi.clearAllMocks();
    const stopAppResponse = await device.act(async (agent) => agent.get(ApplicationLauncherServer).stopApp({}));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeApplicationLauncherServer: stopApp (endpoint ${device.id}.${device.number})`);
    expect(stopAppResponse).toEqual({ status: ApplicationLauncher.Status.Success });

    vi.clearAllMocks();
    const hideAppResponse = await device.act(async (agent) => agent.get(ApplicationLauncherServer).hideApp({}));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeApplicationLauncherServer: hideApp (endpoint ${device.id}.${device.number})`);
    expect(hideAppResponse).toEqual({ status: ApplicationLauncher.Status.Success });
  });

  test('remove the content app device', async () => {
    expect(await deleteDevice(server, device, 0, 0, 0, 0)).toBeTruthy();
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode(0, 0, 0, 0);
    else await stopServerNode();
  });
});
