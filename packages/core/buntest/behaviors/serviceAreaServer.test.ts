/**
 * @file packages/core/buntest/behaviors/serviceAreaServer.test.ts
 * @description This file contains the bun tests for serviceAreaServer.
 * @author Luca Liguori
 */

const NAME = 'ServiceAreaServer';
const MATTER_PORT = 14200;

import { describe, expect, test } from 'bun:test';

import { ServiceArea } from '@matter/types/clusters/service-area';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeServiceAreaServer } from '../../src/behaviors/serviceAreaServer.js';
import { RoboticVacuumCleaner } from '../../src/devices/roboticVacuumCleaner.js';
import { recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const mapsServer = MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps);
const progressServer = MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps, ServiceArea.Feature.ProgressReporting);

describe('MatterbridgeServiceAreaServer', () => {
  useServerNode(MATTER_PORT);

  test('selectAreas and skipArea forward every request and answer through the response status', async () => {
    const rvc = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(await addBridgedDevice(aggregator, rvc, 0, 0, 0, 0)).toBeTruthy();
    expect(rvc.behaviors.has(mapsServer)).toBeTruthy();
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([]);
    expect(rvc.getAttribute(ServiceArea.id, 'currentArea')).toBe(1);
    expect(rvc.getAttribute(ServiceArea.id, 'supportedAreas')).toHaveLength(4);

    const emitted: unknown[] = [];
    rvc.subscribeCommand(ServiceArea, 'selectAreas', (data) => emitted.push(data.request));
    const selectCalls = recordCommand(rvc, 'selectAreas');
    const skipCalls = recordCommand(rvc, 'skipArea');
    // act() is used because invokeBehaviorCommand() discards the command response, which carries the validation result.
    const selectAreas = async (newAreas: number[]): Promise<ServiceArea.SelectAreasResponse> => rvc.act(async (agent) => agent.get(mapsServer).selectAreas({ newAreas }));
    const skipArea = async (skippedArea: number): Promise<ServiceArea.SkipAreaResponse> => rvc.act(async (agent) => agent.get(mapsServer).skipArea({ skippedArea }));

    expect(await selectAreas([1, 2])).toEqual({ status: ServiceArea.SelectAreasStatus.Success, statusText: '' });
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]);
    // Areas 0 and 5 are not supported: the whole request is refused, but the plugin still received it first.
    expect(await selectAreas([0, 5])).toMatchObject({ status: ServiceArea.SelectAreasStatus.UnsupportedArea });
    expect(rvc.getAttribute(ServiceArea.id, 'selectedAreas')).toEqual([1, 2]);
    expect(selectCalls).toEqual([
      { cluster: 'serviceArea', endpoint: rvc, request: { newAreas: [1, 2] } },
      { cluster: 'serviceArea', endpoint: rvc, request: { newAreas: [0, 5] } },
    ]);
    expect(emitted).toEqual([{ newAreas: [1, 2] }]);

    // Without ProgressReporting the Progress attribute stays undefined.
    expect(await skipArea(1)).toEqual({ status: ServiceArea.SkipAreaStatus.Success, statusText: '' });
    expect(rvc.getAttribute(ServiceArea.id, 'progress')).toBeUndefined();
    expect(await skipArea(99)).toEqual({ status: ServiceArea.SkipAreaStatus.InvalidSkippedArea, statusText: 'AreaID 99 is not in the selected areas list' });
    expect(skipCalls.map((call) => call.request)).toEqual([{ skippedArea: 1 }, { skippedArea: 99 }]);
  });

  test('skipArea with ProgressReporting marks the skipped area', async () => {
    const rvc = new RoboticVacuumCleaner('RVC Progress Device', 'RVCProgress123', { progress: [] });
    expect(await addBridgedDevice(aggregator, rvc, 0, 0, 0, 0)).toBeTruthy();
    expect(rvc.getAttribute(ServiceArea.id, 'progress')).toEqual([]);

    // No selected areas yet: InvalidAreaList.
    expect(await rvc.act(async (agent) => agent.get(progressServer).skipArea({ skippedArea: 1 }))).toEqual({ status: ServiceArea.SkipAreaStatus.InvalidAreaList, statusText: '' });
    await rvc.act(async (agent) => agent.get(progressServer).selectAreas({ newAreas: [1, 2] }));
    expect(rvc.getAttribute(ServiceArea.id, 'progress')).toEqual([
      { areaId: 1, status: ServiceArea.OperationalStatus.Pending },
      { areaId: 2, status: ServiceArea.OperationalStatus.Pending },
    ]);
    expect(await rvc.act(async (agent) => agent.get(progressServer).skipArea({ skippedArea: 1 }))).toEqual({ status: ServiceArea.SkipAreaStatus.Success, statusText: '' });
    expect(rvc.getAttribute(ServiceArea.id, 'progress')).toEqual([
      { areaId: 1, status: ServiceArea.OperationalStatus.Skipped },
      { areaId: 2, status: ServiceArea.OperationalStatus.Pending },
    ]);
  });
});
