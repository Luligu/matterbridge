/* eslint-disable jest/no-standalone-expect */
// src/microwaveOven.test.ts

const MATTER_PORT = 8010;
const NAME = 'MicrowaveOven';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { MicrowaveOvenControlServer, MicrowaveOvenModeServer } from '@matter/node/behaviors';
import { Identify, MicrowaveOvenControl, MicrowaveOvenMode, OnOff, OperationalState, PowerSource } from '@matter/types/clusters';
import { LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import {
  addDevice,
  aggregator,
  createTestEnvironment,
  destroyTestEnvironment,
  flushAsync,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerLogSpy,
  loggerWarnSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestHelpers.js';
import { microwaveOven } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeMicrowaveOvenControlServer, MicrowaveOven } from './microwaveOven.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
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
    await startServerNode(NAME, MATTER_PORT, microwaveOven.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    await server.construction.ready;
    await aggregator.construction.ready;
  }, 10000);

  test('create a microwave oven device', async () => {
    device = new MicrowaveOven('Microwave Oven Test Device', 'MW123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('MicrowaveOvenTestDevice-MW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.hasClusterServer(MicrowaveOvenMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(MicrowaveOvenControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'operationalState', 'microwaveOvenMode', 'microwaveOvenControl']);
  });

  test('add a microwave oven device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
    await device.construction.ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer initialized`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 121, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 94, 95, 96 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'microwaveOvenControl(0x5f).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'microwaveOvenControl(0x5f).attributeList(0xfffb)=[ 0, 1, 6, 7, 65528, 65529, 65531, 65532, 65533 ]',
        'microwaveOvenControl(0x5f).clusterRevision(0xfffd)=1',
        'microwaveOvenControl(0x5f).cookTime(0x0)=60',
        'microwaveOvenControl(0x5f).featureMap(0xfffc)={ powerAsNumber: false, powerInWatts: true, powerNumberLimits: false }',
        'microwaveOvenControl(0x5f).generatedCommandList(0xfff8)=[  ]',
        'microwaveOvenControl(0x5f).maxCookTime(0x1)=3600',
        'microwaveOvenControl(0x5f).selectedWattIndex(0x7)=5',
        'microwaveOvenControl(0x5f).supportedWatts(0x6)=[ 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 ]',
        'microwaveOvenMode(0x5e).acceptedCommandList(0xfff9)=[  ]',
        'microwaveOvenMode(0x5e).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'microwaveOvenMode(0x5e).clusterRevision(0xfffd)=2',
        'microwaveOvenMode(0x5e).currentMode(0x1)=1',
        'microwaveOvenMode(0x5e).featureMap(0xfffc)={ onOff: false }',
        'microwaveOvenMode(0x5e).generatedCommandList(0xfff8)=[  ]',
        "microwaveOvenMode(0x5e).supportedModes(0x0)=[ { label: 'Auto', mode: 1, modeTags: [ { mfgCode: undefined, value: 0 } ] }, { label: 'Quick', mode: 2, modeTags: [ { mfgCode: undefined, value: 1 } ] }, { label: 'Quiet', mode: 3, modeTags: [ { mfgCode: undefined, value: 2 } ] }, { label: 'Min', mode: 4, modeTags: [ { mfgCode: undefined, value: 6 } ] }, { label: 'Max', mode: 5, modeTags: [ { mfgCode: undefined, value: 7 } ] }, { label: 'Normal', mode: 6, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Defrost', mode: 7, modeTags: [ { mfgCode: undefined, value: 16385 } ] } ]",
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
      ].sort(),
    );
  });

  test('invoke MatterbridgeMicrowaveOvenControlServer commands', async () => {
    expect(device.behaviors.has(MicrowaveOvenControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeMicrowaveOvenControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(MicrowaveOvenModeServer).commands.has('changeToMode')).toBeFalsy();
    expect((device as any).state['microwaveOvenControl'].acceptedCommandList).toEqual([0, 1]);
    expect((device as any).state['microwaveOvenControl'].generatedCommandList).toEqual([]); // No response

    // Default cookTime from constructor is 60; adding 1 should log setting cookTime to 61
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'addMoreTime', { timeToAdd: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: addMoreTime called setting cookTime to 61`);

    // Adding -1 should log invalid cookTime
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'addMoreTime', { timeToAdd: -1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeMicrowaveOvenControlServer: addMoreTime called with invalid cookTime -1`);

    // Test setCookingParameters command - all unspecified -> defaults
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`,
    );

    // Test setCookingParameters - valid cookMode only
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { cookMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`,
    );

    // Test setCookingParameters - no cookMode provided but valid cookTime and wattSettingIndex
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { cookTime: 120, wattSettingIndex: 3 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 120`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 3`);

    // Test setCookingParameters - invalid cookTime (<0) -> default to 30sec
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { cookMode: 7, cookTime: -5, wattSettingIndex: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 7`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 0`);

    // Test setCookingParameters - cookTime > maxCookTime -> default to 30sec
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { cookTime: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`,
    );

    // Test setCookingParameters - invalid wattSettingIndex (out of range) -> default to highest supported index
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { cookMode: 3, cookTime: 45, wattSettingIndex: 100 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 3`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 45`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`,
    );

    // Test setCookingParameters - all valid values
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { cookMode: 4, cookTime: 90, wattSettingIndex: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 4`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 90`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 2`);

    // Test setCookingParameters - startAfterSetting false (no change expected)
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { startAfterSetting: false });
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
    expect((device as any).state['operationalState'].operationalState).toBe(OperationalState.OperationalStateEnum.Stopped);

    // Test setCookingParameters - startAfterSetting true (transition to Running)
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('microwaveOvenControl', 'setCookingParameters', { startAfterSetting: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
    expect((device as any).state['operationalState'].operationalState).toBe(OperationalState.OperationalStateEnum.Running);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
