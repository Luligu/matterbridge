/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, BLUE, db, er, hk, LogLevel, or } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  airQualitySensor,
  bridgedNode,
  colorTemperatureLight,
  contactSensor,
  flowSensor,
  humiditySensor,
  lightSensor,
  occupancySensor,
  onOffLight,
  onOffOutlet,
  powerSource,
  pressureSensor,
  rainSensor,
  temperatureSensor,
  thermostatDevice,
} from './matterbridgeDeviceTypes.js';

// @matter
import { Lifecycle, EndpointNumber } from '@matter/main';
import {
  BooleanState,
  BooleanStateCluster,
  Descriptor,
  FixedLabel,
  FlowMeasurement,
  Groups,
  Identify,
  IlluminanceMeasurement,
  OccupancySensing,
  OnOff,
  PressureMeasurement,
  RelativeHumidityMeasurement,
  ScenesManagement,
  TemperatureMeasurement,
  Thermostat,
  UserLabel,
} from '@matter/main/clusters';
import {
  BooleanStateBehavior,
  BooleanStateServer,
  ColorControlBehavior,
  DescriptorBehavior,
  DescriptorServer,
  EnergyPreferenceServer,
  GroupsBehavior,
  GroupsServer,
  IdentifyBehavior,
  IdentifyServer,
  LevelControlBehavior,
  OnOffBehavior,
  OnOffServer,
  TemperatureMeasurementServer,
  ThermostatBehavior,
  ThermostatServer,
  ThermostatUserInterfaceConfigurationServer,
  TimeSynchronizationServer,
} from '@matter/node/behaviors';
import { checkNotLatinCharacters, generateUniqueId, getAttributeId, getClusterId } from './matterbridgeEndpointHelpers.js';
import { log } from 'node:console';

describe('MatterbridgeEndpoint class', () => {
  let matterbridge: Matterbridge;
  let device: MatterbridgeEndpoint;

  /**
   * Waits for the `isOnline` property to become `true`.
   * @param {number} timeout - The maximum time to wait in milliseconds.
   * @returns {Promise<void>} A promise that resolves when `isOnline` becomes `true` or rejects if the timeout is reached.
   */
  async function waitForOnline(timeout = 10000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      const checkOnline = () => {
        if (matterbridge.serverNode?.lifecycle.isOnline) {
          resolve();
        } else if (Date.now() - start >= timeout) {
          reject(new Error('Timeout waiting for matterbridge.serverNode.lifecycle.isOnline to become true'));
        } else {
          setTimeout(checkOnline, 100); // Check every 100ms
        }
      };

      checkOnline();
    });
  }

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance
    process.argv = ['node', 'matterbridge.js', '-mdnsInterface', 'Wi-Fi', '-frontend', '0', '-profile', 'JestMain', '-bridge', '-logger', 'info', '-matterlogger', 'info'];
    matterbridge = await Matterbridge.loadInstance(true);
    /*
    await matterbridge.matterStorageManager?.createContext('events')?.clearAll();
    await matterbridge.matterStorageManager?.createContext('fabrics')?.clearAll();
    await matterbridge.matterStorageManager?.createContext('root')?.clearAll();
    await matterbridge.matterStorageManager?.createContext('sessions')?.clearAll();
    await matterbridge.matterbridgeContext?.clearAll();
    */

    await waitForOnline();
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    //
  });

  afterAll(async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();

    // Cleanup the storages
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();

    // Restore all mocks
    jest.restoreAllMocks();
  }, 30000);

  describe('MatterbridgeEndpoint', () => {
    async function add(device: MatterbridgeEndpoint): Promise<void> {
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      expect(matterbridge.serverNode).toBeDefined();
      expect(matterbridge.serverNode?.lifecycle.isReady).toBeTruthy();
      expect(matterbridge.serverNode?.construction.status).toBe(Lifecycle.Status.Active);
      expect(matterbridge.aggregatorNode).toBeDefined();
      expect(matterbridge.aggregatorNode?.lifecycle.isReady).toBeTruthy();
      expect(matterbridge.aggregatorNode?.construction.status).toBe(Lifecycle.Status.Active);
      expect(await matterbridge.aggregatorNode?.add(device)).toBeDefined();
      expect(device.lifecycle.isReady).toBeTruthy();
      expect(device.construction.status).toBe(Lifecycle.Status.Active);
      if (device.uniqueStorageKey === undefined) return;
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`\x1B[39mMatterbridge.Matterbridge.${device.uniqueStorageKey.replaceAll(' ', '')} \x1B[0mready`));
    }

    test('conversion of not latin characters', async () => {
      // Should return false for Latin-based text (including accents)
      expect(checkNotLatinCharacters('Hello World')).toBe(false);
      expect(checkNotLatinCharacters('café au lait')).toBe(false);
      expect(checkNotLatinCharacters('München-2024')).toBe(false);
      expect(checkNotLatinCharacters('Tōkyō_2024')).toBe(false);
      expect(checkNotLatinCharacters("L'éclair du matin")).toBe(false);
      expect(checkNotLatinCharacters('São Paulo')).toBe(false);
      expect(checkNotLatinCharacters('Résumé and naïve')).toBe(false);

      // Should return false for numbers, dashes, and underscores
      expect(checkNotLatinCharacters('123456')).toBe(false);
      expect(checkNotLatinCharacters('Hello_123')).toBe(false);
      expect(checkNotLatinCharacters('test-underscore_')).toBe(false);
      expect(checkNotLatinCharacters('text-with-dash')).toBe(false);

      // Special characters should return false
      expect(checkNotLatinCharacters('.,><!?@#$%^&*(){}[]|')).toBe(false);
      expect(checkNotLatinCharacters('€¥£₹')).toBe(false); // Currency symbols
      expect(checkNotLatinCharacters('©®™✓✔︎')).toBe(false); // Copyright, trademarks
      expect(checkNotLatinCharacters('♥︎♡♦︎♠︎♣︎♜♞♟')).toBe(false); // Playing card & chess symbols
      expect(checkNotLatinCharacters('→↓↑←↔↕')).toBe(false); // Arrows
      expect(checkNotLatinCharacters('“”‘’')).toBe(false); // Quotes

      // Should return true for non-Latin scripts
      expect(checkNotLatinCharacters('Москва')).toBe(true); // Cyrillic (Russian)
      expect(checkNotLatinCharacters('조명 - 세탁실')).toBe(true); // Korean (Hangul)
      expect(checkNotLatinCharacters('東京')).toBe(true); // Chinese (Kanji)
      expect(checkNotLatinCharacters('こんにちは')).toBe(true); // Japanese (Hiragana)
      expect(checkNotLatinCharacters('مرحبا')).toBe(true); // Arabic
      expect(checkNotLatinCharacters('שלום')).toBe(true); // Hebrew
      expect(checkNotLatinCharacters('हिन्दी')).toBe(true); // Hindi (Devanagari)
      expect(checkNotLatinCharacters('ไทย')).toBe(true); // Thai script
      expect(checkNotLatinCharacters('ትግርኛ')).toBe(true); // Amharic (Ethiopian)

      // Should return true for mixed Latin and non-Latin
      expect(checkNotLatinCharacters('Hello 世界')).toBe(true); // English + Chinese
      expect(checkNotLatinCharacters('Bonjour, Москва')).toBe(true); // French + Russian
      expect(checkNotLatinCharacters('Test123 조명')).toBe(true); // English + Korean
    });

    test('encoding of non-Latin and Latin names into unique IDs', async () => {
      // Sample names
      const latinNames = ['Hello World', 'café au lait', 'München-2024', 'Tōkyō_2024', "L'éclair du matin", 'São Paulo', 'Résumé and naïve', '123456', 'Hello_123', 'test-underscore_', 'text-with-dash'];

      const specialChars = ['.,><!?@#$%^&*(){}[]|', '€¥£₹', '©®™✓✔︎', '♥︎♡♦︎♠︎♣︎♜♞♟', '→↓↑←↔↕', '“”‘’'];

      const nonLatinNames = [
        'Москва', // Cyrillic (Russian)
        '조명 - 세탁실', // Korean (Hangul)
        '東京', // Chinese (Kanji)
        'こんにちは', // Japanese (Hiragana)
        'مرحبا', // Arabic
        'שלום', // Hebrew
        'हिन्दी', // Hindi (Devanagari)
        'ไทย', // Thai script
        'ትግርኛ', // Amharic (Ethiopian)
        'Hello 世界', // English + Chinese
        'Bonjour, Москва', // French + Russian
        'Test123 조명', // English + Korean
      ];

      // Each name should produce a **consistent** hash
      const uniqueIds = new Map<string, string>();

      [...latinNames, ...specialChars, ...nonLatinNames].forEach((name) => {
        const hash = generateUniqueId(name);
        expect(hash).toHaveLength(32); // MD5 produces 32-char hex strings
        expect(uniqueIds.has(name)).toBe(false); // Ensure no duplicates
        uniqueIds.set(name, hash);
      });

      // The same input should generate the same hash
      uniqueIds.forEach((hash, name) => {
        expect(generateUniqueId(name)).toBe(hash);
      });

      // Different names should generate different hashes
      const hashes = [...uniqueIds.values()];
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length); // Ensure no hash collisions
    });

    test('constructor with non latin', async () => {
      const nonLatinNames = [
        '버튼 - 작은방 (버튼-작은방)',
        '거실 공기 관리 - 샤오미 공기 청정기 속도 조절 (거실공기관리-샤오미공기청정기속도조절)',
        '난방 - 온도관리 방법 설정 (난방-온도관리방법설정)',
        '단후이 로봇청소기 예약/일정 (단후이로봇청소기예약/일정)',
        '단후이 로봇청소기 시계/지역시간 설정(mqtt) (단후이로봇청소기시계/지역시간설정(mqtt))',
        '애드온을 다시 시작(DuckDNS) (애드온을다시시작(DuckDNS))',
        '외출 중 기기 제어 - 외출 3시간 이상시 끄기 (외출중기기제어-외출3시간이상시끄기)',
        '메인 등(L1) 조명 자동 컨트롤 (메인등(L1)조명자동컨트롤)',
        '작은방 공기 관리 - 샤오미 공기 청정기 속도 조절 (작은방공기관리-샤오미공기청정기속도조절)',
        '알림 - haos 메모이 시용이 90% 이상으로 시스템을 재시작합니다 (알림-haos메모이시용이90%이상으로시스템을재시작합니다)',
        '알림 - 가스 검침기의 카운트를 다시 설정해 주세요 (알림-가스검침기의카운트를다시설정해주세요)',
        '알림 - 배달원이 고객님의 음식을 픽업했습니다 (알림-배달원이고객님의음식을픽업했습니다)',
        '알림 - 조리기기 관리가 수동으로 변경되었습니다 (알림-조리기기관리가수동으로변경되었습니다)',
        '알림 - 주문이 거의 도착했습니다 (알림-주문이거의도착했습니다)',
        '알림 - 현재 외부에는 비가 오고 있습니다 (알림-현재외부에는비가오고있습니다)',
        '알림 - NAS의 보안 위험이 감지 되었습니디.  보안 어드바이저를 확인해 주세요 (알림-NAS의보안위험이감지되었습니디보안어드바이저를확인해주세요)',
      ];
      let n = 1000;
      for (const name of nonLatinNames) {
        const device = new MatterbridgeEndpoint(onOffOutlet, { uniqueStorageKey: name, endpointId: EndpointNumber(n++) });
        expect(device).toBeDefined();
        expect(device.id).toBe(generateUniqueId(name));
        await add(device);
      }
    });

    test('constructor', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight1' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight1');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
      expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
      expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

      await add(device);
    });

    test('constructor with tagList', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight2', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light2' }] });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight2');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.hasAttributeServer('Descriptor', 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer('descriptor', 'TagList')).toBe(true);
      expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ tagList: [{ mfgCode: null, namespaceId: 7, tag: 1, label: 'Light2' }], deviceTypeList: [{ deviceType: 256, revision: 3 }] });

      await add(device);
    });

    test('loadInstance', async () => {
      const deviceType = onOffLight;
      const device = await MatterbridgeEndpoint.loadInstance(deviceType, { uniqueStorageKey: 'OnOffLight3' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight3');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
      expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
      expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

      expect(device.getDeviceTypes()).toEqual([deviceType]);

      await add(device);
    });

    test('serialize and deserialize', async () => {
      MatterbridgeEndpoint.bridgeMode = 'bridge';
      const device = new MatterbridgeEndpoint([onOffLight, bridgedNode, powerSource], { uniqueStorageKey: 'OnOffLight4', endpointId: EndpointNumber(100) });
      expect(device).toBeDefined();
      device
        .createDefaultIdentifyClusterServer()
        .createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light')
        .createDefaultGroupsClusterServer()
        .createDefaultScenesClusterServer()
        .createDefaultOnOffClusterServer()
        .createDefaultPowerSourceWiredClusterServer();
      const serializedDevice = MatterbridgeEndpoint.serialize(device);
      let deserializedDevice: MatterbridgeEndpoint | undefined;
      if (serializedDevice) {
        deserializedDevice = MatterbridgeEndpoint.deserialize(serializedDevice);
      }
      expect(deserializedDevice).toBeDefined();

      await add(device);
    });

    test('hasClusterServer', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight5', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      expect(device.hasClusterServer(DescriptorBehavior)).toBe(true);
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(Descriptor.Cluster)).toBe(true);
      expect(device.hasClusterServer(Descriptor.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Descriptor')).toBe(true);
      expect(device.hasClusterServer('descriptor')).toBe(true);
      expect(getClusterId(device, 'Descriptor')).toBe(0x1d);

      expect(device.hasClusterServer(IdentifyBehavior)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(Identify.Cluster)).toBe(true);
      expect(device.hasClusterServer(Identify.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Identify')).toBe(true);
      expect(device.hasClusterServer('identify')).toBe(true);
      expect(getClusterId(device, 'identify')).toBe(0x03);

      expect(device.hasClusterServer(GroupsBehavior)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(true);
      expect(device.hasClusterServer(Groups.Cluster)).toBe(true);
      expect(device.hasClusterServer(Groups.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('Groups')).toBe(true);
      expect(device.hasClusterServer('groups')).toBe(true);
      expect(getClusterId(device, 'identify')).toBe(0x03);

      expect(device.hasClusterServer(IdentifyBehavior)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ScenesManagement.Cluster.id)).toBe(false);
      expect(device.hasClusterServer('ScenesManagement')).toBe(false);
      expect(device.hasClusterServer('scenesManagement')).toBe(false);

      expect(device.hasClusterServer(OnOffBehavior)).toBe(true);
      expect(device.hasClusterServer(OnOffServer)).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster)).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.Lighting))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.OffOnly))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.with(OnOff.Feature.DeadFrontBehavior))).toBe(true);
      expect(device.hasClusterServer(OnOff.Cluster.id)).toBe(true);
      expect(device.hasClusterServer('OnOff')).toBe(true);
      expect(device.hasClusterServer('onOff')).toBe(true);
      expect(getClusterId(device, 'onOff')).toBe(0x06);
      expect(getAttributeId(device, 'onOff', 'onOff')).toBe(0x00);
      expect(getAttributeId(device, 'onOff', 'startUpOnOff')).toBe(0x4003);

      expect(device.hasClusterServer(ThermostatBehavior)).toBe(false);
      expect(device.hasClusterServer(ThermostatServer)).toBe(false);
      expect(device.hasClusterServer(Thermostat.Cluster.with(Thermostat.Feature.AutoMode, Thermostat.Feature.Heating, Thermostat.Feature.Cooling))).toBe(false);
      expect(device.hasClusterServer(Thermostat.Cluster.id)).toBe(false);
      expect(device.hasClusterServer('Thermostat')).toBe(false);
      expect(device.hasClusterServer('thermostat')).toBe(false);

      await add(device);
    });

    test('hasAttributeServer', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight6', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(DescriptorBehavior, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(DescriptorServer, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(Descriptor.Cluster, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(Descriptor.Cluster.id, 'tagList')).toBe(true);
      expect(device.hasAttributeServer('Descriptor', 'features')).toBe(false);
      expect(device.hasAttributeServer(Descriptor.Cluster.id, 'identifyTime')).toBe(false);

      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(IdentifyServer, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(Identify.Cluster.id, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'identifyType')).toBe(true);
      expect(device.hasAttributeServer('identify', 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer('identify', 'identifyType')).toBe(true);
      expect(device.hasAttributeServer('Identify', 'none')).toBe(false);

      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOffServer, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(OnOff.Cluster.id, 'onOff')).toBe(true);
      expect(device.hasAttributeServer('OnOff', 'onOff')).toBe(true);
      expect(device.hasAttributeServer('onOff', 'onOff')).toBe(true);
      expect(device.hasAttributeServer('onOff', 'none')).toBe(false);

      await add(device);
    });

    test('getClusterServerOptions', async () => {
      const device = new MatterbridgeEndpoint(colorTemperatureLight, { uniqueStorageKey: 'ColorLight1', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'ColorLight' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createDefaultColorControlClusterServer();
      expect(device.hasAttributeServer(DescriptorBehavior, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(ColorControlBehavior, 'colorMode')).toBe(true);
      const options = device.getClusterServerOptions(ColorControlBehavior);
      expect(options).toBeDefined();
      // console.log('getClusterServerOptions(ColorControlBehavior)', options);
      expect(options).toEqual({
        colorMode: 0,
        enhancedColorMode: 0,
        colorCapabilities: {
          xy: true,
          hueSaturation: true,
          colorLoop: false,
          enhancedHue: false,
          colorTemperature: true,
        },
        options: { executeIfOff: false },
        numberOfPrimaries: null,
        currentX: 0,
        currentY: 0,
        currentHue: 0,
        currentSaturation: 0,
        colorTemperatureMireds: 500,
        colorTempPhysicalMinMireds: 147,
        colorTempPhysicalMaxMireds: 500,
        coupleColorTempToLevelMinMireds: 147,
        remainingTime: 0,
        startUpColorTemperatureMireds: null,
      });

      await add(device);
    });

    test('getClusterServerOptions CT', async () => {
      const device = new MatterbridgeEndpoint(colorTemperatureLight, { uniqueStorageKey: 'ColorLight2', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'ColorLight' }] });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultGroupsClusterServer();
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createCtColorControlClusterServer();
      expect(device.hasAttributeServer(DescriptorBehavior, 'deviceTypeList')).toBe(true);
      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(true);
      expect(device.hasAttributeServer(ColorControlBehavior, 'colorMode')).toBe(true);
      const options = device.getClusterServerOptions(ColorControlBehavior);
      expect(options).toBeDefined();
      // console.log('getClusterServerOptions(ColorControlBehavior) CT', options);
      expect(options).toEqual({
        colorMode: 2,
        enhancedColorMode: 2,
        colorCapabilities: {
          xy: false,
          hueSaturation: false,
          colorLoop: false,
          enhancedHue: false,
          colorTemperature: true,
        },
        options: { executeIfOff: false },
        numberOfPrimaries: null,
        colorTemperatureMireds: 500,
        colorTempPhysicalMinMireds: 147,
        colorTempPhysicalMaxMireds: 500,
        coupleColorTempToLevelMinMireds: 147,
        remainingTime: 0,
        startUpColorTemperatureMireds: null,
      });

      await add(device);
    });

    test('addClusterServers', async () => {
      const device = new MatterbridgeEndpoint(onOffLight);
      expect(device).toBeDefined();
      expect(device.maybeId).toBe(undefined);
      expect(device.maybeNumber).toBe(undefined);
      device.addClusterServers([Identify.Cluster.id, Groups.Cluster.id, OnOff.Cluster.id]);
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(OnOffServer)).toBe(true);
      expect(device.getAllClusterServers()).toHaveLength(5);
      expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'onOff']);

      await add(device);
    });

    test('addFixedLabel', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'FixedLabel', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      await device.addFixedLabel('Composed', 'Light');
      expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(true);
      expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(false);
      const options = device.getClusterServerOptions(FixedLabel.Cluster);
      expect(options).toBeDefined();
      expect(options).toEqual({ 'labelList': [{ 'label': 'Composed', 'value': 'Light' }] });

      expect(device.getAttribute(FixedLabel.Cluster, 'labelList', device.log)).toBeUndefined();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}fixedLabel.labelList${er} error: Endpoint`));

      await add(device);

      await device.addFixedLabel('Composed2', 'Light');
      const labelList = device.getAttribute(FixedLabel.Cluster, 'labelList', device.log);
      expect(labelList).toEqual([
        { 'label': 'Composed', 'value': 'Light' },
        { 'label': 'Composed2', 'value': 'Light' },
      ]);
    });

    test('addUserLabel', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'UserLabel', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      await device.addUserLabel('Composed', 'Light');
      expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(false);
      expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(true);
      const options = device.getClusterServerOptions(UserLabel.Cluster);
      expect(options).toBeDefined();
      expect(options).toEqual({ 'labelList': [{ 'label': 'Composed', 'value': 'Light' }] });

      expect(device.getAttribute(UserLabel.Cluster, 'labelList', device.log)).toBeUndefined();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}userLabel.labelList${er} error: Endpoint`));

      await add(device);

      await device.addUserLabel('Composed2', 'Light');
      const labelList = device.getAttribute(UserLabel.Cluster, 'labelList', device.log);
      expect(labelList).toEqual([
        { 'label': 'Composed', 'value': 'Light' },
        { 'label': 'Composed2', 'value': 'Light' },
      ]);
    });

    test('subscribeAttribute without await', async () => {
      const device = new MatterbridgeEndpoint(rainSensor, { uniqueStorageKey: 'RainSensorI' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultBooleanStateClusterServer(true);
      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(BooleanStateCluster, 'stateValue')).toBe(true);

      let state = false;
      const listener = async (value: any) => {
        state = value;
      };
      device.subscribeAttribute('booleanState', 'stateValue', listener, device.log);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`is in the ${BLUE}inactive${db} state`));

      await add(device);

      await device.setAttribute(BooleanStateCluster, 'stateValue', false, device.log);
      expect(state).toBe(false);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);
      await device.setAttribute(BooleanStateCluster, 'stateValue', true, device.log);
      expect(state).toBe(true);
      expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);
    });

    test('subscribeAttribute await', async () => {
      const device = new MatterbridgeEndpoint(rainSensor, { uniqueStorageKey: 'RainSensorII' });
      expect(device).toBeDefined();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultBooleanStateClusterServer(true);
      expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
      expect(device.hasAttributeServer(BooleanStateCluster, 'stateValue')).toBe(true);
      expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'booleanState']);
      await add(device);

      let state = false;
      const listener = async (value: any) => {
        state = value;
      };

      expect(await device.subscribeAttribute('booleanStateXX', 'stateValue', listener, device.log)).toBe(false);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute ${hk}stateValue${er} error: cluster not found on endpoint`));

      expect(await device.subscribeAttribute('booleanState', 'stateValueXX', listener, device.log)).toBe(false);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute error: Attribute ${hk}stateValueXX${er} not found on Cluster`));

      expect(await device.subscribeAttribute('booleanState', 'stateValue', listener, device.log)).toBe(true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Subscribed endpoint `));

      await device.setAttribute(BooleanStateCluster, 'stateValue', false, device.log);
      expect(state).toBe(false);
      expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(false);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);
      expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(false);
      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(false);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(false);

      await device.setAttribute(BooleanState.Cluster, 'stateValue', true, device.log);
      expect(state).toBe(true);
      expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(true);
      expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);
    });

    test('addCommandHandler', async () => {
      const device = new MatterbridgeEndpoint(onOffLight, { uniqueStorageKey: 'OnOffLight7' });
      expect(device).toBeDefined();
      device.createDefaultOnOffClusterServer();
      expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
      expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(false);

      let called = false;

      device.addCommandHandler('on', async () => {
        called = true;
        console.log('OnOff.Cluster.on');
      });
      await device.executeCommandHandler('on');
      expect(called).toBe(true);

      called = false;
      device.addCommandHandler('off', async () => {
        called = true;
        console.log('OnOff.Cluster.off');
      });
      await device.executeCommandHandler('off');
      expect(called).toBe(true);

      called = false;
      device.addCommandHandler('toggle', async () => {
        called = true;
        console.log('OnOff.Cluster.toggle');
      });
      await device.executeCommandHandler('toggle');
      expect(called).toBe(true);

      await add(device);
    });

    test('addRequiredClusterServers', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'Thermostat1' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(false);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ThermostatServer)).toBe(true);
      expect(device.hasClusterServer(ThermostatUserInterfaceConfigurationServer)).toBe(false);
      expect(device.hasClusterServer(EnergyPreferenceServer)).toBe(false);
      expect(device.hasClusterServer(TimeSynchronizationServer)).toBe(false);

      await add(device);
    });

    test('addOptionalClusterServers', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'Thermostat2' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      device.addOptionalClusterServers();
      expect(device.hasClusterServer(DescriptorServer)).toBe(true);
      expect(device.hasClusterServer(IdentifyServer)).toBe(true);
      expect(device.hasClusterServer(GroupsServer)).toBe(true);
      expect(device.hasClusterServer(ScenesManagement.Cluster)).toBe(false);
      expect(device.hasClusterServer(ThermostatServer)).toBe(true);
      // expect(device.hasClusterServer(ThermostatUserInterfaceConfigurationServer)).toBe(true);
      // expect(device.hasClusterServer(EnergyPreferenceServer)).toBe(true);
      // expect(device.hasClusterServer(TimeSynchronizationServer)).toBe(true); /

      await add(device);
    });

    test('forEachAttribute Thermostat', async () => {
      const device = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'EachThermostat' });
      expect(device).toBeDefined();

      await add(device);

      let count = 0;
      device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
        // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
        expect(clusterName).toBeDefined();
        expect(clusterId).toBeDefined();
        expect(attributeName).toBeDefined();
        expect(attributeId).toBeDefined();
        count++;
      });
      expect(count).toBe(85);
    });

    test('forEachAttribute AirQuality', async () => {
      const device = new MatterbridgeEndpoint(airQualitySensor, { uniqueStorageKey: 'EachAirQuality' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
      device.addOptionalClusterServers();

      await add(device);

      let count = 0;
      device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
        // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
        expect(clusterName).toBeDefined();
        expect(clusterId).toBeDefined();
        expect(attributeName).toBeDefined();
        expect(attributeId).toBeDefined();
        count++;
      });
      expect(count).toBe(216);

      loggerLogSpy.mockClear();
      expect(await device.setAttribute(TemperatureMeasurementServer, 'measuredValue', 2500, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));

      loggerLogSpy.mockClear();
      expect(await device.setAttribute(TemperatureMeasurement.Cluster, 'measuredValue', 2600, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));

      loggerLogSpy.mockClear();
      expect(await device.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', 2700, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));

      loggerLogSpy.mockClear();
      expect(await device.setAttribute('TemperatureMeasurement', 'measuredValue', 2800, device.log)).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} attribute ${hk}TemperatureMeasurement${db}.${hk}measuredValue${db}`));
    });

    test('create a OnOffOutletWithSensors device', async () => {
      device = new MatterbridgeEndpoint(onOffOutlet, { uniqueStorageKey: 'OnOffOutlet With Sensors' });
      expect(device).toBeDefined();
      device.addRequiredClusterServers();
    });

    test('add contact child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-1', contactSensor, { endpointId: EndpointNumber(35) });
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultIdentifyClusterServer();
      childEndpoint.createDefaultBooleanStateClusterServer(false);
      expect(device.getChildEndpointByName('contactChild-1')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(1);
    });

    test('add motion child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('occupancyChild-2', occupancySensor, [OccupancySensing.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultOccupancySensingClusterServer(false);
      expect(device.getChildEndpointByName('occupancyChild-2')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(2);

      device.addChildDeviceTypeWithClusterServer('occupancyChild-2', occupancySensor, [OccupancySensing.Cluster.id]);
      expect(device.getChildEndpoints().length).toBe(2);
    });

    test('add illuminance child to OnOffOutletWithSensors', async () => {
      const deviceType = lightSensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('illuminanceChild-3', [lightSensor], [IlluminanceMeasurement.Cluster.id], { tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultIlluminanceMeasurementClusterServer(200);
      expect(device.getChildEndpointByName('illuminanceChild-3')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(3);
    });

    test('add temperature child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('temperatureChild-4', temperatureSensor, [TemperatureMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultTemperatureMeasurementClusterServer(2500);
      expect(device.getChildEndpointByName('temperatureChild-4')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(4);
    });

    test('add humidity child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('humidityChild-5', [humiditySensor], [RelativeHumidityMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultRelativeHumidityMeasurementClusterServer(8000);
      expect(device.getChildEndpointByName('humidityChild-5')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(5);
    });

    test('add pressure child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('pressureChild-6', pressureSensor, [PressureMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultPressureMeasurementClusterServer(900);
      expect(device.getChildEndpointByName('pressureChild-6')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(6);
    });

    test('add flow child to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('flowChild-7', [flowSensor], [FlowMeasurement.Cluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultFlowMeasurementClusterServer(900);
      expect(device.getChildEndpointByName('flowChild-7')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(7);
    });

    test('add multiple device types children to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceType('multiChild-8', [temperatureSensor, humiditySensor, pressureSensor]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addRequiredClusterServers();
      expect(device.getChildEndpointByName('multiChild-8')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(8);
    });

    test('add multiple device types children with required to OnOffOutletWithSensors', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('multiChild-9', [temperatureSensor, humiditySensor, pressureSensor]);
      expect(childEndpoint).toBeDefined();
      expect(device.getChildEndpointByName('multiChild-9')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(9);
    });

    test('add OnOffOutletWithSensors device to serverNode', async () => {
      expect(device).toBeDefined();
      await add(device);
    });

    test('getChildEndpoint of OnOffOutletWithSensors by number', async () => {
      expect(device.getChildEndpoint(EndpointNumber(35))).toBeDefined();
    });

    test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-2', contactSensor, { endpointId: EndpointNumber(36) });
      childEndpoint.addRequiredClusterServers();
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-2')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(36))).toBeDefined();
    });

    test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed and taglist', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-2bis', contactSensor, { endpointId: EndpointNumber(46), tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      childEndpoint.addRequiredClusterServers();
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-2bis')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(46))).toBeDefined();
    });

    test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed and taglist and already added', async () => {
      const childEndpoint = device.addChildDeviceType('contactChild-2bis', contactSensor);
      expect(childEndpoint.number).toBe(46);
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3', contactSensor, [BooleanState.Cluster.id], { endpointId: EndpointNumber(37) });
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-3')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(37))).toBeDefined();
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor, [BooleanState.Cluster.id], { endpointId: EndpointNumber(47), tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
      await Promise.all([childEndpoint.lifecycle.ready, childEndpoint.construction.ready]); // We need to wait for the lifecycle to be ready since we cannot await the construction
      expect(device.getChildEndpointByName('contactChild-3bis')).toBeDefined();
      expect(device.getChildEndpoint(EndpointNumber(47))).toBeDefined();
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist and already added', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor);
      expect(childEndpoint.number).toBe(47);
    });

    test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist and already added 2', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor);
      expect(childEndpoint.number).toBe(47);
    });

    test('verify OnOffOutletWithSensors child endpoints', async () => {
      const getChildDescriptorAttribute = (name: string, attribute: string) => {
        const childEndpoint = device.getChildEndpointByName(name);
        expect(childEndpoint).toBeDefined();
        if (!childEndpoint) return;
        return childEndpoint.getAttribute(Descriptor.Cluster.id, attribute, device.log);
      };
      expect(getChildDescriptorAttribute('contactChild-1', 'deviceTypeList')).toEqual([{ deviceType: contactSensor.code, revision: contactSensor.revision }]);
      expect(getChildDescriptorAttribute('occupancyChild-2', 'deviceTypeList')).toEqual([{ deviceType: occupancySensor.code, revision: occupancySensor.revision }]);
      expect(getChildDescriptorAttribute('illuminanceChild-3', 'deviceTypeList')).toEqual([{ deviceType: lightSensor.code, revision: lightSensor.revision }]);
      expect(getChildDescriptorAttribute('temperatureChild-4', 'deviceTypeList')).toEqual([{ deviceType: temperatureSensor.code, revision: temperatureSensor.revision }]);
      expect(getChildDescriptorAttribute('humidityChild-5', 'deviceTypeList')).toEqual([{ deviceType: humiditySensor.code, revision: humiditySensor.revision }]);
      expect(getChildDescriptorAttribute('pressureChild-6', 'deviceTypeList')).toEqual([{ deviceType: pressureSensor.code, revision: pressureSensor.revision }]);
      expect(getChildDescriptorAttribute('flowChild-7', 'deviceTypeList')).toEqual([{ deviceType: flowSensor.code, revision: flowSensor.revision }]);
      expect(getChildDescriptorAttribute('multiChild-8', 'deviceTypeList')).toEqual([
        { deviceType: temperatureSensor.code, revision: temperatureSensor.revision },
        { deviceType: humiditySensor.code, revision: humiditySensor.revision },
        { deviceType: pressureSensor.code, revision: pressureSensor.revision },
      ]);
      expect(getChildDescriptorAttribute('multiChild-9', 'deviceTypeList')).toEqual([
        { deviceType: temperatureSensor.code, revision: temperatureSensor.revision },
        { deviceType: humiditySensor.code, revision: humiditySensor.revision },
        { deviceType: pressureSensor.code, revision: pressureSensor.revision },
      ]);
    });

    // eslint-disable-next-line jest/expect-expect
    test('pause before cleanup', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Pause for 1 seconds to allow matter.js promises to settle
    }, 60000);
  });
});
