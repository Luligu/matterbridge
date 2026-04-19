/* eslint-disable jest/no-standalone-expect */
// src\laundryDryer.test.ts

const MATTER_PORT = 8008;
const NAME = 'LaundryDryer';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

// Import necessary modules and types
import path from 'node:path';

import { jest } from '@jest/globals';
import { LaundryWasherModeServer, TemperatureControlServer } from '@matter/node/behaviors';
// @matter
import { Identify } from '@matter/types/clusters/identify';
import { LaundryDryerControls } from '@matter/types/clusters/laundry-dryer-controls';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import {
  addDevice,
  aggregator,
  createTestEnvironment,
  deleteDevice,
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
import { laundryDryer } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { LaundryDryer } from './laundryDryer.js';
import { MatterbridgeLaundryWasherModeServer } from './laundryWasher.js';
import { MatterbridgeLevelTemperatureControlServer, MatterbridgeNumberTemperatureControlServer } from './temperatureControl.js';

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
    await startServerNode(NAME, MATTER_PORT, laundryDryer.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a laundry dryer device', async () => {
    device = new LaundryDryer('Laundry Dryer Test Device', 'LD123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('LaundryDryerTestDevice-LD123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryDryerControls.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
  });

  test('add a laundry dryer device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `MatterbridgeLevelTemperatureControlServer initialized with selectedTemperatureLevel 1 and supportedTemperatureLevels: Cold, Warm, Hot, 30°, 40°, 60°, 80°`,
    );
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 124, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 6, 29, 47, 74, 81, 86, 96 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'laundryDryerControls(0x4a).acceptedCommandList(0xfff9)=[  ]',
        'laundryDryerControls(0x4a).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'laundryDryerControls(0x4a).clusterRevision(0xfffd)=1',
        'laundryDryerControls(0x4a).featureMap(0xfffc)={  }',
        'laundryDryerControls(0x4a).generatedCommandList(0xfff8)=[  ]',
        'laundryDryerControls(0x4a).selectedDrynessLevel(0x1)=1',
        'laundryDryerControls(0x4a).supportedDrynessLevels(0x0)=[ 0, 1, 2, 3 ]',
        'laundryWasherMode(0x51).acceptedCommandList(0xfff9)=[ 0 ]',
        'laundryWasherMode(0x51).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'laundryWasherMode(0x51).clusterRevision(0xfffd)=3',
        'laundryWasherMode(0x51).currentMode(0x1)=2',
        'laundryWasherMode(0x51).featureMap(0xfffc)={ onOff: false }',
        'laundryWasherMode(0x51).generatedCommandList(0xfff8)=[ 1 ]',
        "laundryWasherMode(0x51).supportedModes(0x0)=[ { label: 'Delicate', mode: 1, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Normal', mode: 2, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Heavy', mode: 3, modeTags: [ { mfgCode: undefined, value: 16386 } ] }, { label: 'Whites', mode: 4, modeTags: [ { mfgCode: undefined, value: 16387 } ] } ]",
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
      ].sort(),
    );
  });

  test('invoke MatterbridgeLaundryWasherModeServer commands', async () => {
    expect(device.behaviors.has(LaundryWasherModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeLaundryWasherModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(LaundryWasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeLaundryWasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['laundryWasherMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['laundryWasherMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('onOff', 'off', {}); // Dead Front state
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('laundryWasherMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeLaundryWasherModeServer: changeToMode called with invalid mode 0`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('laundryWasherMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `ChangeToMode (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeLaundryWasherModeServer: changeToMode called with mode 1 => Delicate`);
  });

  test('invoke MatterbridgeLevelTemperatureControlServer commands', async () => {
    expect(device.behaviors.has(TemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeLevelTemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(TemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeLevelTemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect((device as any).state['temperatureControl'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['temperatureControl'].generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('temperatureControl', 'TemperatureControl.setTemperature', { targetTemperatureLevel: 100 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeLevelTemperatureControlServer: setTemperature called with invalid targetTemperatureLevel 100`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('temperatureControl', 'TemperatureControl.setTemperature', { targetTemperatureLevel: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeLevelTemperatureControlServer: setTemperature called setting selectedTemperatureLevel to 2: Hot`);
  });

  test('remove the laundry washer device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
  });

  test('create a laundry dryer device with number temperature control', async () => {
    device = new LaundryDryer('Laundry Dryer Test Device', 'LD123456', undefined, undefined, undefined, undefined, 5500, 3000, 9000, 1000);
    expect(device).toBeDefined();
    expect(device.id).toBe('LaundryDryerTestDevice-LD123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryDryerControls.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
  });

  test('add a laundry dryer device with number temperature control', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer initialized: currentMode is 2`);
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

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
