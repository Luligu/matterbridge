// src/devices/extractorHood.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'ExtractorHood';
const MATTER_PORT = 8006;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { ActivatedCarbonFilterMonitoringServer } from '@matter/node/behaviors/activated-carbon-filter-monitoring';
import { HepaFilterMonitoringServer } from '@matter/node/behaviors/hepa-filter-monitoring';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { FanControl } from '@matter/types/clusters/fan-control';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
// @matter
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { wait } from '@matterbridge/utils';
import { LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeActivatedCarbonFilterMonitoringServer } from '../behaviors/activatedCarbonFilterMonitoringServer.js';
import { MatterbridgeHepaFilterMonitoringServer } from '../behaviors/hepaFilterMonitoringServer.js';
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
import { extractorHood } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeSubscribeHandler } from '../matterbridgeEndpointHelpers.js';
import { ExtractorHood } from './extractorHood.js';

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
    await createServerNode(MATTER_PORT, extractorHood.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an extractor hood device', async () => {
    device = new ExtractorHood('Extractor Hood Test Device', 'EH123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ExtractorHoodTestDevice-EH123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(FanControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(HepaFilterMonitoring.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ActivatedCarbonFilterMonitoring.Cluster.id)).toBeTruthy();
  });

  test('add an extractor hood device', async () => {
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
        'activatedCarbonFilterMonitoring(0x72).acceptedCommandList(0xfff9)=[ 0 ]',
        'activatedCarbonFilterMonitoring(0x72).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'activatedCarbonFilterMonitoring(0x72).changeIndication(0x2)=0',
        'activatedCarbonFilterMonitoring(0x72).clusterRevision(0xfffd)=1',
        'activatedCarbonFilterMonitoring(0x72).condition(0x0)=100',
        'activatedCarbonFilterMonitoring(0x72).degradationDirection(0x1)=1',
        'activatedCarbonFilterMonitoring(0x72).featureMap(0xfffc)={ condition: true, warning: true, replacementProductList: true }',
        'activatedCarbonFilterMonitoring(0x72).generatedCommandList(0xfff8)=[  ]',
        'activatedCarbonFilterMonitoring(0x72).inPlaceIndicator(0x3)=true',
        'activatedCarbonFilterMonitoring(0x72).lastChangedTime(0x4)=null',
        'activatedCarbonFilterMonitoring(0x72).replacementProductList(0x5)=[  ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 122, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 113, 114, 514 ]',
        'fanControl(0x202).acceptedCommandList(0xfff9)=[  ]',
        'fanControl(0x202).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'fanControl(0x202).clusterRevision(0xfffd)=5',
        'fanControl(0x202).fanMode(0x0)=0',
        'fanControl(0x202).fanModeSequence(0x1)=0',
        'fanControl(0x202).featureMap(0xfffc)={ multiSpeed: false, auto: false, rocking: false, wind: false, step: false, airflowDirection: false }',
        'fanControl(0x202).generatedCommandList(0xfff8)=[  ]',
        'fanControl(0x202).percentCurrent(0x3)=0',
        'fanControl(0x202).percentSetting(0x2)=0',
        'hepaFilterMonitoring(0x71).acceptedCommandList(0xfff9)=[ 0 ]',
        'hepaFilterMonitoring(0x71).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'hepaFilterMonitoring(0x71).changeIndication(0x2)=0',
        'hepaFilterMonitoring(0x71).clusterRevision(0xfffd)=1',
        'hepaFilterMonitoring(0x71).condition(0x0)=100',
        'hepaFilterMonitoring(0x71).degradationDirection(0x1)=1',
        'hepaFilterMonitoring(0x71).featureMap(0xfffc)={ condition: true, warning: true, replacementProductList: true }',
        'hepaFilterMonitoring(0x71).generatedCommandList(0xfff8)=[  ]',
        'hepaFilterMonitoring(0x71).inPlaceIndicator(0x3)=true',
        'hepaFilterMonitoring(0x71).lastChangedTime(0x4)=null',
        'hepaFilterMonitoring(0x71).replacementProductList(0x5)=[  ]',
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
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].toSorted(),
    );
  });

  test('invoke MatterbridgeHepaFilterMonitoringServer commands', async () => {
    expect(device.behaviors.has(HepaFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeHepaFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(HepaFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeHepaFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect((device as any).state['hepaFilterMonitoring'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['hepaFilterMonitoring'].generatedCommandList).toEqual([]);
    await device.invokeBehaviorCommand(HepaFilterMonitoringServer, 'resetCondition'); // Reset condition
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting condition (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeHepaFilterMonitoringServer: resetCondition called`);
  });

  test('invoke MatterbridgeActivatedCarbonFilterMonitoringServer commands', async () => {
    expect(device.behaviors.has(ActivatedCarbonFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeActivatedCarbonFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(ActivatedCarbonFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeActivatedCarbonFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect((device as any).state['activatedCarbonFilterMonitoring'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['activatedCarbonFilterMonitoring'].generatedCommandList).toEqual([]);
    await device.invokeBehaviorCommand(ActivatedCarbonFilterMonitoringServer, 'resetCondition'); // Reset condition
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting condition (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called`);
  });

  test('write attributes fanMode and percentSetting of fanControl cluster', async () => {
    await device.setAttribute('fanControl', 'fanMode', 1); // Set fan mode to 1
    await invokeSubscribeHandler(device, 'fanControl', 'fanMode', 1, 1);
    await wait(100); // Wait for the device to be ready
    expect(device.getAttribute('fanControl', 'fanMode')).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Fan control fanMode attribute changed: 1`);

    await device.setAttribute('fanControl', 'percentSetting', 50); // Set percent setting to 50
    await invokeSubscribeHandler(device, 'fanControl', 'percentSetting', 50, 50);
    await wait(100); // Wait for the device to be ready
    expect(device.getAttribute('fanControl', 'percentSetting')).toBe(50);
    expect(device.getAttribute('fanControl', 'percentCurrent')).toBe(50);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Fan control percentSetting attribute changed: 50`);
  });

  test('write attributes lastChangedTime of hepa cluster', async () => {
    const epochSeconds = Math.floor(Date.now() / 1000); // Current epoch time in seconds
    await device.setAttribute('hepaFilterMonitoring', 'lastChangedTime', epochSeconds); // Set last changed time
    await invokeSubscribeHandler(device, 'hepaFilterMonitoring', 'lastChangedTime', epochSeconds, epochSeconds);
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Hepa filter monitoring lastChangedTime attribute changed: ${epochSeconds}`);
    expect(device.getAttribute('hepaFilterMonitoring', 'lastChangedTime')).toBe(epochSeconds);
  });

  test('write attributes lastChangedTime of activated carbon cluster', async () => {
    const epochSeconds = Math.floor(Date.now() / 1000); // Current epoch time in seconds
    await device.setAttribute('activatedCarbonFilterMonitoring', 'lastChangedTime', epochSeconds); // Set last changed time
    await invokeSubscribeHandler(device, 'activatedCarbonFilterMonitoring', 'lastChangedTime', epochSeconds, epochSeconds);
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Activated carbon filter monitoring lastChangedTime attribute changed: ${epochSeconds}`);
    expect(device.getAttribute('activatedCarbonFilterMonitoring', 'lastChangedTime')).toBe(epochSeconds);
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
