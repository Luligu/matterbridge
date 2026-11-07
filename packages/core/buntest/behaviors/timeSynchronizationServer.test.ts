/**
 * @file packages/core/buntest/behaviors/timeSynchronizationServer.test.ts
 * @description This file contains the bun tests for the MatterbridgeTimeSynchronizationServer class.
 * @author Luca Liguori
 */

const NAME = 'TimeSynchronizationServer';
const MATTER_PORT = 8036;

import { afterEach, beforeAll, describe, expect, setSystemTime, test, vi } from 'bun:test';
import { rmSync } from 'node:fs';
import path from 'node:path';

import { CommandModel } from '@matter/main/model';
import { OperationalCredentialsServer } from '@matter/node/behaviors/operational-credentials';
import { TimeSynchronization } from '@matter/types/clusters/time-synchronization';
import { StatusResponseError } from '@matter/types/common';
import { EndpointNumber, FabricIndex, NodeId } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { TlvOfModel } from '@matter/types/tlv';
import { server } from '@matterbridge/test-utils/buntest/matter';
import { HOMEDIR, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { MATTER_STORAGE_DIR } from '@matterbridge/types';

import { isCanonicalIpv6, MATTER_EPOCH_US, MatterbridgeTimeSynchronizationServer } from '../../src/behaviors/timeSynchronizationServer.js';
import { useServerNode, waitFor } from '../bunUtils.js';

await setupTest(NAME);

/** One hour in microseconds. */
const HOUR_US = 3_600_000_000n;

/**
 * Runs an action on the server's MatterbridgeTimeSynchronizationServer behavior the way matter.js invokes a command:
 * the behavior state is locked before the action runs, so its synchronous state writes do not fail.
 *
 * @param {(timeSync: MatterbridgeTimeSynchronizationServer) => T} action - The action to run.
 * @param {FabricIndex} [fabric] - The accessing fabric of the action, undefined for a local actor.
 * @returns {Promise<Awaited<T>>} The result of the action.
 */
async function withTimeSync<T>(action: (timeSync: MatterbridgeTimeSynchronizationServer) => T, fabric?: FabricIndex): Promise<Awaited<T>> {
  return await server.act(async (agent) => {
    const timeSync = agent.get(MatterbridgeTimeSynchronizationServer);
    // Pre-warm the state with the real context, then lock it as matter.js does before invoking a command
    void timeSync.state;
    const transaction = agent.context.transaction;
    await transaction.addResources(timeSync);
    await transaction.begin();
    // A local actor has no accessing fabric: give it one to test the fabric scoped command
    if (fabric !== undefined) {
      const context = new Proxy(agent.context, { get: (target, key): unknown => (key === 'fabric' ? fabric : Reflect.get(target, key, target)) });
      Object.defineProperty(timeSync, 'context', { configurable: true, value: context });
    }
    try {
      return await action(timeSync);
    } finally {
      delete (timeSync as unknown as Record<string, unknown>).context;
    }
  });
}

/**
 * Emits a change of the OperationalCredentials fabrics, as on a fabric removal, and waits for the Time
 * Synchronization server reaction, which runs in its own transaction.
 *
 * @param {FabricIndex[]} fabricIndexes - The fabric indexes of the fabrics left on the node.
 */
async function emitFabrics(fabricIndexes: FabricIndex[]): Promise<void> {
  await server.act((agent) => {
    agent.get(OperationalCredentialsServer).events.fabrics$Changed.emit(
      fabricIndexes.map((fabricIndex) => ({ fabricIndex }) as never),
      [],
      agent.context,
    );
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Returns the current time in Unix microseconds.
 *
 * @returns {bigint} The current time in Unix microseconds.
 */
function nowUs(): bigint {
  return BigInt(Date.now()) * 1000n;
}

describe('MatterbridgeTimeSynchronizationServer', () => {
  const events = {
    dstTableEmpty: vi.fn(),
    dstStatus: vi.fn(),
    timeZoneStatus: vi.fn(),
    missingTrustedTimeSource: vi.fn(),
  };

  useServerNode(MATTER_PORT);

  beforeAll(async () => {
    server.behaviors.require(MatterbridgeTimeSynchronizationServer, {
      utcTime: null,
      granularity: TimeSynchronization.Granularity.NoTimeGranularity,
      timeSource: TimeSynchronization.TimeSource.None,
      trustedTimeSource: null,
      defaultNtp: null,
      supportsDnsResolve: false,
      timeZone: [],
      dstOffset: [],
      localTime: null,
      timeZoneDatabase: TimeSynchronization.TimeZoneDatabase.Full,
      timeZoneListMaxSize: 2,
      dstOffsetListMaxSize: 2,
    });
    await server.act(async (agent) => {
      await agent.load(MatterbridgeTimeSynchronizationServer);
    });
    const timeSyncEvents = server.eventsOf(MatterbridgeTimeSynchronizationServer);
    timeSyncEvents.dstTableEmpty.on(events.dstTableEmpty);
    timeSyncEvents.dstStatus.on(events.dstStatus);
    timeSyncEvents.timeZoneStatus.on(events.timeZoneStatus);
    timeSyncEvents.missingTrustedTimeSource.on(events.missingTrustedTimeSource);
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  test('should report the host clock on initialization', () => {
    const state = server.stateOf(MatterbridgeTimeSynchronizationServer);
    expect(BigInt(state.utcTime ?? 0)).toBeGreaterThan(nowUs() - HOUR_US);
    expect(state.granularity).toBe(TimeSynchronization.Granularity.MillisecondsGranularity);
    expect(state.timeSource).toBe(TimeSynchronization.TimeSource.Unknown);
    // The TimeZone attribute has at least one entry, UTC by default, and there is no time zone database.
    expect(state.timeZone.map((entry) => ({ ...entry }))).toEqual([{ offset: 0, validAt: MATTER_EPOCH_US }]);
    expect(state.timeZoneDatabase).toBe(TimeSynchronization.TimeZoneDatabase.None);
    // LocalTime is null while DSTOffset is empty.
    expect(state.localTime).toBeNull();
  });

  test('should refresh UTCTime when the clock is updated', async () => {
    const before = BigInt(server.stateOf(MatterbridgeTimeSynchronizationServer).utcTime ?? 0);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await withTimeSync((timeSync) => timeSync.updateClock());
    expect(BigInt(server.stateOf(MatterbridgeTimeSynchronizationServer).utcTime ?? 0)).toBeGreaterThan(before);
  });

  test('should not accept SetUTCTime', async () => {
    expect(withTimeSync((timeSync) => timeSync.setUtcTime({ utcTime: nowUs(), granularity: TimeSynchronization.Granularity.SecondsGranularity }))).rejects.toThrow(
      TimeSynchronization.TimeNotAcceptedError,
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('MatterbridgeTimeSynchronizationServer.setUtcTime: time with granularity 2 not accepted, the node uses the host clock (endpoint '),
    );
  });

  test('should set the TrustedTimeSource with the accessing fabric', async () => {
    await withTimeSync((timeSync) => timeSync.setTrustedTimeSource({ trustedTimeSource: { nodeId: NodeId(5), endpoint: EndpointNumber(0) } }), FabricIndex(1));
    expect({ ...server.stateOf(MatterbridgeTimeSynchronizationServer).trustedTimeSource }).toEqual({ fabricIndex: FabricIndex(1), nodeId: NodeId(5), endpoint: EndpointNumber(0) });
    expect(events.missingTrustedTimeSource).not.toHaveBeenCalled();
  });

  test('should reject SetTrustedTimeSource without an accessing fabric', async () => {
    const error = await withTimeSync((timeSync) => timeSync.setTrustedTimeSource({ trustedTimeSource: { nodeId: NodeId(6), endpoint: EndpointNumber(0) } })).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(StatusResponseError);
    expect((error as StatusResponseError).code).toBe(Status.UnsupportedAccess);
  });

  test('should keep the TrustedTimeSource while its fabric is present', async () => {
    await server.setStateOf(MatterbridgeTimeSynchronizationServer, { defaultNtp: 'fe80::1' });
    await emitFabrics([FabricIndex(1)]);
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).trustedTimeSource).not.toBeNull();
    // The DefaultNTP is cleared only when the last fabric is removed
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).defaultNtp).toBe('fe80::1');
    expect(events.missingTrustedTimeSource).not.toHaveBeenCalled();
  });

  test('should clear the TrustedTimeSource when its fabric is removed', async () => {
    await emitFabrics([]);
    await waitFor(() => events.missingTrustedTimeSource.mock.calls.length === 1);
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).trustedTimeSource).toBeNull();
    // Matter 1.6.1 § 11.18.6.12: removing the last fabric sets the DefaultNTP to null
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).defaultNtp).toBeNull();
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('the last fabric was removed, the DefaultNTP was cleared'));

    // Nothing to clear the second time
    await emitFabrics([]);
    expect(events.missingTrustedTimeSource).toHaveBeenCalledTimes(1);
  });

  test('should clear the TrustedTimeSource with a null SetTrustedTimeSource', async () => {
    await withTimeSync((timeSync) => timeSync.setTrustedTimeSource({ trustedTimeSource: null }));
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).trustedTimeSource).toBeNull();
    expect(events.missingTrustedTimeSource).toHaveBeenCalledTimes(1);
  });

  test('should recognize canonical IPv6 addresses', () => {
    expect(isCanonicalIpv6('fe80::1')).toBe(true);
    expect(isCanonicalIpv6('2001:db8::1')).toBe(true);
    expect(isCanonicalIpv6('::ffff:192.0.2.1')).toBe(true);
    expect(isCanonicalIpv6('FE80::1')).toBe(false);
    expect(isCanonicalIpv6('fe80:0:0:0:0:0:0:1')).toBe(false);
    expect(isCanonicalIpv6('fe80::1%eth0')).toBe(false);
    expect(isCanonicalIpv6('192.0.2.1')).toBe(false);
  });

  test('should set and clear the DefaultNTP with an IPv6 address', async () => {
    await withTimeSync((timeSync) => timeSync.setDefaultNtp({ defaultNtp: 'fe80::1' }));
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).defaultNtp).toBe('fe80::1');
    await withTimeSync((timeSync) => timeSync.setDefaultNtp({ defaultNtp: null }));
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).defaultNtp).toBeNull();
  });

  test.each(['192.0.2.1', '[fe80::1]:123', 'FE80::1', 'not a host', '-pool.ntp.org'])('should reject the DefaultNTP %s with INVALID_COMMAND', async (defaultNtp) => {
    const error = await withTimeSync((timeSync) => timeSync.setDefaultNtp({ defaultNtp })).catch((error: unknown) => error);
    expect((error as StatusResponseError).code).toBe(Status.InvalidCommand);
    expect((error as Error).message).toContain('is not a domain name or a static IPv6 address');
  });

  test('should accept a domain name DefaultNTP only when DNS resolution is supported', async () => {
    const error = await withTimeSync((timeSync) => timeSync.setDefaultNtp({ defaultNtp: 'pool.ntp.org' })).catch((error: unknown) => error);
    expect((error as StatusResponseError).code).toBe(Status.InvalidCommand);
    expect((error as Error).message).toContain('the node does not support DNS resolution');

    await server.setStateOf(MatterbridgeTimeSynchronizationServer, { supportsDnsResolve: true });
    await withTimeSync((timeSync) => timeSync.setDefaultNtp({ defaultNtp: 'pool.ntp.org' }));
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).defaultNtp).toBe('pool.ntp.org');
    await server.setStateOf(MatterbridgeTimeSynchronizationServer, { supportsDnsResolve: false, defaultNtp: null });
  });

  test('should reject a TimeZone list larger than TimeZoneListMaxSize with RESOURCE_EXHAUSTED', async () => {
    const timeZone = [
      { offset: 0, validAt: MATTER_EPOCH_US },
      { offset: 3600, validAt: nowUs() + HOUR_US },
      { offset: 7200, validAt: nowUs() + 2n * HOUR_US },
    ];
    const error = await withTimeSync((timeSync) => timeSync.setTimeZone({ timeZone })).catch((error: unknown) => error);
    expect((error as StatusResponseError).code).toBe(Status.ResourceExhausted);
  });

  test('should let any SetTimeZone list reach the handler, which checks its 1 to 2 entries (TC-TIMESYNC-2.4 step 16)', () => {
    // The protocol layer validates the request against the TLV of the command model of the behavior schema before the handler runs
    const command = MatterbridgeTimeSynchronizationServer.schema.require(CommandModel, 'SetTimeZone');
    const requestTlv = TlvOfModel(command);
    const entry = { offset: 0, validAt: MATTER_EPOCH_US };
    expect(() => requestTlv.validate({ timeZone: [entry, entry, entry] })).not.toThrow();
    expect(() => requestTlv.validate({ timeZone: [] })).not.toThrow();
    // The features required on the Root Node of a Camera are kept
    expect([...MatterbridgeTimeSynchronizationServer.schema.supportedFeatures].toSorted()).toEqual(['NTPC', 'TSC', 'TZ']);
  });

  test.each([
    ['an empty list', []],
    ['a first entry with a non-zero ValidAt', [{ offset: 0, validAt: nowUs() }]],
    [
      'a second entry with a zero ValidAt',
      [
        { offset: 0, validAt: MATTER_EPOCH_US },
        { offset: 3600, validAt: MATTER_EPOCH_US },
      ],
    ],
  ])('should reject a TimeZone list with %s with CONSTRAINT_ERROR', async (_description, timeZone) => {
    const error = await withTimeSync((timeSync) => timeSync.setTimeZone({ timeZone })).catch((error: unknown) => error);
    expect((error as StatusResponseError).code).toBe(Status.ConstraintError);
  });

  test('should set the TimeZone, empty DSTOffset and ask for the DST offsets', async () => {
    const response = await withTimeSync((timeSync) => timeSync.setTimeZone({ timeZone: [{ offset: 3600, validAt: MATTER_EPOCH_US, name: 'Europe/Rome' }] }));
    expect(response).toEqual({ dstOffsetRequired: true });
    const state = server.stateOf(MatterbridgeTimeSynchronizationServer);
    expect(state.timeZone.map((entry) => ({ ...entry }))).toEqual([{ offset: 3600, validAt: MATTER_EPOCH_US, name: 'Europe/Rome' }]);
    expect(state.dstOffset).toEqual([]);
    expect(state.localTime).toBeNull();
    expect(events.timeZoneStatus).toHaveBeenCalledWith({ offset: 3600, name: 'Europe/Rome' }, expect.anything());
    expect(events.dstTableEmpty).toHaveBeenCalledTimes(1);
    expect(events.dstStatus).not.toHaveBeenCalled();
  });

  test('should reject a DSTOffset list larger than DSTOffsetListMaxSize with RESOURCE_EXHAUSTED', async () => {
    const now = nowUs();
    const dstOffset = [
      { offset: 3600, validStarting: now, validUntil: now + HOUR_US },
      { offset: 0, validStarting: now + HOUR_US, validUntil: now + 2n * HOUR_US },
      { offset: 3600, validStarting: now + 2n * HOUR_US, validUntil: null },
    ];
    const error = await withTimeSync((timeSync) => timeSync.setDstOffset({ dstOffset })).catch((error: unknown) => error);
    expect((error as StatusResponseError).code).toBe(Status.ResourceExhausted);
  });

  test.each([
    [
      'a null ValidUntil not in last place',
      (now: bigint): TimeSynchronization.DstOffset[] => [
        { offset: 3600, validStarting: now, validUntil: null },
        { offset: 0, validStarting: now + HOUR_US, validUntil: null },
      ],
    ],
    ['a ValidUntil not after its ValidStarting', (now: bigint): TimeSynchronization.DstOffset[] => [{ offset: 3600, validStarting: now, validUntil: now }]],
    [
      'an entry starting before the previous ValidUntil',
      (now: bigint): TimeSynchronization.DstOffset[] => [
        { offset: 3600, validStarting: now, validUntil: now + 2n * HOUR_US },
        { offset: 0, validStarting: now + HOUR_US, validUntil: null },
      ],
    ],
  ])('should reject a DSTOffset list with %s with CONSTRAINT_ERROR', async (_description, build) => {
    const dstOffset = build(nowUs());
    const error = await withTimeSync((timeSync) => timeSync.setDstOffset({ dstOffset })).catch((error: unknown) => error);
    expect((error as StatusResponseError).code).toBe(Status.ConstraintError);
  });

  test('should apply a DST offset and compute LocalTime', async () => {
    const now = nowUs();
    await withTimeSync((timeSync) =>
      timeSync.setDstOffset({
        dstOffset: [
          { offset: 3600, validStarting: now - HOUR_US, validUntil: now + HOUR_US },
          { offset: 0, validStarting: now + HOUR_US, validUntil: null },
        ],
      }),
    );
    expect(events.dstStatus).toHaveBeenCalledWith({ dstOffsetActive: true }, expect.anything());
    expect(events.dstTableEmpty).not.toHaveBeenCalled();
    const state = server.stateOf(MatterbridgeTimeSynchronizationServer);
    // LocalTime = UTCTime + the TimeZone offset (3600 s) + the DST offset (3600 s)
    const localTime = BigInt(state.localTime ?? 0);
    expect(localTime - nowUs()).toBeGreaterThan(2n * HOUR_US - 60_000_000n);
    expect(localTime - nowUs()).toBeLessThanOrEqual(2n * HOUR_US);
  });

  test('should stop applying the DST offset when it expires and remove the expired entry', async () => {
    const later = Date.now() + 2 * 3_600_000;
    setSystemTime(later);
    try {
      await withTimeSync((timeSync) => timeSync.updateClock());
    } finally {
      setSystemTime();
    }
    const state = server.stateOf(MatterbridgeTimeSynchronizationServer);
    expect(state.dstOffset).toHaveLength(1);
    expect(state.dstOffset[0].offset).toBe(0);
    expect(events.dstStatus).toHaveBeenCalledWith({ dstOffsetActive: false }, expect.anything());
    expect(events.dstTableEmpty).not.toHaveBeenCalled();
  });

  test('should generate DSTTableEmpty when the last DST offset expires', async () => {
    const now = nowUs();
    await withTimeSync((timeSync) => timeSync.setDstOffset({ dstOffset: [{ offset: 3600, validStarting: now - HOUR_US, validUntil: now + HOUR_US }] }));
    expect(events.dstStatus).toHaveBeenCalledWith({ dstOffsetActive: true }, expect.anything());

    setSystemTime(Date.now() + 2 * 3_600_000);
    try {
      await withTimeSync((timeSync) => timeSync.updateClock());
    } finally {
      setSystemTime();
    }
    const state = server.stateOf(MatterbridgeTimeSynchronizationServer);
    expect(state.dstOffset).toEqual([]);
    expect(state.localTime).toBeNull();
    expect(events.dstTableEmpty).toHaveBeenCalledTimes(1);
    expect(events.dstStatus).toHaveBeenCalledWith({ dstOffsetActive: false }, expect.anything());
  });

  test('should generate DSTTableEmpty when SetDSTOffset empties the list', async () => {
    await withTimeSync((timeSync) => timeSync.setDstOffset({ dstOffset: [] }));
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).dstOffset).toEqual([]);
    expect(events.dstTableEmpty).toHaveBeenCalledTimes(1);
    expect(events.dstStatus).not.toHaveBeenCalled();
  });

  test('should repeat DSTTableEmpty at most once per hour while the DSTOffset list is empty', async () => {
    const start = Date.now();
    const updateClockAt = async (ms: number): Promise<void> => {
      setSystemTime(ms);
      try {
        await withTimeSync((timeSync) => timeSync.updateClock());
      } finally {
        setSystemTime();
      }
    };
    // The list was emptied by the previous test: no new event within the hour
    await updateClockAt(start);
    await updateClockAt(start + 59 * 60_000);
    expect(events.dstTableEmpty).not.toHaveBeenCalled();
    // One hour later the time update generates it again, then not before another hour
    await updateClockAt(start + 61 * 60_000);
    expect(events.dstTableEmpty).toHaveBeenCalledTimes(1);
    await updateClockAt(start + 62 * 60_000);
    expect(events.dstTableEmpty).toHaveBeenCalledTimes(1);
    await updateClockAt(start + 122 * 60_000);
    expect(events.dstTableEmpty).toHaveBeenCalledTimes(2);
  });

  test('should generate DSTStatus when SetTimeZone stops a DST offset in use', async () => {
    const now = nowUs();
    await withTimeSync((timeSync) => timeSync.setDstOffset({ dstOffset: [{ offset: 3600, validStarting: now - HOUR_US, validUntil: null }] }));
    expect(events.dstStatus).toHaveBeenLastCalledWith({ dstOffsetActive: true }, expect.anything());

    await withTimeSync((timeSync) => timeSync.setTimeZone({ timeZone: [{ offset: 0, validAt: MATTER_EPOCH_US }] }));
    expect(events.dstStatus).toHaveBeenLastCalledWith({ dstOffsetActive: false }, expect.anything());
    expect(events.timeZoneStatus).toHaveBeenCalledWith({ offset: 0, name: undefined }, expect.anything());
  });

  test('should switch to a scheduled TimeZone entry once it becomes valid', async () => {
    const validAt = nowUs() + HOUR_US;
    await withTimeSync((timeSync) =>
      timeSync.setTimeZone({
        timeZone: [
          { offset: 0, validAt: MATTER_EPOCH_US },
          { offset: 7200, validAt, name: 'Scheduled' },
        ],
      }),
    );
    expect(events.timeZoneStatus).toHaveBeenCalledWith({ offset: 0, name: undefined }, expect.anything());
    // A DST offset makes LocalTime non-null, so the scheduled entry's offset is visible in it.
    const now = nowUs();
    await withTimeSync((timeSync) => timeSync.setDstOffset({ dstOffset: [{ offset: 0, validStarting: now - HOUR_US, validUntil: null }] }));

    const later = Date.now() + 2 * 3_600_000;
    setSystemTime(later);
    try {
      await withTimeSync((timeSync) => timeSync.updateClock());
    } finally {
      setSystemTime();
    }
    const state = server.stateOf(MatterbridgeTimeSynchronizationServer);
    expect(state.timeZone.map((entry) => ({ ...entry }))).toEqual([{ offset: 7200, validAt: MATTER_EPOCH_US, name: 'Scheduled' }]);
    // Matter 1.6.1 § 11.17.10.3: the scheduled entry changes the time zone offset and name, so TimeZoneStatus is generated.
    expect(events.timeZoneStatus).toHaveBeenLastCalledWith({ offset: 7200, name: 'Scheduled' }, expect.anything());
    expect(BigInt(state.localTime ?? 0) - BigInt(later) * 1000n).toBe(2n * HOUR_US);
  });

  test('should report the scheduled TimeZone entry already valid in the TimeZoneStatus event', async () => {
    await withTimeSync((timeSync) =>
      timeSync.setTimeZone({
        timeZone: [
          { offset: 0, validAt: MATTER_EPOCH_US },
          { offset: -3600, validAt: nowUs() - HOUR_US },
        ],
      }),
    );
    expect(events.timeZoneStatus).toHaveBeenCalledWith({ offset: -3600, name: undefined }, expect.anything());
  });

  test('should keep a scheduled TimeZone entry without name when it becomes valid', async () => {
    setSystemTime(Date.now() + 3_600_000);
    try {
      await withTimeSync((timeSync) => timeSync.updateClock());
    } finally {
      setSystemTime();
    }
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).timeZone.map((entry) => ({ ...entry }))).toEqual([{ offset: -3600, validAt: MATTER_EPOCH_US }]);
    expect(events.timeZoneStatus).toHaveBeenLastCalledWith({ offset: -3600, name: undefined }, expect.anything());
  });

  test('should not generate TimeZoneStatus when a scheduled TimeZone entry keeps the offset and name', async () => {
    await withTimeSync((timeSync) =>
      timeSync.setTimeZone({
        timeZone: [
          { offset: 3600, validAt: MATTER_EPOCH_US },
          { offset: 3600, validAt: nowUs() + HOUR_US },
        ],
      }),
    );
    events.timeZoneStatus.mockClear();
    setSystemTime(Date.now() + 2 * 3_600_000);
    try {
      await withTimeSync((timeSync) => timeSync.updateClock());
    } finally {
      setSystemTime();
    }
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).timeZone.map((entry) => ({ ...entry }))).toEqual([{ offset: 3600, validAt: MATTER_EPOCH_US }]);
    expect(events.timeZoneStatus).not.toHaveBeenCalled();
  });

  test('should stop the clock refresh when the server is disposed', async () => {
    await withTimeSync(async (timeSync) => {
      await timeSync[Symbol.asyncDispose]();
      expect(timeSync.internal.clockTimer).toBeUndefined();
    });
  });
});

describe('MatterbridgeTimeSynchronizationServer with a TimeZone set before initialization', () => {
  // A second server node: the TimeZone attribute is set before the server initializes. It has the id of the first one,
  // so its storage is erased first: otherwise it restores the TimeZone the first suite stored.
  beforeAll(() => {
    rmSync(path.join(HOMEDIR, '.matterbridge', MATTER_STORAGE_DIR), { recursive: true, force: true });
  });
  useServerNode(MATTER_PORT + 100);

  beforeAll(async () => {
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

  test('should keep the TimeZone set before initialization instead of the UTC default', () => {
    expect(server.stateOf(MatterbridgeTimeSynchronizationServer).timeZone.map((entry) => ({ ...entry }))).toEqual([
      { offset: 3600, validAt: MATTER_EPOCH_US, name: 'Europe/Rome' },
    ]);
  });
});
