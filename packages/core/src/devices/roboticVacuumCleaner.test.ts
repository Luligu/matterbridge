// src\roboticVacuumCleaner.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'Vacuum';
const MATTER_PORT = 8013;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
// @matter
import { RvcCleanModeServer, RvcOperationalStateServer, RvcRunModeServer, ServiceAreaServer } from '@matter/node/behaviors';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { er, hk, LogLevel, stringify } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeServiceAreaServer } from '../behaviors/serviceAreaServer.js';
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
import {
  loggerErrorSpy,
  loggerFatalSpy,
  loggerLogSpy,
  loggerWarnSpy,
  setDebug,
  setupTest,
} from '../jestutils/jestSetupTest.js';
import { roboticVacuumCleaner } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeRvcCleanModeServer, MatterbridgeRvcOperationalStateServer, MatterbridgeRvcRunModeServer, RoboticVacuumCleaner } from './roboticVacuumCleaner.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Robotic Vacuum Cleaner', () => {
  let device: RoboticVacuumCleaner;

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
    await createServerNode(MATTER_PORT, roboticVacuumCleaner.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an RVC device', async () => {
    device = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('RVCTestDevice-RVC123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RvcRunMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RvcCleanMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RvcOperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ServiceArea.Cluster.id)).toBeTruthy();
  });

  test('createDefaultRvcOperationalStateClusterServer argument normalization and chaining', () => {
    const requireSpy = jest.spyOn(device.behaviors, 'require').mockImplementation(() => undefined);
    // Call with all parameters
    device.createDefaultRvcOperationalStateClusterServer(
      ['Phase1', 'Phase2'],
      1,
      [{ operationalStateId: RvcOperationalState.OperationalState.Stopped }, { operationalStateId: RvcOperationalState.OperationalState.Running }],
      RvcOperationalState.OperationalState.Running,
      { errorStateId: RvcOperationalState.ErrorState.DustBinFull, errorStateDetails: 'Test error' },
    );
    expect(requireSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        phaseList: ['Phase1', 'Phase2'],
        currentPhase: 1,
        operationalStateList: [{ operationalStateId: RvcOperationalState.OperationalState.Stopped }, { operationalStateId: RvcOperationalState.OperationalState.Running }],
        operationalState: RvcOperationalState.OperationalState.Running,
        operationalError: { errorStateId: RvcOperationalState.ErrorState.DustBinFull, errorStateDetails: 'Test error' },
      }),
    );
    // Call with defaults
    device.createDefaultRvcOperationalStateClusterServer();
    expect(requireSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        phaseList: null,
        currentPhase: null,
        operationalStateList: expect.any(Array),
        operationalState: RvcOperationalState.OperationalState.Docked,
        operationalError: { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
      }),
    );
    // Chaining
    expect(device.createDefaultRvcOperationalStateClusterServer()).toBe(device);
    requireSpy.mockRestore();
  });

  test('createDefaultServiceAreaClusterServer argument normalization and chaining', () => {
    const requireSpy = jest.spyOn(device.behaviors, 'require').mockImplementation(() => undefined);
    // Call with all parameters
    const supportedAreas: ServiceArea.Area[] = [];
    const selectedAreas: number[] = [];
    const currentArea: number | null = null;
    const supportedMaps: ServiceArea.Map[] = [];
    device.createDefaultServiceAreaClusterServer(supportedAreas, selectedAreas, currentArea, supportedMaps);
    expect(requireSpy).toHaveBeenCalledWith(expect.anything(), { currentArea: null, estimatedEndTime: null, selectedAreas: [], supportedAreas: [], supportedMaps: [] });
    // Call with defaults
    jest.clearAllMocks();
    device.createDefaultServiceAreaClusterServer();
    expect(requireSpy).toHaveBeenCalledWith(expect.anything(), {
      currentArea: 1,
      estimatedEndTime: null,
      selectedAreas: [],
      supportedAreas: [
        {
          areaId: 1,
          areaInfo: {
            landmarkInfo: null,
            locationInfo: {
              areaType: 52,
              floorNumber: 0,
              locationName: 'Living',
            },
          },
          mapId: null,
        },
        {
          areaId: 2,
          areaInfo: {
            landmarkInfo: null,
            locationInfo: {
              areaType: 47,
              floorNumber: 0,
              locationName: 'Kitchen',
            },
          },
          mapId: null,
        },
        {
          areaId: 3,
          areaInfo: {
            landmarkInfo: null,
            locationInfo: {
              areaType: 7,
              floorNumber: 1,
              locationName: 'Bedroom',
            },
          },
          mapId: null,
        },
        {
          areaId: 4,
          areaInfo: {
            landmarkInfo: null,
            locationInfo: {
              areaType: 6,
              floorNumber: 1,
              locationName: 'Bathroom',
            },
          },
          mapId: null,
        },
      ],
      supportedMaps: [],
    });
    requireSpy.mockRestore();
  });

  test('add an RVC device', async () => {
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 116, revision: 4 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 84, 85, 97, 336 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).activeBatFaults(0x12)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 11, 12, 13, 14, 15, 16, 17, 18, 26, 28, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).batChargeLevel(0xe)=0',
        'powerSource(0x2f).batChargeState(0x1a)=3',
        'powerSource(0x2f).batFunctionalWhileCharging(0x1c)=true',
        'powerSource(0x2f).batPercentRemaining(0xc)=160',
        'powerSource(0x2f).batPresent(0x11)=true',
        'powerSource(0x2f).batReplaceability(0x10)=0',
        'powerSource(0x2f).batReplacementNeeded(0xf)=false',
        'powerSource(0x2f).batTimeRemaining(0xd)=null',
        'powerSource(0x2f).batVoltage(0xb)=5900',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='Primary battery'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: false, battery: true, rechargeable: true, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'rvcCleanMode(0x55).acceptedCommandList(0xfff9)=[ 0 ]',
        'rvcCleanMode(0x55).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'rvcCleanMode(0x55).clusterRevision(0xfffd)=4',
        'rvcCleanMode(0x55).currentMode(0x1)=1',
        'rvcCleanMode(0x55).featureMap(0xfffc)={ onOff: false }',
        'rvcCleanMode(0x55).generatedCommandList(0xfff8)=[ 1 ]',
        "rvcCleanMode(0x55).supportedModes(0x0)=[ { label: 'Vacuum', mode: 1, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Mop', mode: 2, modeTags: [ { mfgCode: undefined, value: 16386 } ] }, { label: 'DeepClean', mode: 3, modeTags: [ { mfgCode: undefined, value: 16384 } ] } ]",
        'rvcOperationalState(0x61).acceptedCommandList(0xfff9)=[ 0, 3, 128 ]',
        'rvcOperationalState(0x61).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'rvcOperationalState(0x61).clusterRevision(0xfffd)=3',
        'rvcOperationalState(0x61).currentPhase(0x1)=null',
        'rvcOperationalState(0x61).featureMap(0xfffc)={  }',
        'rvcOperationalState(0x61).generatedCommandList(0xfff8)=[ 4 ]',
        "rvcOperationalState(0x61).operationalError(0x5)={ errorStateId: 0, errorStateLabel: undefined, errorStateDetails: 'Fully operational' }",
        'rvcOperationalState(0x61).operationalState(0x4)=66',
        'rvcOperationalState(0x61).operationalStateList(0x3)=[ { operationalStateId: 0, operationalStateLabel: undefined }, { operationalStateId: 1, operationalStateLabel: undefined }, { operationalStateId: 2, operationalStateLabel: undefined }, { operationalStateId: 3, operationalStateLabel: undefined }, { operationalStateId: 64, operationalStateLabel: undefined }, { operationalStateId: 65, operationalStateLabel: undefined }, { operationalStateId: 66, operationalStateLabel: undefined } ]',
        'rvcOperationalState(0x61).phaseList(0x0)=null',
        'rvcRunMode(0x54).acceptedCommandList(0xfff9)=[ 0 ]',
        'rvcRunMode(0x54).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'rvcRunMode(0x54).clusterRevision(0xfffd)=3',
        'rvcRunMode(0x54).currentMode(0x1)=1',
        'rvcRunMode(0x54).featureMap(0xfffc)={ onOff: false }',
        'rvcRunMode(0x54).generatedCommandList(0xfff8)=[ 1 ]',
        "rvcRunMode(0x54).supportedModes(0x0)=[ { label: 'Idle', mode: 1, modeTags: [ { mfgCode: undefined, value: 16384 } ] }, { label: 'Cleaning', mode: 2, modeTags: [ { mfgCode: undefined, value: 16385 } ] }, { label: 'Mapping', mode: 3, modeTags: [ { mfgCode: undefined, value: 16386 } ] }, { label: 'SpotCleaning', mode: 4, modeTags: [ { mfgCode: undefined, value: 16385 }, { mfgCode: undefined, value: 7 } ] } ]",
        'serviceArea(0x150).acceptedCommandList(0xfff9)=[ 0 ]',
        'serviceArea(0x150).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 65528, 65529, 65531, 65532, 65533 ]',
        'serviceArea(0x150).clusterRevision(0xfffd)=2',
        'serviceArea(0x150).currentArea(0x3)=1',
        'serviceArea(0x150).estimatedEndTime(0x4)=null',
        'serviceArea(0x150).featureMap(0xfffc)={ selectWhileRunning: false, progressReporting: false, maps: true }',
        'serviceArea(0x150).generatedCommandList(0xfff8)=[ 1 ]',
        'serviceArea(0x150).selectedAreas(0x2)=[  ]',
        "serviceArea(0x150).supportedAreas(0x0)=[ { areaId: 1, mapId: null, areaInfo: { locationInfo: { locationName: 'Living', floorNumber: 0, areaType: 52 }, landmarkInfo: null } }, { areaId: 2, mapId: null, areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: 47 }, landmarkInfo: null } }, { areaId: 3, mapId: null, areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 1, areaType: 7 }, landmarkInfo: null } }, { areaId: 4, mapId: null, areaInfo: { locationInfo: { locationName: 'Bathroom', floorNumber: 1, areaType: 6 }, landmarkInfo: null } } ]",
        'serviceArea(0x150).supportedMaps(0x1)=[  ]',
      ].sort(),
    );
  });

  test('invoke MatterbridgeRvcRunModeServer commands', async () => {
    expect(device.behaviors.has(RvcRunModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcRunModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeRvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['rvcRunMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['rvcRunMode'].generatedCommandList).toEqual([1]);
    expect((device.stateOf(MatterbridgeRvcRunModeServer) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeRvcRunModeServer) as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('noCluster', 'changeToMode', { newMode: 0 }); // noCluster is invalid
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeBehaviorCommand error: command ${hk}changeToMode${er} not found on endpoint`));
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'noCommand' as any, { newMode: 0 }); // noCommand is invalid
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeBehaviorCommand error: command ${hk}noCommand${er} not found on agent for endpoint`));
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 1 }); // 1 has Idle
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked`);
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 2 }); // 2 has Cleaning
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 2 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 3 }); // 3 has Mapping
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 3 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode 3 => Mapping`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 4 }); // 4 has Cleaning and Max
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 4 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
  });

  test('invoke MatterbridgeRvcCleanModeServer commands', async () => {
    expect(device.behaviors.has(RvcCleanModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcCleanModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeRvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['rvcCleanMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['rvcCleanMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcCleanMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcCleanMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcCleanModeServer changeToMode called with newMode 1 => Vacuum`);
  });

  test('invoke MatterbridgeRvcOperationalStateServer commands', async () => {
    expect(device.behaviors.has(RvcOperationalStateServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcOperationalStateServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcOperationalStateServer).commands.has('pause')).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcOperationalStateServer).commands.has('resume')).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcOperationalStateServer).commands.has('goHome')).toBeTruthy();
    expect((device.stateOf(RvcOperationalStateServer) as any).acceptedCommandList).toEqual([0, 3, 128]);
    expect((device.stateOf(RvcOperationalStateServer) as any).generatedCommandList).toEqual([4]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcOperationalState', 'pause');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle`);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcOperationalState', 'resume');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resume (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning`,
    );
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcOperationalState', 'goHome');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `GoHome (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle`);
  });

  test('invoke MatterbridgeServiceAreaServer commands', async () => {
    expect(device.behaviors.has(ServiceAreaServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeServiceAreaServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(ServiceAreaServer).commands.has('selectAreas')).toBeTruthy();
    expect((device.stateOf(ServiceAreaServer) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(ServiceAreaServer) as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('serviceArea', 'selectAreas', { newAreas: [1, 2, 3, 4] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Selecting areas [1, 2, 3, 4] (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeServiceAreaServer selectAreas called with: [1, 2, 3, 4]`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('serviceArea', 'selectAreas', { newAreas: [0, 5] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Selecting areas [0, 5] (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeServiceAreaServer selectAreas called with: [0, 5]`);
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
