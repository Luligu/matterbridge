/**
 * @file packages/core/buntest/devices/irrigationSystem.test.ts
 * @description This file contains the tests for the IrrigationSystem device.
 * @author Luca Liguori
 */

const NAME = 'IrrigationSystem';
const MATTER_PORT = 8021;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';

import { CommonNumberTag } from '@matter/main';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
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
} from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel, stringify } from 'node-ansi-logger';

import { IrrigationSystem } from '../../src/devices/irrigationSystem.js';
import { irrigationSystem } from '../../src/matterbridgeDeviceTypes.js';
import { getSemtag, invokeSubscribeHandler } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: IrrigationSystem;
  let singleZoneBatteryDevice: IrrigationSystem;
  let autoOpenCloseDevice: IrrigationSystem;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
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
    await createServerNode(MATTER_PORT, irrigationSystem.code, 0, 0, 0);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an irrigation system device', () => {
    device = new IrrigationSystem('Irrigation System Test Device', 'IR123456', { flowMeasuredValue: 123, operationalState: OperationalState.OperationalStateEnum.Running })
      .addZone(getSemtag(CommonNumberTag.One))
      .addZone(getSemtag(CommonNumberTag.Two))
      .addZone(getSemtag(CommonNumberTag.Three))
      .addZone(getSemtag(CommonNumberTag.Four));
    expect(device).toBeDefined();
    expect(device.id).toBe('IrrigationSystemTestDevice-IR123456');
    expect(device.getChildEndpointByOriginalId('Zone 1')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 2')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 3')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 4')).toBeDefined();

    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.id)).toBeTruthy();
    expect(device.hasClusterServer(FlowMeasurement.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    // Default behavior: wired power source and NOT a single-zone valve endpoint
    expect(device.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'AC Power', wiredCurrentType: PowerSource.WiredCurrentType.Ac });
    expect(device.hasClusterServer(ValveConfigurationAndControl.id)).toBeFalsy();

    // Cover option paths
    expect(device.getClusterServerOptions(OperationalState.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Running });
    expect(device.getClusterServerOptions(FlowMeasurement.id)).toMatchObject({ measuredValue: 123 });

    // Cover default paths
    const defaultDevice = new IrrigationSystem('Irrigation System Default Device', 'IR000000');
    expect(defaultDevice.getClusterServerOptions(OperationalState.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Stopped });
    expect(defaultDevice.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'AC Power', wiredCurrentType: PowerSource.WiredCurrentType.Ac });
    expect(defaultDevice.hasClusterServer(ValveConfigurationAndControl.id)).toBeFalsy();
  });

  test('create a single zone battery irrigation system device', () => {
    singleZoneBatteryDevice = new IrrigationSystem('Irrigation System Single Zone', 'IRBAT001', { batteryPowered: true, flowMeasuredValue: 45 }).addZone(
      getSemtag(CommonNumberTag.One),
    );
    expect(singleZoneBatteryDevice).toBeDefined();
    expect(singleZoneBatteryDevice.id).toBe('IrrigationSystemSingleZone-IRBAT001');
    expect(singleZoneBatteryDevice.getChildEndpointByOriginalId('Zone 1')).toBeDefined();

    expect(singleZoneBatteryDevice.hasClusterServer(Identify.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(OperationalState.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(FlowMeasurement.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(ValveConfigurationAndControl.id)).toBeFalsy();
    expect(singleZoneBatteryDevice.getChildEndpointByOriginalId('Zone 1')?.hasClusterServer(ValveConfigurationAndControl.id)).toBeTruthy();

    expect(singleZoneBatteryDevice.getClusterServerOptions(FlowMeasurement.id)).toMatchObject({ measuredValue: 45 });
    expect(singleZoneBatteryDevice.getClusterServerOptions(PowerSource.id)).toMatchObject({
      description: 'Primary battery',
      batChargeLevel: PowerSource.BatChargeLevel.Ok,
    });
  });

  test('add an irrigation system device', async () => {
    expect(await addDevice(server, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getChildEndpointByOriginalId('Zone 1')?.getAttribute('Descriptor', 'tagList')).toEqual([
      { mfgCode: null, namespaceId: 7, tag: 1 },
      { mfgCode: null, namespaceId: 6, tag: 4 },
    ]);
  });

  test('add a single zone battery irrigation system device', async () => {
    expect(await addDevice(aggregator, singleZoneBatteryDevice, 0, 0, 0, 0)).toBeTruthy();
  });

  test('openAllZones opens all zone valves', async () => {
    await device.openAllZones();
    for (const tag of [1, 2, 3, 4]) {
      const zone = device.getChildEndpointByOriginalId(`Zone ${tag}`);
      expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Open);
      expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
    }
  });

  test('closeAllZones closes all zone valves', async () => {
    await device.closeAllZones();
    for (const tag of [1, 2, 3, 4]) {
      const zone = device.getChildEndpointByOriginalId(`Zone ${tag}`);
      expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
      expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'currentState')).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
    }
  });

  test('create and add an irrigation system device with autoOpenClose', async () => {
    autoOpenCloseDevice = new IrrigationSystem('Irrigation System AutoOpenClose', 'IRAOC001', { autoOpenClose: true }).addZone(getSemtag(CommonNumberTag.One));
    expect(autoOpenCloseDevice).toBeDefined();
    expect(await addDevice(aggregator, autoOpenCloseDevice, 0, 0, 0, 0)).toBeTruthy();
  });

  test('autoOpenClose opens all zones when operationalState changes to Running', async () => {
    await autoOpenCloseDevice.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Running);
    await invokeSubscribeHandler(
      autoOpenCloseDevice,
      OperationalState,
      'operationalState',
      OperationalState.OperationalStateEnum.Running,
      OperationalState.OperationalStateEnum.Stopped,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'IrrigationSystem operationalState changed to: Running');
    const zone = autoOpenCloseDevice.getChildEndpointByOriginalId('Zone 1');
    expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Open);
  });

  test('autoOpenClose closes all zones when operationalState changes to Paused', async () => {
    await autoOpenCloseDevice.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Paused);
    await invokeSubscribeHandler(
      autoOpenCloseDevice,
      OperationalState,
      'operationalState',
      OperationalState.OperationalStateEnum.Paused,
      OperationalState.OperationalStateEnum.Running,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'IrrigationSystem operationalState changed to: Paused');
    const zone = autoOpenCloseDevice.getChildEndpointByOriginalId('Zone 1');
    expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
  });

  test('autoOpenClose closes all zones when operationalState changes to Stopped', async () => {
    await autoOpenCloseDevice.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Running);
    await autoOpenCloseDevice.openAllZones();
    await autoOpenCloseDevice.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Stopped);
    await invokeSubscribeHandler(
      autoOpenCloseDevice,
      OperationalState,
      'operationalState',
      OperationalState.OperationalStateEnum.Stopped,
      OperationalState.OperationalStateEnum.Running,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'IrrigationSystem operationalState changed to: Stopped');
    const zone = autoOpenCloseDevice.getChildEndpointByOriginalId('Zone 1');
    expect(zone?.getAttribute(ValveConfigurationAndControl.id, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
  });

  test('autoOpenClose only logs when operationalState changes to Error', async () => {
    await autoOpenCloseDevice.setAttribute(OperationalState.id, 'operationalState', OperationalState.OperationalStateEnum.Error);
    await invokeSubscribeHandler(
      autoOpenCloseDevice,
      OperationalState,
      'operationalState',
      OperationalState.OperationalStateEnum.Error,
      OperationalState.OperationalStateEnum.Stopped,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'IrrigationSystem operationalState changed to: Error');
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
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 64, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5, 6 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 64, 96, 1028 ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'IrrigationSystem' } ]",
        'flowMeasurement(0x404).acceptedCommandList(0xfff9)=[  ]',
        'flowMeasurement(0x404).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'flowMeasurement(0x404).clusterRevision(0xfffd)=5',
        'flowMeasurement(0x404).featureMap(0xfffc)={  }',
        'flowMeasurement(0x404).generatedCommandList(0xfff8)=[  ]',
        'flowMeasurement(0x404).maxMeasuredValue(0x2)=null',
        'flowMeasurement(0x404).measuredValue(0x0)=123',
        'flowMeasurement(0x404).minMeasuredValue(0x1)=null',
        'flowMeasurement(0x404).tolerance(0x3)=0',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
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
        'powerSource(0x2f).endpointList(0x1f)=[ 2, 3, 4, 5, 6 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].toSorted(),
    );
  });

  test('Zone1 child forEachAttribute', () => {
    const child = device.getChildEndpointById('Zone1');
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 66, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 129 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 1, label: undefined }, { mfgCode: null, namespaceId: 6, tag: 4, label: undefined } ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'valveConfigurationAndControl(0x81).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'valveConfigurationAndControl(0x81).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 65528, 65529, 65531, 65532, 65533 ]',
        'valveConfigurationAndControl(0x81).clusterRevision(0xfffd)=1',
        'valveConfigurationAndControl(0x81).currentLevel(0x6)=0',
        'valveConfigurationAndControl(0x81).currentState(0x4)=2',
        'valveConfigurationAndControl(0x81).defaultOpenDuration(0x1)=null',
        'valveConfigurationAndControl(0x81).defaultOpenLevel(0x8)=100',
        'valveConfigurationAndControl(0x81).featureMap(0xfffc)={ timeSync: false, level: true }',
        'valveConfigurationAndControl(0x81).generatedCommandList(0xfff8)=[  ]',
        'valveConfigurationAndControl(0x81).levelStep(0xa)=1',
        'valveConfigurationAndControl(0x81).openDuration(0x0)=null',
        'valveConfigurationAndControl(0x81).remainingDuration(0x3)=null',
        'valveConfigurationAndControl(0x81).targetLevel(0x7)=0',
        'valveConfigurationAndControl(0x81).targetState(0x5)=0',
        'valveConfigurationAndControl(0x81).valveFault(0x9)={ generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false }',
      ].toSorted(),
    );
  });

  test('Zone2 child forEachAttribute', () => {
    const child = device.getChildEndpointById('Zone2');
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 66, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 129 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 2, label: undefined }, { mfgCode: null, namespaceId: 6, tag: 4, label: undefined } ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'valveConfigurationAndControl(0x81).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'valveConfigurationAndControl(0x81).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 65528, 65529, 65531, 65532, 65533 ]',
        'valveConfigurationAndControl(0x81).clusterRevision(0xfffd)=1',
        'valveConfigurationAndControl(0x81).currentLevel(0x6)=0',
        'valveConfigurationAndControl(0x81).currentState(0x4)=2',
        'valveConfigurationAndControl(0x81).defaultOpenDuration(0x1)=null',
        'valveConfigurationAndControl(0x81).defaultOpenLevel(0x8)=100',
        'valveConfigurationAndControl(0x81).featureMap(0xfffc)={ timeSync: false, level: true }',
        'valveConfigurationAndControl(0x81).generatedCommandList(0xfff8)=[  ]',
        'valveConfigurationAndControl(0x81).levelStep(0xa)=1',
        'valveConfigurationAndControl(0x81).openDuration(0x0)=null',
        'valveConfigurationAndControl(0x81).remainingDuration(0x3)=null',
        'valveConfigurationAndControl(0x81).targetLevel(0x7)=0',
        'valveConfigurationAndControl(0x81).targetState(0x5)=0',
        'valveConfigurationAndControl(0x81).valveFault(0x9)={ generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false }',
      ].toSorted(),
    );
  });

  test('Zone3 child forEachAttribute', () => {
    const child = device.getChildEndpointById('Zone3');
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 66, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 129 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 3, label: undefined }, { mfgCode: null, namespaceId: 6, tag: 4, label: undefined } ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'valveConfigurationAndControl(0x81).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'valveConfigurationAndControl(0x81).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 65528, 65529, 65531, 65532, 65533 ]',
        'valveConfigurationAndControl(0x81).clusterRevision(0xfffd)=1',
        'valveConfigurationAndControl(0x81).currentLevel(0x6)=0',
        'valveConfigurationAndControl(0x81).currentState(0x4)=2',
        'valveConfigurationAndControl(0x81).defaultOpenDuration(0x1)=null',
        'valveConfigurationAndControl(0x81).defaultOpenLevel(0x8)=100',
        'valveConfigurationAndControl(0x81).featureMap(0xfffc)={ timeSync: false, level: true }',
        'valveConfigurationAndControl(0x81).generatedCommandList(0xfff8)=[  ]',
        'valveConfigurationAndControl(0x81).levelStep(0xa)=1',
        'valveConfigurationAndControl(0x81).openDuration(0x0)=null',
        'valveConfigurationAndControl(0x81).remainingDuration(0x3)=null',
        'valveConfigurationAndControl(0x81).targetLevel(0x7)=0',
        'valveConfigurationAndControl(0x81).targetState(0x5)=0',
        'valveConfigurationAndControl(0x81).valveFault(0x9)={ generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false }',
      ].toSorted(),
    );
  });

  test('Zone4 child forEachAttribute', () => {
    const child = device.getChildEndpointById('Zone4');
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 66, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 129 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 4, label: undefined }, { mfgCode: null, namespaceId: 6, tag: 4, label: undefined } ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'valveConfigurationAndControl(0x81).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'valveConfigurationAndControl(0x81).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 65528, 65529, 65531, 65532, 65533 ]',
        'valveConfigurationAndControl(0x81).clusterRevision(0xfffd)=1',
        'valveConfigurationAndControl(0x81).currentLevel(0x6)=0',
        'valveConfigurationAndControl(0x81).currentState(0x4)=2',
        'valveConfigurationAndControl(0x81).defaultOpenDuration(0x1)=null',
        'valveConfigurationAndControl(0x81).defaultOpenLevel(0x8)=100',
        'valveConfigurationAndControl(0x81).featureMap(0xfffc)={ timeSync: false, level: true }',
        'valveConfigurationAndControl(0x81).generatedCommandList(0xfff8)=[  ]',
        'valveConfigurationAndControl(0x81).levelStep(0xa)=1',
        'valveConfigurationAndControl(0x81).openDuration(0x0)=null',
        'valveConfigurationAndControl(0x81).remainingDuration(0x3)=null',
        'valveConfigurationAndControl(0x81).targetLevel(0x7)=0',
        'valveConfigurationAndControl(0x81).targetState(0x5)=0',
        'valveConfigurationAndControl(0x81).valveFault(0x9)={ generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false }',
      ].toSorted(),
    );
  });

  test('single zone battery device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    singleZoneBatteryDevice.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'bridgedDeviceBasicInformation(0x39).acceptedCommandList(0xfff9)=[  ]',
        'bridgedDeviceBasicInformation(0x39).attributeList(0xfffb)=[ 1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 14, 15, 17, 18, 24, 65528, 65529, 65531, 65532, 65533 ]',
        'bridgedDeviceBasicInformation(0x39).clusterRevision(0xfffd)=6',
        'bridgedDeviceBasicInformation(0x39).configurationVersion(0x18)=1',
        'bridgedDeviceBasicInformation(0x39).featureMap(0xfffc)={ bridgedIcdSupport: false }',
        'bridgedDeviceBasicInformation(0x39).generatedCommandList(0xfff8)=[  ]',
        'bridgedDeviceBasicInformation(0x39).hardwareVersion(0x7)=1',
        "bridgedDeviceBasicInformation(0x39).hardwareVersionString(0x8)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).nodeLabel(0x5)='Irrigation System Single Zone'",
        'bridgedDeviceBasicInformation(0x39).productId(0x4)=32768',
        "bridgedDeviceBasicInformation(0x39).productLabel(0xe)='Matter Bridged Endpoint'",
        "bridgedDeviceBasicInformation(0x39).productName(0x3)='Matterbridge Irrigation System'",
        "bridgedDeviceBasicInformation(0x39).productUrl(0xd)='https://matterbridge.io'",
        'bridgedDeviceBasicInformation(0x39).reachable(0x11)=true',
        "bridgedDeviceBasicInformation(0x39).serialNumber(0xf)='IRBAT001'",
        'bridgedDeviceBasicInformation(0x39).softwareVersion(0x9)=1',
        "bridgedDeviceBasicInformation(0x39).softwareVersionString(0xa)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).uniqueId(0x12)='214c884f968f6c56477cf9f76c4a0100'",
        'bridgedDeviceBasicInformation(0x39).vendorId(0x2)=65521',
        "bridgedDeviceBasicInformation(0x39).vendorName(0x1)='Matterbridge'",
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 64, revision: 1 }, { deviceType: 17, revision: 1 }, { deviceType: 19, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 8 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 57, 64, 96, 1028 ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'IrrigationSystem' } ]",
        'flowMeasurement(0x404).acceptedCommandList(0xfff9)=[  ]',
        'flowMeasurement(0x404).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'flowMeasurement(0x404).clusterRevision(0xfffd)=5',
        'flowMeasurement(0x404).featureMap(0xfffc)={  }',
        'flowMeasurement(0x404).generatedCommandList(0xfff8)=[  ]',
        'flowMeasurement(0x404).maxMeasuredValue(0x2)=null',
        'flowMeasurement(0x404).measuredValue(0x0)=45',
        'flowMeasurement(0x404).minMeasuredValue(0x1)=null',
        'flowMeasurement(0x404).tolerance(0x3)=0',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
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
        'powerSource(0x2f).activeBatFaults(0x12)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 11, 12, 14, 15, 16, 18, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).batChargeLevel(0xe)=0',
        'powerSource(0x2f).batPercentRemaining(0xc)=200',
        'powerSource(0x2f).batReplaceability(0x10)=0',
        'powerSource(0x2f).batReplacementNeeded(0xf)=false',
        'powerSource(0x2f).batVoltage(0xb)=1500',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='Primary battery'",
        'powerSource(0x2f).endpointList(0x1f)=[ 7, 8 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: false, battery: true, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
      ].toSorted(),
    );
  });

  test('single zone battery device Zone1 child forEachAttribute', () => {
    const child = singleZoneBatteryDevice.getChildEndpointById('Zone1');
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 66, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: true }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 129 ]',
        'descriptor(0x1d).tagList(0x4)=[ { mfgCode: null, namespaceId: 7, tag: 1, label: undefined }, { mfgCode: null, namespaceId: 6, tag: 4, label: undefined } ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'valveConfigurationAndControl(0x81).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'valveConfigurationAndControl(0x81).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 65528, 65529, 65531, 65532, 65533 ]',
        'valveConfigurationAndControl(0x81).clusterRevision(0xfffd)=1',
        'valveConfigurationAndControl(0x81).currentLevel(0x6)=0',
        'valveConfigurationAndControl(0x81).currentState(0x4)=0',
        'valveConfigurationAndControl(0x81).defaultOpenDuration(0x1)=null',
        'valveConfigurationAndControl(0x81).defaultOpenLevel(0x8)=100',
        'valveConfigurationAndControl(0x81).featureMap(0xfffc)={ timeSync: false, level: true }',
        'valveConfigurationAndControl(0x81).generatedCommandList(0xfff8)=[  ]',
        'valveConfigurationAndControl(0x81).levelStep(0xa)=1',
        'valveConfigurationAndControl(0x81).openDuration(0x0)=null',
        'valveConfigurationAndControl(0x81).remainingDuration(0x3)=null',
        'valveConfigurationAndControl(0x81).targetLevel(0x7)=0',
        'valveConfigurationAndControl(0x81).targetState(0x5)=0',
        'valveConfigurationAndControl(0x81).valveFault(0x9)={ generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false }',
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
    if (MATTER_CREATE_ONLY) await flushServerNode(0, 0, 0, 0);
    else await stopServerNode();
  });
});
