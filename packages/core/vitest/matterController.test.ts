/**
 * @file packages/core/vitest/matterController.test.ts
 * @description Covers controller commands, peer lifecycle and report handling without network access.
 * @author Luca Liguori
 */

import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { Environment, Logger, MemoryStorageDriver, Observable, type StorageContext, StorageManager, StorageService } from '@matter/general';
import { NetworkClient, ServerNode } from '@matter/node';
import { BasicInformationClient } from '@matter/node/behaviors/basic-information';
import { FileStorageDriver } from '@matter/nodejs';
import type { ReadResult, Subscribe } from '@matter/protocol';
import { VendorId } from '@matter/types/datatype';
import { ManualPairingCodeCodec } from '@matter/types/schema';
import { flushAsync } from '@matterbridge/test-utils';
import { HOMEDIR, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { AnsiLogger } from 'node-ansi-logger';
import { afterAll, afterEach, beforeEach, describe, expect, type MockInstance, test, vi } from 'vitest';

import type { Matterbridge } from '../src/matterbridge.js';
import { startController } from '../src/matterController.js';

await setupTest('MatterController', false, []);

/** Peer fixture with controllable lifecycle and interaction responses. */
class PeerFixture {
  readonly id: string;
  readonly network = { autoSubscribe: false, isDisabled: false };
  readonly lifecycle = { isCommissioned: true, online: new Observable<[]>(), offline: new Observable<[]>() };
  readonly events = {
    autoSubscribe$Changed: new Observable<[boolean, boolean]>(),
    defaultSubscription$Changed: new Observable<[Subscribe | undefined, Subscribe | undefined]>(),
    subscriptionStatusChanged: new Observable<[boolean]>(),
    subscriptionAlive: new Observable<[]>(),
  };
  readonly basicInformation = { vendorName: 'Test vendor' };
  readonly start = vi.fn(async () => {});
  readonly enable = vi.fn(async () => {});
  readonly decommission = vi.fn(async () => {});
  readonly setStateOf = vi.fn(async () => {});
  readonly stateOf = vi.fn((behavior: unknown) => (behavior === BasicInformationClient ? this.basicInformation : this.network));
  readonly interaction = {
    subscribe: vi.fn(async (_request: Subscribe) => ({ close: vi.fn() })),
    read: vi.fn((_request: unknown): ReadResult => reports([])),
  };

  constructor(id: string, commissioned = true) {
    this.id = id;
    this.lifecycle.isCommissioned = commissioned;
  }

  readonly eventsOf = (): typeof this.events => this.events;
}

/**
 * Produces lazy report chunks, including asynchronously iterable chunks.
 *
 * @param {unknown[]} values Report fixtures consumed by the controller.
 * @returns {ReadResult} Protocol-shaped report stream.
 */
function reports(values: unknown[]): ReadResult {
  // Fixtures deliberately omit wire-only fields unused by the controller.
  return (async function* (): AsyncGenerator<AsyncIterable<unknown>> {
    yield (async function* (): AsyncGenerator {
      yield* values;
    })();
  })() as ReadResult;
}

describe('Matter controller commands', () => {
  const argv = process.argv;
  let manager: StorageManager;
  let loggerErrorSpy = vi.fn<AnsiLogger['error']>();
  let loggerInfoSpy = vi.fn<AnsiLogger['info']>();
  let loggerNoticeSpy = vi.fn<AnsiLogger['notice']>();
  let loggerWarnSpy = vi.fn<AnsiLogger['warn']>();
  let bridge: Matterbridge;
  let peers: PeerFixture[];
  let create: MockInstance<typeof ServerNode.create>;
  let subscriptions: Subscribe[];
  const discovered = new Observable<[PeerFixture]>();
  let discovery: Promise<void> & { discovered: typeof discovered };
  let commission = vi.fn(async (_options: unknown) => ({ id: 'peer7' }));
  const nodeStart = vi.fn(async () => {});

  beforeEach(async () => {
    vi.clearAllMocks();
    manager = new StorageManager(new MemoryStorageDriver());
    await manager.initialize();
    peers = [];
    subscriptions = [];
    discovery = Object.assign(Promise.resolve(), { discovered });
    commission = vi.fn(async (_options: unknown) => ({ id: 'peer7' }));
    const container = {
      get size(): number {
        return peers.length;
      },
      get commissioned(): PeerFixture[] {
        return peers.filter((peer) => peer.lifecycle.isCommissioned);
      },
      get: (id: string): PeerFixture | undefined => peers.find((peer) => peer.id === id),
      commission: async (options: unknown): Promise<{ id: string }> => commission(options),
      discover: (): typeof discovery => discovery,
      [Symbol.iterator]: (): ArrayIterator<PeerFixture> => peers[Symbol.iterator](),
    };
    // Substitute only the transport-facing node; storage and report codecs remain real.
    const node = { start: nodeStart, peers: container } as unknown as ServerNode;
    create = vi.spyOn(ServerNode, 'create').mockResolvedValue(node);
    const storageService = new StorageService(Environment.default);
    vi.spyOn(storageService, 'open').mockResolvedValue(manager);
    // The controller reads only these fields; avoid constructing unrelated bridge services.
    bridge = {
      log: new AnsiLogger({ logName: 'Controller' }),
      matterbridgeDirectory: HOMEDIR,
      matterStorageService: storageService,
      controllerVendorId: 65521,
      controllerVendorName: 'Matterbridge',
      controllerProductId: 32768,
      controllerProductName: 'Matterbridge Controller',
      matterbridgeVersion: '3.11.2',
      systemInformation: { osRelease: '1.2.3' },
      port: 6000,
    } as unknown as Matterbridge;
    loggerErrorSpy = vi.spyOn(bridge.log, 'error').mockImplementation(() => {});
    loggerInfoSpy = vi.spyOn(bridge.log, 'info').mockImplementation(() => {});
    loggerNoticeSpy = vi.spyOn(bridge.log, 'notice').mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(bridge.log, 'warn').mockImplementation(() => {});
    process.argv = argv.slice(0, 2);
  });

  afterEach(async () => {
    await flushAsync(undefined, undefined, 0);
    await manager.close();
    vi.restoreAllMocks();
    process.argv = argv;
  });

  afterAll(() => {
    process.argv = argv;
  });

  /**
   * Starts one command with the fixture bridge.
   *
   * @param {string[]} args Controller command arguments.
   * @returns {Promise<void>} Resolves after background reactions settle.
   */
  async function run(...args: string[]): Promise<void> {
    process.argv = [...argv.slice(0, 2), ...args];
    await startController(bridge, Environment.default);
    await flushAsync(undefined, undefined, 0);
  }

  /**
   * Adds a peer and captures subscription requests.
   *
   * @param {string} id Local peer identifier.
   * @param {boolean} commissioned Whether this peer is commissioned.
   * @returns {PeerFixture} Controllable peer.
   */
  function addPeer(id = 'peer2', commissioned = true): PeerFixture {
    const peer = new PeerFixture(id, commissioned);
    peer.interaction.subscribe.mockImplementation(async (request) => {
      subscriptions.push(request);
      return { close: vi.fn() };
    });
    peers.push(peer);
    return peer;
  }

  test('should reject startup without a storage service', async () => {
    bridge.matterStorageService = undefined;
    await expect(startController(bridge, Environment.default)).rejects.toThrow('No storage service initialized');
    expect(create).not.toHaveBeenCalled();
  });

  test('should stop when the storage context cannot be created', async () => {
    // Exercise the defensive guard against a broken storage implementation.
    vi.spyOn(manager, 'createContext').mockReturnValue(undefined as unknown as StorageContext);
    await run();
    expect(loggerErrorSpy).toHaveBeenCalledWith('No storage context controllerContext initialized');
    expect(create).not.toHaveBeenCalled();
  });

  test('should clear all controller storage without creating a node', async () => {
    await manager.createContext('controllerContext').set('serialNumber', 'old-serial');
    await manager.createContext('nodes').set('peer1', 'discovered');
    await manager.createContext('certificates').set('rootCertId', 1);
    const clear = vi.spyOn(manager.driver, 'clearAll');
    await run('--reset');
    expect(clear).toHaveBeenCalledWith(['controllerContext']);
    expect(clear).toHaveBeenCalledWith(['nodes']);
    expect(clear).toHaveBeenCalledWith(['certificates']);
    expect(await manager.createContext('controllerContext').get('serialNumber', 'missing')).toBe('missing');
    expect(await manager.createContext('nodes').get('peer1', 'missing')).toBe('missing');
    expect(await manager.createContext('certificates').get('rootCertId', 0)).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(nodeStart).not.toHaveBeenCalled();
    expect(loggerNoticeSpy).toHaveBeenCalledWith('MatterbridgeController storage reset; remote device fabrics are unchanged');
  });

  test('should clear file-backed storage permanently while preserving bridge storage', async () => {
    await manager.close();
    const directory = path.join(HOMEDIR, 'file-reset');
    manager = new StorageManager(new FileStorageDriver(directory));
    await manager.initialize();
    const service = bridge.matterStorageService;
    if (!service) throw new Error('Missing fixture storage service');
    vi.spyOn(service, 'open').mockResolvedValue(manager);
    const bridgeStorage = new StorageManager(new MemoryStorageDriver());
    await bridgeStorage.initialize();
    bridge.matterStorageManager = bridgeStorage;
    await bridgeStorage.createContext('persist').set('serialNumber', 'bridge-serial');
    try {
      await manager.createContext('controllerContext').set('serialNumber', 'controller-serial');
      await manager.createContext('nodes').createContext('peer1').set('commissionedAt', 123);
      await manager.createContext('certificates').set('rootCertId', 1);
      await manager.driver.set([], 'rootKey', 'root-value');
      await run('--reset');
      expect(await manager.driver.contexts([])).toEqual([]);
      expect(await manager.driver.keys([])).toEqual([]);
      expect(await bridgeStorage.createContext('persist').get('serialNumber', '')).toBe('bridge-serial');
      await manager.close();
      manager = new StorageManager(new FileStorageDriver(directory));
      await manager.initialize();
      expect(await manager.driver.contexts([])).toEqual([]);
      expect(await manager.driver.keys([])).toEqual([]);
    } finally {
      await bridgeStorage.close();
    }
  });

  test('should reset empty storage without creating a node', async () => {
    await run('--reset');
    expect(create).not.toHaveBeenCalled();
  });

  test('should retain identity and configure a noncommissionable controller', async () => {
    const context = manager.createContext('controllerContext');
    await context.set('serialNumber', 'existing-serial');
    await context.set('uniqueId', 'existing-unique');
    await run('--peers');
    expect(await context.get('serialNumber')).toBe('existing-serial');
    expect(await context.get('uniqueId')).toBe('existing-unique');
    expect(Array.from(create.mock.calls[0] ?? [])[1]).toMatchObject({
      id: 'MatterbridgeController',
      commissioning: { enabled: false },
      controller: { adminFabricLabel: 'Matterbridge Controller' },
      subscriptions: { persistenceEnabled: false },
      network: { autoStartCommissionedPeers: false, port: undefined },
      basicInformation: { softwareVersion: 31102, softwareVersionString: '3.11.2', hardwareVersion: 10203, hardwareVersionString: '1.2.3' },
    });
    expect(nodeStart).toHaveBeenCalledTimes(1);
  });

  test('should preserve an explicitly requested controller port', async () => {
    await run('--peers', '--port', '6000');
    expect(Array.from(create.mock.calls[0] ?? [])[1]).toMatchObject({ network: { port: 6000 } });
  });

  test('should use fallback versions when metadata is invalid', async () => {
    bridge.matterbridgeVersion = '';
    bridge.systemInformation.osRelease = '';
    await run('--peers');
    expect(Array.from(create.mock.calls[0] ?? [])[1]).toMatchObject({
      basicInformation: { softwareVersion: 1, softwareVersionString: '1.0.0', hardwareVersion: 1, hardwareVersionString: '1.0.0' },
    });
  });

  test('should list discovered and commissioned peers with accurate paired counts', async () => {
    addPeer('peer1', false);
    addPeer('peer2');
    addPeer('custom-id');
    await run('--peers');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller known nodes: 3, paired nodes: 2');
    expect(loggerInfoSpy).toHaveBeenCalledWith('- Node 1 (discovered)');
    expect(loggerInfoSpy).toHaveBeenCalledWith('- Node 2 (commissioned)');
    expect(loggerInfoSpy).toHaveBeenCalledWith('- custom-id (commissioned)');
  });

  test('should commission using a manual pairing code and selected local id', async () => {
    await run('--pair', '--pairingcode', '32902218933', '--node', '7');
    expect(commission).toHaveBeenCalledWith(expect.objectContaining({ id: 'peer7', pairingCode: '32902218933' }));
    expect(loggerNoticeSpy).toHaveBeenCalledWith('Commissioning successfully done for node peer7');
  });

  test('should include optional pairing identity filters when supplied by the codec', async () => {
    vi.spyOn(ManualPairingCodeCodec, 'decode').mockReturnValue({ passcode: 12345678, discriminator: 913, vendorId: VendorId(1), productId: 2 });
    await run('--pair', '--pairingcode', 'test');
    expect(commission).toHaveBeenCalledWith({ id: undefined, pairingCode: 'test', vendorId: VendorId(1), productId: 2 });
  });

  test('should report a missing pairing code value', async () => {
    await run('--pair', '--pairingcode');
    expect(loggerErrorSpy).toHaveBeenCalledWith('Missing parameter --pairingcode');
    expect(commission).not.toHaveBeenCalled();
  });

  test('should commission using discriminator and passcode', async () => {
    await run('--pair', '--discriminator', '913', '--passcode', '32748080');
    expect(commission).toHaveBeenCalledWith({ id: undefined, discriminator: 913, passcode: 32748080 });
  });

  test('should pass the missing passcode fallback to commissioning', async () => {
    await run('--pair');
    expect(commission).toHaveBeenCalledWith({ id: undefined, discriminator: undefined, passcode: 0 });
  });

  test('should report commissioning failure', async () => {
    commission.mockRejectedValueOnce(new Error('Rejected passcode'));
    await run('--pair');
    expect(loggerErrorSpy).toHaveBeenCalledWith('Commissioning failed for node undefined: Rejected passcode');
  });

  test('should log discovered devices', async () => {
    await run('--discover');
    discovered.emit(new PeerFixture('peer9', false));
    expect(loggerInfoSpy).toHaveBeenCalledWith('Discovered commissionable device: peer9');
  });

  test('should report discovery failure', async () => {
    let rejectDiscovery = (_error: Error): void => {};
    discovery = Object.assign(
      new Promise<void>((_resolve, reject) => {
        rejectDiscovery = reject;
      }),
      { discovered },
    );
    await run('--discover');
    rejectDiscovery(new Error('Scanner failed'));
    await flushAsync(undefined, undefined, 0);
    expect(loggerErrorSpy).toHaveBeenCalledWith('Discovery failed: Scanner failed');
  });

  test('should require a node id for unpair', async () => {
    await run('--unpair');
    expect(loggerErrorSpy).toHaveBeenCalledWith('Missing parameter --node for --unpair');
  });

  test('should warn when the requested unpair node is unknown', async () => {
    addPeer('peer1', false);
    await run('--unpair', '--node', '99');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Matter commissioning controller node not found: Node 99');
  });

  test('should connect before decommissioning the requested peer', async () => {
    addPeer('peer1', false);
    const peer = addPeer();
    await run('--unpair', '--node', '2');
    expect(peer.start).toHaveBeenCalledTimes(1);
    expect(peer.decommission).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller decommissioned node: Node 2');
  });

  test('should enable a disabled peer before unpairing', async () => {
    const peer = addPeer();
    peer.network.isDisabled = true;
    await run('--unpair', '--node', '2');
    expect(peer.enable).toHaveBeenCalledTimes(1);
    expect(peer.decommission).toHaveBeenCalledTimes(1);
  });

  test('should decommission only commissioned peers using a stable snapshot', async () => {
    const discoveredPeer = addPeer('peer1', false);
    const first = addPeer();
    const second = addPeer('peer3');
    second.network.isDisabled = true;
    first.decommission.mockImplementation(async () => {
      peers.splice(peers.indexOf(first), 1);
    });
    await run('--unpairall');
    expect(discoveredPeer.decommission).not.toHaveBeenCalled();
    expect(first.start).toHaveBeenCalledTimes(1);
    expect(second.enable).toHaveBeenCalledTimes(1);
    expect(second.decommission).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller decommissioned all nodes');
  });

  test('should connect all commissioned peers but skip discovered peers', async () => {
    const discoveredPeer = addPeer('peer1', false);
    const peer = addPeer();
    const custom = addPeer('custom');
    custom.network.isDisabled = true;
    await run();
    expect(discoveredPeer.start).not.toHaveBeenCalled();
    expect(peer.start).toHaveBeenCalledTimes(1);
    expect(custom.enable).toHaveBeenCalledTimes(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller started with 2 paired nodes');
  });

  test('should connect only the selected peer', async () => {
    const first = addPeer('peer1');
    const second = addPeer();
    await run('--node', '2');
    expect(first.start).not.toHaveBeenCalled();
    expect(second.start).toHaveBeenCalledTimes(1);
  });

  test('should warn when a selected peer does not exist', async () => {
    await run('--node', '99');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Matter commissioning controller peer not found: Node 99');
  });

  test('should report peer startup failure', async () => {
    const peer = addPeer();
    peer.start.mockRejectedValueOnce(new Error('Offline'));
    await run();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Matter commissioning controller failed to start peer Node 2: Offline');
  });

  test('should enable automatic subscription and report failures', async () => {
    const peer = addPeer();
    peer.setStateOf.mockRejectedValueOnce(new Error('Cannot update'));
    await run();
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(peer.setStateOf).toHaveBeenCalledWith(NetworkClient, { autoSubscribe: true });
    expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to set autoSubscribe for peer Node 2: Cannot update');
  });

  test('should report peer lifecycle and subscription events', async () => {
    const peer = addPeer();
    peer.network.autoSubscribe = true;
    await run();
    peer.lifecycle.online.emit();
    peer.lifecycle.offline.emit();
    peer.events.autoSubscribe$Changed.emit(true, false);
    peer.events.autoSubscribe$Changed.emit(false, true);
    peer.events.defaultSubscription$Changed.emit(...([undefined, undefined] as const));
    peer.events.defaultSubscription$Changed.emit({} as Subscribe, {} as Subscribe);
    peer.events.subscriptionStatusChanged.emit(true);
    peer.events.subscriptionStatusChanged.emit(false);
    peer.events.subscriptionAlive.emit();
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller autoSubscribe is enabled for peer Node 2');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Matter commissioning controller peer Node 2 is offline');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller peer Node 2 subscription is active');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller peer Node 2 subscription is inactive');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Matter commissioning controller peer Node 2 subscription alive event received');
  });

  test('should trace report variants, avoid duplicate subscriptions, and resubscribe after close', async () => {
    const peer = addPeer();
    await run('--trace-peer');
    peer.lifecycle.online.emit();
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(peer.interaction.subscribe).toHaveBeenCalledTimes(1);
    const subscription = subscriptions[0];
    expect(subscription).toMatchObject({ keepSubscriptions: true });
    const path = { endpointId: 1, clusterId: 6, attributeId: 0, eventId: 1 };
    await subscription?.updated?.(
      reports([
        { kind: 'attr-value', path, version: 2, value: true },
        { kind: 'attr-value', path, version: 2, value: null },
        { kind: 'event-value', path, number: 3, value: { active: true } },
        { kind: 'event-value', path, number: 4, value: undefined },
        { kind: 'attr-status', path, status: 1 },
        { kind: 'event-status', path, status: 2 },
        { kind: 'unknown' },
      ]),
    );
    expect(loggerInfoSpy.mock.calls.map(([message]) => stripVTControlCharacters(message))).toContain('Peer Node 2 attr 1/6/0 v2: true');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Peer Node 2 attr-status 1/6/0: 1');
    expect(loggerWarnSpy).toHaveBeenCalledWith('Peer Node 2 event-status 1/6/1: 2');
    subscription?.closed?.();
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(peer.interaction.subscribe).toHaveBeenCalledTimes(2);
  });

  test('should retry tracing after a subscription failure', async () => {
    const peer = addPeer();
    peer.interaction.subscribe.mockRejectedValueOnce(new Error('Subscription failed'));
    await run('--trace-peer');
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(loggerErrorSpy).toHaveBeenCalledWith('Matter commissioning controller trace-peer subscription failed for Node 2: Subscription failed');
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(peer.interaction.subscribe).toHaveBeenCalledTimes(2);
  });

  test('should fully consume lazy dump reports before logging cached Basic Information', async () => {
    const peer = addPeer();
    const consumed = vi.fn();
    // Track report iteration directly; reading a report need not inspect its fields.
    peer.interaction.read.mockImplementation((): ReadResult => {
      return (async function* (): AsyncGenerator<AsyncIterable<unknown>> {
        yield (async function* (): AsyncGenerator {
          consumed();
          yield {};
        })();
      })() as ReadResult;
    });
    const logger = Logger.get('BasicInformation: Node 2');
    const log = vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(Logger, 'get').mockReturnValue(logger);
    await run('--dump-peer');
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(peer.stateOf).toHaveBeenCalledWith(BasicInformationClient);
    expect(log).toHaveBeenCalledWith({ vendorName: 'Test vendor' });
  });

  test('should report dump read failures', async () => {
    const peer = addPeer();
    peer.interaction.read.mockImplementation(() => {
      throw new Error('Read failed');
    });
    await run('--dump-peer');
    peer.lifecycle.online.emit();
    await flushAsync(undefined, undefined, 0);
    expect(loggerErrorSpy).toHaveBeenCalledWith('Matter commissioning controller dump-peer failed for Node 2: Read failed');
  });
});
