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
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  flushServerNode,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerWarnSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { BasicVideoPlayer } from '../../src/devices/basicVideoPlayer.js';
import { ContentApp } from '../../src/devices/contentApp.js';
import {
  createDefaultMediaBindingClusterServer,
  createDefaultMediaPowerSourceClusterServer,
  type MediaPowerSourceType,
  MatterbridgeMediaPlaybackServer,
  MatterbridgeKeypadInputServer,
  MatterbridgeApplicationLauncherServer,
} from '../../src/devices/mediaHelpers.js';
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

    const registeredClientList = device.getClusterServerOptions(MatterbridgeBindingServer)?.clientList;
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

    const registeredClientList = unmappedDevice.getClusterServerOptions(MatterbridgeBindingServer)?.clientList;
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

  test('should emit completed media commands after awaited plugin forwarding', async () => {
    const player = new BasicVideoPlayer('Observed Player', 'MEDIA-OBS', { onOff: true });
    const app = new ContentApp('Observed App', 'APP-OBS');
    await addDevice(server, player);
    await addDevice(server, app);
    const order: string[] = [];
    const request0 = {};
    player.addCommandHandler('MediaPlayback.play', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request0);
      await Promise.resolve();
      order.push('forwarded:play');
    });
    player.subscribeCommand(MediaPlayback, 'play', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request0);
      order.push('emitted:play');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).play())).toMatchObject({ status: MediaPlayback.Status.Success });
    expect(player.stateOf(MatterbridgeMediaPlaybackServer).currentState).toBe(MediaPlayback.PlaybackState.Playing);
    const request1 = {};
    player.addCommandHandler('MediaPlayback.pause', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request1);
      await Promise.resolve();
      order.push('forwarded:pause');
    });
    player.subscribeCommand(MediaPlayback, 'pause', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request1);
      order.push('emitted:pause');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).pause())).toMatchObject({ status: MediaPlayback.Status.Success });
    expect(player.stateOf(MatterbridgeMediaPlaybackServer).currentState).toBe(MediaPlayback.PlaybackState.Paused);
    const request2 = {};
    player.addCommandHandler('MediaPlayback.stop', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request2);
      await Promise.resolve();
      order.push('forwarded:stop');
    });
    player.subscribeCommand(MediaPlayback, 'stop', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request2);
      order.push('emitted:stop');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).stop())).toMatchObject({ status: MediaPlayback.Status.Success });
    expect(player.stateOf(MatterbridgeMediaPlaybackServer).currentState).toBe(MediaPlayback.PlaybackState.NotPlaying);
    const request3 = {};
    player.addCommandHandler('MediaPlayback.previous', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request3);
      await Promise.resolve();
      order.push('forwarded:previous');
    });
    player.subscribeCommand(MediaPlayback, 'previous', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request3);
      order.push('emitted:previous');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).previous())).toMatchObject({ status: MediaPlayback.Status.Success });
    const request4 = {};
    player.addCommandHandler('MediaPlayback.next', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request4);
      await Promise.resolve();
      order.push('forwarded:next');
    });
    player.subscribeCommand(MediaPlayback, 'next', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request4);
      order.push('emitted:next');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).next())).toMatchObject({ status: MediaPlayback.Status.Success });
    const request5 = { deltaPositionMilliseconds: 1000 };
    player.addCommandHandler('MediaPlayback.skipForward', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request5);
      await Promise.resolve();
      order.push('forwarded:skipForward');
    });
    player.subscribeCommand(MediaPlayback, 'skipForward', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request5);
      order.push('emitted:skipForward');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).skipForward(request5))).toMatchObject({ status: MediaPlayback.Status.Success });
    const request6 = { deltaPositionMilliseconds: 1000 };
    player.addCommandHandler('MediaPlayback.skipBackward', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request6);
      await Promise.resolve();
      order.push('forwarded:skipBackward');
    });
    player.subscribeCommand(MediaPlayback, 'skipBackward', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request6);
      order.push('emitted:skipBackward');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeMediaPlaybackServer).skipBackward(request6))).toMatchObject({ status: MediaPlayback.Status.Success });
    const request7 = { keyCode: KeypadInput.CecKeyCode.Down };
    player.addCommandHandler('KeypadInput.sendKey', async (data) => {
      expect(data.endpoint).toBe(player);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request7);
      await Promise.resolve();
      order.push('forwarded:sendKey');
    });
    player.subscribeCommand(KeypadInput, 'sendKey', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request7);
      order.push('emitted:sendKey');
    });
    expect(await player.act(async (agent) => agent.get(MatterbridgeKeypadInputServer).sendKey(request7))).toMatchObject({ status: KeypadInput.Status.Success });
    const request8 = {};
    app.addCommandHandler('ApplicationLauncher.launchApp', async (data) => {
      expect(data.endpoint).toBe(app);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request8);
      await Promise.resolve();
      order.push('forwarded:launchApp');
    });
    app.subscribeCommand(ApplicationLauncher, 'launchApp', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request8);
      order.push('emitted:launchApp');
    });
    expect(await app.act(async (agent) => agent.get(MatterbridgeApplicationLauncherServer).launchApp(request8))).toMatchObject({ status: ApplicationLauncher.Status.Success });
    const request9 = {};
    app.addCommandHandler('ApplicationLauncher.stopApp', async (data) => {
      expect(data.endpoint).toBe(app);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request9);
      await Promise.resolve();
      order.push('forwarded:stopApp');
    });
    app.subscribeCommand(ApplicationLauncher, 'stopApp', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request9);
      order.push('emitted:stopApp');
    });
    expect(await app.act(async (agent) => agent.get(MatterbridgeApplicationLauncherServer).stopApp(request9))).toMatchObject({ status: ApplicationLauncher.Status.Success });
    const request10 = {};
    app.addCommandHandler('ApplicationLauncher.hideApp', async (data) => {
      expect(data.endpoint).toBe(app);
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request10);
      await Promise.resolve();
      order.push('forwarded:hideApp');
    });
    app.subscribeCommand(ApplicationLauncher, 'hideApp', (data) => {
      expect(data.context).toBeDefined();
      expect(data.request).toEqual(request10);
      order.push('emitted:hideApp');
    });
    expect(await app.act(async (agent) => agent.get(MatterbridgeApplicationLauncherServer).hideApp(request10))).toMatchObject({ status: ApplicationLauncher.Status.Success });
    expect(order).toEqual([
      'forwarded:play',
      'emitted:play',
      'forwarded:pause',
      'emitted:pause',
      'forwarded:stop',
      'emitted:stop',
      'forwarded:previous',
      'emitted:previous',
      'forwarded:next',
      'emitted:next',
      'forwarded:skipForward',
      'emitted:skipForward',
      'forwarded:skipBackward',
      'emitted:skipBackward',
      'forwarded:sendKey',
      'emitted:sendKey',
      'forwarded:launchApp',
      'emitted:launchApp',
      'forwarded:stopApp',
      'emitted:stopApp',
      'forwarded:hideApp',
      'emitted:hideApp',
    ]);
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
