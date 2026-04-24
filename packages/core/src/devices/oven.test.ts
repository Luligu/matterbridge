// src/oven.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'Oven';
const MATTER_PORT = 8011;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
// @matter
import { PositionTag } from '@matter/node';
import { OvenCavityOperationalStateServer, OvenModeServer } from '@matter/node/behaviors';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { OvenCavityOperationalState } from '@matter/types/clusters/oven-cavity-operational-state';
import { OvenMode } from '@matter/types/clusters/oven-mode';
import { PowerSource } from '@matter/types/clusters/power-source';
import { LogLevel, stringify } from 'node-ansi-logger';

// Jest utilities for Matter testing
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
} from '../jestutils/jestMatterTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { oven } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeOvenCavityOperationalStateServer, MatterbridgeOvenModeServer, Oven } from './oven.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Oven;
  let cabinet1: MatterbridgeEndpoint;
  let cabinet2: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, oven.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a oven device', async () => {
    device = new Oven('Oven Test Device', 'OV123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('OvenTestDevice-OV123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'fixedLabel']);

    cabinet1 = device.addCabinet('Oven Test Cabinet Top', [{ mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label }]);
    expect(cabinet1).toBeDefined();
    expect(cabinet1.id).toBe('OvenTestCabinetTop');
    expect(cabinet1.hasClusterServer(OvenMode.Cluster.id)).toBeTruthy();
    expect(cabinet1.hasClusterServer(OvenCavityOperationalState.Cluster.id)).toBeTruthy();
    expect(cabinet1.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'temperatureControl', 'temperatureMeasurement', 'ovenMode', 'ovenCavityOperationalState']);

    cabinet2 = device.addCabinet(
      'Oven Test Cabinet Bottom',
      [{ mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label }],
      3,
      [
        { label: 'Convection', mode: 1, modeTags: [{ value: OvenMode.ModeTag.Convection }] },
        { label: 'Clean', mode: 2, modeTags: [{ value: OvenMode.ModeTag.Clean }] },
        { label: 'Steam', mode: 3, modeTags: [{ value: OvenMode.ModeTag.Steam }] },
      ],
      180 * 100,
      180 * 100,
      300 * 100,
      10 * 100,
      20 * 100,
      OperationalState.OperationalStateEnum.Running,
      1,
      ['pre-heating', 'pre-heated', 'cooling down'],
    );
    expect(cabinet2).toBeDefined();
    expect(cabinet2.id).toBe('OvenTestCabinetBottom');
    expect(cabinet2.hasClusterServer(OvenMode.Cluster.id)).toBeTruthy();
    expect(cabinet2.hasClusterServer(OvenCavityOperationalState.Cluster.id)).toBeTruthy();
    expect(cabinet2.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'temperatureControl', 'temperatureMeasurement', 'ovenMode', 'ovenCavityOperationalState']);
  });

  test('add a oven device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenModeServer initialized`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeOvenCavityOperationalStateServer initialized: setting operational state to Stopped and operational error to No error`,
    );
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 123, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 64 ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'Oven' } ]",
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
        'powerSource(0x2f).endpointList(0x1f)=[ 2, 3, 4 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].sort(),
    );
  });

  test('cabinet1 forEachAttribute', async () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    cabinet1.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 113, revision: 5 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 72, 73, 86, 1026 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 8, tag: 2, label: 'Top' } ]",
        'ovenCavityOperationalState(0x48).acceptedCommandList(0xfff9)=[ 1, 2 ]',
        'ovenCavityOperationalState(0x48).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'ovenCavityOperationalState(0x48).clusterRevision(0xfffd)=2',
        'ovenCavityOperationalState(0x48).currentPhase(0x1)=null',
        'ovenCavityOperationalState(0x48).featureMap(0xfffc)={  }',
        'ovenCavityOperationalState(0x48).generatedCommandList(0xfff8)=[ 4 ]',
        "ovenCavityOperationalState(0x48).operationalError(0x5)={ errorStateId: 0, errorStateLabel: undefined, errorStateDetails: 'Fully operational' }",
        'ovenCavityOperationalState(0x48).operationalState(0x4)=0',
        'ovenCavityOperationalState(0x48).operationalStateList(0x3)=[ { operationalStateId: 0, operationalStateLabel: undefined }, { operationalStateId: 1, operationalStateLabel: undefined }, { operationalStateId: 3, operationalStateLabel: undefined } ]',
        'ovenCavityOperationalState(0x48).phaseList(0x0)=null',
        'ovenMode(0x49).acceptedCommandList(0xfff9)=[ 0 ]',
        'ovenMode(0x49).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'ovenMode(0x49).clusterRevision(0xfffd)=2',
        'ovenMode(0x49).currentMode(0x1)=2',
        'ovenMode(0x49).featureMap(0xfffc)={ onOff: false }',
        'ovenMode(0x49).generatedCommandList(0xfff8)=[ 1 ]',
        "ovenMode(0x49).supportedModes(0x0)=[ { label: 'Bake', mode: 1, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Convection', mode: 2, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Grill', mode: 3, modeTags: [ { mfgCode: undefined, value: 16386 } ] }, { label: 'Roast', mode: 4, modeTags: [ { mfgCode: undefined, value: 16387 } ] }, { label: 'Clean', mode: 5, modeTags: [ { mfgCode: undefined, value: 16388 } ] }, { label: 'Convection Bake', mode: 6, modeTags: [ { mfgCode: undefined, value: 16389 } ] }, { label: 'Convection Roast', mode: 7, modeTags: [ { mfgCode: undefined, value: 16390 } ] }, { label: 'Warming', mode: 8, modeTags: [ { mfgCode: undefined, value: 16391 } ] }, { label: 'Proofing', mode: 9, modeTags: [ { mfgCode: undefined, value: 16392 } ] }, { label: 'Steam', mode: 10, modeTags: [ { mfgCode: undefined, value: 16393 } ] } ]",
        'temperatureControl(0x56).acceptedCommandList(0xfff9)=[ 0 ]',
        'temperatureControl(0x56).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureControl(0x56).clusterRevision(0xfffd)=1',
        'temperatureControl(0x56).featureMap(0xfffc)={ temperatureNumber: true, temperatureLevel: false, temperatureStep: true }',
        'temperatureControl(0x56).generatedCommandList(0xfff8)=[  ]',
        'temperatureControl(0x56).maxTemperature(0x2)=30000',
        'temperatureControl(0x56).minTemperature(0x1)=3000',
        'temperatureControl(0x56).step(0x3)=1000',
        'temperatureControl(0x56).temperatureSetpoint(0x0)=18000',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=4',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=2000',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].sort(),
    );
  });

  test('cabinet2 forEachAttribute', async () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    cabinet2.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 113, revision: 5 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 72, 73, 86, 1026 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 8, tag: 3, label: 'Bottom' } ]",
        'ovenCavityOperationalState(0x48).acceptedCommandList(0xfff9)=[ 1, 2 ]',
        'ovenCavityOperationalState(0x48).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'ovenCavityOperationalState(0x48).clusterRevision(0xfffd)=2',
        'ovenCavityOperationalState(0x48).currentPhase(0x1)=1',
        'ovenCavityOperationalState(0x48).featureMap(0xfffc)={  }',
        'ovenCavityOperationalState(0x48).generatedCommandList(0xfff8)=[ 4 ]',
        "ovenCavityOperationalState(0x48).operationalError(0x5)={ errorStateId: 0, errorStateLabel: undefined, errorStateDetails: 'Fully operational' }",
        'ovenCavityOperationalState(0x48).operationalState(0x4)=0',
        'ovenCavityOperationalState(0x48).operationalStateList(0x3)=[ { operationalStateId: 0, operationalStateLabel: undefined }, { operationalStateId: 1, operationalStateLabel: undefined }, { operationalStateId: 3, operationalStateLabel: undefined } ]',
        "ovenCavityOperationalState(0x48).phaseList(0x0)=[ 'pre-heating', 'pre-heated', 'cooling down' ]",
        'ovenMode(0x49).acceptedCommandList(0xfff9)=[ 0 ]',
        'ovenMode(0x49).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'ovenMode(0x49).clusterRevision(0xfffd)=2',
        'ovenMode(0x49).currentMode(0x1)=3',
        'ovenMode(0x49).featureMap(0xfffc)={ onOff: false }',
        'ovenMode(0x49).generatedCommandList(0xfff8)=[ 1 ]',
        "ovenMode(0x49).supportedModes(0x0)=[ { label: 'Convection', mode: 1, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Clean', mode: 2, modeTags: [ { mfgCode: undefined, value: 16388 } ] }, { label: 'Steam', mode: 3, modeTags: [ { mfgCode: undefined, value: 16393 } ] } ]",
        'temperatureControl(0x56).acceptedCommandList(0xfff9)=[ 0 ]',
        'temperatureControl(0x56).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureControl(0x56).clusterRevision(0xfffd)=1',
        'temperatureControl(0x56).featureMap(0xfffc)={ temperatureNumber: true, temperatureLevel: false, temperatureStep: true }',
        'temperatureControl(0x56).generatedCommandList(0xfff8)=[  ]',
        'temperatureControl(0x56).maxTemperature(0x2)=30000',
        'temperatureControl(0x56).minTemperature(0x1)=18000',
        'temperatureControl(0x56).step(0x3)=1000',
        'temperatureControl(0x56).temperatureSetpoint(0x0)=18000',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=4',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=2000',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].sort(),
    );
  });

  test('createDefaultOvenCavityOperationalStateClusterServer normalizes different parameters', () => {
    const requireSpy = jest.spyOn(cabinet1.behaviors as any, 'require').mockImplementation(() => undefined);

    expect(device.createDefaultOvenCavityOperationalStateClusterServer(cabinet1)).toBe(cabinet1);
    expect(requireSpy).toHaveBeenNthCalledWith(1, MatterbridgeOvenCavityOperationalStateServer, {
      phaseList: null,
      currentPhase: null,
      operationalStateList: [
        { operationalStateId: OperationalState.OperationalStateEnum.Stopped },
        { operationalStateId: OperationalState.OperationalStateEnum.Running },
        { operationalStateId: OperationalState.OperationalStateEnum.Error },
      ],
      operationalState: OperationalState.OperationalStateEnum.Stopped,
      operationalError: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    });

    expect(
      device.createDefaultOvenCavityOperationalStateClusterServer(cabinet1, OperationalState.OperationalStateEnum.Running, 1, ['pre-heating', 'pre-heated', 'cooling down']),
    ).toBe(cabinet1);
    expect(requireSpy).toHaveBeenNthCalledWith(2, MatterbridgeOvenCavityOperationalStateServer, {
      phaseList: ['pre-heating', 'pre-heated', 'cooling down'],
      currentPhase: 1,
      operationalStateList: [
        { operationalStateId: OperationalState.OperationalStateEnum.Stopped },
        { operationalStateId: OperationalState.OperationalStateEnum.Running },
        { operationalStateId: OperationalState.OperationalStateEnum.Error },
      ],
      operationalState: OperationalState.OperationalStateEnum.Running,
      operationalError: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    });

    requireSpy.mockRestore();
  });

  test('invoke MatterbridgeOvenModeServer commands', async () => {
    expect(cabinet1.behaviors.has(OvenModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.has(MatterbridgeOvenModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((cabinet1 as any).state['ovenMode'].acceptedCommandList).toEqual([0]);
    expect((cabinet1 as any).state['ovenMode'].generatedCommandList).toEqual([1]);

    // Change to mode 2
    jest.clearAllMocks();
    await cabinet1.invokeBehaviorCommand('ovenMode', 'changeToMode', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenModeServer: changeToMode (endpoint OvenTestCabinetTop.3) called with mode 2 = Convection`);

    // Change to mode 15
    jest.clearAllMocks();
    await cabinet1.invokeBehaviorCommand('ovenMode', 'changeToMode', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeOvenModeServer: changeToMode (endpoint OvenTestCabinetTop.3) called with invalid mode 15`);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`MatterbridgeOvenModeServer: changeToMode (endpoint OvenTestCabinetTop.3) called with invalid mode 15`);
    loggerErrorSpy.mockClear();
  });

  test('invoke MatterbridgeOvenCavityOperationalStateServer commands', async () => {
    expect(cabinet1.behaviors.has(OvenCavityOperationalStateServer)).toBeTruthy();
    expect(cabinet1.behaviors.has(MatterbridgeOvenCavityOperationalStateServer)).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('stop')).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('start')).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('pause')).toBeFalsy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('resume')).toBeFalsy();
    expect((cabinet1 as any).state['ovenCavityOperationalState'].acceptedCommandList).toEqual([1, 2]);
    expect((cabinet1 as any).state['ovenCavityOperationalState'].generatedCommandList).toEqual([4]);

    // Change to mode 2
    jest.clearAllMocks();
    await cabinet1.invokeBehaviorCommand('ovenCavityOperationalState', 'start', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeOvenCavityOperationalStateServer: start (endpoint OvenTestCabinetTop.3) called setting operational state to Running and operational error to No error`,
    );

    // Change to mode 15
    jest.clearAllMocks();
    await cabinet1.invokeBehaviorCommand('ovenCavityOperationalState', 'stop', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeOvenCavityOperationalStateServer: stop (endpoint OvenTestCabinetTop.3) called setting operational state to Stopped and operational error to No error`,
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
