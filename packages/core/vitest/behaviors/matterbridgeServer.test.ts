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
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
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
  waterValve,
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
  let valve: MatterbridgeEndpoint;
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

  test('Device type: valve', async () => {
    valve = new MatterbridgeEndpoint(waterValve, { id: 'valve' });
    valve.createDefaultValveConfigurationAndControlClusterServer();
    valve.addRequiredClusterServers();
    expect(valve).toBeDefined();
    expect(await addDevice(aggregator, valve)).toBeTruthy();
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

    const onWithTimedOffRequest = getOnWithTimedOffRequest(false, 10, 5);
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

    const enhancedMoveHueRequest = getEnhancedMoveHueRequest(ColorControl.MoveMode.Up, 5, false);
    await expectCommand(light, ColorControl, 'ColorControl.enhancedMoveHue', enhancedMoveHueRequest, (data) => {
      expect(data.cluster).toBe('colorControl');
    });

    const enhancedStepHueRequest = getEnhancedStepHueRequest(ColorControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, ColorControl, 'ColorControl.enhancedStepHue', enhancedStepHueRequest, (data) => {
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
    const stepCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    vent.addCommandHandler('step', (data) => {
      stepCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(0);

    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false });
    expect(stepCalls[0]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(10);

    await vent.setAttribute(FanControl.id, 'percentCurrent', 100);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false });
    expect(stepCalls[1]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(10);

    await vent.setAttribute(FanControl.id, 'percentCurrent', 100);
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true });
    expect(stepCalls[2]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(0);

    await vent.setAttribute(FanControl.id, 'percentCurrent', 20);

    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false });
    expect(stepCalls[3]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(10);

    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false });
    expect(stepCalls[4]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(100);

    await vent.setAttribute(FanControl.id, 'percentCurrent', 0);

    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true });
    expect(stepCalls[5]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(100);

    await vent.setAttribute(FanControl.id, 'percentCurrent', 20);

    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: true });
    expect(stepCalls[6]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: true } });
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(10);

    await vent.setAttribute(FanControl.id, 'percentCurrent', 30);

    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: 99 as FanControl.StepDirection, wrap: false, lowestOff: false });
    expect(stepCalls[7]).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction: 99, wrap: false, lowestOff: false } });
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
      `Setting preset to ${formatPresetHandleForLog(firstPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 2100, 2500);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', secondPresetRequest);
    expect(presetCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: secondPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Setting preset to ${formatPresetHandleForLog(secondPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
    );
    expectPresetThermostatAttributes(null, 1900, 2700);

    await thermostatPreset.invokeBehaviorCommand('Thermostat', 'setActivePresetRequest', clearPresetRequest);
    expect(presetCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatPreset, request: clearPresetRequest });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Setting preset to ${formatPresetHandleForLog(clearPresetRequest.presetHandle)} (endpoint ${thermostatPreset.id}.${thermostatPreset.number})`,
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
      `Setting schedule to ${formatScheduleHandleForLog(secondScheduleRequest.scheduleHandle)} (endpoint ${thermostatSchedule.id}.${thermostatSchedule.number})`,
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

    // A suggestion referencing an existing preset with an explicit effectiveTime is accepted.
    const explicitRequest = { presetHandle: Uint8Array.from([1]), effectiveTime: 1700000000, expirationInMinutes: 30 };
    await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', explicitRequest);
    expect(addCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: explicitRequest });
    let suggestions = thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ uniqueId: 0, effectiveTime: 1700000000, expirationTime: 1700001800 });
    expect(JSON.stringify(Object.values(suggestions[0].presetHandle))).toBe(JSON.stringify([1]));

    // A null effectiveTime means "immediately": the server fills in the current time.
    const now = new Date('2026-01-15T10:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const immediateRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: null, expirationInMinutes: 60 };
    await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', immediateRequest);
    vi.useRealTimers();
    expect(addCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: immediateRequest });
    suggestions = thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions');
    expect(suggestions).toHaveLength(2);
    expect(suggestions[1].uniqueId).toBe(1);
    expect(suggestions[1].effectiveTime).toBe(Math.floor(now.getTime() / 1000));
    expect(suggestions[1].expirationTime).toBe(suggestions[1].effectiveTime + 3600);

    // An EffectiveTime more than 24 hours in the future is rejected.
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const futureRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: Math.floor(now.getTime() / 1000) + 24 * 60 * 60 + 1, expirationInMinutes: 30 };
    await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', futureRequest)).rejects.toThrow(
      'EffectiveTime cannot be more than 24 hours in the future',
    );
    vi.useRealTimers();
    expect(addCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: futureRequest });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);

    // An unknown PresetHandle is rejected, but the command is still forwarded to the command handler first.
    const invalidPresetRequest = { presetHandle: Uint8Array.from([9]), effectiveTime: 1700000000, expirationInMinutes: 30 };
    await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', invalidPresetRequest)).rejects.toThrow('Requested PresetHandle not found');
    expect(addCalls[3]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: invalidPresetRequest });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(2);

    // Fill the list up to MaxThermostatSuggestions (5), then the next add is rejected as ResourceExhausted.
    for (let i = 0; i < 3; i++) {
      await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', {
        presetHandle: Uint8Array.from([0]),
        effectiveTime: 1700000000,
        expirationInMinutes: 30,
      });
    }
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(5);
    const overflowRequest = { presetHandle: Uint8Array.from([0]), effectiveTime: 1700000000, expirationInMinutes: 30 };
    await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'addThermostatSuggestion', overflowRequest)).rejects.toThrow(
      'Maximum number of thermostat suggestions reached',
    );
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(5);

    // Simulate the thermostat currently following the first suggestion.
    await thermostatSuggestion.setAttribute(Thermostat.id, 'currentThermostatSuggestion', suggestions[0]);

    // Removing a different suggestion keeps CurrentThermostatSuggestion unchanged.
    const removeOtherRequest = { uniqueId: 1 };
    await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeOtherRequest);
    expect(removeCalls[0]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: removeOtherRequest });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(4);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toEqual(suggestions[0]);

    // Removing the current suggestion clears CurrentThermostatSuggestion.
    const removeCurrentRequest = { uniqueId: 0 };
    await thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', removeCurrentRequest);
    expect(removeCalls[1]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: removeCurrentRequest });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'currentThermostatSuggestion')).toBeNull();

    // An unknown UniqueID is rejected, but the command is still forwarded to the command handler first.
    const invalidRemoveRequest = { uniqueId: 99 };
    await expect(thermostatSuggestion.invokeBehaviorCommand('Thermostat', 'removeThermostatSuggestion', invalidRemoveRequest)).rejects.toThrow('Requested UniqueID not found');
    expect(removeCalls[2]).toEqual({ cluster: 'thermostat', endpoint: thermostatSuggestion, request: invalidRemoveRequest });
    expect(thermostatSuggestion.getAttribute(Thermostat.id, 'thermostatSuggestions')).toHaveLength(3);

    // The 3 remaining suggestions (uniqueId 2, 3, 4) all reference preset 0. Removing preset 0 via a Presets atomic
    // write deletes the referencing entries and, since CurrentThermostatSuggestion references that preset, nulls it
    // (Matter 1.6 Application Cluster Spec § 4.3.11.50, points 1-2). matter.js only fires `presets$AtomicChanged`
    // through a committed atomic write (AtomicWriteHandler), which local-actor/command-context test writes bypass
    // entirely, so the event is emitted directly here, matching how AtomicWriteHandler.commitWrite() does it.
    await thermostatSuggestion.setAttribute(Thermostat.id, 'currentThermostatSuggestion', {
      uniqueId: 2,
      presetHandle: Uint8Array.from([0]),
      effectiveTime: 1700000000,
      expirationTime: 1700001800,
    });
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

  test('ValveConfigurationAndControl server', async () => {
    const expectValveAttributes = (expected: {
      currentState: number;
      targetState: number;
      currentLevel: number;
      targetLevel: number;
      openDuration: number | null;
      remainingDuration: number | null;
    }) => {
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(expected.currentState);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(expected.targetState);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'currentLevel')).toBe(expected.currentLevel);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(expected.targetLevel);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'openDuration')).toBe(expected.openDuration);
      expect(valve.getAttribute(ValveConfigurationAndControl.id, 'remainingDuration')).toBe(expected.remainingDuration);
    };

    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Closed,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });

    const openRequest = { targetLevel: 50, openDuration: 60 };
    await expectCommand(valve, ValveConfigurationAndControl, 'open', openRequest, (data) => {
      expect(data.cluster).toBe('valveConfigurationAndControl');
    });
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Open,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 50,
      targetLevel: 50,
      openDuration: 60,
      remainingDuration: null,
    });

    await valve.setAttribute(ValveConfigurationAndControl.id, 'defaultOpenDuration', null);
    await valve.invokeBehaviorCommand(ValveConfigurationAndControl, 'open', {});
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Open,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 100,
      targetLevel: 100,
      openDuration: null,
      remainingDuration: null,
    });

    await expectCommand(valve, ValveConfigurationAndControl, 'close', undefined, (data) => {
      expect(data.cluster).toBe('valveConfigurationAndControl');
    });
    expectValveAttributes({
      currentState: ValveConfigurationAndControl.ValveState.Closed,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      openDuration: null,
      remainingDuration: null,
    });
  });

  test('SmokeCoAlarm server', async () => {
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);

    await expectCommand(smoke, SmokeCoAlarm, 'selfTestRequest', undefined, (data) => {
      expect(data.cluster).toBe('smokeCoAlarm');
    });

    expect(smoke.getAttribute(SmokeCoAlarm.id, 'smokeState')).toBe(SmokeCoAlarm.AlarmState.Normal);
    expect(smoke.getAttribute(SmokeCoAlarm.id, 'coState')).toBe(SmokeCoAlarm.AlarmState.Normal);
  });

  test('BooleanStateConfiguration server', async () => {
    const enableDisableAlarmRequest = { alarmsToEnableDisable: { audible: true, visual: true } };

    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsActive')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });

    await expectCommand(contact, BooleanStateConfiguration, 'enableDisableAlarm', enableDisableAlarmRequest, (data) => {
      expect(data.cluster).toBe('booleanStateConfiguration');
    });

    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsActive')).toEqual({ visual: false, audible: false });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsEnabled')).toEqual({ visual: true, audible: true });
    expect(contact.getAttribute(BooleanStateConfiguration.id, 'alarmsSupported')).toEqual({ visual: true, audible: true });
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeHepaFilterMonitoringServer: resetCondition called');
  });

  test('ActivatedCarbonFilterMonitoring server', async () => {
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(30);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBeNull();

    await purifier.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');

    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(100);
    expect(typeof purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called');
  });

  test('DeviceEnergyManagement server', async () => {
    const powerAdjustRequest = { power: 500, duration: 60, cause: 'Test' };
    const cancelCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: unknown }> = [];

    energyManagement.addCommandHandler('cancelPowerAdjustRequest', (data) => {
      cancelCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'esaType')).toBe(DeviceEnergyManagement.EsaType.Other);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'esaState')).toBe(DeviceEnergyManagement.EsaState.Online);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'absMinPower')).toBe(-3000);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'absMaxPower')).toBe(2000);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

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

  test('OperationalState server', async () => {
    const expectOperationalStateAttributes = (expectedState: number) => {
      expect(washer.getAttribute(OperationalState.id, 'operationalState')).toBe(expectedState);
      expect(washer.getAttribute(OperationalState.id, 'operationalError')).toEqual({
        errorStateId: OperationalState.ErrorState.NoError,
        errorStateDetails: 'Fully operational',
      });
    };

    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Stopped);

    await expectCommand(washer, OperationalState, 'start', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Running);

    await expectCommand(washer, OperationalState, 'pause', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Paused);

    await expectCommand(washer, OperationalState, 'resume', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Running);

    await expectCommand(washer, OperationalState, 'stop', undefined, (data) => {
      expect(data.cluster).toBe('operationalState');
    });
    expectOperationalStateAttributes(OperationalState.OperationalStateEnum.Stopped);
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
