// src/irrigationSystem.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'IrrigationSystem';
const MATTER_PORT = 8021;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { NumberTag } from '@matter/main';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { stringify } from 'node-ansi-logger';

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
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { irrigationSystem } from '../matterbridgeDeviceTypes.js';
import { getSemtag } from '../matterbridgeEndpointHelpers.js';
import { IrrigationSystem } from './irrigationSystem.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: IrrigationSystem;
  let singleZoneBatteryDevice: IrrigationSystem;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(async () => {
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
    await createServerNode(MATTER_PORT, irrigationSystem.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an irrigation system device', async () => {
    device = new IrrigationSystem('Irrigation System Test Device', 'IR123456', { flowMeasuredValue: 123, operationalState: OperationalState.OperationalStateEnum.Running })
      .addZone(getSemtag(NumberTag.One))
      .addZone(getSemtag(NumberTag.Two))
      .addZone(getSemtag(NumberTag.Three))
      .addZone(getSemtag(NumberTag.Four));
    expect(device).toBeDefined();
    expect(device.id).toBe('IrrigationSystemTestDevice-IR123456');
    expect(device.getChildEndpointByOriginalId('Zone 1')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 2')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 3')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 4')).toBeDefined();

    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(FlowMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();

    // Default behavior: wired power source and NOT a single-zone valve endpoint
    expect(device.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({ description: 'AC Power', wiredCurrentType: PowerSource.WiredCurrentType.Ac });
    expect(device.hasClusterServer(ValveConfigurationAndControl.Cluster.id)).toBeFalsy();

    // Cover option paths
    expect(device.getClusterServerOptions(OperationalState.Cluster.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Running });
    expect(device.getClusterServerOptions(FlowMeasurement.Cluster.id)).toMatchObject({ measuredValue: 123 });

    // Cover default paths
    const defaultDevice = new IrrigationSystem('Irrigation System Default Device', 'IR000000');
    expect(defaultDevice.getClusterServerOptions(OperationalState.Cluster.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Stopped });
    expect(defaultDevice.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({ description: 'AC Power', wiredCurrentType: PowerSource.WiredCurrentType.Ac });
    expect(defaultDevice.hasClusterServer(ValveConfigurationAndControl.Cluster.id)).toBeFalsy();
  });

  test('create a single zone battery irrigation system device', async () => {
    singleZoneBatteryDevice = new IrrigationSystem('Irrigation System Single Zone', 'IRBAT001', { singleZone: true, batteryPowered: true, flowMeasuredValue: 45 });
    expect(singleZoneBatteryDevice).toBeDefined();
    expect(singleZoneBatteryDevice.id).toBe('IrrigationSystemSingleZone-IRBAT001');

    expect(singleZoneBatteryDevice.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(FlowMeasurement.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(ValveConfigurationAndControl.Cluster.id)).toBeTruthy();

    expect(singleZoneBatteryDevice.getClusterServerOptions(FlowMeasurement.Cluster.id)).toMatchObject({ measuredValue: 45 });
    expect(singleZoneBatteryDevice.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({
      description: 'Primary battery',
      batChargeLevel: PowerSource.BatChargeLevel.Ok,
    });
  });

  test('add an irrigation system device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
    expect(device.getChildEndpointByOriginalId('Zone 1')?.getAttribute('Descriptor', 'tagList')).toEqual([
      { mfgCode: null, namespaceId: 7, tag: 1 },
      { mfgCode: null, namespaceId: 6, tag: 4 },
    ]);
  });

  test('add a single zone battery irrigation system device', async () => {
    expect(await addDevice(server, singleZoneBatteryDevice)).toBeTruthy();
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 64, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 3, 4, 5, 6 ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 96, 1028 ]',
        'flowMeasurement(0x404).acceptedCommandList(0xfff9)=[  ]',
        'flowMeasurement(0x404).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'flowMeasurement(0x404).clusterRevision(0xfffd)=3',
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

  test('single zone battery device forEachAttribute', async () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    singleZoneBatteryDevice.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 64, revision: 1 }, { deviceType: 66, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 96, 129, 1028 ]',
        'flowMeasurement(0x404).acceptedCommandList(0xfff9)=[  ]',
        'flowMeasurement(0x404).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'flowMeasurement(0x404).clusterRevision(0xfffd)=3',
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
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 11, 12, 14, 15, 16, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).batChargeLevel(0xe)=0',
        'powerSource(0x2f).batPercentRemaining(0xc)=null',
        'powerSource(0x2f).batReplaceability(0x10)=0',
        'powerSource(0x2f).batReplacementNeeded(0xf)=false',
        'powerSource(0x2f).batVoltage(0xb)=null',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='Primary battery'",
        'powerSource(0x2f).endpointList(0x1f)=[ 7 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: false, battery: true, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
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
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
