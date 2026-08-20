/**
 * @file packages/core/vitest/devices/castingVideoClient.test.ts
 * @description This file contains the tests for the CastingVideoClient device.
 * @author Luca Liguori
 */

const NAME = 'CastingVideoClient';
const MATTER_PORT = 8027;
const MATTER_CREATE_ONLY = true;

// @matter
import { ApplicationBasicClient } from '@matter/node/behaviors/application-basic';
import { ContentLauncherClient } from '@matter/node/behaviors/content-launcher';
import { KeypadInputClient } from '@matter/node/behaviors/keypad-input';
import { OnOffClient } from '@matter/node/behaviors/on-off';
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { CastingVideoClient } from '../../src/devices/castingVideoClient.js';
import { castingVideoClient } from '../../src/matterbridgeDeviceTypes.js';
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
    await createServerNode(MATTER_PORT, castingVideoClient.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a casting video client device', () => {
    device = new CastingVideoClient('CastingVideoClient Test Device', 'CVC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('CastingVideoClientTestDevice-CVC123456');

    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    const clientList = (device.getClusterServerOptions(MatterbridgeBindingServer) as { clientList?: number[] } | undefined)?.clientList;
    expect(clientList).toContain(OnOff.id);
    expect(clientList).toContain(KeypadInput.id);
    expect(clientList).toContain(ContentLauncher.id);
    expect(clientList).toContain(ApplicationBasic.id);

    // createDefaultMediaBindingClusterServer populates endpoint.type.clientClusters directly, since these
    // client behaviors have no entry in matterbridgeEndpointHelpers.ts's generic lookup table.
    expect(device.type.clientClusters['onOff']).toBe(OnOffClient);
    expect(device.type.clientClusters['keypadInput']).toBe(KeypadInputClient);
    expect(device.type.clientClusters['contentLauncher']).toBe(ContentLauncherClient);
    expect(device.type.clientClusters['applicationBasic']).toBe(ApplicationBasicClient);
  });

  test('create a casting video client device with powerSourceType None', () => {
    const noneDevice = new CastingVideoClient('CastingVideoClient None Device', 'CVC000001', { powerSourceType: 'None' });
    expect(noneDevice.hasClusterServer(PowerSource.id)).toBeFalsy();
  });

  test('add a casting video client device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('remove the casting video client device', async () => {
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
