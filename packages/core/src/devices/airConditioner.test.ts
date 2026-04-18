// src/airConditioner.test.ts

const MATTER_PORT = 8001; // Unique test port (ensure no collision with other device tests)
const NAME = 'AirConditioner';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { FanControl, Identify, OnOff, PowerSource, Thermostat, ThermostatCluster, ThermostatUserInterfaceConfiguration } from '@matter/types/clusters';
import { stringify } from 'node-ansi-logger';

// Matterbridge helpers
import { addDevice, aggregator, createTestEnvironment, destroyTestEnvironment, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';
import { airConditioner } from '../matterbridgeDeviceTypes.js';
import { featuresFor } from '../matterbridgeEndpointHelpers.js';
import { AirConditioner } from './airConditioner.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: AirConditioner;

  beforeAll(async () => {
    // Setup the Matter test environment
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment(MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, airConditioner.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create an air conditioner device (defaults)', async () => {
    device = new AirConditioner('Air Conditioner Test Device', 'AC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('AirConditionerTestDevice-AC123456');

    // Cluster servers existence
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(featuresFor(device, 'Identify')).toEqual({});
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(featuresFor(device, 'PowerSource')).toEqual({ battery: false, rechargeable: false, replaceable: false, wired: true });
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy(); // Dead Front On/Off cluster
    expect(featuresFor(device, 'OnOff')).toEqual({ deadFrontBehavior: true, lighting: false, offOnly: false }); // Dead Front On/Off cluster
    expect(device.hasClusterServer(Thermostat.Cluster.id)).toBeTruthy();
    expect(featuresFor(device, 'Thermostat')).toEqual({
      autoMode: true,
      cooling: true,
      heating: true,
      localTemperatureNotExposed: false,
      matterScheduleConfiguration: false,
      occupancy: false,
      presets: false,
      scheduleConfiguration: false,
      setback: false,
    });
    expect(device.hasClusterServer(ThermostatUserInterfaceConfiguration.Cluster.id)).toBeTruthy();
    expect(featuresFor(device, 'ThermostatUserInterfaceConfiguration')).toEqual({});
    expect(device.hasClusterServer(FanControl.Cluster.id)).toBeTruthy();
    expect(featuresFor(device, 'FanControl')).toEqual({ airflowDirection: false, auto: true, multiSpeed: false, rocking: false, step: true, wind: false });
    expect(device.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'powerSource',
      'onOff',
      'thermostat',
      'thermostatUserInterfaceConfiguration',
      'fanControl',
    ]);
  });

  test('create an air conditioner device (custom options)', async () => {
    const custom = new AirConditioner('Bedroom AC', 'AC654321', { localTemperature: 30, percentSetting: 40 });
    expect(custom).toBeDefined();
    expect(custom.id).toBe('BedroomAC-AC654321');
    expect(custom.getClusterServerOptions(Thermostat.Cluster.id)).toEqual({
      absMaxCoolSetpointLimit: 5000,
      absMaxHeatSetpointLimit: 5000,
      absMinCoolSetpointLimit: 0,
      absMinHeatSetpointLimit: 0,
      controlSequenceOfOperation: 4,
      externalMeasuredIndoorTemperature: 3000,
      localTemperature: 3000,
      maxCoolSetpointLimit: 5000,
      maxHeatSetpointLimit: 5000,
      minCoolSetpointLimit: 0,
      minHeatSetpointLimit: 0,
      minSetpointDeadBand: 10,
      occupiedCoolingSetpoint: 2500,
      occupiedHeatingSetpoint: 2100,
      systemMode: 1,
      thermostatRunningMode: 0,
      thermostatRunningState: {
        cool: false,
        coolStage2: false,
        fan: false,
        fanStage2: false,
        fanStage3: false,
        heat: false,
        heatStage2: false,
      },
    });
    expect(custom.getClusterServerOptions(ThermostatUserInterfaceConfiguration.Cluster.id)).toEqual({
      keypadLockout: 0,
      scheduleProgrammingVisibility: 0,
      temperatureDisplayMode: 0,
    });
    expect(custom.getClusterServerOptions(FanControl.Cluster.id)).toEqual({ fanMode: 0, fanModeSequence: 2, percentSetting: 40, percentCurrent: 0 });
    expect(await addDevice(server, custom)).toBeTruthy();
    expect(custom.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'powerSource',
      'onOff',
      'thermostat',
      'thermostatUserInterfaceConfiguration',
      'fanControl',
    ]);
  });

  test('add air conditioner to server', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'powerSource',
      'onOff',
      'thermostat',
      'thermostatUserInterfaceConfiguration',
      'fanControl',
    ]);
  });

  test('fan control attributes check', async () => {
    // Presence
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentSetting')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'percentCurrent')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanMode')).toBe(true);
    expect(device.hasAttributeServer(FanControl.Cluster, 'fanModeSequence')).toBe(true);
    // Default values from constructor (0,0)
    expect(device.getAttribute(FanControl.Cluster.id, 'percentSetting')).toBe(0);
    expect(device.getAttribute(FanControl.Cluster.id, 'percentCurrent')).toBe(0);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(device.getAttribute(FanControl.Cluster.id, 'fanModeSequence')).toBe(FanControl.FanModeSequence.OffLowMedHighAuto);
  });

  test('thermostat attributes check', async () => {
    // Presence
    expect(device.hasClusterServer(Thermostat.Cluster.id)).toBe(true);
    expect(device.hasClusterServer(Thermostat.Cluster.with(Thermostat.Feature.AutoMode, Thermostat.Feature.Cooling, Thermostat.Feature.Heating))).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'localTemperature')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'minSetpointDeadBand')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'minHeatSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'maxHeatSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'minCoolSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'maxCoolSetpointLimit')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'systemMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'thermostatRunningMode')).toBe(true);
    expect(device.hasAttributeServer(Thermostat.Cluster.id, 'thermostatRunningState')).toBe(true);
    // Default values (scaled by 100 for temperatures and 10 for minSetpointDeadBand)
    expect(device.getAttribute(Thermostat.Cluster.id, 'localTemperature')).toBe(2300);
    expect(device.getAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint')).toBe(2100);
    expect(device.getAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint')).toBe(2500);
    expect(device.getAttribute(Thermostat.Cluster.id, 'minSetpointDeadBand')).toBe(10);
    expect(device.getAttribute(Thermostat.Cluster.id, 'minHeatSetpointLimit')).toBe(0);
    expect(device.getAttribute(Thermostat.Cluster.id, 'maxHeatSetpointLimit')).toBe(5000);
    expect(device.getAttribute(Thermostat.Cluster.id, 'minCoolSetpointLimit')).toBe(0);
    expect(device.getAttribute(Thermostat.Cluster.id, 'maxCoolSetpointLimit')).toBe(5000);
    expect(device.getAttribute(Thermostat.Cluster.id, 'systemMode')).toBe(1);
    expect(device.getAttribute(Thermostat.Cluster.id, 'thermostatRunningMode')).toBe(0);
    expect(device.getAttribute(Thermostat.Cluster.id, 'thermostatRunningState')).toEqual({
      cool: false,
      coolStage2: false,
      fan: false,
      fanStage2: false,
      fanStage3: false,
      heat: false,
      heatStage2: false,
    });
  });

  test('thermostat UI configuration attributes check', async () => {
    // Presence
    expect(device.hasClusterServer(ThermostatUserInterfaceConfiguration.Cluster.id)).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'keypadLockout')).toBe(true);
    expect(device.hasAttributeServer(ThermostatUserInterfaceConfiguration.Cluster.id, 'scheduleProgrammingVisibility')).toBe(true);
    // Default values
    expect(device.getAttribute(ThermostatUserInterfaceConfiguration.Cluster.id, 'temperatureDisplayMode')).toBe(0);
    expect(device.getAttribute(ThermostatUserInterfaceConfiguration.Cluster.id, 'keypadLockout')).toBe(0);
    expect(device.getAttribute(ThermostatUserInterfaceConfiguration.Cluster.id, 'scheduleProgrammingVisibility')).toBe(0);
  });

  test('device forEachAttribute', async () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;

      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');
      expect(clusterName.length).toBeGreaterThanOrEqual(1);

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');
      expect(attributeName.length).toBeGreaterThanOrEqual(1);

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);

      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = Array.from(attributeValue as number[]).sort((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .sort(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 114, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 6, 29, 47, 513, 514, 516 ]',
        'fanControl(0x202).acceptedCommandList(0xfff9)=[ 0 ]',
        'fanControl(0x202).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'fanControl(0x202).clusterRevision(0xfffd)=5',
        'fanControl(0x202).fanMode(0x0)=0',
        'fanControl(0x202).fanModeSequence(0x1)=2',
        'fanControl(0x202).featureMap(0xfffc)={ multiSpeed: false, auto: true, rocking: false, wind: false, step: true, airflowDirection: false }',
        'fanControl(0x202).generatedCommandList(0xfff8)=[  ]',
        'fanControl(0x202).percentCurrent(0x3)=0',
        'fanControl(0x202).percentSetting(0x2)=0',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2 ]',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).clusterRevision(0xfffd)=6',
        'onOff(0x6).featureMap(0xfffc)={ lighting: false, deadFrontBehavior: true, offOnly: false }',
        'onOff(0x6).generatedCommandList(0xfff8)=[  ]',
        'onOff(0x6).onOff(0x0)=true',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 3 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'thermostat(0x201).absMaxCoolSetpointLimit(0x6)=5000',
        'thermostat(0x201).absMaxHeatSetpointLimit(0x4)=5000',
        'thermostat(0x201).absMinCoolSetpointLimit(0x5)=0',
        'thermostat(0x201).absMinHeatSetpointLimit(0x3)=0',
        'thermostat(0x201).acceptedCommandList(0xfff9)=[ 0 ]',
        'thermostat(0x201).attributeList(0xfffb)=[ 0, 3, 4, 5, 6, 17, 18, 21, 22, 23, 24, 25, 27, 28, 30, 41, 65528, 65529, 65531, 65532, 65533 ]',
        'thermostat(0x201).clusterRevision(0xfffd)=9',
        'thermostat(0x201).controlSequenceOfOperation(0x1b)=4',
        'thermostat(0x201).featureMap(0xfffc)={ heating: true, cooling: true, occupancy: false, scheduleConfiguration: false, setback: false, autoMode: true, localTemperatureNotExposed: false, matterScheduleConfiguration: false, presets: false }',
        'thermostat(0x201).generatedCommandList(0xfff8)=[  ]',
        'thermostat(0x201).localTemperature(0x0)=2300',
        'thermostat(0x201).maxCoolSetpointLimit(0x18)=5000',
        'thermostat(0x201).maxHeatSetpointLimit(0x16)=5000',
        'thermostat(0x201).minCoolSetpointLimit(0x17)=0',
        'thermostat(0x201).minHeatSetpointLimit(0x15)=0',
        'thermostat(0x201).minSetpointDeadBand(0x19)=10',
        'thermostat(0x201).occupiedCoolingSetpoint(0x11)=2500',
        'thermostat(0x201).occupiedHeatingSetpoint(0x12)=2100',
        'thermostat(0x201).systemMode(0x1c)=1',
        'thermostat(0x201).thermostatRunningMode(0x1e)=0',
        'thermostat(0x201).thermostatRunningState(0x29)={ heat: false, cool: false, fan: false, heatStage2: false, coolStage2: false, fanStage2: false, fanStage3: false }',
        'thermostatUserInterfaceConfiguration(0x204).acceptedCommandList(0xfff9)=[  ]',
        'thermostatUserInterfaceConfiguration(0x204).attributeList(0xfffb)=[ 0, 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'thermostatUserInterfaceConfiguration(0x204).clusterRevision(0xfffd)=2',
        'thermostatUserInterfaceConfiguration(0x204).featureMap(0xfffc)={  }',
        'thermostatUserInterfaceConfiguration(0x204).generatedCommandList(0xfff8)=[  ]',
        'thermostatUserInterfaceConfiguration(0x204).keypadLockout(0x1)=0',
        'thermostatUserInterfaceConfiguration(0x204).scheduleProgrammingVisibility(0x2)=0',
        'thermostatUserInterfaceConfiguration(0x204).temperatureDisplayMode(0x0)=0',
      ].sort(),
    );
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
