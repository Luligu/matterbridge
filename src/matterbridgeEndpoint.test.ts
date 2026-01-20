// src\matterbridgeEndpoint.test.ts

/* eslint-disable no-console */

const MATTER_PORT = 6009;
const NAME = 'Endpoint';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.js', '-mdnsInterface', 'Wi-Fi', '-frontend', '0', '-port', MATTER_PORT.toString(), '-homedir', HOMEDIR, '-bridge', '-logger', 'info', '-matterlogger', 'info'];

import path from 'node:path';

import { jest } from '@jest/globals';
import { Lifecycle } from '@matter/general';
import { EndpointNumber } from '@matter/types';
import {
  BooleanState,
  BooleanStateCluster,
  Descriptor,
  DescriptorCluster,
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
} from '@matter/types/clusters';
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
import { BLUE, CYAN, db, er, hk, LogLevel, or } from 'node-ansi-logger';
import { ActionContext } from '@matter/node';

import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  airQualitySensor,
  bridgedNode,
  colorTemperatureLight,
  contactSensor,
  dishwasher,
  extractorHood,
  flowSensor,
  humiditySensor,
  laundryWasher,
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
import { checkNotLatinCharacters, featuresFor, generateUniqueId, getAttributeId, getClusterId, invokeSubscribeHandler } from './matterbridgeEndpointHelpers.js';
import {
  addDevice,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  flushAsync,
  loggerDebugSpy,
  loggerLogSpy,
  matterbridge,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

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

  async function add(device: MatterbridgeEndpoint): Promise<void> {
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBe(true);
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
      const device = new MatterbridgeEndpoint(onOffOutlet, { id: name, number: EndpointNumber(n++) });
      expect(device).toBeDefined();
      expect(device.id).toBe(generateUniqueId(name));
      await add(device);
    }
  });

  test('constructor id with non latin', async () => {
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
    let n = 2000;
    for (const name of nonLatinNames) {
      const device = new MatterbridgeEndpoint(onOffOutlet, { id: name + 'bis', number: EndpointNumber(n++) });
      expect(device).toBeDefined();
      expect(device.id).toBe(generateUniqueId(name + 'bis'));
      await add(device);
    }
  });

  test('constructor', async () => {
    const deviceType = onOffLight;
    const device = new MatterbridgeEndpoint(deviceType, { id: 'OnOffLight1' });
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight1');
    expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(device.type.deviceType).toBe(deviceType.code);
    expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(device.type.deviceRevision).toBe(deviceType.revision);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);

    expect(device.behaviors.supported.descriptor).toBeDefined();
    expect(device.behaviors.has(DescriptorBehavior)).toBeTruthy();
    expect(device.behaviors.has(DescriptorServer)).toBeTruthy();
    expect(device.hasClusterServer(DescriptorBehavior)).toBeTruthy();
    expect(device.hasClusterServer(DescriptorServer)).toBeTruthy();
    expect(device.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.hasClusterServer(Descriptor.Cluster)).toBeTruthy();
    expect(device.hasClusterServer(DescriptorCluster.id)).toBeTruthy();
    expect(device.hasClusterServer(Descriptor.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DescriptorCluster.name)).toBeTruthy();

    expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
    expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

    await add(device);
  });

  test('constructor with id', async () => {
    const deviceType = onOffLight;
    const device = new MatterbridgeEndpoint(deviceType, { id: 'OnOffLight1bis' });
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight1bis');
    expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(device.type.deviceType).toBe(deviceType.code);
    expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(device.type.deviceRevision).toBe(deviceType.revision);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);

    expect(device.behaviors.supported.descriptor).toBeDefined();

    expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
    expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

    await add(device);
  });

  test('constructor with number', async () => {
    const deviceType = onOffLight;
    const device = new MatterbridgeEndpoint(deviceType, { id: 'OnOffLight1ter', number: EndpointNumber(6000) });
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight1ter');
    expect(device.number).toBe(6000);
    expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(device.type.deviceType).toBe(deviceType.code);
    expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(device.type.deviceRevision).toBe(deviceType.revision);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);

    expect(device.behaviors.supported.descriptor).toBeDefined();

    expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
    expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

    await add(device);
  });

  test('constructor with tagList', async () => {
    const deviceType = onOffLight;
    const device = new MatterbridgeEndpoint(deviceType, { id: 'OnOffLight2', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light2' }] });
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight2');
    expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(device.type.deviceType).toBe(deviceType.code);
    expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(device.type.deviceRevision).toBe(deviceType.revision);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);

    expect(device.behaviors.supported.descriptor).toBeDefined();

    expect(device.hasAttributeServer('Descriptor', 'deviceTypeList')).toBe(true);
    expect(device.hasAttributeServer('descriptor', 'TagList')).toBe(true);
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ tagList: [{ mfgCode: null, namespaceId: 7, tag: 1, label: 'Light2' }], deviceTypeList: [{ deviceType: 256, revision: 3 }] });

    await add(device);
  });

  test('loadInstance', async () => {
    const deviceType = onOffLight;
    const device = await MatterbridgeEndpoint.loadInstance(deviceType, { id: 'OnOffLight3' });
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight3');
    expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(device.type.deviceType).toBe(deviceType.code);
    expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(device.type.deviceRevision).toBe(deviceType.revision);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);

    expect(device.behaviors.supported.descriptor).toBeDefined();

    expect(device.hasAttributeServer('Descriptor', 'DeviceTypeList')).toBe(true);
    expect(device.hasAttributeServer('descriptor', 'tagList')).toBe(false);
    expect(device.behaviors.optionsFor(DescriptorBehavior)).toEqual({ deviceTypeList: [{ deviceType: 256, revision: 3 }] });

    expect(device.getDeviceTypes()).toEqual([deviceType]);

    await add(device);
  });

  test('serialize and deserialize', async () => {
    const device = new MatterbridgeEndpoint([onOffLight, bridgedNode, powerSource], { id: 'OnOffLight4', number: EndpointNumber(100) });
    expect(device).toBeDefined();
    device
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('OnOffLight', '1234', 0xfff1, 'Matterbridge', 'Light')
      .createDefaultGroupsClusterServer()
      // .createDefaultScenesClusterServer()
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
    const device = new MatterbridgeEndpoint(deviceType, { id: 'OnOffLight5', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'onOff']);
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
    const device = new MatterbridgeEndpoint(deviceType, { id: 'OnOffLight6', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'onOff']);

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

    expect(featuresFor(device, OnOffBehavior)).toEqual({
      'deadFrontBehavior': false,
      'lighting': true,
      'offOnly': false,
    });
    expect(featuresFor(device, OnOffServer)).toEqual({
      'deadFrontBehavior': false,
      'lighting': true,
      'offOnly': false,
    });
    expect(featuresFor(device, OnOff.Cluster)).toEqual({
      'deadFrontBehavior': false,
      'lighting': true,
      'offOnly': false,
    });
    expect(featuresFor(device, OnOff.Cluster.id)).toEqual({
      'deadFrontBehavior': false,
      'lighting': true,
      'offOnly': false,
    });
    expect(featuresFor(device, 'onOff')).toEqual({
      'deadFrontBehavior': false,
      'lighting': true,
      'offOnly': false,
    });

    expect(featuresFor(device, 'unknown')).toEqual({});

    await add(device);
  });

  test('getClusterServerOptions', async () => {
    const device = new MatterbridgeEndpoint(colorTemperatureLight, { id: 'ColorLight1', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'ColorLight' }] });
    expect(device).toBeDefined();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer();
    device.createDefaultLevelControlClusterServer();
    device.createDefaultColorControlClusterServer();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'onOff', 'levelControl', 'colorControl']);
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
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
  });

  test('getClusterServerOptions CT', async () => {
    const device = new MatterbridgeEndpoint(colorTemperatureLight, { id: 'ColorLight2', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'ColorLight' }] });
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer();
    device.createDefaultLevelControlClusterServer();
    device.createCtColorControlClusterServer();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'onOff', 'levelControl', 'colorControl']);
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
      colorTemperatureMireds: 250,
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
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FixedLabel', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    await device.addFixedLabel('composed', 'Light');
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'scenesManagement', 'onOff', 'fixedLabel']);
    expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(true);
    expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(false);
    const options = device.getClusterServerOptions(FixedLabel.Cluster);
    expect(options).toBeDefined();
    expect(options).toEqual({ 'labelList': [{ 'label': 'composed', 'value': 'Light' }] });

    expect(device.getAttribute(FixedLabel.Cluster, 'labelList', device.log)).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}fixedLabel.labelList${er} error: Endpoint`));

    await add(device);

    await device.addFixedLabel('composed2', 'Light');
    const labelList = device.getAttribute(FixedLabel.Cluster, 'labelList', device.log);
    expect(labelList).toEqual([
      { 'label': 'composed', 'value': 'Light' },
      { 'label': 'composed2', 'value': 'Light' },
    ]);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
  });

  test('addUserLabel', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'UserLabel', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    await device.addUserLabel('composed', 'Light');
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'groups', 'scenesManagement', 'onOff', 'userLabel']);
    expect(device.hasAttributeServer(FixedLabel.Cluster, 'labelList')).toBe(false);
    expect(device.hasAttributeServer(UserLabel.Cluster, 'labelList')).toBe(true);
    const options = device.getClusterServerOptions(UserLabel.Cluster);
    expect(options).toBeDefined();
    expect(options).toEqual({ 'labelList': [{ 'label': 'composed', 'value': 'Light' }] });

    expect(device.getAttribute(UserLabel.Cluster, 'labelList', device.log)).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`getAttribute ${hk}userLabel.labelList${er} error: Endpoint`));

    await add(device);

    await device.addUserLabel('composed2', 'Light');
    const labelList = device.getAttribute(UserLabel.Cluster, 'labelList', device.log);
    expect(labelList).toEqual([
      { 'label': 'composed', 'value': 'Light' },
      { 'label': 'composed2', 'value': 'Light' },
    ]);
    (matterbridge as any).frontend.getClusterTextFromDevice(device);
  });

  test('subscribeAttribute without await', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorI' }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(true);
    expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateCluster, 'stateValue')).toBe(true);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'booleanState']);

    let newState = false;
    let oldState = false;
    let offlineState: boolean | undefined = false;
    const listener = (newValue: boolean, oldValue: boolean, context: ActionContext) => {
      newState = newValue;
      oldState = oldValue;
      offlineState = context.offline;
    };
    device.subscribeAttribute('booleanState', 'stateValue', listener, device.log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`is in the ${BLUE}inactive${db} state`));

    await add(device);
    console.log('subscribeAttribute without await: add(device)', newState);

    await device.setAttribute(BooleanStateCluster, 'stateValue', false, device.log);
    expect(newState).toBe(false);
    expect(oldState).toBe(true);
    expect(offlineState).toBe(true);
    expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);
    await device.setAttribute(BooleanStateCluster, 'stateValue', true, device.log);
    expect(newState).toBe(true);
    expect(oldState).toBe(false);
    expect(offlineState).toBe(true);
    // console.log('subscribeAttribute without await: state', newState);
    expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);
    // console.log('subscribeAttribute without await: state', newState);

    expect(device.construction.status).toBe(Lifecycle.Status.Active);
    expect(await invokeSubscribeHandler(device, 'booleanState', 'stateValue', false, true)).toBe(true);
    expect(newState).toBe(false);
    expect(oldState).toBe(true);
    expect(offlineState).toBe(false);
  });

  test('subscribeAttribute with await', async () => {
    const device = new MatterbridgeEndpoint(rainSensor, { id: 'RainSensorII' }, true);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer();
    device.createDefaultBooleanStateClusterServer(true);
    expect(device.hasAttributeServer(IdentifyBehavior, 'identifyTime')).toBe(true);
    expect(device.hasAttributeServer(BooleanStateCluster, 'stateValue')).toBe(true);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'booleanState']);

    expect(await invokeSubscribeHandler(device, 'booleanState', 'stateValue', false, true)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`is in the ${BLUE}inactive${er} state`));

    await add(device);

    let newState = false;
    let oldState = false;
    let offlineState: boolean | undefined = false;
    const listener = (newValue: boolean, oldValue: boolean, context: ActionContext) => {
      newState = newValue;
      oldState = oldValue;
      offlineState = context.offline;
    };

    expect(await device.subscribeAttribute('booleanStateXX', 'stateValue', listener, device.log)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute ${hk}stateValue${er} error: cluster not found on endpoint`));

    expect(await device.subscribeAttribute('booleanState', 'stateValueXX', listener, device.log)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`subscribeAttribute error: Attribute ${hk}stateValueXX${er} not found on Cluster`));

    expect(await device.subscribeAttribute('booleanState', 'stateValue', listener, device.log)).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Subscribed endpoint `));

    await device.setAttribute(BooleanStateCluster, 'stateValue', false, device.log);
    expect(newState).toBe(false);
    expect(oldState).toBe(true);
    expect(offlineState).toBe(true);
    expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(false);
    expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(false);
    expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(false);
    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(false);
    expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(false);

    await device.setAttribute(BooleanState.Cluster, 'stateValue', true, device.log);
    expect(newState).toBe(true);
    expect(oldState).toBe(false);
    expect(offlineState).toBe(true);
    expect(device.getAttribute(BooleanStateBehavior, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute(BooleanStateServer, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute(BooleanState.Cluster, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute(BooleanState.Cluster.id, 'stateValue', device.log)).toBe(true);
    expect(device.getAttribute('BooleanState', 'stateValue', device.log)).toBe(true);

    expect(device.construction.status).toBe(Lifecycle.Status.Active);

    expect(await invokeSubscribeHandler(device, 'notacluster', 'stateValue', false, true)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeSubscribeHandler ${hk}stateValue$Changed${er} error: cluster not found on endpoint`));

    expect(await invokeSubscribeHandler(device, 'booleanState', 'notanattribute', false, true)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeSubscribeHandler ${hk}notanattribute$Changed${er} error: cluster booleanState not found on endpoint`));

    expect(await invokeSubscribeHandler(device, 'booleanState', 'stateValue', false, true)).toBe(true);
    expect(newState).toBe(false);
    expect(oldState).toBe(true);
    expect(offlineState).toBe(false);
  });

  test('addCommandHandler', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight7' });
    expect(device).toBeDefined();
    device.createDefaultOnOffClusterServer();
    expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(false);

    let called = false;

    // consoleLogSpy.mockRestore();
    device.addCommandHandler('on', async (data) => {
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

  test('addCommandHandler with data', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight8' });
    expect(device).toBeDefined();
    device.createDefaultOnOffClusterServer();
    expect(device.hasAttributeServer(OnOffBehavior, 'onOff')).toBe(true);
    expect(device.hasAttributeServer(LevelControlBehavior, 'currentLevel')).toBe(false);
    await add(device);

    let called = false;

    // consoleLogSpy.mockRestore();
    device.addCommandHandler('on', async (data) => {
      called = true;
      console.log('OnOff.Cluster.on', data);
      expect(data).toBeDefined();
      expect(data.request).toEqual({});
      expect(data.cluster).toBe('onOff');
      expect(data.attributes).toBeDefined();
      expect(data.attributes.onOff).toBe(false);
      expect(data.endpoint).toBe(device);
    });
    await device.invokeBehaviorCommand('onOff', 'on');
    expect(called).toBe(true);

    called = false;
    device.addCommandHandler('off', async (data) => {
      called = true;
      console.log('OnOff.Cluster.off', data);
      expect(data).toBeDefined();
      expect(data.request).toEqual({});
      expect(data.cluster).toBe('onOff');
      expect(data.attributes).toBeDefined();
      expect(data.attributes.onOff).toBe(true);
      expect(data.endpoint).toBe(device);
    });
    await device.invokeBehaviorCommand('onOff', 'off');
    expect(called).toBe(true);

    called = false;
    device.addCommandHandler('toggle', async (data) => {
      called = true;
      console.log('OnOff.Cluster.toggle', data);
      expect(data).toBeDefined();
      expect(data.request).toEqual({});
      expect(data.cluster).toBe('onOff');
      expect(data.attributes).toBeDefined();
      expect(data.attributes.onOff).toBe(false);
      expect(data.endpoint).toBe(device);
    });
    await device.invokeBehaviorCommand('onOff', 'toggle');
    expect(called).toBe(true);
  });

  test('addRequiredClusterServers', async () => {
    const device = new MatterbridgeEndpoint(thermostatDevice, { id: 'Thermostat1' });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat']);
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
    const device = new MatterbridgeEndpoint(thermostatDevice, { id: 'Thermostat2' });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    device.addOptionalClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat', 'groups']);
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
    const device = new MatterbridgeEndpoint(thermostatDevice, { id: 'EachThermostat' });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat']);

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
    expect(count).toBe(60);
  });

  test('forEachAttribute DishWasher', async () => {
    const device = new MatterbridgeEndpoint(dishwasher, { id: 'EachDishWasher' });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'operationalState']);

    await add(device);

    let count = 0;
    // consoleWarnSpy.mockRestore();
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
      expect(clusterName).toBeDefined();
      expect(clusterId).toBeDefined();
      expect(attributeName).toBeDefined();
      expect(attributeId).toBeDefined();
      count++;
    });
    expect(count).toBe(21);
  });

  test('forEachAttribute LaundryWasher', async () => {
    const device = new MatterbridgeEndpoint(laundryWasher, { id: 'EachLaundryWasher' });
    expect(device).toBeDefined();
    device.createOffOnlyOnOffClusterServer();
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'operationalState']);

    await add(device);

    expect(device.hasClusterServer('OperationalState')).toBe(true);

    let count = 0;
    // consoleWarnSpy.mockRestore();
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
      expect(clusterName).toBeDefined();
      expect(clusterId).toBeDefined();
      expect(attributeName).toBeDefined();
      expect(attributeId).toBeDefined();
      count++;
    });
    expect(count).toBe(27);
  });

  test('forEachAttribute ExtractorHood', async () => {
    const device = new MatterbridgeEndpoint(extractorHood, { id: 'EachExtractorHood' });
    expect(device).toBeDefined();
    device.createOffOnlyOnOffClusterServer();
    device.createLevelControlClusterServer();
    device.createLevelTvocMeasurementClusterServer();
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'levelControl', 'totalVolatileOrganicCompoundsConcentrationMeasurement', 'fanControl']);

    await add(device);

    let count = 0;
    // consoleWarnSpy.mockRestore();
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
      expect(clusterName).toBeDefined();
      expect(clusterId).toBeDefined();
      expect(attributeName).toBeDefined();
      expect(attributeId).toBeDefined();
      count++;
    });
    expect(count).toBe(45);
  });

  test('forEachAttribute AirQuality', async () => {
    const device = new MatterbridgeEndpoint(airQualitySensor, { id: 'EachAirQuality' });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    device.addOptionalClusterServers();
    expect(device.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'airQuality',
      'temperatureMeasurement',
      'relativeHumidityMeasurement',
      'carbonMonoxideConcentrationMeasurement',
      'carbonDioxideConcentrationMeasurement',
      'nitrogenDioxideConcentrationMeasurement',
      'ozoneConcentrationMeasurement',
      'formaldehydeConcentrationMeasurement',
      'pm1ConcentrationMeasurement',
      'pm25ConcentrationMeasurement',
      'pm10ConcentrationMeasurement',
      'radonConcentrationMeasurement',
      'totalVolatileOrganicCompoundsConcentrationMeasurement',
    ]);

    await add(device);

    (matterbridge as any).frontend.getClusterTextFromDevice(device);

    let count = 0;
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
      expect(clusterName).toBeDefined();
      expect(clusterId).toBeDefined();
      expect(attributeName).toBeDefined();
      expect(attributeId).toBeDefined();
      count++;
    });
    expect(count).toBe(151);

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
    device = new MatterbridgeEndpoint(onOffOutlet, { id: 'OnOffOutlet With Sensors' });
    expect(device).toBeDefined();
    device.addRequiredClusterServers();
    await flushAsync();
  });

  test('add contact child to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceType('contactChild-1', contactSensor, { number: EndpointNumber(35) });
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultIdentifyClusterServer();
    childEndpoint.createDefaultBooleanStateClusterServer(false);
    expect(device.getChildEndpointByName('contactChild-1')).toBeDefined();
    expect(device.getChildEndpointById('contactChild-1')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('contactChild-1')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(1);
    await flushAsync();
  });

  test('add motion child to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('occupancyChild-2', occupancySensor, [OccupancySensing.Cluster.id]);
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultIdentifyClusterServer();
    childEndpoint.createDefaultOccupancySensingClusterServer(false);
    expect(device.getChildEndpointByName('occupancyChild-2')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(2);

    // expect(device.addChildDeviceTypeWithClusterServer('occupancyChild-2', occupancySensor, [OccupancySensing.Cluster.id])).toBeDefined();
    // expect(device.getChildEndpoints().length).toBe(2);
    await flushAsync();
  });

  test('add illuminance child to OnOffOutletWithSensors', async () => {
    const deviceType = lightSensor;
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('illuminanceChild-3', [lightSensor], [IlluminanceMeasurement.Cluster.id], { tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultIlluminanceMeasurementClusterServer(200);
    expect(device.getChildEndpointByName('illuminanceChild-3')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(3);
    await flushAsync();
  });

  test('add temperature child to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('temperatureChild-4', temperatureSensor, [TemperatureMeasurement.Cluster.id]);
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultTemperatureMeasurementClusterServer(2500);
    expect(device.getChildEndpointByName('temperatureChild-4')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(4);
    await flushAsync();
  });

  test('add humidity child to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('humidityChild-5', [humiditySensor], [RelativeHumidityMeasurement.Cluster.id]);
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultRelativeHumidityMeasurementClusterServer(8000);
    expect(device.getChildEndpointByName('humidityChild-5')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(5);
    await flushAsync();
  });

  test('add pressure child to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('pressureChild-6', pressureSensor, [PressureMeasurement.Cluster.id]);
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultPressureMeasurementClusterServer(900);
    expect(device.getChildEndpointByName('pressureChild-6')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(6);
    await flushAsync();
  });

  test('add flow child to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('flowChild-7', [flowSensor], [FlowMeasurement.Cluster.id]);
    expect(childEndpoint).toBeDefined();
    childEndpoint.createDefaultFlowMeasurementClusterServer(900);
    expect(device.getChildEndpointByName('flowChild-7')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(7);
    await flushAsync();
  });

  test('add multiple device types children to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceType('multiChild-8', [temperatureSensor, humiditySensor, pressureSensor]);
    expect(childEndpoint).toBeDefined();
    childEndpoint.addRequiredClusterServers();
    expect(device.getChildEndpointByName('multiChild-8')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(8);
    await flushAsync();
  });

  test('add multiple device types children with required to OnOffOutletWithSensors', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('multiChild-9', [temperatureSensor, humiditySensor, pressureSensor]);
    expect(childEndpoint).toBeDefined();
    expect(device.getChildEndpointByName('multiChild-9')).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(9);
    await flushAsync();
  });

  test('add OnOffOutletWithSensors device to serverNode', async () => {
    expect(device).toBeDefined();
    await add(device);
    await flushAsync();
  });

  test('getChildEndpoint of OnOffOutletWithSensors by number', async () => {
    expect(device.getChildEndpoint(EndpointNumber(35))).toBeDefined();
  });

  test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed', async () => {
    const childEndpoint = device.addChildDeviceType('contactChild-2', contactSensor, { number: EndpointNumber(36) });
    expect(childEndpoint).toBeDefined();
    childEndpoint.addRequiredClusterServers();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceType: ${CYAN}contactChild-2${db}`));
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining(`- endpoint ${CYAN}contactChild-2${db} already added!`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- with lifecycle installed`));
    await childEndpoint.construction.ready;
    expect(device.getChildEndpointByName('contactChild-2')).toBeDefined();
    expect(device.getChildEndpoint(EndpointNumber(36))).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(10);
  });

  test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed and taglist', async () => {
    const childEndpoint = device.addChildDeviceType('contactChild-2bis', contactSensor, { number: EndpointNumber(46), tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(childEndpoint).toBeDefined();
    childEndpoint.addRequiredClusterServers();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceType: ${CYAN}contactChild-2bis${db}`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- with tagList`));
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining(`- endpoint ${CYAN}contactChild-2bis${db} already added!`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- with lifecycle installed`));
    await childEndpoint.construction.ready;
    expect(device.getChildEndpointByName('contactChild-2bis')).toBeDefined();
    expect(device.getChildEndpoint(EndpointNumber(46))).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(11);
  });

  test('addChildDeviceType to OnOffOutletWithSensors with lifecycle installed and taglist and already added', async () => {
    const childEndpoint = device.addChildDeviceType('contactChild-2bis', contactSensor);
    expect(childEndpoint).toBeDefined();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceType: ${CYAN}contactChild-2bis${db}`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- endpoint ${CYAN}contactChild-2bis${db} already added!`));
    expect(childEndpoint.number).toBe(46);
    expect(device.getChildEndpoints().length).toBe(11);
  });

  test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3', contactSensor, [BooleanState.Cluster.id], { number: EndpointNumber(37) });
    expect(childEndpoint).toBeDefined();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceTypeWithClusterServer: ${CYAN}contactChild-3${db}`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- with lifecycle installed`));
    await childEndpoint.construction.ready;
    expect(device.getChildEndpointByName('contactChild-3')).toBeDefined();
    expect(device.getChildEndpoint(EndpointNumber(37))).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(12);
  });

  test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor, [BooleanState.Cluster.id], { number: EndpointNumber(47), tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Light' }] });
    expect(childEndpoint).toBeDefined();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceTypeWithClusterServer: ${CYAN}contactChild-3bis${db}`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- with tagList`));
    expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining(`- endpoint ${CYAN}contactChild-3bis${db} already added!`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- with lifecycle installed`));
    await childEndpoint.construction.ready;
    expect(device.getChildEndpointByName('contactChild-3bis')).toBeDefined();
    expect(device.getChildEndpoint(EndpointNumber(47))).toBeDefined();
    expect(device.getChildEndpoints().length).toBe(13);
  });

  test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist and already added', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceTypeWithClusterServer: ${CYAN}contactChild-3bis${db}`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- endpoint ${CYAN}contactChild-3bis${db} already added!`));
    expect(childEndpoint.number).toBe(47);
  });

  test('addChildDeviceTypeWithClusterServer to OnOffOutletWithSensors with lifecycle installed and taglist and already added 2', async () => {
    const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-3bis', contactSensor);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`addChildDeviceTypeWithClusterServer: ${CYAN}contactChild-3bis${db}`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`- endpoint ${CYAN}contactChild-3bis${db} already added!`));
    expect(childEndpoint.number).toBe(47);
  });

  test('verify OnOffOutletWithSensors child endpoints', async () => {
    const getChildDescriptorAttribute = (name: string, attribute: string) => {
      const childEndpoint = device.getChildEndpointByName(name);
      expect(childEndpoint).toBeDefined();
      if (!childEndpoint) return;
      (matterbridge as any).frontend.getClusterTextFromDevice(childEndpoint);
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
});
