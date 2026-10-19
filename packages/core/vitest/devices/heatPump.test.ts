/**
 * @file packages/core/vitest/devices/heatPump.test.ts
 * @description This file contains the tests for the HeatPump device.
 * @author Luca Liguori
 */

const NAME = 'HeatPump';
const MATTER_PORT = 8007;
const MATTER_CREATE_ONLY = true;

import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { EndpointNumber } from '@matter/types/datatype';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

import { HeatPump } from '../../src/devices/heatPump.js';
import { heatPump } from '../../src/matterbridgeDeviceTypes.js';
import type { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

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
    await createServerNode(MATTER_PORT, heatPump.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a heat pump device', () => {
    device = new HeatPump('Heat Pump Test Device', 'HP123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('HeatPumpTestDevice-HP123456');
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurement.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalPowerMeasurement.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagement.id)).toBeTruthy();
  });

  test('create a heat pump with explicit endpoint and measurement options', () => {
    const tagList = [{ mfgCode: null, namespaceId: 1, tag: 1, label: 'One' }];
    const optionsDevice = new HeatPump('Heat Pump', 'HP-OPTIONS', {
      id: 'HeatPumpOptions',
      number: EndpointNumber(14_05),
      tagList,
      voltage: 230_000,
      current: 15_000,
      power: 3_450_000,
      energyImported: 8_000,
      absMinPower: 1_000,
      absMaxPower: 4_000_000,
    });
    expect(optionsDevice.id).toBe('HeatPumpOptions');
    expect(optionsDevice.number).toBe(EndpointNumber(14_05));
    expect(optionsDevice.tagList).toEqual(tagList);
  });

  test('create a heat pump with an empty options object', () => {
    expect(new HeatPump('Heat Pump Defaults', 'HP-DEFAULTS', {})).toBeDefined();
  });

  test('add a heat pump device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
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
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 777, revision: 1 }, { deviceType: 17, revision: 1 }, { deviceType: 1296, revision: 1 }, { deviceType: 1293, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5, 6 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 144, 145, 152, 156, 159 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 15, tag: 1, label: undefined } ]',
        'deviceEnergyManagement(0x98).absMaxPower(0x4)=0',
        'deviceEnergyManagement(0x98).absMinPower(0x3)=0',
        'deviceEnergyManagement(0x98).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'deviceEnergyManagement(0x98).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 6, 7, 65528, 65529, 65531, 65532, 65533 ]',
        'deviceEnergyManagement(0x98).clusterRevision(0xfffd)=4',
        'deviceEnergyManagement(0x98).esaCanGenerate(0x1)=false',
        'deviceEnergyManagement(0x98).esaState(0x2)=1',
        'deviceEnergyManagement(0x98).esaType(0x0)=1',
        'deviceEnergyManagement(0x98).featureMap(0xfffc)={ powerAdjustment: true, powerForecastReporting: true, stateForecastReporting: false, startTimeAdjustment: false, pausable: false, forecastAdjustment: false, constraintBasedAdjustment: false }',
        'deviceEnergyManagement(0x98).forecast(0x6)=null',
        'deviceEnergyManagement(0x98).generatedCommandList(0xfff8)=[  ]',
        'deviceEnergyManagement(0x98).optOutState(0x7)=0',
        'deviceEnergyManagement(0x98).powerAdjustmentCapability(0x5)=null',
        'deviceEnergyManagementMode(0x9f).acceptedCommandList(0xfff9)=[ 0 ]',
        'deviceEnergyManagementMode(0x9f).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'deviceEnergyManagementMode(0x9f).clusterRevision(0xfffd)=2',
        'deviceEnergyManagementMode(0x9f).currentMode(0x1)=1',
        'deviceEnergyManagementMode(0x9f).featureMap(0xfffc)={ onOff: false }',
        'deviceEnergyManagementMode(0x9f).generatedCommandList(0xfff8)=[ 1 ]',
        "deviceEnergyManagementMode(0x9f).supportedModes(0x0)=[ { label: 'No Energy Management (Forecast reporting only)', mode: 1, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Device Energy Management', mode: 2, modeTags: [ { mfgCode: undefined, value: 16385 }, { mfgCode: undefined, value: 16386 } ] }, { label: 'Home Energy Management', mode: 3, modeTags: [ { mfgCode: undefined, value: 16387 }, { mfgCode: undefined, value: 16386 } ] }, { label: 'Grid Energy Management', mode: 4, modeTags: [ { mfgCode: undefined, value: 16387 } ] }, { label: 'Full Energy Management', mode: 5, modeTags: [ { mfgCode: undefined, value: 16385 }, { mfgCode: undefined, value: 16386 }, { mfgCode: undefined, value: 16387 } ] } ]",
        'electricalEnergyMeasurement(0x91).acceptedCommandList(0xfff9)=[  ]',
        'electricalEnergyMeasurement(0x91).accuracy(0x0)={ measurementType: 14, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }',
        'electricalEnergyMeasurement(0x91).attributeList(0xfffb)=[ 0, 1, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalEnergyMeasurement(0x91).clusterRevision(0xfffd)=2',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyImported(0x1)=null',
        'electricalEnergyMeasurement(0x91).cumulativeEnergyReset(0x5)=null',
        'electricalEnergyMeasurement(0x91).featureMap(0xfffc)={ importedEnergy: true, exportedEnergy: false, cumulativeEnergy: true, periodicEnergy: false, apparentEnergy: false, reactiveEnergy: false }',
        'electricalEnergyMeasurement(0x91).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).acceptedCommandList(0xfff9)=[  ]',
        'electricalPowerMeasurement(0x90).accuracy(0x2)=[ { measurementType: 1, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 2, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 5, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }, { measurementType: 11, measured: true, minMeasuredValue: -9007199254740991, maxMeasuredValue: 9007199254740991, accuracyRanges: [ { rangeMin: -9007199254740991, rangeMax: 9007199254740991, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] } ]',
        'electricalPowerMeasurement(0x90).activeCurrent(0x5)=null',
        'electricalPowerMeasurement(0x90).activePower(0x8)=null',
        'electricalPowerMeasurement(0x90).attributeList(0xfffb)=[ 0, 1, 2, 4, 5, 8, 14, 65528, 65529, 65531, 65532, 65533 ]',
        'electricalPowerMeasurement(0x90).clusterRevision(0xfffd)=3',
        'electricalPowerMeasurement(0x90).featureMap(0xfffc)={ directCurrent: false, alternatingCurrent: true, polyphasePower: false, harmonics: false, powerQuality: false }',
        'electricalPowerMeasurement(0x90).frequency(0xe)=null',
        'electricalPowerMeasurement(0x90).generatedCommandList(0xfff8)=[  ]',
        'electricalPowerMeasurement(0x90).numberOfMeasurementTypes(0x1)=4',
        'electricalPowerMeasurement(0x90).powerMode(0x0)=2',
        'electricalPowerMeasurement(0x90).voltage(0x4)=null',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2, 3, 4, 5, 6 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'powerTopology(0x9c).acceptedCommandList(0xfff9)=[  ]',
        'powerTopology(0x9c).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'powerTopology(0x9c).clusterRevision(0xfffd)=1',
        'powerTopology(0x9c).featureMap(0xfffc)={ nodeTopology: false, treeTopology: true, setTopology: false, dynamicPowerFlow: false }',
        'powerTopology(0x9c).generatedCommandList(0xfff8)=[  ]',
      ].toSorted(),
    );
  });

  test('FlowTemperature child forEachAttribute', () => {
    const child = device.getChildEndpointById('FlowTemperature');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
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
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 770, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 1026 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 1, label: 'FlowTemperature' } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=6',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=4500',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].toSorted(),
    );
  });

  test('ReturnTemperature child forEachAttribute', () => {
    const child = device.getChildEndpointById('ReturnTemperature');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
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
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 770, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 1026 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 2, label: 'ReturnTemperature' } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=6',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=3500',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].toSorted(),
    );
  });

  test('LivingThermostat child forEachAttribute', () => {
    const child = device.getChildEndpointById('LivingThermostat');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
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
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 769, revision: 6 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 65, 513 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 1, label: 'LivingThermostat' }, { mfgCode: null, namespaceId: 16, tag: 52, label: undefined } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'thermostat(0x201).absMaxCoolSetpointLimit(0x6)=5000',
        'thermostat(0x201).absMaxHeatSetpointLimit(0x4)=5000',
        'thermostat(0x201).absMinCoolSetpointLimit(0x5)=0',
        'thermostat(0x201).absMinHeatSetpointLimit(0x3)=0',
        'thermostat(0x201).acceptedCommandList(0xfff9)=[ 0 ]',
        'thermostat(0x201).attributeList(0xfffb)=[ 0, 3, 4, 5, 6, 17, 18, 21, 22, 23, 24, 25, 27, 28, 30, 41, 65528, 65529, 65531, 65532, 65533 ]',
        'thermostat(0x201).clusterRevision(0xfffd)=11',
        'thermostat(0x201).controlSequenceOfOperation(0x1b)=4',
        'thermostat(0x201).featureMap(0xfffc)={ heating: true, cooling: true, occupancy: false, setback: false, autoMode: true, localTemperatureNotExposed: false, matterScheduleConfiguration: false, presets: false, events: false, thermostatSuggestions: false }',
        'thermostat(0x201).generatedCommandList(0xfff8)=[  ]',
        'thermostat(0x201).localTemperature(0x0)=2300',
        'thermostat(0x201).maxCoolSetpointLimit(0x18)=5000',
        'thermostat(0x201).maxHeatSetpointLimit(0x16)=5000',
        'thermostat(0x201).minCoolSetpointLimit(0x17)=0',
        'thermostat(0x201).minHeatSetpointLimit(0x15)=0',
        'thermostat(0x201).minSetpointDeadBand(0x19)=0',
        'thermostat(0x201).occupiedCoolingSetpoint(0x11)=2500',
        'thermostat(0x201).occupiedHeatingSetpoint(0x12)=2100',
        'thermostat(0x201).systemMode(0x1c)=1',
        'thermostat(0x201).thermostatRunningMode(0x1e)=0',
        'thermostat(0x201).thermostatRunningState(0x29)={ heat: false, cool: false, fan: false, heatStage2: false, coolStage2: false, fanStage2: false, fanStage3: false }',
        'userLabel(0x41).acceptedCommandList(0xfff9)=[  ]',
        'userLabel(0x41).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'userLabel(0x41).clusterRevision(0xfffd)=1',
        'userLabel(0x41).featureMap(0xfffc)={  }',
        'userLabel(0x41).generatedCommandList(0xfff8)=[  ]',
        "userLabel(0x41).labelList(0x0)=[ { label: 'room', value: 'Living Room' } ]",
      ].toSorted(),
    );
  });

  test('BedroomThermostat child forEachAttribute', () => {
    const child = device.getChildEndpointById('BedroomThermostat');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
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
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 769, revision: 6 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 65, 513 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 2, label: 'BedroomThermostat' }, { mfgCode: null, namespaceId: 16, tag: 7, label: undefined } ]",
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'thermostat(0x201).absMaxCoolSetpointLimit(0x6)=5000',
        'thermostat(0x201).absMaxHeatSetpointLimit(0x4)=5000',
        'thermostat(0x201).absMinCoolSetpointLimit(0x5)=0',
        'thermostat(0x201).absMinHeatSetpointLimit(0x3)=0',
        'thermostat(0x201).acceptedCommandList(0xfff9)=[ 0 ]',
        'thermostat(0x201).attributeList(0xfffb)=[ 0, 3, 4, 5, 6, 17, 18, 21, 22, 23, 24, 25, 27, 28, 30, 41, 65528, 65529, 65531, 65532, 65533 ]',
        'thermostat(0x201).clusterRevision(0xfffd)=11',
        'thermostat(0x201).controlSequenceOfOperation(0x1b)=4',
        'thermostat(0x201).featureMap(0xfffc)={ heating: true, cooling: true, occupancy: false, setback: false, autoMode: true, localTemperatureNotExposed: false, matterScheduleConfiguration: false, presets: false, events: false, thermostatSuggestions: false }',
        'thermostat(0x201).generatedCommandList(0xfff8)=[  ]',
        'thermostat(0x201).localTemperature(0x0)=2300',
        'thermostat(0x201).maxCoolSetpointLimit(0x18)=5000',
        'thermostat(0x201).maxHeatSetpointLimit(0x16)=5000',
        'thermostat(0x201).minCoolSetpointLimit(0x17)=0',
        'thermostat(0x201).minHeatSetpointLimit(0x15)=0',
        'thermostat(0x201).minSetpointDeadBand(0x19)=0',
        'thermostat(0x201).occupiedCoolingSetpoint(0x11)=2500',
        'thermostat(0x201).occupiedHeatingSetpoint(0x12)=2100',
        'thermostat(0x201).systemMode(0x1c)=1',
        'thermostat(0x201).thermostatRunningMode(0x1e)=0',
        'thermostat(0x201).thermostatRunningState(0x29)={ heat: false, cool: false, fan: false, heatStage2: false, coolStage2: false, fanStage2: false, fanStage3: false }',
        'userLabel(0x41).acceptedCommandList(0xfff9)=[  ]',
        'userLabel(0x41).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'userLabel(0x41).clusterRevision(0xfffd)=1',
        'userLabel(0x41).featureMap(0xfffc)={  }',
        'userLabel(0x41).generatedCommandList(0xfff8)=[  ]',
        "userLabel(0x41).labelList(0x0)=[ { label: 'room', value: 'Bedroom' } ]",
      ].toSorted(),
    );
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
