/**
 * @file packages/core/vitest/devices/mediaHelpers.test.ts
 * @description This file contains the tests for the mediaHelpers shared by Chapter 10 Media Device Types.
 * @author Luca Liguori
 */

const NAME = 'MediaHelpers';
const MATTER_PORT = 8029;
const MATTER_CREATE_ONLY = true;

// @matter
import { AccountLoginClient } from '@matter/node/behaviors/account-login';
import { ApplicationBasicClient } from '@matter/node/behaviors/application-basic';
import { ApplicationLauncherClient } from '@matter/node/behaviors/application-launcher';
import { AudioOutputClient } from '@matter/node/behaviors/audio-output';
import { ChannelClient } from '@matter/node/behaviors/channel';
import { ContentAppObserverClient } from '@matter/node/behaviors/content-app-observer';
import { ContentControlClient } from '@matter/node/behaviors/content-control';
import { ContentLauncherClient } from '@matter/node/behaviors/content-launcher';
import { KeypadInputClient } from '@matter/node/behaviors/keypad-input';
import { LevelControlClient } from '@matter/node/behaviors/level-control';
import { LowPowerClient } from '@matter/node/behaviors/low-power';
import { MediaInputClient } from '@matter/node/behaviors/media-input';
import { MediaPlaybackClient } from '@matter/node/behaviors/media-playback';
import { MessagesClient } from '@matter/node/behaviors/messages';
import { OnOffClient } from '@matter/node/behaviors/on-off';
import { TargetNavigatorClient } from '@matter/node/behaviors/target-navigator';
import { WakeOnLanClient } from '@matter/node/behaviors/wake-on-lan';
import { AccountLogin } from '@matter/types/clusters/account-login';
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { ApplicationLauncher } from '@matter/types/clusters/application-launcher';
import { AudioOutput } from '@matter/types/clusters/audio-output';
import { Channel } from '@matter/types/clusters/channel';
import { ContentAppObserver } from '@matter/types/clusters/content-app-observer';
import { ContentControl } from '@matter/types/clusters/content-control';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { Identify } from '@matter/types/clusters/identify';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { LevelControl } from '@matter/types/clusters/level-control';
import { LowPower } from '@matter/types/clusters/low-power';
import { MediaInput } from '@matter/types/clusters/media-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { Messages } from '@matter/types/clusters/messages';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { TargetNavigator } from '@matter/types/clusters/target-navigator';
import { WakeOnLan } from '@matter/types/clusters/wake-on-lan';
import type { ClusterId } from '@matter/types/datatype';
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
import { createDefaultMediaBindingClusterServer, createDefaultMediaPowerSourceClusterServer, type MediaPowerSourceType } from '../../src/devices/mediaHelpers.js';
import { castingVideoClient, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Every client cluster used (required or optional) across all Chapter 10 device types.
const allMediaClientClusters: { id: ClusterId; key: string; client: unknown }[] = [
  { id: OnOff.id, key: 'onOff', client: OnOffClient },
  { id: KeypadInput.id, key: 'keypadInput', client: KeypadInputClient },
  { id: MediaPlayback.id, key: 'mediaPlayback', client: MediaPlaybackClient },
  { id: ContentLauncher.id, key: 'contentLauncher', client: ContentLauncherClient },
  { id: ApplicationBasic.id, key: 'applicationBasic', client: ApplicationBasicClient },
  { id: LevelControl.id, key: 'levelControl', client: LevelControlClient },
  { id: Messages.id, key: 'messages', client: MessagesClient },
  { id: WakeOnLan.id, key: 'wakeOnLan', client: WakeOnLanClient },
  { id: Channel.id, key: 'channel', client: ChannelClient },
  { id: TargetNavigator.id, key: 'targetNavigator', client: TargetNavigatorClient },
  { id: MediaInput.id, key: 'mediaInput', client: MediaInputClient },
  { id: LowPower.id, key: 'lowPower', client: LowPowerClient },
  { id: AudioOutput.id, key: 'audioOutput', client: AudioOutputClient },
  { id: ApplicationLauncher.id, key: 'applicationLauncher', client: ApplicationLauncherClient },
  { id: AccountLogin.id, key: 'accountLogin', client: AccountLoginClient },
  { id: ContentControl.id, key: 'contentControl', client: ContentControlClient },
  { id: ContentAppObserver.id, key: 'contentAppObserver', client: ContentAppObserverClient },
];

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

  test('createDefaultMediaBindingClusterServer resolves every mapped media client cluster', () => {
    device = new MatterbridgeEndpoint([castingVideoClient, powerSource], { id: 'MediaHelpersTestDevice' });
    device.createDefaultBasicInformationClusterServer('MediaHelpers Test Device', 'MH123456', 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Media Helpers Test Device');

    const clientList = allMediaClientClusters.map((c) => c.id);
    createDefaultMediaBindingClusterServer(device, clientList);

    const registeredClientList = (device.getClusterServerOptions(MatterbridgeBindingServer) as { clientList?: ClusterId[] } | undefined)?.clientList;
    for (const { id, key, client } of allMediaClientClusters) {
      expect(registeredClientList).toContain(id);
      expect(device.type.clientClusters[key]).toBe(client);
    }
  });

  test('createDefaultMediaBindingClusterServer skips clientClusters for an unmapped cluster ID', () => {
    // Identify is not in mediaClientBehaviors: it's registered in the Binding clientList (bookkeeping still
    // happens), but no entry is added to endpoint.type.clientClusters since there's no known client Behavior.Type.
    const unmappedDevice = new MatterbridgeEndpoint([castingVideoClient, powerSource], { id: 'MediaHelpersUnmappedDevice' });
    createDefaultMediaBindingClusterServer(unmappedDevice, [Identify.id]);

    const registeredClientList = (unmappedDevice.getClusterServerOptions(MatterbridgeBindingServer) as { clientList?: ClusterId[] } | undefined)?.clientList;
    expect(registeredClientList).toContain(Identify.id);
    expect(unmappedDevice.type.clientClusters['identify']).toBeUndefined();
  });

  test('createDefaultMediaPowerSourceClusterServer creates the matching Power Source cluster server', () => {
    // Each power source type sets a distinct attribute that the others don't, so checking for its presence
    // confirms the right createDefaultPowerSource*ClusterServer() overload was invoked.
    const cases: { powerSourceType: MediaPowerSourceType; distinguishingKey: string }[] = [
      { powerSourceType: 'Rechargeable', distinguishingKey: 'batTimeRemaining' },
      { powerSourceType: 'Replaceable', distinguishingKey: 'batReplacementDescription' },
      { powerSourceType: 'Battery', distinguishingKey: 'batChargeLevel' },
      { powerSourceType: 'Wired', distinguishingKey: 'wiredCurrentType' },
    ];
    for (const { powerSourceType, distinguishingKey } of cases) {
      const testDevice = new MatterbridgeEndpoint([castingVideoClient, powerSource], { id: `MediaHelpersPower${powerSourceType}` });
      createDefaultMediaPowerSourceClusterServer(testDevice, powerSourceType);
      expect(testDevice.hasClusterServer(PowerSource.id)).toBeTruthy();
      expect(testDevice.getClusterServerOptions(PowerSource.id)).toHaveProperty(distinguishingKey);
    }

    // 'None' is a no-op: no Power Source cluster server is created.
    const noneDevice = new MatterbridgeEndpoint([castingVideoClient], { id: 'MediaHelpersPowerNone' });
    createDefaultMediaPowerSourceClusterServer(noneDevice, 'None');
    expect(noneDevice.hasClusterServer(PowerSource.id)).toBeFalsy();
  });

  test('add a media helpers test device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('remove the media helpers test device', async () => {
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
