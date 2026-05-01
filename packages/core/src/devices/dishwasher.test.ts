// src/dishwasher.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'Dishwasher';
const MATTER_PORT = 8004;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
// @matter
import { DishwasherModeServer, TemperatureControlServer } from '@matter/node/behaviors';
import { DishwasherAlarm } from '@matter/types/clusters/dishwasher-alarm';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { LogLevel, stringify } from 'node-ansi-logger';

// Jest utilities for Matter testing
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestMatterTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { dishwasher } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { Dishwasher, MatterbridgeDishwasherModeServer } from './dishwasher.js';
import { MatterbridgeNumberTemperatureControlServer } from './temperatureControl.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

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
    await createServerNode(MATTER_PORT, dishwasher.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a dishwasher device', async () => {
    device = new Dishwasher('Dishwasher Test Device', 'DW123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('DishwasherTestDevice-DW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherAlarm.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
  });

  test('add a dishwasher device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
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
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 117, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 6, 29, 47, 86, 89, 93, 96 ]',
        'dishwasherAlarm(0x5d).acceptedCommandList(0xfff9)=[  ]',
        'dishwasherAlarm(0x5d).attributeList(0xfffb)=[ 0, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'dishwasherAlarm(0x5d).clusterRevision(0xfffd)=1',
        'dishwasherAlarm(0x5d).featureMap(0xfffc)={ reset: false }',
        'dishwasherAlarm(0x5d).generatedCommandList(0xfff8)=[  ]',
        'dishwasherAlarm(0x5d).mask(0x0)={ inflowError: true, drainError: true, doorError: true, tempTooLow: true, tempTooHigh: true, waterLevelError: true }',
        'dishwasherAlarm(0x5d).state(0x2)={ inflowError: false, drainError: false, doorError: false, tempTooLow: false, tempTooHigh: false, waterLevelError: false }',
        'dishwasherAlarm(0x5d).supported(0x3)={ inflowError: true, drainError: true, doorError: true, tempTooLow: true, tempTooHigh: true, waterLevelError: true }',
        'dishwasherMode(0x59).acceptedCommandList(0xfff9)=[ 0 ]',
        'dishwasherMode(0x59).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'dishwasherMode(0x59).clusterRevision(0xfffd)=3',
        'dishwasherMode(0x59).currentMode(0x1)=2',
        'dishwasherMode(0x59).featureMap(0xfffc)={ onOff: false }',
        'dishwasherMode(0x59).generatedCommandList(0xfff8)=[ 1 ]',
        "dishwasherMode(0x59).supportedModes(0x0)=[ { label: 'Light', mode: 1, modeTags: [ { mfgCode: undefined, value: 16386 } ] }, { label: 'Normal', mode: 2, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Heavy', mode: 3, modeTags: [ { mfgCode: undefined, value: 16385 } ] } ]",
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
        'operationalState(0x60).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3 ]',
        'operationalState(0x60).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'operationalState(0x60).clusterRevision(0xfffd)=3',
        'operationalState(0x60).countdownTime(0x2)=null',
        'operationalState(0x60).currentPhase(0x1)=null',
        'operationalState(0x60).featureMap(0xfffc)={  }',
        'operationalState(0x60).generatedCommandList(0xfff8)=[ 4 ]',
        "operationalState(0x60).operationalError(0x5)={ errorStateId: 0, errorStateLabel: undefined, errorStateDetails: 'Fully operational' }",
        'operationalState(0x60).operationalState(0x4)=0',
        'operationalState(0x60).operationalStateList(0x3)=[ { operationalStateId: 0, operationalStateLabel: undefined }, { operationalStateId: 1, operationalStateLabel: undefined }, { operationalStateId: 2, operationalStateLabel: undefined }, { operationalStateId: 3, operationalStateLabel: undefined } ]',
        'operationalState(0x60).phaseList(0x0)=[  ]',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'temperatureControl(0x56).acceptedCommandList(0xfff9)=[ 0 ]',
        'temperatureControl(0x56).attributeList(0xfffb)=[ 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'temperatureControl(0x56).clusterRevision(0xfffd)=1',
        'temperatureControl(0x56).featureMap(0xfffc)={ temperatureNumber: false, temperatureLevel: true, temperatureStep: false }',
        'temperatureControl(0x56).generatedCommandList(0xfff8)=[  ]',
        'temperatureControl(0x56).selectedTemperatureLevel(0x4)=1',
        "temperatureControl(0x56).supportedTemperatureLevels(0x5)=[ 'Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°' ]",
      ].toSorted(),
    );
  });

  test('invoke MatterbridgeDishwasherModeServer commands', async () => {
    expect(device.behaviors.has(DishwasherModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeDishwasherModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(DishwasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeDishwasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['dishwasherMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['dishwasherMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('onOff', 'off', {}); // Dead Front state
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('dishwasherMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `DishwasherModeServer: changeToMode called with invalid mode 0`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('dishwasherMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `ChangeToMode (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `DishwasherModeServer: changeToMode called with mode 1 => Light`);
  });

  test('remove the laundry washer device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
  });

  test('create a dishwasher device with number temperature control', async () => {
    device = new Dishwasher('Dishwasher Test Device', 'DW123456', undefined, undefined, undefined, undefined, 5500, 3000, 9000, 1000);
    expect(device).toBeDefined();
    expect(device.id).toBe('DishwasherTestDevice-DW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherAlarm.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
  });

  test('add a dishwasher device with number temperature control', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    expect(await addDevice(server, device)).toBeTruthy();
    expect(server.parts.has('DishwasherTestDevice-DW123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeDishwasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeNumberTemperatureControlServer initialized with temperatureSetpoint 5500 minTemperature 3000 maxTemperature 9000 step 1000`,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
  });

  test('invoke MatterbridgeNumberTemperatureControlServer commands', async () => {
    expect(device.behaviors.has(TemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeNumberTemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(TemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeNumberTemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect((device as any).state['temperatureControl'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['temperatureControl'].generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('temperatureControl', 'TemperatureControl.setTemperature', { targetTemperature: 3 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeNumberTemperatureControlServer: setTemperature called with invalid targetTemperature 3`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('temperatureControl', 'TemperatureControl.setTemperature', { targetTemperature: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to 5000`);
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
