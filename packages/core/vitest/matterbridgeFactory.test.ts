// src\matterbridgeFactory.test.ts

const NAME = 'Factory';
const MATTER_PORT = 11280;
const MATTER_CREATE_ONLY = true;

import { BooleanState } from '@matter/types/clusters/boolean-state';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import { ClusterId } from '@matter/types/datatype';
import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { LogLevel } from 'node-ansi-logger';

import { contactSensor, onOffLight } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { featuresFor } from '../src/matterbridgeEndpointHelpers.js';
import { camelCase, createClusterServer, getServerBehaviorFromClusterId, pascalCase, snakeCase } from '../src/matterbridgeFactory.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  }, 30000);

  test('snakeCase converts PascalCase cluster names to matter.js behavior subpaths', () => {
    expect(snakeCase('OnOff')).toBe('on-off');
    expect(snakeCase('BooleanState')).toBe('boolean-state');
    expect(snakeCase('LevelControl')).toBe('level-control');
    expect(snakeCase('Pm25ConcentrationMeasurement')).toBe('pm25-concentration-measurement');
    expect(snakeCase('TotalVolatileOrganicCompoundsConcentrationMeasurement')).toBe('total-volatile-organic-compounds-concentration-measurement');
    expect(snakeCase('Identify')).toBe('identify');
  });

  test('pascalCase and camelCase convert separated names back to cluster names', () => {
    expect(pascalCase('on-off')).toBe('OnOff');
    expect(pascalCase('boolean-state')).toBe('BooleanState');
    expect(pascalCase('pm25-concentration-measurement')).toBe('Pm25ConcentrationMeasurement');
    expect(pascalCase('identify')).toBe('Identify');
    expect(pascalCase('off_only')).toBe('OffOnly');

    expect(camelCase('on-off')).toBe('onOff');
    expect(camelCase('level-control')).toBe('levelControl');
    expect(camelCase('Identify')).toBe('identify');
  });

  test('getServerBehaviorFromClusterId resolves the stock matter.js server', async () => {
    const onOffType = await getServerBehaviorFromClusterId(OnOff.id);
    expect(onOffType?.id).toBe('onOff');

    const booleanStateType = await getServerBehaviorFromClusterId(BooleanState.id);
    expect(booleanStateType?.id).toBe('booleanState');
  });

  test('getServerBehaviorFromClusterId returns undefined for an unknown cluster id', async () => {
    expect(await getServerBehaviorFromClusterId(0xfff0 as ClusterId)).toBeUndefined();
  });

  test('createClusterServer creates a state cluster without features', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'FactoryBooleanState' });
    expect(await createClusterServer(device, BooleanState.id, { attributes: { stateValue: false } })).toBe(device);
    expect(device.hasClusterServer(BooleanState.id)).toBe(true);
    expect(device.hasAttributeServer(BooleanState, 'stateValue')).toBe(true);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanState']);
    expect(featuresFor(device, BooleanState.id)).toEqual({});

    expect(await createClusterServer(device, Identify.id, { attributes: { identifyTime: 0, identifyType: Identify.IdentifyType.None } })).toBe(device);
    expect(device.hasClusterServer(Identify.id)).toBe(true);
    expect(device.hasAttributeServer(Identify, 'identifyTime')).toBe(true);
    expect(device.hasAttributeServer(Identify, 'identifyType')).toBe(true);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanState', 'identify']);

    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanState', 'identify']);

    expect(await addDevice(aggregator, device)).toBe(true);

    expect(device.getAttribute(BooleanState.id, 'stateValue')).toBe(false);
    expect(device.getAttribute(Identify.id, 'identifyTime')).toBe(0);
    expect(device.getAttribute(Identify.id, 'identifyType')).toBe(Identify.IdentifyType.None);
  });

  test('createClusterServer creates an Identify server that processes commands', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'FactoryIdentifyCommands' });
    expect(await createClusterServer(device, Identify.id, { attributes: { identifyTime: 0, identifyType: Identify.IdentifyType.None } })).toBe(device);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBe(true);

    // Proves a real stock IdentifyServer (with command implementation) was required.
    expect(device.getAttribute(Identify.id, 'identifyTime')).toBe(0);
    await device.invokeBehaviorCommand('identify', 'identify', { identifyTime: 5 });
    expect(device.getAttribute(Identify.id, 'identifyTime')).toBe(5);
    await device.invokeBehaviorCommand('identify', 'identify', { identifyTime: 0 });
    expect(device.getAttribute(Identify.id, 'identifyTime')).toBe(0);
    await device.invokeBehaviorCommand('identify', 'triggerEffect', {
      effectIdentifier: Identify.EffectIdentifier.Blink,
      effectVariant: Identify.EffectVariant.Default,
    });
  });

  test('createClusterServer creates a command-bearing server with features and processes commands', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FactoryOnOffLighting' });
    expect(await createClusterServer(device, OnOff.id, { features: { lighting: true }, attributes: { onOff: false } })).toBe(device);
    expect(device.hasClusterServer(OnOff.id)).toBe(true);
    expect(device.hasAttributeServer(OnOff, 'onOff')).toBe(true);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff']);
    expect(featuresFor(device, OnOff.id)).toEqual({ lighting: true, deadFrontBehavior: false, offOnly: false });

    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'identify', 'groups', 'scenesManagement']);

    expect(await addDevice(aggregator, device)).toBe(true);

    // Proves a real stock server (with command implementation) was required, not a plain behavior.
    expect(device.getAttribute(OnOff.id, 'onOff')).toBe(false);
    await device.invokeBehaviorCommand('onOff', 'on');
    expect(device.getAttribute(OnOff.id, 'onOff')).toBe(true);
    await device.invokeBehaviorCommand('onOff', 'off');
    expect(device.getAttribute(OnOff.id, 'onOff')).toBe(false);
  });

  test('createClusterServer applies exactly the requested features (replacement, not union)', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FactoryOnOffOffOnly' });
    await createClusterServer(device, OnOff.id, { features: { offOnly: true }, attributes: { onOff: false } });
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff']);
    expect(featuresFor(device, OnOff.id)).toEqual({ lighting: false, deadFrontBehavior: false, offOnly: true });
  });

  test('createClusterServer accepts features as a string array', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FactoryOnOffFeatureArray' });
    expect(await createClusterServer(device, OnOff.id, { features: ['Lighting'], attributes: { onOff: false } })).toBe(device);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff']);
    expect(featuresFor(device, OnOff.id)).toEqual({ lighting: true, deadFrontBehavior: false, offOnly: false });
  });

  test('createClusterServer ignores a non-existing feature', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FactoryOnOffBogusFeature' });
    expect(await createClusterServer(device, OnOff.id, { features: ['NotAFeature'], attributes: { onOff: false } })).toBe(device);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff']);
    expect(featuresFor(device, OnOff.id)).toEqual({ lighting: false, deadFrontBehavior: false, offOnly: false });
  });

  test('createClusterServer ignores features on a cluster without features', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'FactoryBooleanStateFeatures' });
    expect(await createClusterServer(device, BooleanState.id, { features: ['Lighting'], attributes: { stateValue: false } })).toBe(device);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanState']);
    expect(featuresFor(device, BooleanState.id)).toEqual({});
  });

  test('createClusterServer works without options (attributes default to empty)', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'FactoryNoOptions' });
    expect(await createClusterServer(device, BooleanState.id)).toBe(device);
    expect(device.hasClusterServer(BooleanState.id)).toBe(true);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanState']);
  });

  test('createClusterServer logs a warning and is a no-op for an unknown cluster id', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FactoryUnknown' });
    expect(await createClusterServer(device, 0xfff0 as ClusterId)).toBe(device);
    expect(device.hasClusterServer(0xfff0 as ClusterId)).toBe(false);
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('createClusterServer: no matter.js server for clusterId'));
  });
});
