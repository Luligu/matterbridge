/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-bridge', '-profile', 'Jest'];

import { jest } from '@jest/globals';

import { AnsiLogger, id, LogLevel } from 'node-ansi-logger';
import {
  airQualitySensor,
  bridgedNode,
  colorTemperatureLight,
  colorTemperatureSwitch,
  deviceEnergyManagement,
  dimmableLight,
  dimmableSwitch,
  electricalSensor,
  onOffLight,
  onOffSwitch,
  powerSource,
  rainSensor,
  smokeCoAlarm,
  waterFreezeDetector,
  waterLeakDetector,
} from './matterbridgeDeviceTypes.js';

import {
  BooleanStateConfiguration,
  ColorControl,
  ColorControlCluster,
  DoorLock,
  FlowMeasurementCluster,
  Identify,
  IdentifyCluster,
  LevelControl,
  ModeSelect,
  OnOff,
  Switch,
  SwitchCluster,
  Thermostat,
  ThreadNetworkDiagnostics,
  TimeSynchronization,
  WindowCovering,
  WindowCoveringCluster,
  SmokeCoAlarm,
  DeviceEnergyManagement,
} from '@matter/main/clusters';
import { VendorId } from '@matter/main';
import { DeviceTypes } from '@project-chip/matter.js/device';
import { ClusterServerObj, getClusterNameById } from '@project-chip/matter.js/cluster';
import { waiter } from './utils/utils.js';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';

describe('Matterbridge device serialize/deserialize', () => {
  test('create a basic device with all default clusters', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.ON_OFF_LIGHT);
    MatterbridgeDevice.bridgeMode = 'bridge';
    device.createDefaultBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 1, 'ProductName');
    MatterbridgeDevice.bridgeMode = '';
    device.createDefaultBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 1, 'ProductName');
    device.createDefaultBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 1, 'ProductName', 1, '1.0.0', 1, '1.0.0');
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    // device.createDefaultScenesClusterServer();
    device.createDefaultOnOffClusterServer();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    expect(device.getAllClusterServers()).toHaveLength(7);
    const serialized = device.serialize();
    expect(serialized).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const deserialized = MatterbridgeDevice.deserialize(serialized!);
    expect(deserialized).toBeDefined();
    expect(deserialized.getDeviceTypes()).toHaveLength(1);
    expect(deserialized.getAllClusterServers()).toHaveLength(7);
    expect(() => deserialized.verifyRequiredClusters()).not.toThrow();
  });

  test('create a bridged device with all default clusters', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName');
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName', 1, '1.0.0', 1, '1.0.0');
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    // device.createDefaultScenesClusterServer();
    device.createDefaultOnOffClusterServer();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    expect(device.getAllClusterServers()).toHaveLength(5);
    const serialized = device.serialize();
    expect(serialized).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const deserialized = MatterbridgeDevice.deserialize(serialized!);
    expect(deserialized).toBeDefined();
    expect(deserialized.getDeviceTypes()).toHaveLength(1);
    expect(deserialized.getAllClusterServers()).toHaveLength(5);
    expect(() => deserialized.verifyRequiredClusters()).not.toThrow();
  });
});

describe('Matterbridge device', () => {
  function invokeCommands(cluster: ClusterServerObj | undefined): void {
    // console.log('Cluster commands:', cluster);
    const commands = (cluster as any).commands as object;
    Object.entries(commands).forEach(([key, value]) => {
      // console.log(`Key "${key}": ${value}`, typeof value.handler, value.handler);
      if (typeof value.handler === 'function') value.handler({});
    });
  }

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'debug').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked debug: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'info').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked info: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'warn').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked warn: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'error').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked error: ${message}`, ...parameters);
    });
  });

  afterAll(async () => {
    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('create a device syncronously', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    expect(device.getDeviceTypes().length).toBe(1);
    expect(device.getDeviceTypes()[0].name).toBe('MA-bridgedNode');
  });

  test('create a double device asyncronously', async () => {
    const device = await MatterbridgeDevice.loadInstance([powerSource, bridgedNode]);
    expect(device.getDeviceTypes().length).toBe(2);
    expect(device.getDeviceTypes().includes(powerSource)).toBeTruthy();
    expect(device.getDeviceTypes().includes(bridgedNode)).toBeTruthy();
    device.addDeviceType(onOffSwitch);
    expect(device.getDeviceTypes().length).toBe(3);
    expect(device.getDeviceTypes().includes(onOffSwitch)).toBeTruthy();
    device.addDeviceType(dimmableSwitch);
    expect(device.getDeviceTypes().length).toBe(4);
    expect(device.getDeviceTypes().includes(dimmableSwitch)).toBeTruthy();
    device.addDeviceType(colorTemperatureSwitch);
    expect(device.getDeviceTypes().length).toBe(5);
    expect(device.getDeviceTypes().includes(colorTemperatureSwitch)).toBeTruthy();
  });

  test('create a device with all new matter 1.3 device types', async () => {
    const device = await MatterbridgeDevice.loadInstance([airQualitySensor, waterFreezeDetector, waterLeakDetector, rainSensor, smokeCoAlarm, electricalSensor, deviceEnergyManagement]);
    expect(device.getDeviceTypes().length).toBe(7);
    expect(device.getDeviceTypes().includes(airQualitySensor)).toBeTruthy();
    expect(device.getDeviceTypes().includes(waterFreezeDetector)).toBeTruthy();
    expect(device.getDeviceTypes().includes(waterLeakDetector)).toBeTruthy();
    expect(device.getDeviceTypes().includes(rainSensor)).toBeTruthy();
    expect(device.getDeviceTypes().includes(smokeCoAlarm)).toBeTruthy();
    expect(device.getDeviceTypes().includes(electricalSensor)).toBeTruthy();
    expect(device.getDeviceTypes().includes(deviceEnergyManagement)).toBeTruthy();
  });

  test('create a device with all clusters for the new matter 1.3 device types', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName');
    device.addDeviceTypeWithClusterServer([airQualitySensor, waterFreezeDetector, waterLeakDetector, rainSensor, smokeCoAlarm, electricalSensor, deviceEnergyManagement]);
    expect(device.getDeviceTypes().length).toBe(8);
    expect(device.getDeviceTypes().includes(bridgedNode)).toBeTruthy();
    expect(device.getDeviceTypes().includes(airQualitySensor)).toBeTruthy();
    expect(device.getDeviceTypes().includes(waterFreezeDetector)).toBeTruthy();
    expect(device.getDeviceTypes().includes(waterLeakDetector)).toBeTruthy();
    expect(device.getDeviceTypes().includes(rainSensor)).toBeTruthy();
    expect(device.getDeviceTypes().includes(smokeCoAlarm)).toBeTruthy();
    expect(device.getDeviceTypes().includes(electricalSensor)).toBeTruthy();
    expect(device.getDeviceTypes().includes(deviceEnergyManagement)).toBeTruthy();
    const deviceTypes = device.getDeviceTypes();
    deviceTypes.forEach((deviceType) => {
      deviceType.requiredServerClusters.forEach((clusterId) => {
        expect(device.getClusterServerById(clusterId)).toBeDefined();
        if (!device.getClusterServerById(clusterId)) console.log(`Cluster ${clusterId}-${getClusterNameById(clusterId)} not found in device ${deviceType.name}`);
      });
    });
  });

  test('create a device with child endpoints of type light', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName');

    const child1 = device.addChildDeviceTypeWithClusterServer('ComposedDevice1', [onOffLight]);
    expect(child1.uniqueStorageKey).toBe('ComposedDevice1');
    expect(child1.deviceType).toBe(onOffLight.code);
    expect(child1.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().length).toBe(1);
    expect(device.getChildEndpoints().length).toBe(1);
    expect(device.deviceType).toBe(bridgedNode.code);

    let child = device.getChildEndpointByName('ComposedDevice1');
    expect(child).toBeDefined();
    if (!child) return;
    expect(child.deviceType).toBe(onOffLight.code);
    expect(child.uniqueStorageKey).toBe('ComposedDevice1');

    const child2 = device.addChildDeviceTypeWithClusterServer('ComposedDevice2', [dimmableLight]);
    expect(child2.uniqueStorageKey).toBe('ComposedDevice2');
    expect(child2.deviceType).toBe(dimmableLight.code);
    expect(child2.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().length).toBe(1);
    expect(device.deviceType).toBe(bridgedNode.code);
    expect(device.getChildEndpoints().length).toBe(2);

    child = device.getChildEndpointByName('ComposedDevice1');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice1');
    child = device.getChildEndpointByName('ComposedDevice2');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice2');
    child = device.getChildEndpointByName('ComposedDevice3');
    expect(child).not.toBeDefined();

    const child3 = device.addChildDeviceTypeWithClusterServer('ComposedDevice3', [colorTemperatureLight]);
    expect(child3.uniqueStorageKey).toBe('ComposedDevice3');
    expect(child3.deviceType).toBe(colorTemperatureLight.code);
    expect(child3.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().length).toBe(1);
    expect(device.deviceType).toBe(bridgedNode.code);
    expect(device.getChildEndpoints().length).toBe(3);

    child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice1');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice1');
    child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice2');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice2');
    child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice3');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice3');

    child = device.addChildDeviceTypeWithClusterServer('ComposedDevice1', [dimmableLight]);
    expect(child?.uniqueStorageKey).toBe('ComposedDevice1');
    expect(device.getChildEndpoints().length).toBe(3);
    expect(child.getDeviceTypes()).toHaveLength(2);

    child = device.addChildDeviceTypeWithClusterServer('ComposedDevice2', [colorTemperatureLight]);
    expect(child?.uniqueStorageKey).toBe('ComposedDevice2');
    expect(device.getChildEndpoints().length).toBe(3);
    expect(child.getDeviceTypes()).toHaveLength(2);

    child = device.addChildDeviceTypeWithClusterServer('ComposedDevice3', [colorTemperatureLight]);
    expect(child?.uniqueStorageKey).toBe('ComposedDevice3');
    expect(device.getChildEndpoints().length).toBe(3);
    expect(child.getDeviceTypes()).toHaveLength(1);

    expect(device.getChildEndpointByName('ComposedDevice1')).toBeDefined();
    expect(device.getChildEndpointByName('ComposedDevice2')).toBeDefined();
    expect(device.getChildEndpointByName('ComposedDevice3')).toBeDefined();
    expect(device.getChildEndpointByName('ComposedDevice4')).not.toBeDefined();
    expect(device.getChildEndpointByName('')).not.toBeDefined();

    device?.verifyRequiredClusters();

    child = device.getChildEndpointByName('ComposedDevice1');
    expect(child).toBeDefined();
    if (!child) return;
    child.verifyRequiredClusters();

    child = device.getChildEndpointByName('ComposedDevice2');
    expect(child).toBeDefined();
    if (!child) return;
    child.verifyRequiredClusters();

    child = device.getChildEndpointByName('ComposedDevice3');
    expect(child).toBeDefined();
    if (!child) return;
    child?.verifyRequiredClusters();
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('create a power source device with EveHistory', async () => {
    const device = new MatterbridgeDevice(powerSource);
    MatterHistory.createEveHistoryClusterServer(device);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    invokeCommands(device.getClusterServerById(EveHistoryCluster.id));
  });

  test('create a door device with EveHistory', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.CONTACT_SENSOR);
    device.log.logLevel = LogLevel.DEBUG;
    const history = new MatterHistory(device.log, 'Eve door');
    history.createDoorEveHistoryClusterServer(device, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const historyCluster = device.getClusterServerById(EveHistory.Complete.id);
    expect(historyCluster).toBeDefined();

    history.autoPilot(device);
    // Wait for the Matterbridge history to be loaded
    await waiter(
      'Matterbridge history loaded',
      () => {
        return (history as any).historyLoaded === true;
      },
      false,
      5000,
      500,
      false,
    );
    historyCluster?.getConfigDataGetAttribute();
    historyCluster?.getConfigDataSetAttribute();
    historyCluster?.setConfigDataSetAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistoryStatusAttribute();
    historyCluster?.getHistoryEntriesAttribute();
    historyCluster?.setHistoryEntriesAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistorySetTimeAttribute();
    historyCluster?.setHistorySetTimeAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getHistoryRequestAttribute();
    historyCluster?.setHistoryRequestAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getLastEventAttribute();
    historyCluster?.getTimesOpenedAttribute();
    historyCluster?.getResetTotalAttribute();
    historyCluster?.setResetTotalAttribute(0);
    await history.close();
  }, 60000);

  test('create a motion device with EveHistory', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.OCCUPANCY_SENSOR);
    const history = new MatterHistory(device.log, 'Eve motion');
    history.createMotionEveHistoryClusterServer(device, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const historyCluster = device.getClusterServerById(EveHistory.Complete.id);
    expect(historyCluster).toBeDefined();

    history.autoPilot(device);
    // Wait for the Matterbridge history to be loaded
    await waiter(
      'Matterbridge history loaded',
      () => {
        return (history as any).historyLoaded === true;
      },
      false,
      5000,
      500,
      false,
    );
    historyCluster?.getConfigDataGetAttribute();
    historyCluster?.getConfigDataSetAttribute();
    historyCluster?.setConfigDataSetAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistoryStatusAttribute();
    historyCluster?.getHistoryEntriesAttribute();
    historyCluster?.setHistoryEntriesAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistorySetTimeAttribute();
    historyCluster?.setHistorySetTimeAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getHistoryRequestAttribute();
    historyCluster?.setHistoryRequestAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getLastEventAttribute();
    await history.close();
  }, 60000);

  test('create a energy device with EveHistory', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.ON_OFF_PLUGIN_UNIT);
    const history = new MatterHistory(device.log, 'Eve energy');
    history.createEnergyEveHistoryClusterServer(device, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const historyCluster = device.getClusterServerById(EveHistory.Complete.id);
    expect(historyCluster).toBeDefined();

    history.autoPilot(device);
    // Wait for the Matterbridge history to be loaded
    await waiter(
      'Matterbridge history loaded',
      () => {
        return (history as any).historyLoaded === true;
      },
      false,
      5000,
      500,
      false,
    );
    historyCluster?.getConfigDataGetAttribute();
    historyCluster?.getConfigDataSetAttribute();
    historyCluster?.setConfigDataSetAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistoryStatusAttribute();
    historyCluster?.getHistoryEntriesAttribute();
    historyCluster?.setHistoryEntriesAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistorySetTimeAttribute();
    historyCluster?.setHistorySetTimeAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getHistoryRequestAttribute();
    historyCluster?.setHistoryRequestAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getLastEventAttribute();
    historyCluster?.getResetTotalAttribute();
    historyCluster?.setResetTotalAttribute(0);
    await history.close();
  }, 60000);

  test('create a room device with EveHistory', async () => {
    const device = new MatterbridgeDevice([airQualitySensor]);
    const history = new MatterHistory(device.log, 'Eve room');
    history.createRoomEveHistoryClusterServer(device, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    device.addOptionalClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const historyCluster = device.getClusterServerById(EveHistory.Complete.id);
    expect(historyCluster).toBeDefined();

    history.autoPilot(device);
    // Wait for the Matterbridge history to be loaded
    await waiter(
      'Matterbridge history loaded',
      () => {
        return (history as any).historyLoaded === true;
      },
      false,
      5000,
      500,
      false,
    );
    historyCluster?.getConfigDataGetAttribute();
    historyCluster?.getConfigDataSetAttribute();
    historyCluster?.setConfigDataSetAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistoryStatusAttribute();
    historyCluster?.getHistoryEntriesAttribute();
    historyCluster?.setHistoryEntriesAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistorySetTimeAttribute();
    historyCluster?.setHistorySetTimeAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getHistoryRequestAttribute();
    historyCluster?.setHistoryRequestAttribute(Uint8Array.fromHex('000000000000'));
    await history.close();
  }, 60000);

  test('create a weather device with EveHistory', async () => {
    const device = new MatterbridgeDevice([DeviceTypes.TEMPERATURE_SENSOR, DeviceTypes.HUMIDITY_SENSOR, DeviceTypes.PRESSURE_SENSOR]);
    const history = new MatterHistory(device.log, 'Eve weather');
    history.createWeatherEveHistoryClusterServer(device, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(3);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const historyCluster = device.getClusterServerById(EveHistory.Complete.id);
    expect(historyCluster).toBeDefined();

    history.autoPilot(device);
    // Wait for the Matterbridge history to be loaded
    await waiter(
      'Matterbridge history loaded',
      () => {
        return (history as any).historyLoaded === true;
      },
      false,
      5000,
      500,
      false,
    );
    historyCluster?.getConfigDataGetAttribute();
    historyCluster?.getConfigDataSetAttribute();
    historyCluster?.setConfigDataSetAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistoryStatusAttribute();
    historyCluster?.getHistoryEntriesAttribute();
    historyCluster?.setHistoryEntriesAttribute(Uint8Array.fromHex(''));
    historyCluster?.getHistorySetTimeAttribute();
    historyCluster?.setHistorySetTimeAttribute(Uint8Array.fromHex('000000000000'));
    historyCluster?.getHistoryRequestAttribute();
    historyCluster?.setHistoryRequestAttribute(Uint8Array.fromHex('000000000000'));
    await history.close();
  }, 60000);
  */

  test('create a device with all default clusters', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName');
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultScenesClusterServer();
    device.addClusterServer(device.getDefaultElectricalEnergyMeasurementClusterServer());
    device.addClusterServer(device.getDefaultElectricalPowerMeasurementClusterServer());
    device.createDefaultDummyThreadNetworkDiagnosticsClusterServer();
    device.createDefaultOnOffClusterServer();
    device.createDefaultLevelControlClusterServer();
    device.createDefaultColorControlClusterServer();
    invokeCommands(device.getClusterServerById(ColorControl.Complete.id));
    device.createDefaultColorControlClusterServer();
    device.createDefaultWindowCoveringClusterServer();
    device.createDefaultDoorLockClusterServer();
    device.createDefaultSwitchClusterServer();
    device.createDefaultLatchingSwitchClusterServer();
    device.createDefaultModeSelectClusterServer('Mode select', [
      { mode: 1, label: 'Mode 1', semanticTags: [{ mfgCode: VendorId(0xfff1), value: 0 }] },
      { mode: 2, label: 'Mode 2', semanticTags: [{ mfgCode: VendorId(0xfff1), value: 0 }] },
    ]);
    device.createDefaultOccupancySensingClusterServer();
    device.createDefaultIlluminanceMeasurementClusterServer();
    device.createDefaultFlowMeasurementClusterServer();
    device.createDefaultTemperatureMeasurementClusterServer();
    device.createDefaultRelativeHumidityMeasurementClusterServer();
    device.createDefaultPressureMeasurementClusterServer();
    device.createDefaultBooleanStateClusterServer();
    device.createDefaultBooleanStateConfigurationClusterServer();
    device.createDefaultPowerSourceReplaceableBatteryClusterServer();
    device.createDefaultPowerSourceRechargeableBatteryClusterServer();
    device.createDefaultPowerSourceWiredClusterServer();
    device.createDefaultPowerSourceConfigurationClusterServer();
    device.createDefaultAirQualityClusterServer();
    device.createDefaultTvocMeasurementClusterServer();
    device.createDefaultThermostatClusterServer();
    device.createDefaultTimeSyncClusterServer();
    device.createDefaultSmokeCOAlarmClusterServer();
    device.createDefaultCarbonMonoxideConcentrationMeasurementClusterServer();
    device.createDefaultCarbonDioxideConcentrationMeasurementClusterServer();
    device.createDefaultFormaldehydeConcentrationMeasurementClusterServer();
    device.createDefaulPm1ConcentrationMeasurementClusterServer();
    device.createDefaulPm25ConcentrationMeasurementClusterServer();
    device.createDefaulPm10ConcentrationMeasurementClusterServer();
    device.createDefaulOzoneConcentrationMeasurementClusterServer();
    device.createDefaulRadonConcentrationMeasurementClusterServer();
    device.createDefaulNitrogenDioxideConcentrationMeasurementClusterServer();
    device.createDefaultFanControlClusterServer();
    device.addClusterServer(device.getDefaultDeviceEnergyManagementModeClusterServer());
    device.addClusterServer(device.getDefaultDeviceEnergyManagementClusterServer());
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    device.addDeviceTypeWithClusterServer([airQualitySensor, waterFreezeDetector, waterLeakDetector, rainSensor, smokeCoAlarm, electricalSensor, deviceEnergyManagement]);
    device.addRequiredClusterServers(device);
    device.addOptionalClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    invokeCommands(device.getClusterServerById(Identify.Complete.id));
    // invokeCommands(device.getClusterServerById(Scenes.Complete.id));
    // invokeCommands(device.getClusterServerById(Groups.Complete.id));
    invokeCommands(device.getClusterServerById(OnOff.Complete.id));
    invokeCommands(device.getClusterServerById(LevelControl.Complete.id));
    invokeCommands(device.getClusterServerById(ColorControl.Complete.id));
    invokeCommands(device.getClusterServerById(Thermostat.Complete.id));
    invokeCommands(device.getClusterServerById(BooleanStateConfiguration.Complete.id));
    invokeCommands(device.getClusterServerById(SmokeCoAlarm.Complete.id));
    invokeCommands(device.getClusterServerById(ModeSelect.Complete.id));
    invokeCommands(device.getClusterServerById(Switch.Complete.id));
    invokeCommands(device.getClusterServerById(TimeSynchronization.Complete.id));
    invokeCommands(device.getClusterServerById(DeviceEnergyManagement.Complete.id));
    invokeCommands(device.getClusterServerById(ThreadNetworkDiagnostics.Complete.id));
  });

  test('create a device switch with basic information', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.GENERIC_SWITCH);
    expect(MatterbridgeDevice.bridgeMode).toBe('');
    device.createDefaultBasicInformationClusterServer('Name', 'Serial', 0xfff1, 'VendorName', 0x8000, 'ProductName');
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.GENERIC_SWITCH)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    expect(device.getAllClusterServers()).toHaveLength(3);
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    expect(device.getAllClusterServers()).toHaveLength(5);
    device.createDefaultLatchingSwitchClusterServer();
    expect(device.getAllClusterServers()).toHaveLength(5);
    device.createDefaultLatchingSwitchClusterServer();
    expect(device.getAllClusterServers()).toHaveLength(5);
    device.createDefaultSwitchClusterServer();
    expect(device.getAllClusterServers()).toHaveLength(5);
    // logEndpoint(device);
  });

  test('create a device lock with bridged basic information', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.DOOR_LOCK);
    device.addCommandHandler('lockDoor', (data) => {
      device.log.debug('Lock command called with:', data.request);
    });
    device.addCommandHandler('unlockDoor', (data) => {
      device.log.debug('Unlock command called with:', data.request);
    });
    expect(MatterbridgeDevice.bridgeMode).toBe('');
    expect(device.getDeviceTypes()).toHaveLength(1);
    device.addDeviceType(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 0xfff1, 'VendorName', 'ProductName');
    expect(device.getDeviceTypes()).toHaveLength(2);
    expect(device.getDeviceTypes().includes(DeviceTypes.DOOR_LOCK)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    expect(device.getAllClusterServers()).toHaveLength(3);
    device.addRequiredClusterServers(device);
    invokeCommands(device.getClusterServerById(DoorLock.Complete.id));
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    expect(device.getAllClusterServers()).toHaveLength(5);
  });

  test('create a device window covering', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.WINDOW_COVERING);
    device.addCommandHandler('upOrOpen', (data) => {
      device.log.debug('upOrOpen command called with:', data.request);
    });
    device.addCommandHandler('downOrClose', (data) => {
      device.log.debug('downOrClose command called with:', data.request);
    });
    device.addCommandHandler('stopMotion', (data) => {
      device.log.debug('stopMotion command called with:', data.request);
    });
    device.addCommandHandler('goToLiftPercentage', (data) => {
      device.log.debug('goToLiftPercentage command called with:', data.request);
    });

    expect(MatterbridgeDevice.bridgeMode).toBe('');
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.WINDOW_COVERING)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const windowCoveringCluster = device.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    expect(windowCoveringCluster).toBeDefined();
    invokeCommands(device.getClusterServerById(WindowCovering.Complete.id));

    const current = windowCoveringCluster?.getCurrentPositionLiftPercent100thsAttribute();
    expect(current).not.toBeNull();
    expect(current).toBe(0); // Fully open

    device.setWindowCoveringTargetAsCurrentAndStopped();
    const target = windowCoveringCluster?.getTargetPositionLiftPercent100thsAttribute();
    expect(target).not.toBeNull();
    expect(target).toBe(current);
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
    expect(windowCoveringCluster?.getCurrentPositionLiftPercent100thsAttribute()).toBe(windowCoveringCluster?.getTargetPositionLiftPercent100thsAttribute());

    device.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening);
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Opening);

    device.setWindowCoveringCurrentTargetStatus(5000, 6000, WindowCovering.MovementStatus.Closing);
    expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Closing);
    expect(windowCoveringCluster?.getCurrentPositionLiftPercent100thsAttribute()).toBe(5000);
    expect(windowCoveringCluster?.getTargetPositionLiftPercent100thsAttribute()).toBe(6000);

    device.setWindowCoveringTargetAndCurrentPosition(7000);
    expect(windowCoveringCluster?.getCurrentPositionLiftPercent100thsAttribute()).toBe(7000);
    expect(windowCoveringCluster?.getTargetPositionLiftPercent100thsAttribute()).toBe(7000);

    const features = windowCoveringCluster?.getFeatureMapAttribute();
    expect(features).toBeDefined();
    if (!features) return;
    expect(features.lift).toBe(true);
    expect(features.tilt).toBe(false);
    expect(features.positionAwareLift).toBe(true);
    expect(features.absolutePosition).toBe(false);
    expect(features.positionAwareTilt).toBe(false);
  });

  test('create a device identify', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.FLOW_SENSOR);
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.FLOW_SENSOR)).toBeTruthy();
    expect(device.getDeviceTypes().includes(DeviceTypes.WINDOW_COVERING)).toBeFalsy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    const identifyCluster = device.getClusterServerById(IdentifyCluster.id);
    expect(identifyCluster).toBeDefined();
    expect(identifyCluster?.isCommandSupportedByName('identify')).toBeTruthy();
    expect(identifyCluster?.isCommandSupportedByName('lock')).toBeFalsy();

    let identifyTime = device.getAttribute(IdentifyCluster.id, 'identifyTime');
    expect(identifyTime).toBeDefined();
    expect(identifyTime).toBe(0);
    device.setAttribute(IdentifyCluster.id, 'identifyTime', 5);
    identifyTime = device.getAttribute(IdentifyCluster.id, 'identifyTime');
    expect(identifyTime).toBeDefined();
    expect(identifyTime).toBe(5);
    identifyTime = device.getAttribute(FlowMeasurementCluster.id, 'identifyTime');
    expect(identifyTime).toBeUndefined();
    identifyTime = device.getAttribute(IdentifyCluster.id, 'IdentifyTime');
    expect(identifyTime).toBeUndefined();
    identifyTime = device.getAttribute(IdentifyCluster.id, 'Identify');
    expect(identifyTime).toBeUndefined();

    device.addRequiredClusterServers(device);
    expect(device.setAttribute(FlowMeasurementCluster.id, 'identifyTime', 5)).toBeFalsy();
    expect(device.setAttribute(FlowMeasurementCluster.id, 'measuredValue', 10)).toBeTruthy();
    expect(device.setAttribute(ColorControlCluster.id, 'measuredValue', 10)).toBeFalsy();
    expect(device.setAttribute(IdentifyCluster.id, 'measuredValue', 5)).toBeFalsy();

    device.addCommandHandler('identify', (data) => {
      device.log.debug('Identify command called with:', data.request);
    });
    device.addCommandHandler('triggerEffect', (data) => {
      device.log.debug('triggerEffect command called with:', data.request);
    });
    invokeCommands(identifyCluster);
  });

  test('create a device with ColorControl', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.COLOR_TEMPERATURE_LIGHT);
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.ON_OFF_LIGHT)).toBeFalsy();
    expect(device.getDeviceTypes().includes(DeviceTypes.DIMMABLE_LIGHT)).toBeFalsy();
    expect(device.getDeviceTypes().includes(DeviceTypes.COLOR_TEMPERATURE_LIGHT)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const identifyCluster = device.getClusterServerById(IdentifyCluster.id);
    expect(identifyCluster).toBeDefined();
    const colorCluster = device.getClusterServerById(ColorControlCluster.id);
    expect(colorCluster?.isCommandSupportedByName('identify')).toBeFalsy();
    expect(colorCluster?.isCommandSupportedByName('moveToColor')).toBeTruthy();
    expect(colorCluster?.isCommandSupportedByName('moveToHue')).toBeTruthy();
    expect(colorCluster?.isCommandSupportedByName('moveToSaturation')).toBeTruthy();
    expect(colorCluster?.isCommandSupportedByName('moveToHueAndSaturation')).toBeTruthy();
    expect(colorCluster?.isCommandSupportedByName('moveToColorTemperature')).toBeTruthy();

    device.addCommandHandler('identify', (data) => {
      device.log.debug('Identify command called with:', data.request);
    });
    device.addCommandHandler('triggerEffect', (data) => {
      device.log.debug('triggerEffect command called with:', data.request);
    });
    invokeCommands(identifyCluster);

    device.addCommandHandler('moveToColor', (data) => {
      device.log.debug('moveToColor command called with:', data.request);
    });
    device.addCommandHandler('moveToHue', (data) => {
      device.log.debug('moveToHue command called with:', data.request);
    });
    device.addCommandHandler('moveToSaturation', (data) => {
      device.log.debug('moveToSaturation command called with:', data.request);
    });
    device.addCommandHandler('moveToHueAndSaturation', (data) => {
      device.log.debug('moveToHueAndSaturation command called with:', data.request);
    });
    device.addCommandHandler('moveToColorTemperature', (data) => {
      device.log.debug('moveToColorTemperature command called with:', data.request);
    });
    invokeCommands(colorCluster);

    device.createDefaultColorControlClusterServer();
    device.configureColorControlCluster(true, true, true, ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation);
    device.configureColorControlCluster(true, true, true, ColorControl.ColorMode.CurrentXAndCurrentY, device);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.ColorMode.CurrentXAndCurrentY);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.EnhancedColorMode.CurrentXAndCurrentY);
    device.configureColorControlMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.ColorMode.CurrentXAndCurrentY);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.EnhancedColorMode.CurrentXAndCurrentY);
    device.configureColorControlMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation, device);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(device.getAttribute(ColorControlCluster.id, 'colorMode')).toBe(ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation);
  });

  test('create a generic switch device type latching', async () => {
    const matterbridge = await Matterbridge.loadInstance(true);
    await waiter(
      'Matter server started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined;
      },
      false,
      60000,
      1000,
      true,
    );
    const device = new MatterbridgeDevice(DeviceTypes.GENERIC_SWITCH);
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultLatchingSwitchClusterServer();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.GENERIC_SWITCH)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const switchCluster = device.getClusterServerById(SwitchCluster.id);
    expect(switchCluster).toBeDefined();
    if (!switchCluster) return;
    const features = switchCluster?.getFeatureMapAttribute();
    expect(features).toBeDefined();
    if (!features) return;
    expect(features.latchingSwitch).toBe(true);
    expect(features.momentarySwitch).toBe(false);
    expect(features.momentarySwitchRelease).toBe(false);
    expect(features.momentarySwitchLongPress).toBe(false);
    expect(features.momentarySwitchMultiPress).toBe(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Latching switch', 'Serial', 1, 'VendorName', 'ProductName');
    expect(device.triggerSwitchEvent('Press')).toBeFalsy();
    expect(device.triggerSwitchEvent('Release')).toBeFalsy();
    await (matterbridge as any).matterAggregator.addBridgedDevice(device);
    expect(device.triggerSwitchEvent('Press')).toBeTruthy();
    expect(device.triggerSwitchEvent('Release')).toBeTruthy();
    await matterbridge.destroyInstance();
  }, 60000);

  test('create a generic switch device type momentary', async () => {
    const matterbridge = await Matterbridge.loadInstance(true);
    await waiter(
      'Matter server started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined;
      },
      false,
      60000,
      1000,
      true,
    );

    const device = new MatterbridgeDevice(DeviceTypes.GENERIC_SWITCH);
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultSwitchClusterServer();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.GENERIC_SWITCH)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const switchCluster = device.getClusterServerById(SwitchCluster.id);
    expect(switchCluster).toBeDefined();
    if (!switchCluster) return;
    const features = switchCluster?.getFeatureMapAttribute();
    expect(features).toBeDefined();
    if (!features) return;
    expect(features.latchingSwitch).toBe(false);
    expect(features.momentarySwitch).toBe(true);
    expect(features.momentarySwitchRelease).toBe(true);
    expect(features.momentarySwitchLongPress).toBe(true);
    expect(features.momentarySwitchMultiPress).toBe(true);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Momentary switch', 'Serial', 1, 'VendorName', 'ProductName');
    expect(device.triggerSwitchEvent('Single')).toBeFalsy();
    expect(device.triggerSwitchEvent('Double')).toBeFalsy();
    expect(device.triggerSwitchEvent('Long')).toBeFalsy();
    await (matterbridge as any).matterAggregator.addBridgedDevice(device);
    expect(device.triggerSwitchEvent('Single')).toBeTruthy();
    expect(device.triggerSwitchEvent('Double')).toBeTruthy();
    expect(device.triggerSwitchEvent('Long')).toBeTruthy();
    await matterbridge.destroyInstance();
  }, 60000);
});
