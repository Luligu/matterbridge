/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import {
  airQualitySensor,
  bridgedNode,
  colorTemperatureSwitch,
  deviceEnergyManagement,
  dimmableSwitch,
  electricalSensor,
  MatterbridgeDevice,
  onOffSwitch,
  powerSource,
  rainSensor,
  smokeCoAlarm,
  waterFreezeDetector,
  waterLeakDetector,
} from './matterbridgeDevice.js';
import { EveHistory, EveHistoryCluster, MatterHistory } from 'matter-history';

import { Attributes, BasicInformation, BasicInformationCluster, Binding, ClusterServerObj, Descriptor, Events, getClusterNameById, Switch, SwitchCluster, WindowCovering, WindowCoveringCluster } from '@project-chip/matter-node.js/cluster';
import { DeviceTypes } from '@project-chip/matter-node.js/device';

describe('Matterbridge platform', () => {
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
        if (!device.getClusterServerById(clusterId)) console.log(`Cluster ${clusterId}-${getClusterNameById(clusterId)} not found in device ${deviceType.name}`);
        expect(device.getClusterServerById(clusterId)).toBeDefined();
      });
    });
  });

  test('create a device with child endpoints of type light', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName');
    const child1 = device.addChildDeviceTypeWithClusterServer('ComposedDevice1', [DeviceTypes.ON_OFF_LIGHT]);
    expect(child1.uniqueStorageKey).toBe('ComposedDevice1');
    expect(child1.deviceType).toBe(DeviceTypes.ON_OFF_LIGHT.code);
    expect(child1.getDeviceTypes()).toHaveLength(1);

    let child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice1');
    expect(child).toBeDefined();
    expect(child?.deviceType).toBe(DeviceTypes.ON_OFF_LIGHT.code);
    expect(child?.uniqueStorageKey).toBe('ComposedDevice1');
    expect(device.getDeviceTypes().length).toBe(1);
    expect(device.deviceType).toBe(bridgedNode.code);
    expect(device.getChildEndpoints().length).toBe(1);

    const child2 = device.addChildDeviceTypeWithClusterServer('ComposedDevice2', [DeviceTypes.DIMMABLE_LIGHT]);
    expect(child2.uniqueStorageKey).toBe('ComposedDevice2');
    expect(child2.deviceType).toBe(DeviceTypes.DIMMABLE_LIGHT.code);
    expect(child2.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().length).toBe(1);
    expect(device.deviceType).toBe(bridgedNode.code);
    expect(device.getChildEndpoints().length).toBe(2);

    child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice1');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice1');
    child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice2');
    expect(child).toBeDefined();
    expect(child?.uniqueStorageKey).toBe('ComposedDevice2');
    child = device.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === 'ComposedDevice3');
    expect(child).not.toBeDefined();

    const child3 = device.addChildDeviceTypeWithClusterServer('ComposedDevice3', [DeviceTypes.COLOR_TEMPERATURE_LIGHT]);
    expect(child3.uniqueStorageKey).toBe('ComposedDevice3');
    expect(child3.deviceType).toBe(DeviceTypes.COLOR_TEMPERATURE_LIGHT.code);
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

    child = device.addChildDeviceTypeWithClusterServer('ComposedDevice1', [DeviceTypes.DIMMABLE_LIGHT]);
    expect(child?.uniqueStorageKey).toBe('ComposedDevice1');
    expect(device.getChildEndpoints().length).toBe(3);
    expect(child.getDeviceTypes()).toHaveLength(2);

    child = device.addChildDeviceTypeWithClusterServer('ComposedDevice2', [DeviceTypes.COLOR_TEMPERATURE_LIGHT]);
    expect(child?.uniqueStorageKey).toBe('ComposedDevice2');
    expect(device.getChildEndpoints().length).toBe(3);
    expect(child.getDeviceTypes()).toHaveLength(2);

    child = device.addChildDeviceTypeWithClusterServer('ComposedDevice3', [DeviceTypes.COLOR_TEMPERATURE_LIGHT]);
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
    child?.verifyRequiredClusters();
    // eslint-disable-next-line jest/no-conditional-expect
    if (child) expect(device.getChildEndpointName(child)).toBe('ComposedDevice1');

    child = device.getChildEndpointByName('ComposedDevice2');
    child?.verifyRequiredClusters();
    // eslint-disable-next-line jest/no-conditional-expect
    if (child) expect(device.getChildEndpointName(child)).toBe('ComposedDevice2');

    child = device.getChildEndpointByName('ComposedDevice3');
    child?.verifyRequiredClusters();
    // eslint-disable-next-line jest/no-conditional-expect
    if (child) expect(device.getChildEndpointName(child)).toBe('ComposedDevice3');

    child = device.getChildEndpointWithLabel('ComposedDevice1');
    // eslint-disable-next-line jest/no-conditional-expect
    if (child) expect(device.getChildEndpointName(child)).toBe('ComposedDevice1');

    child = device.getChildEndpointWithLabel('ComposedDevice2');
    // eslint-disable-next-line jest/no-conditional-expect
    if (child) expect(device.getChildEndpointName(child)).toBe('ComposedDevice2');

    child = device.getChildEndpointWithLabel('ComposedDevice3');
    // eslint-disable-next-line jest/no-conditional-expect
    if (child) expect(device.getChildEndpointName(child)).toBe('ComposedDevice3');
  });

  test('create a power source device with EveHistory', async () => {
    const device = new MatterbridgeDevice(powerSource);
    device.createDefaultStaticEveHistoryClusterServer();
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
  });

  test('create a door device with EveHistory', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.CONTACT_SENSOR);
    const history = new MatterHistory(device.log, 'Eve door');
    device.createDoorEveHistoryClusterServer(history, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
  });

  test('create a motion device with EveHistory', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.OCCUPANCY_SENSOR);
    const history = new MatterHistory(device.log, 'Eve motion');
    device.createMotionEveHistoryClusterServer(history, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
  });

  test('create a energy device with EveHistory', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.ON_OFF_PLUGIN_UNIT);
    const history = new MatterHistory(device.log, 'Eve energy');
    device.createEnergyEveHistoryClusterServer(history, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
  });

  test('create a room device with EveHistory', async () => {
    const device = new MatterbridgeDevice([airQualitySensor]);
    const history = new MatterHistory(device.log, 'Eve room');
    device.createRoomEveHistoryClusterServer(history, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    device.addOptionalClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
  });

  test('create a weather device with EveHistory', async () => {
    const device = new MatterbridgeDevice([DeviceTypes.TEMPERATURE_SENSOR, DeviceTypes.HUMIDITY_SENSOR, DeviceTypes.PRESSURE_SENSOR]);
    const history = new MatterHistory(device.log, 'Eve weather');
    device.createWeatherEveHistoryClusterServer(history, device.log);
    expect(device.getClusterServerById(EveHistoryCluster.id)).toBeDefined();
    expect(device.getDeviceTypes()).toHaveLength(3);
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
  });

  test('create a device with all default clusters', async () => {
    const device = new MatterbridgeDevice(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 1, 'VendorName', 'ProductName');
    device.createDefaultIdentifyClusterServer();
    device.createDefaultGroupsClusterServer();
    device.createDefaultScenesClusterServer();
    device.createDefaultElectricalMeasurementClusterServer();
    device.createDefaultDummyThreadNetworkDiagnosticsClusterServer();
    device.createDefaultOnOffClusterServer();
    device.createDefaultLevelControlClusterServer();
    device.createDefaultColorControlClusterServer();
    device.createDefaultXYColorControlClusterServer();
    device.createDefaultWindowCoveringClusterServer();
    device.createDefaultDoorLockClusterServer();
    device.createDefaultSwitchClusterServer();
    device.createDefaultLatchingSwitchClusterServer();
    device.createDefaultModeSelectClusterServer();
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
  });

  test('create a device switch with basic information', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.GENERIC_SWITCH);
    expect(MatterbridgeDevice.bridgeMode).toBe('');
    device.createDefaultBasicInformationClusterServer('Name', 'Serial', 0xfff1, 'VendorName', 0x8000, 'ProductName');
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.GENERIC_SWITCH)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    // expect(() => device.getAllClusterServers()).toHaveLength(1); // This is not working
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    // expect(() => device.getAllClusterServers()).toHaveLength(1); // This is not working
  });

  test('create a device switch with bridged basic information', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.GENERIC_SWITCH);
    expect(MatterbridgeDevice.bridgeMode).toBe('');
    device.addDeviceType(bridgedNode);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Name', 'Serial', 0xfff1, 'VendorName', 'ProductName');
    expect(device.getDeviceTypes()).toHaveLength(2);
    expect(device.getDeviceTypes().includes(DeviceTypes.GENERIC_SWITCH)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    // expect(() => device.getAllClusterServers()).toHaveLength(1); // This is not working
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    // expect(() => device.getAllClusterServers()).toHaveLength(1); // This is not working
  });

  test('create a device window covering', async () => {
    const device = new MatterbridgeDevice(DeviceTypes.WINDOW_COVERING);
    expect(MatterbridgeDevice.bridgeMode).toBe('');
    expect(device.getDeviceTypes()).toHaveLength(1);
    expect(device.getDeviceTypes().includes(DeviceTypes.WINDOW_COVERING)).toBeTruthy();
    expect(() => device.verifyRequiredClusters()).toThrow();
    device.addRequiredClusterServers(device);
    expect(() => device.verifyRequiredClusters()).not.toThrow();
    const windowCoveringCluster = device.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));

    windowCoveringCluster?.getCurrentPositionLiftPercent100thsAttribute();

    device.setWindowCoveringTargetAsCurrentAndStopped();
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
  });
});
