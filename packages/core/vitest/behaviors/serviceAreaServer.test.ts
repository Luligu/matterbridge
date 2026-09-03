/**
 * @file packages/core/vitest/behaviors/serviceAreaServer.test.ts
 * @description This file contains the tests for serviceAreaServer.
 * @author Luca Liguori
 */

const NAME = 'ServiceAreaServer';
const MATTER_PORT = 14200;
const MATTER_CREATE_ONLY = true;

import { ServiceArea } from '@matter/types/clusters/service-area';
import { setupTest } from '@matterbridge/vitest-utils';
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

import { MatterbridgeServiceAreaServer } from '../../src/behaviors/serviceAreaServer.js';
import { RoboticVacuumCleaner } from '../../src/devices/roboticVacuumCleaner.js';
import type { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeServiceAreaServer', () => {
  let rvc: RoboticVacuumCleaner;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
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
  });

  test('Device type: roboticVacuumCleaner', async () => {
    rvc = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(rvc).toBeDefined();
    expect(await addDevice(aggregator, rvc)).toBeTruthy();
  });

  test('ServiceArea server', async () => {
    const serviceAreaServer = MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps);
    expect(rvc.behaviors.has(serviceAreaServer)).toBeTruthy();
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([]);
    expect(rvc.getAttribute(ServiceArea.id, 'currentArea')).toBe(1);
    expect(rvc.getAttribute(ServiceArea.id, 'supportedAreas')).toHaveLength(4);

    // A single recording handler is registered for both invocations below, because only the first handler
    // registered for a command name is ever executed.
    const selectAreasCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    rvc.addCommandHandler('selectAreas', (data) => {
      selectAreasCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    // The command is invoked through act() rather than invokeBehaviorCommand() because SelectAreas answers with a
    // SelectAreasResponse (Matter 1.6 Application Cluster Spec Sec 17.4.7.1) that invokeBehaviorCommand() discards,
    // and the response status is the observable outcome of the validation.
    const acceptedResponse = await rvc.act(async (agent) => agent.get(serviceAreaServer).selectAreas({ newAreas: [1, 2] }));
    expect(acceptedResponse).toEqual({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });
    expect(selectAreasCalls).toEqual([{ cluster: 'serviceArea', endpoint: rvc, request: { newAreas: [1, 2] } }]);
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]);

    // Areas 0 and 5 are not in SupportedAreas, so the whole request is refused and SelectedAreas is left untouched.
    const rejectedResponse = await rvc.act(async (agent) => agent.get(serviceAreaServer).selectAreas({ newAreas: [0, 5] }));
    expect(rejectedResponse).toMatchObject({ status: ServiceArea.SelectAreasStatus.UnsupportedArea });
    // The plugin handler ran for the refused request too: the server forwards before it validates.
    expect(selectAreasCalls).toHaveLength(2);
    expect(selectAreasCalls[1]).toEqual({ cluster: 'serviceArea', endpoint: rvc, request: { newAreas: [0, 5] } });
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]);
  });
});
