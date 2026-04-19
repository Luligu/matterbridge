/* eslint-disable jest/no-standalone-expect */
// src/refrigerator.test.ts

const MATTER_PORT = 8012;
const NAME = 'Refrigerator';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { PositionTag, RefrigeratorTag } from '@matter/node';
import { RefrigeratorAndTemperatureControlledCabinetModeServer } from '@matter/node/behaviors';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { RefrigeratorAlarm } from '@matter/types/clusters/refrigerator-alarm';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/types/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import {
  addDevice,
  aggregator,
  createTestEnvironment,
  destroyTestEnvironment,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerLogSpy,
  loggerWarnSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestHelpers.js';
import { refrigerator } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer, Refrigerator } from './refrigerator.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Refrigerator;
  let cabinet1: MatterbridgeEndpoint;
  let cabinet2: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
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
    await destroyTestEnvironment(MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, refrigerator.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a refrigerator device', async () => {
    device = new Refrigerator('Refrigerator Test Device', 'RF123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('RefrigeratorTestDevice-RF123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'powerSource',
      'fixedLabel',
      'refrigeratorAndTemperatureControlledCabinetMode',
      'refrigeratorAlarm',
    ]);
    expect(device.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RefrigeratorAlarm.Cluster.id)).toBeTruthy();

    cabinet1 = device.addCabinet('Refrigerator Test Cabinet Top', [
      { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
      { mfgCode: null, namespaceId: RefrigeratorTag.Refrigerator.namespaceId, tag: RefrigeratorTag.Refrigerator.tag, label: RefrigeratorTag.Refrigerator.label },
    ]);
    expect(cabinet1).toBeDefined();
    expect(cabinet1.id).toBe('RefrigeratorTestCabinetTop');
    expect(cabinet1.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeFalsy();
    expect(cabinet1.hasClusterServer(RefrigeratorAlarm.Cluster.id)).toBeFalsy();
    expect(cabinet1.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'temperatureControl', 'temperatureMeasurement']);

    cabinet2 = device.addCabinet(
      'Freezer Test Cabinet Bottom',
      [
        { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label },
        { mfgCode: null, namespaceId: RefrigeratorTag.Freezer.namespaceId, tag: RefrigeratorTag.Freezer.tag, label: RefrigeratorTag.Freezer.label },
      ],
      -20 * 100,
      -30 * 100,
      10 * 100,
      10 * 100,
    );
    expect(cabinet2).toBeDefined();
    expect(cabinet2.id).toBe('FreezerTestCabinetBottom');
    expect(cabinet2.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeFalsy();
    expect(cabinet2.hasClusterServer(RefrigeratorAlarm.Cluster.id)).toBeFalsy();
    expect(cabinet2.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'temperatureControl', 'temperatureMeasurement']);
  });

  test('add a refrigerator device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer initialized`);
  });

  test('cabinet1 open door', async () => {
    expect(await device.setDoorOpenState(true)).toBeDefined();
    expect(device.getAttribute('RefrigeratorAlarm', 'state')).toEqual({ doorOpen: true });
  });

  test('cabinet1 trigger alert on open door', async () => {
    expect(await device.triggerDoorOpenState(true)).toBeDefined();
  });

  test('cabinet1 trigger alert on close door', async () => {
    expect(await device.triggerDoorOpenState(false)).toBeDefined();
  });

  test('cabinet2 open door', async () => {
    expect(await device.setDoorOpenState(true)).toBeDefined();
    expect(device.getAttribute('RefrigeratorAlarm', 'state')).toEqual({ doorOpen: true });
  });

  test('cabinet2 trigger alert on open door', async () => {
    expect(await device.triggerDoorOpenState(true)).toBeDefined();
  });

  test('cabinet2 trigger alert on close door', async () => {
    expect(await device.triggerDoorOpenState(false)).toBeDefined();
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 112, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 64, 82, 87 ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'Refrigerator' } ]",
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
        'refrigeratorAlarm(0x57).acceptedCommandList(0xfff9)=[  ]',
        'refrigeratorAlarm(0x57).attributeList(0xfffb)=[ 0, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'refrigeratorAlarm(0x57).clusterRevision(0xfffd)=1',
        'refrigeratorAlarm(0x57).featureMap(0xfffc)={ reset: false }',
        'refrigeratorAlarm(0x57).generatedCommandList(0xfff8)=[  ]',
        'refrigeratorAlarm(0x57).mask(0x0)={ doorOpen: true }',
        'refrigeratorAlarm(0x57).state(0x2)={ doorOpen: true }',
        'refrigeratorAlarm(0x57).supported(0x3)={ doorOpen: true }',
        'refrigeratorAndTemperatureControlledCabinetMode(0x52).acceptedCommandList(0xfff9)=[ 0 ]',
        'refrigeratorAndTemperatureControlledCabinetMode(0x52).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'refrigeratorAndTemperatureControlledCabinetMode(0x52).clusterRevision(0xfffd)=3',
        'refrigeratorAndTemperatureControlledCabinetMode(0x52).currentMode(0x1)=1',
        'refrigeratorAndTemperatureControlledCabinetMode(0x52).featureMap(0xfffc)={ onOff: false }',
        'refrigeratorAndTemperatureControlledCabinetMode(0x52).generatedCommandList(0xfff8)=[ 1 ]',
        "refrigeratorAndTemperatureControlledCabinetMode(0x52).supportedModes(0x0)=[ { label: 'Auto', mode: 1, modeTags: [ { mfgCode: undefined, value: 0 } ] }, { label: 'RapidCool', mode: 2, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'RapidFreeze', mode: 3, modeTags: [ { mfgCode: undefined, value: 16385 } ] } ]",
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
        'descriptor(0x1d).serverList(0x1)=[ 29, 86, 1026 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 8, tag: 2, label: 'Top' }, { mfgCode: null, namespaceId: 65, tag: 0, label: 'Refrigerator' } ]",
        'temperatureControl(0x56).acceptedCommandList(0xfff9)=[ 0 ]',
        'temperatureControl(0x56).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureControl(0x56).clusterRevision(0xfffd)=1',
        'temperatureControl(0x56).featureMap(0xfffc)={ temperatureNumber: true, temperatureLevel: false, temperatureStep: true }',
        'temperatureControl(0x56).generatedCommandList(0xfff8)=[  ]',
        'temperatureControl(0x56).maxTemperature(0x2)=2000',
        'temperatureControl(0x56).minTemperature(0x1)=-3000',
        'temperatureControl(0x56).step(0x3)=100',
        'temperatureControl(0x56).temperatureSetpoint(0x0)=1000',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=4',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=1000',
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
        'descriptor(0x1d).serverList(0x1)=[ 29, 86, 1026 ]',
        "descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 8, tag: 3, label: 'Bottom' }, { mfgCode: null, namespaceId: 65, tag: 1, label: 'Freezer' } ]",
        'temperatureControl(0x56).acceptedCommandList(0xfff9)=[ 0 ]',
        'temperatureControl(0x56).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureControl(0x56).clusterRevision(0xfffd)=1',
        'temperatureControl(0x56).featureMap(0xfffc)={ temperatureNumber: true, temperatureLevel: false, temperatureStep: true }',
        'temperatureControl(0x56).generatedCommandList(0xfff8)=[  ]',
        'temperatureControl(0x56).maxTemperature(0x2)=1000',
        'temperatureControl(0x56).minTemperature(0x1)=-3000',
        'temperatureControl(0x56).step(0x3)=1000',
        'temperatureControl(0x56).temperatureSetpoint(0x0)=-2000',
        'temperatureMeasurement(0x402).acceptedCommandList(0xfff9)=[  ]',
        'temperatureMeasurement(0x402).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureMeasurement(0x402).clusterRevision(0xfffd)=4',
        'temperatureMeasurement(0x402).featureMap(0xfffc)={  }',
        'temperatureMeasurement(0x402).generatedCommandList(0xfff8)=[  ]',
        'temperatureMeasurement(0x402).maxMeasuredValue(0x2)=null',
        'temperatureMeasurement(0x402).measuredValue(0x0)=1000',
        'temperatureMeasurement(0x402).minMeasuredValue(0x1)=null',
        'temperatureMeasurement(0x402).tolerance(0x3)=0',
      ].sort(),
    );
  });

  test('createDefaultRefrigeratorAlarmClusterServer normalizes different parameters', () => {
    const requireSpy = jest.spyOn(device.behaviors as any, 'require').mockImplementation(() => undefined);

    expect(device.createDefaultRefrigeratorAlarmClusterServer(device)).toBe(device);
    expect(requireSpy).toHaveBeenNthCalledWith(1, expect.any(Function), {
      mask: { doorOpen: true },
      supported: { doorOpen: true },
      state: { doorOpen: false },
    });

    expect(device.createDefaultRefrigeratorAlarmClusterServer(device, true)).toBe(device);
    expect(requireSpy).toHaveBeenNthCalledWith(2, expect.any(Function), {
      mask: { doorOpen: true },
      supported: { doorOpen: true },
      state: { doorOpen: true },
    });

    requireSpy.mockRestore();
  });

  test('invoke MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer commands', async () => {
    expect(device.behaviors.has(RefrigeratorAndTemperatureControlledCabinetModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RefrigeratorAndTemperatureControlledCabinetModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['refrigeratorAndTemperatureControlledCabinetMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['refrigeratorAndTemperatureControlledCabinetMode'].generatedCommandList).toEqual([1]);

    // Change to mode 2
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('refrigeratorAndTemperatureControlledCabinetMode', 'changeToMode', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestDevice-RF123456.2) called with mode 2 = RapidCool`,
    );

    // Change to mode 15
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('refrigeratorAndTemperatureControlledCabinetMode', 'changeToMode', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestDevice-RF123456.2) called with invalid mode 15`,
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestDevice-RF123456.2) called with invalid mode 15`,
    );
    loggerErrorSpy.mockClear();
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
