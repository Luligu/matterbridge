/**
 * @file packages/core/vitest/behaviors/matterbridgeServer.test.ts
 * @description This file contains the tests for the MatterbridgeServer behavior.
 * @author Luca Liguori
 */

/* oxlint-disable vitest/no-commented-out-tests */
/* oxlint-disable vitest/no-conditional-expect */
/* oxlint-disable typescript/explicit-function-return-type */

// TODO: analyze each rule

const NAME = 'MatterbridgeServer';
const MATTER_PORT = 11500;
const MATTER_CREATE_ONLY = true;

import { Bytes } from '@matter/general';
import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { OnOffBaseServer } from '@matter/node/behaviors/on-off';
import { Status } from '@matter/types';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/types/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { FanControl } from '@matter/types/clusters/fan-control';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getEnhancedMoveHueRequest,
  getEnhancedMoveToHueAndSaturationRequest,
  getEnhancedMoveToHueRequest,
  getEnhancedStepHueRequest,
  getMoveColorRequest,
  getMoveColorTemperatureRequest,
  getMoveHueRequest,
  getMoveRequest,
  getMoveSaturationRequest,
  getMoveToColorRequest,
  getMoveToColorTemperatureRequest,
  getMoveToHueAndSaturationRequest,
  getMoveToHueRequest,
  getMoveToLevelRequest,
  getMoveToSaturationRequest,
  getOffWithEffectRequest,
  getOnWithTimedOffRequest,
  getStepColorRequest,
  getStepColorTemperatureRequest,
  getStepHueRequest,
  getStepRequest,
  getStepSaturationRequest,
  getStopMoveStepRequest,
  getStopRequest,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { type AnsiLogger, LogLevel } from 'node-ansi-logger';

import { MatterbridgeDoorLockServer } from '../../src/behaviors/doorLockServer.js';
import { MatterbridgeServer } from '../../src/behaviors/matterbridgeServer.js';
import { MatterbridgeSmokeCoAlarmServer } from '../../src/behaviors/smokeCoAlarmServer.js';
import { MatterbridgeThermostatServer } from '../../src/behaviors/thermostatServer.js';
import { RoboticVacuumCleaner } from '../../src/devices/roboticVacuumCleaner.js';
import {
  airPurifier,
  bridge,
  contactSensor,
  deviceEnergyManagement,
  doorLock,
  extendedColorLight,
  fan,
  genericSwitch,
  laundryWasher,
  lightSensor,
  modeSelect,
  occupancySensor,
  onOffLight,
  powerSource,
  smokeCoAlarm,
  temperatureSensor,
  thermostat,
  windowCovering,
} from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import type { CommandHandler, CommandHandlers } from '../../src/matterbridgeEndpointCommandHandler.js';
import { internalFor } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Server clusters and behaviors', () => {
  let light: MatterbridgeEndpoint;
  let enhancedLight: MatterbridgeEndpoint;
  let button: MatterbridgeEndpoint;
  let coverLift: MatterbridgeEndpoint;
  let coverLiftTilt: MatterbridgeEndpoint;
  let lock: MatterbridgeEndpoint;
  let vent: MatterbridgeEndpoint;
  let thermo: MatterbridgeEndpoint;
  let thermostatPreset: MatterbridgeEndpoint;
  let thermostatSchedule: MatterbridgeEndpoint;
  let thermostatSuggestion: MatterbridgeEndpoint;
  let smoke: MatterbridgeEndpoint;
  let contact: MatterbridgeEndpoint;
  let mode: MatterbridgeEndpoint;
  let purifier: MatterbridgeEndpoint;
  let energyManagement: MatterbridgeEndpoint;
  let washer: MatterbridgeEndpoint;
  let rvc: RoboticVacuumCleaner;

  const thermostatPresetTypes: Thermostat.PresetType[] = [
    { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
    { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 2, presetTypeFeatures: { automatic: false, supportsNames: true } },
  ];
  const thermostatPresets: Thermostat.Preset[] = [
    { presetHandle: Uint8Array.from([0]), presetScenario: Thermostat.PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: null },
    { presetHandle: Uint8Array.from([1]), presetScenario: Thermostat.PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: null },
  ];

  function createPresetThermostatEndpoint(id: string): MatterbridgeEndpoint {
    const endpoint = new MatterbridgeEndpoint(thermostat, { id });
    endpoint.createDefaultPresetsThermostatClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activePresetHandle: Uint8Array | null
      thermostatPresets, // presetsList: Thermostat.Preset[]
      thermostatPresetTypes, // presetTypesList: Thermostat.PresetType[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  const thermostatScheduleTypes: Thermostat.ScheduleType[] = [
    {
      systemMode: Thermostat.SystemMode.Auto,
      numberOfSchedules: 2,
      scheduleTypeFeatures: { supportsSetpoints: true, supportsNames: true, supportsPresets: false, supportsOff: false },
    },
  ];
  const thermostatSchedules: Thermostat.Schedule[] = [
    {
      scheduleHandle: Uint8Array.from([0]),
      systemMode: Thermostat.SystemMode.Auto,
      name: 'Weekdays',
      transitions: [
        { dayOfWeek: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true }, transitionTime: 420, coolingSetpoint: 2500, heatingSetpoint: 2100 },
      ],
      builtIn: null,
    },
    {
      scheduleHandle: Uint8Array.from([1]),
      systemMode: Thermostat.SystemMode.Auto,
      name: 'Weekend',
      transitions: [{ dayOfWeek: { saturday: true, sunday: true }, transitionTime: 480, coolingSetpoint: 2700, heatingSetpoint: 1900 }],
      builtIn: null,
    },
  ];

  function createScheduleThermostatEndpoint(id: string): MatterbridgeEndpoint {
    const endpoint = new MatterbridgeEndpoint(thermostat, { id });
    endpoint.createDefaultSchedulesThermostatClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activeScheduleHandle: Uint8Array | null
      thermostatSchedules, // schedules: Thermostat.Schedule[]
      thermostatScheduleTypes, // scheduleTypes: Thermostat.ScheduleType[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  function createThermostatSuggestionEndpoint(id: string): MatterbridgeEndpoint {
    const endpoint = new MatterbridgeEndpoint(thermostat, { id });
    endpoint.createDefaultThermostatSuggestionsClusterServer(
      23,
      21,
      25,
      2,
      0,
      48,
      2,
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      Uint8Array.from([0]), // activePresetHandle: Uint8Array | null
      thermostatPresets, // presetsList: Thermostat.Preset[]
      thermostatPresetTypes, // presetTypesList: Thermostat.PresetType[]
      [], // thermostatSuggestions: Thermostat.ThermostatSuggestion[]
    );
    endpoint.addRequiredClusterServers();
    return endpoint;
  }

  // oxlint-disable-next-line typescript/explicit-function-return-type
  async function expectCommand(endpoint: MatterbridgeEndpoint, cluster: any, command: CommandHandlers, expectedRequest?: object, check?: (data: any) => void) {
    let invoke: Promise<void>;

    await new Promise((resolve, reject) => {
      endpoint.addCommandHandler(command, (data) => {
        try {
          expect(data.endpoint).toBe(endpoint);
          if (expectedRequest === undefined) expect(data.request).toEqual({});
          else expect(data.request).toEqual(expectedRequest);
          check?.(data);
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
      invoke = expectedRequest === undefined ? endpoint.invokeBehaviorCommand(cluster, command) : endpoint.invokeBehaviorCommand(cluster, command, expectedRequest);
    });

    // @ts-expect-error Typescript doesn't know that the command handler will be executed before this line
    await invoke;
  }

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('can be constructed', () => {
    const state = new MatterbridgeServer.State();
    expect(state).toBeInstanceOf(MatterbridgeServer.State);
    state.log = {} as AnsiLogger;
    state.commandHandler = {} as CommandHandler;

    expect(state.log).toBeDefined();
    expect(state.commandHandler).toBeDefined();
  });

  test('Device type: extendedLight', async () => {
    light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    expect(light).toBeDefined();

    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, light)).toBeTruthy();
  });

  test('PowerSource server', async () => {
    const poweredDevice = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'powerSourceTest' });
    const constructionCallbacks: Array<() => unknown> = [];
    const onSuccess = poweredDevice.construction.onSuccess.bind(poweredDevice.construction);

    vi.spyOn(poweredDevice.construction, 'onSuccess').mockImplementation((callback) => {
      constructionCallbacks.push(callback);
      return onSuccess(callback);
    });

    poweredDevice.createDefaultBridgedDeviceBasicInformationClusterServer('PowerSource Test', 'SNPS123456');
    poweredDevice.createDefaultPowerSourceWiredClusterServer();
    poweredDevice.addRequiredClusterServers();

    poweredDevice.addChildDeviceType('temperature', temperatureSensor).addRequiredClusterServers();
    poweredDevice.addChildDeviceType('light', lightSensor).addRequiredClusterServers();
    const notReadyChild = poweredDevice.addChildDeviceType('pending', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, poweredDevice)).toBeTruthy();
    vi.spyOn(notReadyChild.lifecycle, 'isReady', 'get').mockReturnValue(false);
    await Promise.resolve(constructionCallbacks.at(-1)?.());
    expect(poweredDevice.getAttribute(PowerSource.id, 'endpointList')).toEqual([
      poweredDevice.number,
      ...poweredDevice.parts.filter((endpoint) => endpoint.lifecycle.isReady).map((endpoint) => endpoint.number),
    ]);
  });

  test('Switch server', async () => {
    button = new MatterbridgeEndpoint([genericSwitch, powerSource], { id: 'genericSwitch' });
    button.addRequiredClusterServers();
    expect(button).toBeDefined();
    expect(await addDevice(aggregator, button)).toBeTruthy();
  });

  test('Device type: enhancedLight', async () => {
    enhancedLight = new MatterbridgeEndpoint([onOffLight, bridge, powerSource], { id: 'enhancedLight' });
    enhancedLight.createDefaultBridgedDeviceBasicInformationClusterServer('Enhanced Light', 'SN87654321');
    enhancedLight.createDefaultPowerSourceWiredClusterServer();
    enhancedLight.createDefaultOnOffClusterServer(true);
    enhancedLight.createEnhancedColorControlClusterServer();
    enhancedLight.addRequiredClusterServers();
    expect(enhancedLight).toBeDefined();
    expect(await addDevice(aggregator, enhancedLight)).toBeTruthy();
  });

  test('Device type: coverLift', async () => {
    coverLift = new MatterbridgeEndpoint(windowCovering, { id: 'coverLift' });
    coverLift.addRequiredClusterServers();
    expect(coverLift).toBeDefined();
    expect(await addDevice(aggregator, coverLift)).toBeTruthy();
  });

  test('Device type: coverLiftTilt', async () => {
    coverLiftTilt = new MatterbridgeEndpoint(windowCovering, { id: 'coverLiftTilt' });
    coverLiftTilt.createDefaultLiftTiltWindowCoveringClusterServer();
    coverLiftTilt.addRequiredClusterServers();
    expect(coverLiftTilt).toBeDefined();
    expect(await addDevice(aggregator, coverLiftTilt)).toBeTruthy();
  });

  test('Device type: doorLock', async () => {
    lock = new MatterbridgeEndpoint(doorLock, { id: 'doorLock' });
    lock.addRequiredClusterServers();
    expect(lock).toBeDefined();
    expect(await addDevice(aggregator, lock)).toBeTruthy();
    // Disable timeout for testing, to avoid flaky tests
    const internal = await internalFor(lock, MatterbridgeDoorLockServer);
    expect(internal).toBeDefined();
    if (!internal) throw new Error('MatterbridgeDoorLockServer internal state not found');
    if ((internal as any).enableTimeout !== undefined) (internal as any).enableTimeout = false;
  });

  test('Device type: fan', async () => {
    vent = new MatterbridgeEndpoint(fan, { id: 'fan' });
    vent.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    vent.createDefaultHepaFilterMonitoringClusterServer();
    vent.addRequiredClusterServers();
    expect(vent).toBeDefined();
    expect(await addDevice(aggregator, vent)).toBeTruthy();
  });

  test('Device type: thermostat', async () => {
    thermo = new MatterbridgeEndpoint(thermostat, { id: 'thermostat' });
    thermo.addRequiredClusterServers();
    expect(thermo).toBeDefined();
    expect(await addDevice(aggregator, thermo)).toBeTruthy();
  });

  test('Device type: thermostatPreset', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPreset');
    expect(thermostatPreset).toBeDefined();
    expect(await addDevice(aggregator, thermostatPreset)).toBeTruthy();
  });

  test('Device type: smokeSensor', async () => {
    smoke = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'smokeSensor' });
    smoke.createDefaultSmokeCOAlarmClusterServer();
    smoke.addRequiredClusterServers();
    expect(smoke).toBeDefined();
    expect(await addDevice(aggregator, smoke)).toBeTruthy();
  });

  test('Device type: contactSensor', async () => {
    contact = new MatterbridgeEndpoint(contactSensor, { id: 'contactSensor' });
    contact.createDefaultBooleanStateConfigurationClusterServer();
    contact.addRequiredClusterServers();
    expect(contact).toBeDefined();
    expect(await addDevice(aggregator, contact)).toBeTruthy();
  });

  test('Device type: modeSelect', async () => {
    mode = new MatterbridgeEndpoint(modeSelect, { id: 'modeSelect' });
    mode.createDefaultModeSelectClusterServer('Night mode', [
      { label: 'Led ON', mode: 0, semanticTags: [] },
      { label: 'Led OFF', mode: 1, semanticTags: [] },
    ]);
    mode.addRequiredClusterServers();
    expect(mode).toBeDefined();
    expect(await addDevice(aggregator, mode)).toBeTruthy();
  });

  test('Device type: airPurifier', async () => {
    purifier = new MatterbridgeEndpoint(airPurifier, { id: 'airPurifier' });
    purifier.createDefaultHepaFilterMonitoringClusterServer(40);
    purifier.createDefaultActivatedCarbonFilterMonitoringClusterServer(30);
    purifier.addRequiredClusterServers();
    expect(purifier).toBeDefined();
    expect(await addDevice(aggregator, purifier)).toBeTruthy();
  });

  test('Device type: deviceEnergyManagement', async () => {
    energyManagement = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagement' });
    energyManagement.createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Other, false, DeviceEnergyManagement.EsaState.Online, -3000, 2000);
    energyManagement.createDefaultDeviceEnergyManagementModeClusterServer();
    energyManagement.addRequiredClusterServers();
    expect(energyManagement).toBeDefined();
    expect(await addDevice(aggregator, energyManagement)).toBeTruthy();
  });

  test('Device type: laundryWasher', async () => {
    washer = new MatterbridgeEndpoint(laundryWasher, { id: 'laundryWasher' });
    washer.createDefaultOperationalStateClusterServer();
    washer.addRequiredClusterServers();
    expect(washer).toBeDefined();
    expect(await addDevice(aggregator, washer)).toBeTruthy();
  });

  test('Device type: roboticVacuumCleaner', async () => {
    rvc = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(rvc).toBeDefined();
    expect(await addDevice(aggregator, rvc)).toBeTruthy();
  });

  test('Identify server', async () => {
    await expectCommand(light, Identify, 'identify', { identifyTime: 1 }, (data) => {
      expect(data.cluster).toBe(Identify.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
    await light.invokeBehaviorCommand(Identify, 'identify', { identifyTime: 0 }); // Turn off identify mode

    await expectCommand(light, Identify, 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default }, (data) => {
      expect(data.cluster).toBe(Identify.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
  });

  test('OnOff server', async () => {
    await expectCommand(light, OnOff, 'on', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });

    await expectCommand(light, OnOff, 'off', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(true);
    });

    await expectCommand(light, OnOff, 'toggle', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });

    // GlobalSceneControl defaults to true; reset it so offWithEffect() doesn't try to store the global scene.
    await light.setStateOf(OnOffBaseServer, { globalSceneControl: false });

    const offWithEffectRequest = getOffWithEffectRequest(OnOff.EffectIdentifier.DelayedAllOff, 0);
    await expectCommand(light, OnOff, 'OnOff.offWithEffect', offWithEffectRequest, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(true);
    });

    // GlobalSceneControl set to true makes onWithRecallGlobalScene() return early without touching the fabric-scoped scene APIs.
    await light.setStateOf(OnOffBaseServer, { globalSceneControl: true });

    await expectCommand(light, OnOff, 'OnOff.onWithRecallGlobalScene', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });

    const onWithTimedOffRequest = getOnWithTimedOffRequest(false, 0, 0);
    await expectCommand(light, OnOff, 'OnOff.onWithTimedOff', onWithTimedOffRequest, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
  });

  test('LevelControl server', async () => {
    const moveToLevelRequest = getMoveToLevelRequest(100, 5, false);
    await expectCommand(light, LevelControl, 'moveToLevel', moveToLevelRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(254);
    });

    const moveToLevelWithOnOffRequest = getMoveToLevelRequest(150, 3, false);
    await expectCommand(light, LevelControl, 'moveToLevelWithOnOff', moveToLevelWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(100);
    });

    const moveRequest = getMoveRequest(LevelControl.MoveMode.Up, 5, false);
    await expectCommand(light, LevelControl, 'LevelControl.move', moveRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(150);
    });

    const moveWithOnOffRequest = getMoveRequest(LevelControl.MoveMode.Down, 5, false);
    await expectCommand(light, LevelControl, 'LevelControl.moveWithOnOff', moveWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(254);
    });

    const stepRequest = getStepRequest(LevelControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, LevelControl, 'LevelControl.step', stepRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(1);
    });

    const stepWithOnOffRequest = getStepRequest(LevelControl.StepMode.Down, 10, 3, false);
    await expectCommand(light, LevelControl, 'LevelControl.stepWithOnOff', stepWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(11);
    });

    const stopRequest = getStopRequest(false);
    await expectCommand(light, LevelControl, 'LevelControl.stop', stopRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(1);
    });

    const stopWithOnOffRequest = getStopRequest(false);
    await expectCommand(light, LevelControl, 'LevelControl.stopWithOnOff', stopWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(1);
    });
  });

  test('ColorControl server', async () => {
    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(light, ColorControl, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(light, ColorControl, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(light, ColorControl, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(light, ColorControl, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(light, ColorControl, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveHueRequest = getMoveHueRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveHue', moveHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const stepHueRequest = getStepHueRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepHue', stepHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveSaturationRequest = getMoveSaturationRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveSaturation', moveSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const stepSaturationRequest = getStepSaturationRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepSaturation', stepSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveColorRequest = getMoveColorRequest(100, 100, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveColor', moveColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const stepColorRequest = getStepColorRequest(100, 100, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepColor', stepColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const moveColorTemperatureRequest = getMoveColorTemperatureRequest(ColorControl.MoveMode.Up, 5, 153, 500, false);
    await expectCommand(light, ColorControl, 'ColorControl.moveColorTemperature', moveColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const stepColorTemperatureRequest = getStepColorTemperatureRequest(ColorControl.StepMode.Up, 10, 3, 153, 500, false);
    await expectCommand(light, ColorControl, 'ColorControl.stepColorTemperature', stepColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const stopMoveStepRequest = getStopMoveStepRequest(false);
    await expectCommand(light, ColorControl, 'ColorControl.stopMoveStep', stopMoveStepRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
  });

  test('EnhancedColorControl server', async () => {
    const expectEnhancedColorAttributes = (expected: {
      colorMode: number;
      enhancedColorMode: number;
      currentHue: number;
      enhancedCurrentHue: number;
      currentSaturation: number;
      currentX: number;
      currentY: number;
      colorTemperatureMireds: number;
    }) => {
      expect(enhancedLight.getAttribute(ColorControl.id, 'colorMode')).toBe(expected.colorMode);
      expect(enhancedLight.getAttribute(ColorControl.id, 'enhancedColorMode')).toBe(expected.enhancedColorMode);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentHue')).toBe(expected.currentHue);
      expect(enhancedLight.getAttribute(ColorControl.id, 'enhancedCurrentHue')).toBe(expected.enhancedCurrentHue);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentSaturation')).toBe(expected.currentSaturation);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentX')).toBe(expected.currentX);
      expect(enhancedLight.getAttribute(ColorControl.id, 'currentY')).toBe(expected.currentY);
      expect(enhancedLight.getAttribute(ColorControl.id, 'colorTemperatureMireds')).toBe(expected.colorTemperatureMireds);
    };

    const moveToHueRequest = getMoveToHueRequest(180, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToHue', moveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 0,
      currentSaturation: 0,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const enhancedMoveToHueRequest = getEnhancedMoveToHueRequest(32000, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'enhancedMoveToHue', enhancedMoveToHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
      expect(data.attributes.enhancedCurrentHue).toBe(0);
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 0,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToSaturationRequest = getMoveToSaturationRequest(100, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToSaturation', moveToSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToHueAndSaturationRequest = getMoveToHueAndSaturationRequest(180, 100, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToHueAndSaturation', moveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const enhancedMoveToHueAndSaturationRequest = getEnhancedMoveToHueAndSaturationRequest(32000, 100, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'enhancedMoveToHueAndSaturation', enhancedMoveToHueAndSaturationRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
      expect(data.attributes.enhancedCurrentHue).toBe(32000);
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 0,
      currentY: 0,
      colorTemperatureMireds: 500,
    });

    const moveToColorRequest = getMoveToColorRequest(30000, 30000, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToColor', moveToColorRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.CurrentXAndCurrentY,
      enhancedColorMode: ColorControl.EnhancedColorMode.CurrentXAndCurrentY,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 30000,
      currentY: 30000,
      colorTemperatureMireds: 500,
    });

    const moveToColorTemperatureRequest = getMoveToColorTemperatureRequest(250, 0, false);
    await expectCommand(enhancedLight, ColorControl, 'moveToColorTemperature', moveToColorTemperatureRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
    expectEnhancedColorAttributes({
      colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
      enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
      currentHue: 180,
      enhancedCurrentHue: 32000,
      currentSaturation: 100,
      currentX: 30000,
      currentY: 30000,
      colorTemperatureMireds: 250,
    });

    const enhancedMoveHueRequest = getEnhancedMoveHueRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(enhancedLight, ColorControl, 'ColorControl.enhancedMoveHue', enhancedMoveHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const enhancedStepHueRequest = getEnhancedStepHueRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(enhancedLight, ColorControl, 'ColorControl.enhancedStepHue', enhancedStepHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });
  });

  test('LiftWindowCovering server', async () => {
    const expectLiftCoverAttributes = (expected: {
      operationalStatus: { global: number; lift: number; tilt: number };
      currentPositionLiftPercent100ths: number;
      targetPositionLiftPercent100ths: number;
    }) => {
      expect(coverLift.getAttribute(WindowCovering.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverLift.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths')).toBe(expected.currentPositionLiftPercent100ths);
      expect(coverLift.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(expected.targetPositionLiftPercent100ths);
    };

    await expectCommand(coverLift, WindowCovering, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
    });

    await expectCommand(coverLift, WindowCovering, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
    });

    await expectCommand(coverLift, WindowCovering, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
    });

    await expectCommand(coverLift, WindowCovering, 'goToLiftPercentage', { liftPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
    });
  });

  test('LiftTiltWindowCovering server', async () => {
    const expectLiftTiltCoverAttributes = (expected: {
      operationalStatus: { global: number; lift: number; tilt: number };
      currentPositionLiftPercent100ths: number;
      targetPositionLiftPercent100ths: number;
      currentPositionTiltPercent100ths: number;
      targetPositionTiltPercent100ths: number;
    }) => {
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'operationalStatus')).toEqual(expected.operationalStatus);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'currentPositionLiftPercent100ths')).toBe(expected.currentPositionLiftPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'targetPositionLiftPercent100ths')).toBe(expected.targetPositionLiftPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'currentPositionTiltPercent100ths')).toBe(expected.currentPositionTiltPercent100ths);
      expect(coverLiftTilt.getAttribute(WindowCovering.id, 'targetPositionTiltPercent100ths')).toBe(expected.targetPositionTiltPercent100ths);
    };

    await expectCommand(coverLiftTilt, WindowCovering, 'upOrOpen', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 0,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 0,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'downOrClose', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'stopMotion', undefined, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 10000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'goToLiftPercentage', { liftPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 10000,
    });

    await expectCommand(coverLiftTilt, WindowCovering, 'goToTiltPercentage', { tiltPercent100thsValue: 5000 }, (data) => {
      expect(data.cluster).toBe('windowCovering');
    });
    expectLiftTiltCoverAttributes({
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      currentPositionLiftPercent100ths: 0,
      targetPositionLiftPercent100ths: 5000,
      currentPositionTiltPercent100ths: 0,
      targetPositionTiltPercent100ths: 5000,
    });
  });

  test('DoorLock server', async () => {
    expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Locked);
    expect(lock.behaviors.has(MatterbridgeDoorLockServer.with())).toBeTruthy();
    expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands.has('lockDoor')).toBeTruthy();
    expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands.has('unlockDoor')).toBeTruthy();
    expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer.with()).commands.has('unlockWithTimeout')).toBeTruthy();

    await expectCommand(lock, DoorLock, 'DoorLock.unlockDoor', {}, (data) => {
      expect(data.cluster).toBe('doorLock');
    });
    expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Unlocked);

    await expectCommand(lock, DoorLock, 'DoorLock.lockDoor', {}, (data) => {
      expect(data.cluster).toBe('doorLock');
    });
    expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Locked);

    await expectCommand(lock, DoorLock, 'DoorLock.unlockWithTimeout', { timeout: 5 }, (data) => {
      expect(data.cluster).toBe('doorLock');
    });
    expect(lock.getCluster(DoorLock)?.lockState).toBe(DoorLock.LockState.Unlocked);
  });

  test('FanControl server', async () => {
    // vent uses createDefaultFanControlClusterServer() (Auto + Step, FanModeSequence OffLowMedHighAuto), whose
    // 1-100 PercentSetting domain splits into Low 1-33 / Medium 34-66 / High 67-100 (see fanControlServer.ts's
    // computePercentRanges()). Step (Matter 1.6 Application Cluster Spec § 4.4.7.1.5) moves FanMode across that
    // step sequence and lands PercentSetting/PercentCurrent on the boundary of the newly-entered range, so
    // positioning between calls is done via FanMode (not PercentCurrent directly, which Step itself derives).
    const stepCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    vent.addCommandHandler('step', (data) => {
      stepCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(0);

    // Off -> Low (lowest step value above Off).
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false });
    expect(stepCalls[0]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Low);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(1);

    // High, Increase without wrap: already at the highest step value, so it wraps only because Wrap is true here.
    await vent.setAttribute(FanControl.id, 'fanMode', FanControl.FanMode.High);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false });
    expect(stepCalls[1]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Low);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(1);

    // High, Increase with Wrap and LowestOff: wraps all the way to Off.
    await vent.setAttribute(FanControl.id, 'fanMode', FanControl.FanMode.High);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true });
    expect(stepCalls[2]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(0);

    // Medium -> Low (highest step value below Medium).
    await vent.setAttribute(FanControl.id, 'fanMode', FanControl.FanMode.Medium);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false });
    expect(stepCalls[3]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Low);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(33);

    // Low, Decrease with Wrap (no reposition — continues from the previous step's Low): wraps to High.
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false });
    expect(stepCalls[4]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.High);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(100);

    // Off, Decrease with Wrap and LowestOff: wraps to High (Off is itself the bottom of the step sequence here).
    await vent.setAttribute(FanControl.id, 'fanMode', FanControl.FanMode.Off);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true });
    expect(stepCalls[5]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.High);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(100);

    // Low, Decrease without wrap, LowestOff true: steps down to Off.
    await vent.setAttribute(FanControl.id, 'fanMode', FanControl.FanMode.Low);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: true });
    expect(stepCalls[6]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: true } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(0);

    // An invalid Direction value is malformed input, not a valid Decrease: a safe no-op, not a guess.
    await vent.setAttribute(FanControl.id, 'fanMode', FanControl.FanMode.Medium);
    await vent.setAttribute(FanControl.id, 'percentCurrent', 30);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: 99 as FanControl.StepDirection, wrap: false, lowestOff: false });
    expect(stepCalls[7]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: 99, wrap: false, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'fanMode')).toBe(FanControl.FanMode.Medium);
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(30);
  });

  test('Thermostat server', async () => {
    const setBothRequest = { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 };
    const setHeatRequest = { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 };
    const setCoolRequest = { mode: Thermostat.SetpointRaiseLowerMode.Cool, amount: 5 };
    const initialThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(initialThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2100, occupiedCoolingSetpoint: 2500 });
    const thermostatBehavior = MatterbridgeThermostatServer.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode);
    expect((thermo.stateOf(thermostatBehavior) as any).acceptedCommandList).toEqual([0]);
    expect((thermo.stateOf(thermostatBehavior) as any).generatedCommandList).toEqual([]);

    await expectCommand(thermo, Thermostat, 'setpointRaiseLower', setBothRequest, (data) => {
      expect(data.cluster).toBe('thermostat');
    });

    let updatedThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2150, occupiedCoolingSetpoint: 2550 });

    await thermo.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setHeatRequest);
    updatedThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2550 });

    await thermo.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setCoolRequest);

    updatedThermostatCluster = thermo.getCluster(MatterbridgeThermostatServer);

    expect(updatedThermostatCluster).toMatchObject({ occupiedHeatingSetpoint: 2200, occupiedCoolingSetpoint: 2600 });
  });

  /*
  test('Thermostat server ignores undefined occupied setpoints', async () => {
    const executeHandler = jest.fn();
    const info = jest.fn();
    const debug = jest.fn();
    const thermostatState = { occupiedHeatingSetpoint: undefined, occupiedCoolingSetpoint: undefined };
    const endpoint = {
      maybeId: 'thermostatUndefinedSetpoints',
      maybeNumber: 1,
      stateOf: () => ({ log: { info, debug }, commandHandler: { executeHandler } }),
    };
    const thermostatServer = { state: thermostatState, endpoint } as unknown as MatterbridgeThermostatServer;

    await MatterbridgeThermostatServer.prototype.setpointRaiseLower.call(thermostatServer, { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 });

    expect(executeHandler).toHaveBeenCalledWith('Thermostat.setpointRaiseLower', {
      request: { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 },
      cluster: 'thermostat',
      attributes: thermostatState,
      endpoint,
    });
    expect(info).toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('MatterbridgeThermostatServer: setpointRaiseLower called with mode: Both amount: 0.5');
    expect(thermostatState.occupiedHeatingSetpoint).toBeUndefined();
    expect(thermostatState.occupiedCoolingSetpoint).toBeUndefined();
  });
  */

  test('PresetThermostat server', async () => {
    thermostatPreset = createPresetThermostatEndpoint('thermostatPresetBehavior');
    expect(await addDevice(aggregator, thermostatPreset)).toBeTruthy();

    const formatPresetHandleForLog = (presetHandle: Uint8Array | null) => (presetHandle ? `0x${Buffer.from(presetHandle).toString('hex')}` : 'null');
    const setHeatRequest = { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 };
    const setCoolRequest = { mode: Thermostat.SetpointRaiseLowerMode.Cool, amount: 5 };
    const firstPresetRequest = { presetHandle: Uint8Array.from([0]) };
    const secondPresetRequest = { presetHandle: Uint8Array.from([1]) };
    const clearPresetRequest = { presetHandle: null };
    const invalidPresetRequest = { presetHandle: Uint8Array.from([9]) };
    const presetThermostatBehavior = MatterbridgeThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.Presets,
    );
    const presetCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];

    thermostatPreset.addCommandHandler('setActivePresetRequest', (data) => {
      presetCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    const expectPresetThermostatAttributes = (activePresetHandle: Uint8Array | null, occupiedHeatingSetpoint: number = 2100, occupiedCoolingSetpoint: number = 2500) => {
      const presetThermostatCluster = thermostatPreset.getCluster(presetThermostatBehavior);

      expect(presetThermostatCluster).toMatchObject({
        localTemperature: 2300,
        systemMode: Thermostat.SystemMode.Auto,
        occupiedHeatingSetpoint,
        occupiedCoolingSetpoint,
        numberOfPresets: 2,
      });
      expect(presetThermostatCluster?.activePresetHandle === null ? null : JSON.stringify(Object.values(presetThermostatCluster?.activePresetHandle ?? {}))).toBe(
        activePresetHandle === null ? null : JSON.stringify(Array.from(activePresetHandle)),
      );
      expect(presetThermostatCluster?.presets).toHaveLength(2);
      expect(presetThermostatCluster?.presets?.[0]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Occupied,
        name: 'Occupied',
        coolingSetpoint: 2500,
        heatingSetpoint: 2100,
        builtIn: true,
      });
      expect(JSON.stringify(Object.values(presetThermostatCluster?.presets?.[0]?.presetHandle ?? {}))).toBe(JSON.stringify([0]));
      expect(presetThermostatCluster?.presets?.[1]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        name: 'Unoccupied',
        coolingSetpoint: 2700,
        heatingSetpoint: 1900,
        builtIn: true,
      });
      expect(JSON.stringify(Object.values(presetThermostatCluster?.presets?.[1]?.presetHandle ?? {}))).toBe(JSON.stringify([1]));
      expect(presetThermostatCluster?.presetTypes).toHaveLength(2);
      expect(presetThermostatCluster?.presetTypes?.[0]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Occupied,
        numberOfPresets: 2,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      });
      expect(presetThermostatCluster?.presetTypes?.[1]).toMatchObject({
        presetScenario: Thermostat.PresetScenario.Unoccupied,
        numberOfPresets: 2,
        presetTypeFeatures: { automatic: false, supportsNames: true },
      });
    };

    expectPresetThermostatAttributes(Uint8Array.from([0]));

    await expectCommand(thermostatPreset, Thermostat, 'setpointRaiseLower', setHeatRequest, (data) => {
      expect(data.cluster).toBe('thermostat');
    });

    expectPresetThermostatAttributes(null, 2150, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setpointRaiseLower', setCoolRequest);

    expectPresetThermostatAttributes(null, 2150, 2550);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', firstPresetRequest);

    expect(presetCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: firstPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(firstPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 2100, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', secondPresetRequest);
    expect(presetCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: secondPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(secondPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', clearPresetRequest);
    expect(presetCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: clearPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting preset to ${formatPresetHandleForLog(clearPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await expect(thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', invalidPresetRequest)).rejects.toThrow('Requested PresetHandle not found');
    expect(presetCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: invalidPresetRequest });
    expect(presetCalls).toHaveLength(4);
    expectPresetThermostatAttributes(null, 1900, 2700);
  });

  test('ScheduleThermostat server', async () => {
    thermostatSchedule = createScheduleThermostatEndpoint('thermostatScheduleBehavior');
    expect(await addDevice(aggregator, thermostatSchedule)).toBeTruthy();

    const scheduleThermostatBehavior = MatterbridgeThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.MatterScheduleConfiguration,
    );
    expect(thermostatSchedule.behaviors.has(scheduleThermostatBehavior)).toBeTruthy();
    expect(thermostatSchedule.behaviors.elementsOf(scheduleThermostatBehavior).commands.has('setActiveScheduleRequest')).toBeTruthy();

    const formatScheduleHandleForLog = (scheduleHandle: Uint8Array) => `0x${Buffer.from(scheduleHandle).toString('hex')}`;
    const secondScheduleRequest = { scheduleHandle: Uint8Array.from([1]) };
    const invalidScheduleRequest = { scheduleHandle: Uint8Array.from([9]) };
    const scheduleCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];

    thermostatSchedule.addCommandHandler('setActiveScheduleRequest', (data) => {
      scheduleCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([0]));

    await thermostatSchedule.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', secondScheduleRequest);
    expect(scheduleCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSchedule, request: secondScheduleRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeThermostatServer: setting schedule to ${formatScheduleHandleForLog(secondScheduleRequest.scheduleHandle)} (endpoint ${thermostatSchedule.id}.${thermostatSchedule.number})`,
    );
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));

    // The stored activeScheduleHandle must be a defensive copy, not a reference to the request payload.
    secondScheduleRequest.scheduleHandle[0] = 0xff;
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));

    await expect(thermostatSchedule.invokeBehaviorCommand('Thermostat', 'setActiveScheduleRequest', invalidScheduleRequest)).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(scheduleCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSchedule, request: invalidScheduleRequest });
    expect(scheduleCalls).toHaveLength(2);
    // The active schedule handle must not change when the requested schedule handle is invalid.
    expect(thermostatSchedule.getAttribute(Thermostat.id, 'activeScheduleHandle')).toEqual(Uint8Array.from([1]));
  });

  test('ThermostatSuggestion server', async () => {
    thermostatSuggestion = createThermostatSuggestionEndpoint('thermostatSuggestionBehavior');
    expect(await addDevice(aggregator, thermostatSuggestion)).toBeTruthy();

    const addCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    const removeCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];

    thermostatSuggestion.addCommandHandler('addThermostatSuggestion', (data) => {
      addCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });
    thermostatSuggestion.addCommandHandler('removeThermostatSuggestion', (data) => {
      removeCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'maxThermostatSuggestions')).toBe(5);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([0]));

    // Freeze the clock so EffectiveTime/ExpirationTime comparisons below are deterministic.
    const now = new Date('2026-01-15T10:00:00Z');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      const nowSeconds = Math.floor(now.getTime() / 1000);

      // A suggestion referencing an existing preset that is already effective (EffectiveTime in the past) is accepted
      // and immediately applied: CurrentThermostatSuggestion, ActivePresetHandle and ThermostatSuggestionNotFollowingReason
      // are updated, mirroring connectedhomeip's ReEvaluateCurrentSuggestion().
      const explicitRequest = { presetHandle: Uint8Array.from([1]), effectiveTime: nowSeconds - 60, expirationInMinutes: 30 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', explicitRequest);
      expect(addCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: explicitRequest });
      let suggestions = thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toMatchObject({ uniqueId: 0, effectiveTime: nowSeconds - 60, expirationTime: nowSeconds - 60 + 1800 });
      expect(JSON.stringify(Object.values(suggestions[0].presetHandle))).toBe(JSON.stringify([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();

      // A null effectiveTime means "immediately": the server fills in the current time. Since the first suggestion
      // became effective earlier, it keeps being the earliest active one and stays current.
      const immediateRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: null, expirationInMinutes: 60 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', immediateRequest);
      expect(addCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: immediateRequest });
      suggestions = thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions');
      expect(suggestions).toHaveLength(2);
      expect(suggestions[1].uniqueId).toBe(1);
      expect(suggestions[1].effectiveTime).toBe(nowSeconds);
      expect(suggestions[1].expirationTime).toBe(nowSeconds + 3600);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));

      // An EffectiveTime more than 24 hours in the future is rejected.
      const futureRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: nowSeconds + 24 * 60 * 60 + 1, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', futureRequest)).rejects.toThrow(
        'requested EffectiveTime is more than 24 hours in the future',
      );
      expect(addCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: futureRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);

      // An unknown PresetHandle is rejected, but the command is still forwarded to the command handler first.
      const invalidPresetRequest = { presetHandle: Uint8Array.from([9]), effectiveTime: nowSeconds, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', invalidPresetRequest)).rejects.toThrow('requested PresetHandle not found');
      expect(addCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: invalidPresetRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);

      // Fill the list up to MaxThermostatSuggestions (5) with suggestions that are not yet effective (2+ hours out),
      // then the next add is rejected as ResourceExhausted. None of them preempt the already-active current one.
      for (let i = 0; i < 3; i++) {
        await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
          presetHandle: Uint8Array.from([0]),
          effectiveTime: nowSeconds + 7200 + i * 60,
          expirationInMinutes: 30,
        });
      }
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(5);
      const overflowRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: nowSeconds, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', overflowRequest)).rejects.toThrow(
        'maximum number of thermostat suggestions reached',
      );
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(5);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });

      // Removing a different, not-yet-effective suggestion (uniqueId 4) keeps CurrentThermostatSuggestion unchanged.
      const removeOtherRequest = { uniqueId: 4 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeOtherRequest);
      expect(removeCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: removeOtherRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(4);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });

      // Removing the current suggestion (uniqueId 0) re-evaluates and applies the next earliest already-active one
      // (uniqueId 1), syncing ActivePresetHandle to it: the thermostat keeps following a suggestion automatically.
      const removeCurrentRequest = { uniqueId: 0 };
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeCurrentRequest);
      expect(removeCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: removeCurrentRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 1 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([0]));

      // An unknown UniqueID is rejected, but the command is still forwarded to the command handler first.
      const invalidRemoveRequest = { uniqueId: 99 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', invalidRemoveRequest)).rejects.toThrow('requested UniqueID not found');
      expect(removeCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: invalidRemoveRequest });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);

      // Once the current suggestion's ExpirationTime elapses and no other suggestion is effective yet, the next
      // add/remove call prunes the expired entry and clears CurrentThermostatSuggestion; ActivePresetHandle, which
      // reflects the last-followed preset, is intentionally left untouched (mirrors the reference behavior).
      // ThermostatSuggestionNotFollowingReason is set here to a non-null value beforehand to verify it is cleared
      // alongside CurrentThermostatSuggestion rather than leaking a stale reason (Matter spec: "If the
      // CurrentThermostatSuggestion attribute is null, this attribute shall be set to null").
      await thermostatSuggestion.setAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason', { ongoingHold: true });
      vi.setSystemTime(new Date((nowSeconds + 3601) * 1000));
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', { uniqueId: 3 });
      expect(removeCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: { uniqueId: 3 } });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(1);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([0]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();

      // A suggestion that becomes current, then expires, is pruned and re-evaluated as part of the next add/remove
      // call. If that call is itself rejected by a later validation (here EffectiveTime > 24h in the future), the
      // prune/re-evaluate performed earlier in the same command must not leak out: matter.js runs each command in
      // its own transaction and discards every mutation when the handler throws (LocalActorContext.act rejects the
      // transaction on error), so CurrentThermostatSuggestion/ThermostatSuggestions/ActivePresetHandle/
      // ThermostatSuggestionNotFollowingReason stay exactly as they were before the rejected command.
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
        presetHandle: Uint8Array.from([1]),
        effectiveTime: null,
        expirationInMinutes: 1,
      });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));

      await thermostatSuggestion.setAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason', { ongoingHold: true });
      vi.setSystemTime(new Date(Date.now() + 61_000)); // past the uniqueId 0 suggestion's 1-minute ExpirationTime
      const currentSeconds = Math.floor(Date.now() / 1000);
      const rejectedRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: currentSeconds + 25 * 60 * 60, expirationInMinutes: 30 };
      await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', rejectedRequest)).rejects.toThrow(
        'requested EffectiveTime is more than 24 hours in the future',
      );
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ uniqueId: 0 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toMatchObject({ ongoingHold: true });

      // The next successful command finally prunes the now-expired suggestion and re-evaluates: CurrentThermostatSuggestion
      // becomes null and ThermostatSuggestionNotFollowingReason is cleared; ActivePresetHandle is left untouched.
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', { uniqueId: 2 });
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'activePresetHandle')).toEqual(Uint8Array.from([1]));
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestionNotFollowingReason')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();

    // Seed 3 ThermostatSuggestions entries, all referencing preset 0, to set up the Presets removal cascade below (the
    // scenario above already drains the list to empty, so it is reseeded here through real add commands, matching the
    // earlier scenarios, rather than the try/finally-scoped flow above). The first, being immediately effective,
    // becomes CurrentThermostatSuggestion as part of the add command's own re-evaluation. Removing preset 0 via a
    // Presets atomic write deletes the referencing entries and, since CurrentThermostatSuggestion references that
    // preset, nulls it (Matter 1.6 Application Cluster Spec § 4.3.11.50, points 1-2). matter.js only fires
    // `presets$AtomicChanged` through a committed atomic write (AtomicWriteHandler), which local-actor/command-context
    // test writes bypass entirely, so the event is emitted directly here, matching how AtomicWriteHandler.commitWrite()
    // does it.
    for (let i = 0; i < 3; i++) {
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
        presetHandle: Uint8Array.from([0]),
        effectiveTime: null,
        expirationInMinutes: 30,
      });
    }
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toMatchObject({ presetHandle: Uint8Array.from([0]) });

    const thermostatSuggestionBehavior = MatterbridgeThermostatServer.with(
      Thermostat.Feature.Heating,
      Thermostat.Feature.Cooling,
      Thermostat.Feature.AutoMode,
      Thermostat.Feature.Presets,
      Thermostat.Feature.ThermostatSuggestions,
    );
    const presetsWithoutPreset0 = thermostatPresets.filter((p) => p.presetHandle === null || !Bytes.areEqual(p.presetHandle, Uint8Array.from([0])));
    thermostatSuggestion.eventsOf(thermostatSuggestionBehavior).presets$AtomicChanged?.emit(presetsWithoutPreset0, thermostatPresets, undefined as never);
    // The reactor runs in its own dedicated, independently-committed transaction (matching production), so its
    // effect is not necessarily visible synchronously after emit() returns.
    await vi.waitFor(() => {
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
    });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();

    // Regression test: CurrentThermostatSuggestion must be nulled whenever its own PresetHandle was removed, even
    // when the ThermostatSuggestions list itself is unaffected (already empty here, so its length doesn't change).
    // Matter 1.6 Application Cluster Spec § 4.3.11.50 point 1 applies to CurrentThermostatSuggestion independently
    // of point 2 (which only covers ThermostatSuggestions entries).
    await thermostatSuggestion.setAttribute(Thermostat.id, 'currentThermostatSuggestion', {
      uniqueId: 5,
      presetHandle: Uint8Array.from([1]),
      effectiveTime: 1700000000,
      expirationTime: 1700001800,
    });
    const presetsWithoutPreset1 = presetsWithoutPreset0.filter((p) => p.presetHandle === null || !Bytes.areEqual(p.presetHandle, Uint8Array.from([1])));
    thermostatSuggestion.eventsOf(thermostatSuggestionBehavior).presets$AtomicChanged?.emit(presetsWithoutPreset1, presetsWithoutPreset0, undefined as never);
    await vi.waitFor(() => {
      expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();
    });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(0);
  });

  test('removeThermostatSuggestionsForRemovedPresets branch coverage', () => {
    // Exercises MatterbridgeThermostatServer['removeThermostatSuggestionsForRemovedPresets'] directly against a stub
    // state/endpoint, mirroring the private-method call pattern used for setpointRaiseLower above. This sidesteps
    // matter.js's Presets struct validation on presets$AtomicChanged (which rejects a committed entry with a null
    // PresetHandle), letting each branch be exercised with data that would not otherwise reach the reactor.
    const info = vi.fn();
    const debug = vi.fn();
    const endpoint = {
      maybeId: 'thermostatSuggestionBranches',
      maybeNumber: 1,
      stateOf: () => ({ log: { info, debug } }),
    };
    const callReactor = (state: Record<string, unknown>, newPresets: Thermostat.Preset[], oldPresets: Thermostat.Preset[]) => {
      const server = { state, endpoint } as unknown as MatterbridgeThermostatServer;
      (
        MatterbridgeThermostatServer.prototype as unknown as { removeThermostatSuggestionsForRemovedPresets: (n: Thermostat.Preset[], o: Thermostat.Preset[]) => void }
      ).removeThermostatSuggestionsForRemovedPresets.call(server, newPresets, oldPresets);
    };
    const pendingPreset: Thermostat.Preset = {
      presetHandle: null,
      presetScenario: Thermostat.PresetScenario.Sleep,
      name: 'Pending',
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    };
    const preset2: Thermostat.Preset = {
      presetHandle: Uint8Array.from([2]),
      presetScenario: Thermostat.PresetScenario.Wake,
      name: 'Preset2',
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    };
    const preset3: Thermostat.Preset = {
      presetHandle: Uint8Array.from([3]),
      presetScenario: Thermostat.PresetScenario.Vacation,
      name: 'Preset3',
      coolingSetpoint: 2600,
      heatingSetpoint: 2000,
      builtIn: null,
    };
    const suggestionForPreset2: Thermostat.ThermostatSuggestion = { uniqueId: 10, presetHandle: Uint8Array.from([2]), effectiveTime: 1700000000, expirationTime: 1700003600 };
    const suggestionForPreset3: Thermostat.ThermostatSuggestion = { uniqueId: 11, presetHandle: Uint8Array.from([3]), effectiveTime: 1700000000, expirationTime: 1700003600 };

    // Line 76 false branch + line 84 true branch: a Preset with a null PresetHandle (skipped, not deduped through
    // Bytes.toHex(null)) among presets that are only added, never removed, so the reactor returns early untouched.
    const state1 = { thermostatSuggestions: [suggestionForPreset2], currentThermostatSuggestion: suggestionForPreset2, thermostatSuggestionNotFollowingReason: null };
    callReactor(state1, [pendingPreset, preset2, preset3], [pendingPreset, preset2]);
    expect(state1.thermostatSuggestions).toEqual([suggestionForPreset2]);
    expect(state1.currentThermostatSuggestion).toBe(suggestionForPreset2);
    expect(info).not.toHaveBeenCalled();

    // Line 97 true branch: a Preset is removed, but neither ThermostatSuggestions nor CurrentThermostatSuggestion
    // reference it, so the reactor returns early once it determines neither changed.
    const state2 = { thermostatSuggestions: [suggestionForPreset2], currentThermostatSuggestion: suggestionForPreset2, thermostatSuggestionNotFollowingReason: null };
    callReactor(state2, [pendingPreset, preset2], [pendingPreset, preset2, preset3]);
    expect(state2.thermostatSuggestions).toEqual([suggestionForPreset2]);
    expect(state2.currentThermostatSuggestion).toBe(suggestionForPreset2);
    expect(info).not.toHaveBeenCalled();

    // Line 106 false branch: the removed Preset is referenced by a ThermostatSuggestions entry (pruned) but not by
    // CurrentThermostatSuggestion, which is left untouched.
    const state3 = {
      thermostatSuggestions: [suggestionForPreset2, suggestionForPreset3],
      currentThermostatSuggestion: suggestionForPreset2,
      thermostatSuggestionNotFollowingReason: { ongoingHold: true },
    };
    callReactor(state3, [pendingPreset, preset2], [pendingPreset, preset2, preset3]);
    expect(state3.thermostatSuggestions).toEqual([suggestionForPreset2]);
    expect(state3.currentThermostatSuggestion).toBe(suggestionForPreset2);
    expect(state3.thermostatSuggestionNotFollowingReason).toEqual({ ongoingHold: true });
    expect(info).toHaveBeenCalledTimes(1);
  });

  test('SmokeCoAlarm server', async () => {
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);

    // Matter 1.6 Application Cluster Specification, 2.11.9.1.1 SelfTestRequest: a request is rejected with BUSY
    // when ExpressedState is not Normal (here forced via testInProgress, since the plugin command handler still
    // runs first regardless).
    await smoke.setAttribute(SmokeCoAlarm.id, 'testInProgress', true);
    await expect(smoke.invokeBehaviorCommand(SmokeCoAlarm, 'selfTestRequest')).rejects.toMatchObject({ code: Status.Busy });
    await smoke.setAttribute(SmokeCoAlarm.id, 'testInProgress', false);

    // Reduce the self-test duration so the timer-driven completion (#completeSelfTest) fires promptly and does not
    // leak a pending timer into later tests.
    const originalSelfTestDurationSeconds = MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds;
    MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds = 0;
    try {
      await expectCommand(smoke, SmokeCoAlarm, 'selfTestRequest', undefined, (data) => {
        expect(data.cluster).toBe('smokeCoAlarm');
      });
      // With selfTestDurationSeconds reduced to 0, the completion timer may already have fired by the time control
      // returns here, so only the post-completion state (not the transient Testing state) is asserted deterministically.
      await vi.waitFor(() => {
        expect(smoke.getAttribute(SmokeCoAlarm.id, 'testInProgress')).toBe(false);
      });
      expect(smoke.getAttribute(SmokeCoAlarm.id, 'expressedState')).toBe(SmokeCoAlarm.ExpressedState.Normal);
    } finally {
      MatterbridgeSmokeCoAlarmServer.selfTestDurationSeconds = originalSelfTestDurationSeconds;
    }

    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
  });

  test('BooleanStateConfiguration server', async () => {
    const suppressAlarmRequest = { alarmsToSuppress: { audible: true, visual: true } };
    const enableDisableAlarmRequest = { alarmsToEnableDisable: { audible: true, visual: true } };

    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsActive')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });

    await expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest)).rejects.toMatchObject({ code: Status.InvalidInState });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: false, audible: false });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsActive', { audible: true, visual: true });
    await contact.setAttribute('booleanStateConfiguration', 'alarmsSupported', { audible: true, visual: false });
    await expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest)).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: false, audible: false });

    await expect(contact.invokeBehaviorCommand(BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest)).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsSupported', { audible: true, visual: true });
    await expectCommand(contact, BooleanStateConfiguration, 'suppressAlarm', suppressAlarmRequest, (data) => {
      expect(data.cluster).toBe('booleanStateConfiguration');
    });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSuppressed')).toEqual({ visual: true, audible: true });

    await expectCommand(contact, BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest, (data) => {
      expect(data.cluster).toBe('booleanStateConfiguration');
    });

    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsActive')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsSuppressed', { audible: false, visual: false });
    const alarmsStateChangedEvents: unknown[] = [];
    const alarmsStateChanged = contact.eventsOf('booleanStateConfiguration').alarmsStateChanged;
    expect(alarmsStateChanged).toBeDefined();
    alarmsStateChanged?.on((event) => {
      alarmsStateChangedEvents.push(event);
    });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsActive', { audible: true, visual: false });
    expect(alarmsStateChangedEvents).toHaveLength(1);
    expect(alarmsStateChangedEvents[0]).toEqual({ alarmsActive: { audible: true, visual: false }, alarmsSuppressed: { visual: false, audible: false } });

    await contact.setAttribute('booleanStateConfiguration', 'alarmsSuppressed', { audible: true, visual: true });
    expect(alarmsStateChangedEvents).toHaveLength(2);
    expect(alarmsStateChangedEvents[1]).toEqual({ alarmsActive: { audible: true, visual: false }, alarmsSuppressed: { audible: true, visual: true } });

    const sensorFaultEvents: unknown[] = [];
    const sensorFault = contact.eventsOf('booleanStateConfiguration').sensorFault;
    expect(sensorFault).toBeDefined();
    sensorFault?.on((event) => {
      sensorFaultEvents.push(event);
    });

    await contact.setAttribute('booleanStateConfiguration', 'sensorFault', { generalFault: true });
    expect(sensorFaultEvents).toHaveLength(1);
    expect(sensorFaultEvents[0]).toEqual({ sensorFault: { generalFault: true } });
  });

  test('ModeSelect server', async () => {
    expect(mode.getAttribute(ModeSelect.id, 'currentMode')).toBe(0);

    await expectCommand(mode, ModeSelect, 'changeToMode', { newMode: 1 }, (data) => {
      expect(data.cluster).toBe('modeSelect');
    });

    expect(mode.getAttribute(ModeSelect.id, 'currentMode')).toBe(1);
  });

  test('HepaFilterMonitoring server', async () => {
    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'condition')).toBe(40);
    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'lastChangedTime')).toBeNull();

    await purifier.invokeBehaviorCommand(HepaFilterMonitoring, 'resetCondition');

    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'condition')).toBe(100);
    expect(typeof purifier.getAttribute(HepaFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeHepaFilterMonitoringServer: resetCondition called (endpoint ${purifier.id}.${purifier.number})`);
  });

  test('ActivatedCarbonFilterMonitoring server', async () => {
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(30);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBeNull();

    await purifier.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');

    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(100);
    expect(typeof purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called (endpoint ${purifier.id}.${purifier.number})`,
    );
  });

  test('DeviceEnergyManagement server', async () => {
    const powerAdjustRequest = { power: 500, duration: 60, cause: DeviceEnergyManagement.AdjustmentCause.LocalOptimization };
    const cancelCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: unknown }> = [];

    energyManagement.addCommandHandler('cancelPowerAdjustRequest', (data) => {
      cancelCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'esaType')).toBe(DeviceEnergyManagement.EsaType.Other);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'absMinPower')).toBe(-3000);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'absMaxPower')).toBe(2000);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    // PowerAdjustRequest now validates Power/Duration against PowerAdjustmentCapability (Matter 1.6 Application
    // Cluster Spec § 9.2.9.1.1/§ 9.2.9.1.2), so a capability entry covering the request must exist first.
    await energyManagement.setAttribute(DeviceEnergyManagement.id, 'powerAdjustmentCapability', {
      powerAdjustCapability: [{ minPower: 0, maxPower: 1000, minDuration: 10, maxDuration: 120 }],
      cause: DeviceEnergyManagement.PowerAdjustReason.NoAdjustment,
    });

    await expectCommand(energyManagement, DeviceEnergyManagement, 'powerAdjustRequest', powerAdjustRequest, (data) => {
      expect(data.cluster).toBe('deviceEnergyManagement');
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${powerAdjustRequest.power} duration ${powerAdjustRequest.duration} cause ${powerAdjustRequest.cause}`,
    );

    await energyManagement.invokeBehaviorCommand('deviceEnergyManagement', 'cancelPowerAdjustRequest');
    expect(cancelCalls[0]).toEqual({ cluster: 'deviceEnergyManagement', endpoint: energyManagement, request: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called');
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
  });

  test('DeviceEnergyManagementMode server', async () => {
    const modeCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    energyManagement.addCommandHandler('changeToMode', (data) => {
      modeCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'supportedModes')).toHaveLength(5);

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 0 });
    expect(modeCalls[0]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 0 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0');

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 1 });
    expect(modeCalls[1]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 1 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.OptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 1 => No Energy Management (Forecast reporting only)',
    );

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 5 });
    expect(modeCalls[2]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 5 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(5);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 5 => Full Energy Management');

    const originalHas = energyManagement.behaviors.has.bind(energyManagement.behaviors);
    const hasSpy = vi.spyOn(energyManagement.behaviors, 'has');
    hasSpy.mockImplementation((behavior: any) => {
      if (behavior === (DeviceEnergyManagementServer as any)) return false;
      return originalHas(behavior);
    });

    await energyManagement.setAttribute(DeviceEnergyManagement.id, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 1 });
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 5 });
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    hasSpy.mockRestore();
  });

  test('ServiceArea server', async () => {
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([]);
    expect(rvc.getAttribute(ServiceArea.id, 'currentArea')).toBe(1);
    expect(rvc.getAttribute(ServiceArea.id, 'supportedAreas')).toHaveLength(4);

    await expectCommand(rvc, ServiceArea, 'selectAreas', { newAreas: [1, 2] }, (data) => {
      expect(data.cluster).toBe('serviceArea');
    });
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]);

    await rvc.invokeBehaviorCommand(ServiceArea, 'selectAreas', { newAreas: [0, 5] });
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]);
  });
});
