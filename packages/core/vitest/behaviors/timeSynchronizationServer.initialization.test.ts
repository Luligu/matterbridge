/**
 * @file packages/core/vitest/behaviors/timeSynchronizationServer.initialization.test.ts
 * @description Tests initialization of MatterbridgeTimeSynchronizationServer with preconfigured state.
 * @author Luca Liguori
 */

const NAME = 'TimeSynchronizationServerInitialization';
const MATTER_PORT = 8039;

import { TimeSynchronization } from '@matter/types/clusters/time-synchronization';
import { createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode, server } from '@matterbridge/test-utils/vitest/matter';
import { setupTest } from '@matterbridge/test-utils/vitest/setup';

import { MATTER_EPOCH_US, MatterbridgeTimeSynchronizationServer } from '../../src/behaviors/timeSynchronizationServer.js';

await setupTest(NAME);

describe('MatterbridgeTimeSynchronizationServer initialization', () => {
  beforeAll(async () => {
    await createTestEnvironment();
    await createServerNode(MATTER_PORT);
    server.behaviors.require(MatterbridgeTimeSynchronizationServer, {
      utcTime: null,
      granularity: TimeSynchronization.Granularity.NoTimeGranularity,
      timeSource: TimeSynchronization.TimeSource.None,
      trustedTimeSource: null,
      defaultNtp: null,
      supportsDnsResolve: false,
      timeZone: [{ offset: 3600, validAt: MATTER_EPOCH_US, name: 'Europe/Rome' }],
      dstOffset: [],
      localTime: null,
      timeZoneDatabase: TimeSynchronization.TimeZoneDatabase.None,
      timeZoneListMaxSize: 2,
      dstOffsetListMaxSize: 2,
    });
    await server.act(async (agent) => {
      await agent.load(MatterbridgeTimeSynchronizationServer);
    });
  });

  afterAll(async () => {
    await flushServerNode();
    await destroyTestEnvironment();
    vi.restoreAllMocks();
  });

  it('should keep the TimeZone set before initialization instead of the UTC default', () => {
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).timeZone).toEqual([{ offset: 3600, validAt: MATTER_EPOCH_US, name: 'Europe/Rome' }]);
  });
});
