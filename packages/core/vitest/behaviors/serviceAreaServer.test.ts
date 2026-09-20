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

  test('ServiceArea server skipArea without progress reporting', async () => {
    const serviceAreaServer = MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps);
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]); // Left over from the selectAreas test above.

    const skipAreaCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    rvc.addCommandHandler('skipArea', (data) => {
      skipAreaCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    // Area 1 is in SelectedAreas, so skipping it is allowed. ProgressReporting is not enabled on this instance, so the progress attribute stays undefined.
    const acceptedResponse = await rvc.act(async (agent) => agent.get(serviceAreaServer).skipArea({ skippedArea: 1 }));
    expect(acceptedResponse).toEqual({ status: ServiceArea.SkipAreaStatus.Success, statusText: '' });
    expect(skipAreaCalls).toEqual([{ cluster: 'serviceArea', endpoint: rvc, request: { skippedArea: 1 } }]);
    expect(rvc.getAttribute(ServiceArea.id, 'progress')).toBeUndefined();

    // Area 99 is not in SelectedAreas, so the request is refused.
    const rejectedResponse = await rvc.act(async (agent) => agent.get(serviceAreaServer).skipArea({ skippedArea: 99 }));
    expect(rejectedResponse).toEqual({ status: ServiceArea.SkipAreaStatus.InvalidSkippedArea, statusText: 'AreaID 99 is not in the selected areas list' });
  });

  test('ServiceArea server skipArea with progress reporting', async () => {
    const progressServiceAreaServer = MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps, ServiceArea.Feature.ProgressReporting);
    const progressRvc = new RoboticVacuumCleaner('RVC Progress Device', 'RVCProgress123', { progress: [] });
    expect(await addDevice(aggregator, progressRvc)).toBeTruthy();
    expect(progressRvc.getAttribute(ServiceArea.id, 'progress')).toEqual([]);

    // SelectedAreas is still empty right after creation, so skipping is refused with InvalidAreaList.
    const invalidAreaListResponse = await progressRvc.act(async (agent) => agent.get(progressServiceAreaServer).skipArea({ skippedArea: 1 }));
    expect(invalidAreaListResponse).toEqual({ status: ServiceArea.SkipAreaStatus.InvalidAreaList, statusText: '' });

    // Selecting areas (matter.js base behavior, not overridden by Matterbridge) resets Progress to one Pending entry per selected area.
    await progressRvc.act(async (agent) => agent.get(progressServiceAreaServer).selectAreas({ newAreas: [1, 2] }));
    expect(progressRvc.getAttribute(ServiceArea.id, 'progress')).toEqual([
      { areaId: 1, status: ServiceArea.OperationalStatus.Pending },
      { areaId: 2, status: ServiceArea.OperationalStatus.Pending },
    ]);

    // Skipping area 1 marks only its progress entry as Skipped; CurrentArea handling is left untouched (plugin/device specific).
    const skippedResponse = await progressRvc.act(async (agent) => agent.get(progressServiceAreaServer).skipArea({ skippedArea: 1 }));
    expect(skippedResponse).toEqual({ status: ServiceArea.SkipAreaStatus.Success, statusText: '' });
    expect(progressRvc.getAttribute(ServiceArea.id, 'progress')).toEqual([
      { areaId: 1, status: ServiceArea.OperationalStatus.Skipped },
      { areaId: 2, status: ServiceArea.OperationalStatus.Pending },
    ]);
  });
});
