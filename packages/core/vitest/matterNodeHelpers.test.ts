/**
 * @file packages/core/vitest/matterNodeHelpers.test.ts
 * @description This file contains the tests for matterNodeHelpers.
 * @author Luca Liguori
 */

/* oxlint-disable unicorn/no-useless-undefined */

const NAME = 'MatterNodeHelpers';

import { Lifecycle } from '@matter/general';
import type { ServerNode, SessionsBehavior } from '@matter/node';
import type { ExposedFabricInformation } from '@matter/protocol';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { AirQuality } from '@matter/types/clusters/air-quality';
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { Binding } from '@matter/types/clusters/binding';
import { BooleanState } from '@matter/types/clusters/boolean-state';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { BridgedDeviceBasicInformation } from '@matter/types/clusters/bridged-device-basic-information';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ColorControl } from '@matter/types/clusters/color-control';
import { Descriptor } from '@matter/types/clusters/descriptor';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { FanControl } from '@matter/types/clusters/fan-control';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { FormaldehydeConcentrationMeasurement } from '@matter/types/clusters/formaldehyde-concentration-measurement';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { IlluminanceMeasurement } from '@matter/types/clusters/illuminance-measurement';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import { LevelControl } from '@matter/types/clusters/level-control';
import { MicrowaveOvenMode } from '@matter/types/clusters/microwave-oven-mode';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { OvenMode } from '@matter/types/clusters/oven-mode';
import { Pm1ConcentrationMeasurement } from '@matter/types/clusters/pm1-concentration-measurement';
import { Pm10ConcentrationMeasurement } from '@matter/types/clusters/pm10-concentration-measurement';
import { Pm25ConcentrationMeasurement } from '@matter/types/clusters/pm25-concentration-measurement';
import { PowerSource } from '@matter/types/clusters/power-source';
import { PressureMeasurement } from '@matter/types/clusters/pressure-measurement';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { RelativeHumidityMeasurement } from '@matter/types/clusters/relative-humidity-measurement';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { SoilMeasurement } from '@matter/types/clusters/soil-measurement';
import { Switch } from '@matter/types/clusters/switch';
import { TemperatureAlarm } from '@matter/types/clusters/temperature-alarm';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/types/clusters/total-volatile-organic-compounds-concentration-measurement';
import { UserLabel } from '@matter/types/clusters/user-label';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WaterTankLevelMonitoring } from '@matter/types/clusters/water-tank-level-monitoring';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { setupTest } from '@matterbridge/vitest-utils';

import type { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import {
  clearAdvertisingNodes,
  deleteAdvertisingNode,
  getBatteryLevel,
  getClusterTextFromDevice,
  getPowerSource,
  getReachability,
  getServerNodeData,
  getVendorIdName,
  sanitizeFabricInformations,
  sanitizeSessionInformation,
  setAdvertisingNode,
} from '../src/matterNodeHelpers.js';

const colorAttributes: Record<string, unknown> = { colorMode: 0 };

const labels: Record<string, unknown> = {};

const supportedModes = new Map<string, unknown>();

vi.mock('../src/matterbridgeEndpointHelpers.js', () => ({
  getAttribute: vi.fn((_device: unknown, cluster: string | { id: number }, attribute: string) => {
    if (cluster === 'colorControl') return colorAttributes[attribute];
    if (typeof cluster === 'string' && attribute === 'supportedModes') return supportedModes.get(cluster);
    if (typeof cluster === 'object' && attribute === 'labelList') return labels[cluster.id];
    return null;
  }),
  featuresFor: vi.fn((device: { getAttribute: (cluster: number, attribute: string) => unknown }, cluster: { id: number }) => device.getAttribute(cluster.id, 'featureMap') ?? {}),
}));

// Setup the test environment
await setupTest(NAME, false);

type Attribute = [clusterName: string, attributeName: string, value: unknown, clusterId: number, attributeId: number];

type ClusterLike = { id: number; name: string; attributes: Record<string, { id: number }> };

/**
 * Create an attribute entry as emitted by MatterbridgeEndpoint.forEachAttribute(), validated against the real matter.js cluster definition.
 *
 * @param {ClusterLike} cluster - The matter.js cluster.
 * @param {string} attributeName - The attribute name (must exist in the cluster).
 * @param {unknown} value - The attribute value.
 * @returns {Attribute} The attribute entry: behavior id (cluster name with lowercase first letter), attribute name, value, cluster id and attribute id.
 */
function at(cluster: ClusterLike, attributeName: string, value: unknown): Attribute {
  const attribute = cluster.attributes[attributeName];
  if (!attribute) throw new Error(`Attribute ${attributeName} not found in cluster ${cluster.name}`);
  return [cluster.name.charAt(0).toLowerCase() + cluster.name.slice(1), attributeName, value, cluster.id, attribute.id];
}

/**
 * Create a fake endpoint.
 *
 * @param {object} [options] - The fake endpoint options.
 * @param {boolean} [options.ready] - The lifecycle isReady value.
 * @param {boolean} [options.active] - Whether the construction status is active.
 * @param {number[]} [options.servers] - The cluster server ids present on the endpoint.
 * @param {Record<number, Record<string, unknown>>} [options.attributes] - The attributes by cluster id.
 * @param {MatterbridgeEndpoint[]} [options.children] - The child endpoints.
 * @param {Attribute[]} [options.list] - The attributes iterated by forEachAttribute.
 * @param {'server' | 'matter'} [options.mode] - The endpoint mode.
 * @param {boolean | undefined} [options.serverReachable] - The server node basicInformation reachable value.
 * @param {boolean | undefined} [options.ownerReachable] - The owner server node basicInformation reachable value.
 * @returns {MatterbridgeEndpoint} The fake endpoint.
 */
function fake(
  options: {
    ready?: boolean;
    active?: boolean;
    servers?: number[];
    attributes?: Record<number, Record<string, unknown>>;
    children?: MatterbridgeEndpoint[];
    list?: Attribute[];
    mode?: 'server' | 'matter';
    serverReachable?: boolean;
    ownerReachable?: boolean;
  } = {},
): MatterbridgeEndpoint {
  const { ready = true, active = true, servers = [], attributes = {}, children = [], list = [], mode, serverReachable, ownerReachable } = options;
  return {
    lifecycle: { isReady: ready },
    construction: { status: active ? Lifecycle.Status.Active : Lifecycle.Status.Inactive },
    mode,
    serverNode: serverReachable === undefined && mode !== 'server' ? undefined : { state: { basicInformation: { reachable: serverReachable } } },
    ownerOfType: () => (ownerReachable === undefined ? undefined : { state: { basicInformation: { reachable: ownerReachable } } }),
    hasClusterServer: (id: number) => servers.includes(id),
    getAttribute: (cluster: { id: number } | number, attribute: string) => attributes[typeof cluster === 'number' ? cluster : cluster.id]?.[attribute],
    getChildEndpoints: () => children,
    forEachAttribute: (callback: (clusterName: string, clusterId: number, attributeName: string, attributeId: number, value: unknown) => void) => {
      for (const [clusterName, attributeName, value, clusterId, attributeId] of list) callback(clusterName, clusterId, attributeName, attributeId, value);
    },
  } as unknown as MatterbridgeEndpoint;
}

/**
 * Get the cluster text of a fake endpoint with the given attributes.
 *
 * @param {Attribute[]} list - The attributes.
 * @returns {string} The cluster text.
 */
function text(...list: Attribute[]): string {
  return getClusterTextFromDevice(fake({ list }));
}

describe('matterNodeHelpers', () => {
  describe('getReachability', () => {
    test('returns false when endpoint not ready/active', () => {
      expect(getReachability(fake())).toBe(false);
      expect(getReachability(fake({ ready: false }))).toBe(false);
      expect(getReachability(fake({ active: false }))).toBe(false);
    });

    test('uses the BridgedDeviceBasicInformation reachable attribute', () => {
      const id = BridgedDeviceBasicInformation.id;
      expect(getReachability(fake({ servers: [id], attributes: { [id]: { reachable: true } } }))).toBe(true);
      expect(getReachability(fake({ servers: [id], attributes: { [id]: { reachable: false } } }))).toBe(false);
    });

    test('uses the server node reachable value in server mode', () => {
      expect(getReachability(fake({ mode: 'server', serverReachable: true }))).toBe(true);
      expect(getReachability(fake({ mode: 'server', serverReachable: false }))).toBe(false);
    });

    test('uses the owner server node for endpoints added directly to it (matter mode and accessory)', () => {
      expect(getReachability(fake({ mode: 'matter', ownerReachable: true }))).toBe(true);
      expect(getReachability(fake({ mode: 'matter', ownerReachable: false }))).toBe(false);
      expect(getReachability(fake({ mode: 'matter' }))).toBe(false);
      expect(getReachability(fake({ ownerReachable: true }))).toBe(true); // accessory in childbridge mode: any mode, owned by the plugin server node
      expect(getReachability(fake({ ownerReachable: false }))).toBe(false);
    });

    test('returns false when nothing else applies', () => {
      expect(getReachability(fake({ mode: 'server' }))).toBe(false);
      expect(getReachability(fake())).toBe(false);
    });
  });

  describe('getPowerSource', () => {
    const id = PowerSource.id;

    test('returns undefined when endpoint not ready/active', () => {
      expect(getPowerSource(fake({ servers: [id], ready: false }))).toBeUndefined();
      expect(getPowerSource(fake({ servers: [id], active: false }))).toBeUndefined();
    });

    test('returns undefined without power source cluster', () => {
      expect(getPowerSource(fake())).toBeUndefined();
    });

    test('wired power source', () => {
      expect(getPowerSource(fake({ servers: [id], attributes: { [id]: { featureMap: { wired: true }, wiredCurrentType: PowerSource.WiredCurrentType.Ac } } }))).toBe('ac');
      expect(getPowerSource(fake({ servers: [id], attributes: { [id]: { featureMap: { wired: true }, wiredCurrentType: PowerSource.WiredCurrentType.Dc } } }))).toBe('dc');
    });

    test('battery power source', () => {
      const battery = (level: number): MatterbridgeEndpoint => fake({ servers: [id], attributes: { [id]: { featureMap: { battery: true }, batChargeLevel: level } } });
      expect(getPowerSource(battery(PowerSource.BatChargeLevel.Ok))).toBe('ok');
      expect(getPowerSource(battery(PowerSource.BatChargeLevel.Warning))).toBe('warning');
      expect(getPowerSource(battery(PowerSource.BatChargeLevel.Critical))).toBe('critical');
    });

    test('neither wired nor battery', () => {
      expect(getPowerSource(fake({ servers: [id], attributes: { [id]: { featureMap: {} } } }))).toBeUndefined();
    });

    test('looks into child endpoints', () => {
      const child = fake({ servers: [id], attributes: { [id]: { featureMap: { wired: true }, wiredCurrentType: PowerSource.WiredCurrentType.Dc } } });
      expect(getPowerSource(fake({ children: [fake(), child] }))).toBe('dc');
      expect(getPowerSource(fake({ children: [fake()] }))).toBeUndefined();
    });
  });

  describe('getBatteryLevel', () => {
    const id = PowerSource.id;

    test('returns undefined when endpoint not ready/active', () => {
      expect(getBatteryLevel(fake({ servers: [id] }))).toBeUndefined();
      expect(getBatteryLevel(fake({ servers: [id], ready: false }))).toBeUndefined();
      expect(getBatteryLevel(fake({ servers: [id], active: false }))).toBeUndefined();
    });

    test('returns the percentage from batPercentRemaining', () => {
      expect(getBatteryLevel(fake({ servers: [id], attributes: { [id]: { featureMap: { battery: true }, batPercentRemaining: 200 } } }))).toBe(100);
      expect(getBatteryLevel(fake({ servers: [id], attributes: { [id]: { featureMap: { battery: true }, batPercentRemaining: 101 } } }))).toBe(50.5);
    });

    test('returns undefined for invalid value, no battery feature or no cluster', () => {
      expect(getBatteryLevel(fake({ servers: [id], attributes: { [id]: { featureMap: { battery: true }, batPercentRemaining: null } } }))).toBeUndefined();
      expect(getBatteryLevel(fake({ servers: [id], attributes: { [id]: { featureMap: { wired: true } } } }))).toBeUndefined();
      expect(getBatteryLevel(fake())).toBeUndefined();
    });

    test('looks into child endpoints', () => {
      const child = fake({ servers: [id], attributes: { [id]: { featureMap: { battery: true }, batPercentRemaining: 100 } } });
      expect(getBatteryLevel(fake({ children: [child] }))).toBe(50);
      expect(getBatteryLevel(fake({ children: [fake()] }))).toBeUndefined();
    });
  });

  describe('getClusterTextFromDevice', () => {
    test('returns empty string when endpoint not ready/active', () => {
      expect(getClusterTextFromDevice(fake({ ready: false, list: [at(OnOff, 'onOff', true)] }))).toBe('');
      expect(getClusterTextFromDevice(fake({ active: false, list: [at(OnOff, 'onOff', true)] }))).toBe('');
    });

    test('ignores undefined values and attributes not handled', () => {
      expect(text(at(OnOff, 'onOff', undefined), at(OnOff, 'startUpOnOff', 1), at(LevelControl, 'minLevel', 1))).toBe('');
    });

    test('light: onOff, levelControl and colorControl', () => {
      colorAttributes.colorMode = ColorControl.ColorMode.CurrentHueAndCurrentSaturation;
      expect(
        text(
          at(OnOff, 'onOff', true),
          at(LevelControl, 'currentLevel', 128),
          at(ColorControl, 'colorMode', 0),
          at(ColorControl, 'currentHue', 120.4),
          at(ColorControl, 'currentSaturation', 50.6),
          at(ColorControl, 'currentX', 1),
          at(ColorControl, 'colorTemperatureMireds', 250),
        ),
      ).toBe('OnOff: true Level: 128 Mode: HS Hue: 120 Saturation: 51');
      colorAttributes.colorMode = ColorControl.ColorMode.CurrentXAndCurrentY;
      expect(text(at(ColorControl, 'colorMode', 1), at(ColorControl, 'currentX', 32768), at(ColorControl, 'currentY', 16384), at(ColorControl, 'currentHue', 1))).toBe(
        'Mode: XY X: 0.5 Y: 0.25',
      );
      colorAttributes.colorMode = ColorControl.ColorMode.ColorTemperatureMireds;
      expect(text(at(ColorControl, 'colorMode', 2), at(ColorControl, 'colorTemperatureMireds', 250.4), at(ColorControl, 'currentHue', 1))).toBe('Mode: CT ColorTemp: 250');
      colorAttributes.colorMode = 0;
    });

    test('switch, cover and lock', () => {
      expect(text(at(Switch, 'currentPosition', 1))).toBe('Position: 1');
      expect(text(at(WindowCovering, 'currentPositionLiftPercent100ths', 5000))).toBe('Cover position: 50%');
      expect(text(at(WindowCovering, 'currentPositionLiftPercent100ths', 10001))).toBe('');
      expect(text(at(DoorLock, 'lockState', DoorLock.LockState.Locked))).toBe('State: Locked');
      expect(text(at(DoorLock, 'lockState', DoorLock.LockState.Unlocked))).toBe('State: Not locked');
    });

    test('closureControl', () => {
      expect(text(at(ClosureControl, 'overallCurrentState', null))).toBe('Position: unknown Latch: unknown Speed: unknown SecureState: unknown');
      expect(text(at(ClosureControl, 'overallCurrentState', { position: 0, latch: true, speed: 1, secureState: false }))).toMatch(
        /^Position: .+ Latch: true Speed: .+ SecureState: false$/,
      );
      expect(text(at(ClosureControl, 'overallCurrentState', { position: 0 }))).toMatch(/^Position: .+ SecureState: unknown$/);
    });

    test('thermostat', () => {
      expect(
        text(
          at(Thermostat, 'localTemperature', 2150),
          at(Thermostat, 'occupiedHeatingSetpoint', 2000),
          at(Thermostat, 'occupiedCoolingSetpoint', 2500),
          at(Thermostat, 'systemMode', 1),
        ),
      ).toBe('Temperature: 21.5°C Heat to: 20°C Cool to: 25°C');
      expect(text(at(Thermostat, 'localTemperature', null))).toBe('');
    });

    test.each([ModeSelect, RvcRunMode, RvcCleanMode, LaundryWasherMode, OvenMode, MicrowaveOvenMode, DeviceEnergyManagementMode])('mode cluster %#', (cluster) => {
      const clusterName = at(cluster, 'currentMode', 1)[0];
      supportedModes.set(clusterName, [{ label: 'Eco', mode: 1 }]);
      expect(text(at(cluster, 'supportedModes', [{ label: 'Eco', mode: 1 }]), at(cluster, 'currentMode', 1))).toBe('Mode: Eco');
      expect(text(at(cluster, 'supportedModes', [{ label: 'Eco', mode: 1 }]), at(cluster, 'currentMode', 2))).toBe('');
      supportedModes.delete(clusterName);
      expect(text(at(cluster, 'currentMode', 1))).toBe('');
    });

    test('mode clusters use their own supportedModes regardless of the attribute order', () => {
      supportedModes.set('rvcRunMode', [{ label: 'Idle', mode: 1 }]);
      supportedModes.set('rvcCleanMode', [{ label: 'Vacuum', mode: 1 }]);
      expect(
        text(
          at(RvcRunMode, 'supportedModes', [{ label: 'Idle', mode: 1 }]),
          at(RvcRunMode, 'currentMode', 1),
          at(RvcCleanMode, 'currentMode', 1),
          at(RvcCleanMode, 'supportedModes', [{ label: 'Vacuum', mode: 1 }]),
        ),
      ).toBe('Mode: Idle Mode: Vacuum');
      supportedModes.clear();
    });

    test('robot vacuum and appliances operational states', () => {
      expect(text(at(OperationalState, 'operationalState', OperationalState.OperationalStateEnum.Running))).toBe('OpState: Running');
      expect(text(at(RvcOperationalState, 'operationalState', RvcOperationalState.OperationalState.Docked))).toBe('OpState: Docked');
      expect(text(at(PumpConfigurationAndControl, 'operationMode', 0))).toBe('Mode: 0');
      expect(text(at(ValveConfigurationAndControl, 'currentState', ValveConfigurationAndControl.ValveState.Open))).toBe('State: Open');
      expect(text(at(ValveConfigurationAndControl, 'currentState', null))).toBe('State: unknown');
    });

    test('descriptor and binding', () => {
      expect(text(at(Descriptor, 'clientList', [OnOff.id]))).toBe('Client cluster(s): [OnOff]');
      expect(text(at(Descriptor, 'clientList', []))).toBe('');
      expect(text(at(Binding, 'binding', []))).toBe('Bound cluster(s): none');
      expect(text(at(Binding, 'binding', [{ node: 1, group: 2, endpoint: 3, cluster: OnOff.id, fabricIndex: 1 }]))).toBe(
        'Bound cluster(s): [node: 1, group: 2, endpoint: 3, cluster: OnOff, fabricIndex: 1]',
      );
      expect(text(at(Binding, 'binding', [{ endpoint: 3 }]))).toBe('Bound cluster(s): [endpoint: 3]');
      expect(text(at(Binding, 'binding', [{ node: 1 }]))).toBe('Bound cluster(s): [node: 1]');
    });

    test('fan, application and fixed/user labels', () => {
      expect(
        text(at(FanControl, 'fanMode', FanControl.FanMode.High), at(FanControl, 'percentCurrent', 50), at(FanControl, 'speedCurrent', 3), at(FanControl, 'airflowDirection', 0)),
      ).toBe('Mode: High Percent: 50% Speed: 3 Direction: Forward');
      expect(text(at(FanControl, 'rockSetting', { rockLeftRight: true }), at(FanControl, 'windSetting', { sleepWind: true }))).toMatch(/^Rock: .+ Wind: .+/);
      expect(text(at(ApplicationBasic, 'applicationName', 'App1'))).toBe('App: App1');
      labels[FixedLabel.id] = [{ label: 'composed', value: 'Fixed' }];
      labels[UserLabel.id] = [{ label: 'other', value: 'x' }];
      expect(text(at(FixedLabel, 'labelList', []), at(UserLabel, 'labelList', []))).toBe('Composed: Fixed');
      labels[FixedLabel.id] = [{ label: 'other', value: 'x' }];
      labels[UserLabel.id] = undefined;
      expect(text(at(FixedLabel, 'labelList', []), at(UserLabel, 'labelList', []))).toBe('');
      labels[FixedLabel.id] = undefined;
      labels[UserLabel.id] = [{ label: 'composed', value: 'User' }];
      expect(text(at(FixedLabel, 'labelList', []), at(UserLabel, 'labelList', []))).toBe('Composed: User');
    });

    test('contact, smoke, air quality, alarms, filters, occupancy and energy management', () => {
      expect(text(at(BooleanState, 'stateValue', true))).toBe('Contact: true');
      expect(text(at(BooleanStateConfiguration, 'alarmsActive', { visual: true }))).toMatch(/^Active alarms: /);
      expect(text(at(SmokeCoAlarm, 'smokeState', SmokeCoAlarm.AlarmState.Normal), at(SmokeCoAlarm, 'coState', SmokeCoAlarm.AlarmState.Critical))).toBe(
        'Smoke: Normal Co: Critical',
      );
      expect(text(at(AirQuality, 'airQuality', AirQuality.AirQualityEnum.Good))).toBe('Air quality: Good');
      expect(text(at(HepaFilterMonitoring, 'condition', 90), at(ActivatedCarbonFilterMonitoring, 'condition', 80), at(WaterTankLevelMonitoring, 'condition', 70))).toBe(
        'Hepa filter: 90% Carbon filter: 80% Water tank: 70%',
      );
      expect(text(at(TemperatureAlarm, 'state', { highTemperature: true }))).toMatch(/^Temp alarm: /);
      expect(text(at(OccupancySensing, 'occupancy', { occupied: true }))).toBe('Occupancy: true');
      expect(text(at(DeviceEnergyManagement, 'esaCanGenerate', true), at(DeviceEnergyManagement, 'esaState', DeviceEnergyManagement.EsaState.Online))).toBe(
        'ESA can generate: true ESA state: Online',
      );
    });

    test('environmental sensor measurements', () => {
      expect(
        text(
          at(TemperatureMeasurement, 'measuredValue', 2150),
          at(RelativeHumidityMeasurement, 'measuredValue', 5050),
          at(PressureMeasurement, 'measuredValue', 1013),
          at(FlowMeasurement, 'measuredValue', 25),
        ),
      ).toBe('Temperature: 21.5 °C Humidity: 50.5% Pressure: 1013 hPa Flow: 2.5 m³/h');
      expect(text(at(IlluminanceMeasurement, 'measuredValue', null))).toBe('Illuminance: unknown');
      expect(text(at(IlluminanceMeasurement, 'measuredValue', 'x'))).toBe('');
      expect(text(at(IlluminanceMeasurement, 'measuredValue', 40000))).toBe('Illuminance: 10000 lx');
      expect(text(at(IlluminanceMeasurement, 'measuredValue', 40000), at(TemperatureMeasurement, 'measuredValue', 2150))).toBe('Illuminance: 10000 lx Temperature: 21.5 °C');
      expect(text(at(SoilMeasurement, 'soilMoistureMeasuredValue', 30))).toBe('Soil moisture: 30%');
      expect(text(at(TemperatureMeasurement, 'measuredValue', null), at(PressureMeasurement, 'measuredValue', 'x'))).toBe('Temperature: unknown');
      expect(text(at(PressureMeasurement, 'measuredValue', 10n))).toBe('Pressure: 10 hPa');
    });

    test('air quality concentration measurements', () => {
      expect(
        text(
          at(TotalVolatileOrganicCompoundsConcentrationMeasurement, 'measuredValue', 5),
          at(Pm1ConcentrationMeasurement, 'measuredValue', 1),
          at(Pm25ConcentrationMeasurement, 'measuredValue', 2),
          at(Pm10ConcentrationMeasurement, 'measuredValue', 3),
          at(FormaldehydeConcentrationMeasurement, 'measuredValue', 4),
        ),
      ).toBe('Voc: 5 Pm1: 1 Pm2.5: 2 Pm10: 3 CH₂O: 4');
    });

    test('electrical measurements', () => {
      expect(
        text(
          at(ElectricalPowerMeasurement, 'voltage', 230000),
          at(ElectricalPowerMeasurement, 'activeCurrent', 1500),
          at(ElectricalPowerMeasurement, 'activePower', 345000000),
          at(ElectricalPowerMeasurement, 'frequency', 50000),
          at(ElectricalEnergyMeasurement, 'cumulativeEnergyImported', { energy: 2_000_000 }),
          at(ElectricalEnergyMeasurement, 'cumulativeEnergyExported', { energy: 3_000_000n }),
        ),
      ).toBe('Voltage: 230V Current: 1.5A Power: 345kW Frequency: 50Hz Imported: 2kWh Exported: 3kWh');
      expect(text(at(ElectricalEnergyMeasurement, 'cumulativeEnergyImported', null), at(ElectricalEnergyMeasurement, 'cumulativeEnergyExported', { energy: 'x' }))).toBe(
        'Imported: unknown',
      );
    });
  });
  describe('getVendorIdName', () => {
    test.each([
      [4937, '(AppleHome)'],
      [4996, '(AppleKeyChain)'],
      [4362, '(SmartThings)'],
      [4939, '(HomeAssistant)'],
      [24582, '(GoogleHome)'],
      [4631, '(Alexa)'],
      [4701, '(Tuya)'],
      [4718, '(Xiaomi)'],
      [4742, '(eWeLink)'],
      [5264, '(Shelly)'],
      [0x1488, '(ShortcutLabsFlic)'],
      [0xfff1, '(MatterTest)'],
      [1, '(Unknown vendorId)'],
    ])('vendor id %i', (vendorId, name) => {
      expect(getVendorIdName(vendorId)).toBe(name);
    });

    test('returns empty string for undefined or 0', () => {
      expect(getVendorIdName(undefined)).toBe('');
      expect(getVendorIdName(0)).toBe('');
    });
  });

  describe('sanitizeFabricInformations', () => {
    const fabric = { fabricIndex: 1, fabricId: 123n, nodeId: 456n, rootNodeId: 789n, rootVendorId: 4939, label: 'Home', extra: 'ignored' } as unknown as ExposedFabricInformation;

    test('converts bigint to string and adds the vendor name', () => {
      const result = sanitizeFabricInformations([fabric, { ...fabric, fabricIndex: 2, rootVendorId: 1, label: '' } as unknown as ExposedFabricInformation]);
      expect(result).toEqual([
        { fabricIndex: 1, fabricId: '123', nodeId: '456', rootNodeId: '789', rootVendorId: 4939, rootVendorName: '(HomeAssistant)', label: 'Home' },
        { fabricIndex: 2, fabricId: '123', nodeId: '456', rootNodeId: '789', rootVendorId: 1, rootVendorName: '(Unknown vendorId)', label: '' },
      ]);
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test('empty list', () => {
      expect(sanitizeFabricInformations([])).toEqual([]);
    });
  });

  describe('sanitizeSessionInformation', () => {
    const session = {
      name: 'secure/udp',
      nodeId: 1n,
      peerNodeId: 2n,
      fabric: { fabricIndex: 1, fabricId: 3n, nodeId: 4n, rootNodeId: 5n, rootVendorId: 4996, label: 'Apple' },
      isPeerActive: true,
      lastInteractionTimestamp: 1720035723121,
      lastActiveTimestamp: 1720035761223,
      numberOfActiveSubscriptions: 2,
    } as unknown as SessionsBehavior.Session;

    test('converts bigint to string and timestamps to ISO', () => {
      const result = sanitizeSessionInformation([session]);
      expect(result).toEqual([
        {
          name: 'secure/udp',
          nodeId: '1',
          peerNodeId: '2',
          fabric: { fabricIndex: 1, fabricId: '3', nodeId: '4', rootNodeId: '5', rootVendorId: 4996, rootVendorName: '(AppleKeyChain)', label: 'Apple' },
          isPeerActive: true,
          lastInteractionTimestamp: '2024-07-03T19:42:03.121Z',
          lastActiveTimestamp: '2024-07-03T19:42:41.223Z',
          numberOfActiveSubscriptions: 2,
        },
      ]);
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    test('filters out sessions with an inactive peer', () => {
      expect(sanitizeSessionInformation([{ ...session, isPeerActive: false }])).toEqual([]);
      expect(sanitizeSessionInformation([])).toEqual([]);
    });

    test('session without fabric', () => {
      expect(sanitizeSessionInformation([{ ...session, fabric: undefined }])[0].fabric).toBeUndefined();
    });

    test('invalid timestamps become an empty string', () => {
      const [undefinedTimestamps] = sanitizeSessionInformation([{ ...session, lastInteractionTimestamp: undefined, lastActiveTimestamp: undefined }]);
      expect(undefinedTimestamps.lastInteractionTimestamp).toBe('');
      expect(undefinedTimestamps.lastActiveTimestamp).toBe('');
      const [neverActive] = sanitizeSessionInformation([{ ...session, lastActiveTimestamp: 0 }]);
      expect(neverActive.lastActiveTimestamp).toBe('');
      const [outOfRange] = sanitizeSessionInformation([{ ...session, lastInteractionTimestamp: 8.64e15 + 1 }]);
      expect(outOfRange.lastInteractionTimestamp).toBe('');
    });
  });

  describe('getServerNodeData', () => {
    const serverNode = {
      id: 'node-store',
      lifecycle: { isOnline: true },
      state: {
        commissioning: {
          commissioned: true,
          pairingCodes: { qrPairingCode: 'MT:QR', manualPairingCode: '1234-567-8901' },
          fabrics: { 1: { fabricIndex: 1, fabricId: 3n, nodeId: 4n, rootNodeId: 5n, rootVendorId: 4939, label: 'HA' } },
        },
        administratorCommissioning: { windowStatus: 0 },
        sessions: {
          sessions: {
            1: { name: 's', nodeId: 1n, peerNodeId: 2n, isPeerActive: true, lastInteractionTimestamp: 1720035723121, lastActiveTimestamp: 0, numberOfActiveSubscriptions: 0 },
          },
        },
        basicInformation: { serialNumber: 'SN123' },
      },
    } as unknown as ServerNode;

    afterEach(() => {
      clearAdvertisingNodes();
    });

    test('returns the sanitized server node data when not advertising', () => {
      const data = getServerNodeData(serverNode);
      expect(data).toEqual({
        id: 'node-store',
        online: true,
        commissioned: true,
        advertising: false,
        advertiseTime: 0,
        windowStatus: 0,
        qrPairingCode: 'MT:QR',
        manualPairingCode: '1234-567-8901',
        fabricInformations: [{ fabricIndex: 1, fabricId: '3', nodeId: '4', rootNodeId: '5', rootVendorId: 4939, rootVendorName: '(HomeAssistant)', label: 'HA' }],
        sessionInformations: [
          {
            name: 's',
            nodeId: '1',
            peerNodeId: '2',
            fabric: undefined,
            isPeerActive: true,
            lastInteractionTimestamp: '2024-07-03T19:42:03.121Z',
            lastActiveTimestamp: '',
            numberOfActiveSubscriptions: 0,
          },
        ],
        serialNumber: 'SN123',
      });
      expect(() => JSON.stringify(data)).not.toThrow();
    });

    test('reports advertising when the node is in the advertising map', () => {
      setAdvertisingNode('node-store', 1720035723121);
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: true, advertiseTime: 1720035723121 });
      setAdvertisingNode('node-store', 0);
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: false, advertiseTime: 0 });
    });

    test('setAdvertisingNode and deleteAdvertisingNode', () => {
      setAdvertisingNode('node-store', 1234);
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: true, advertiseTime: 1234 });
      setAdvertisingNode('node-store', 5678);
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: true, advertiseTime: 5678 });
      deleteAdvertisingNode('node-store');
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: false, advertiseTime: 0 });
      deleteAdvertisingNode('node-store'); // no-op when missing
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: false, advertiseTime: 0 });
    });

    test('clearAdvertisingNodes', () => {
      const otherServerNode = Object.create(serverNode, { id: { value: 'other-store' } }) as ServerNode;
      setAdvertisingNode('node-store', 1234);
      setAdvertisingNode('other-store', 5678);
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: true, advertiseTime: 1234 });
      expect(getServerNodeData(otherServerNode)).toMatchObject({ advertising: true, advertiseTime: 5678 });
      clearAdvertisingNodes();
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: false, advertiseTime: 0 });
      expect(getServerNodeData(otherServerNode)).toMatchObject({ advertising: false, advertiseTime: 0 });
      clearAdvertisingNodes(); // no-op when empty
      expect(getServerNodeData(serverNode)).toMatchObject({ advertising: false, advertiseTime: 0 });
    });
  });
});
