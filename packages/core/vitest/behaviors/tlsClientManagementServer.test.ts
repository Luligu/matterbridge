/**
 * @file packages/core/vitest/behaviors/tlsClientManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeTlsClientManagementServer class.
 * @author Luca Liguori
 */

const NAME = 'TlsClientManagementServer';
const MATTER_PORT = 8038;
const MATTER_CREATE_ONLY = true;

import { randomBytes } from 'node:crypto';

import { TimeSynchronization } from '@matter/types/clusters/time-synchronization';
import { TlsClientManagement } from '@matter/types/clusters/tls-client-management';
import { FabricIndex } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode, server, startServerNode, stopServerNode } from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';

import { MatterbridgeTimeSynchronizationServer } from '../../src/behaviors/timeSynchronizationServer.js';
import { MatterbridgeTlsCertificateManagementServer } from '../../src/behaviors/tlsCertificateManagementServer.js';
import { MAX_TLS_ENDPOINT_ID, MatterbridgeTlsClientManagementServer } from '../../src/behaviors/tlsClientManagementServer.js';
import { createCertificate } from './tlsTestUtils.js';

await setupTest(NAME);

/** The accessing fabric of the first controller. */
const FABRIC_1 = FabricIndex(1);

/** The accessing fabric of the second controller. */
const FABRIC_2 = FabricIndex(2);

/** A valid TLS endpoint hostname. */
const HOSTNAME = Buffer.from('camera.example.com');

/**
 * Runs an action on a behavior of the server the way matter.js invokes a command: the behavior state is locked
 * before the action runs, so its synchronous state writes do not fail.
 *
 * @param {MatterbridgeTlsCertificateManagementServer | MatterbridgeTlsClientManagementServer} type - The behavior type.
 * @param {(behavior: B) => T} action - The action to run.
 * @param {FabricIndex | null} fabric - The accessing fabric of the action, null for a local actor without fabric.
 * @returns {Promise<Awaited<T>>} The result of the action.
 */
async function withBehavior<B extends MatterbridgeTlsCertificateManagementServer | MatterbridgeTlsClientManagementServer, T>(
  type: new (...args: never[]) => B,
  action: (behavior: B) => T,
  fabric: FabricIndex | null,
): Promise<Awaited<T>> {
  return await server.act(async (agent) => {
    const behavior = agent.get(type as unknown as typeof MatterbridgeTlsClientManagementServer) as unknown as B;
    // Pre-warm the state with the real context, then lock it as matter.js does before invoking a command
    void behavior.state;
    const transaction = agent.context.transaction;
    await transaction.addResources(behavior);
    await transaction.begin();
    // A local actor has no accessing fabric: give it one to test the fabric scoped commands
    if (fabric !== null) {
      const context = new Proxy(agent.context, { get: (target, key): unknown => (key === 'fabric' ? fabric : Reflect.get(target, key, target)) });
      Object.defineProperty(behavior, 'context', { configurable: true, value: context });
    }
    try {
      return await action(behavior);
    } finally {
      delete (behavior as unknown as Record<string, unknown>).context;
    }
  });
}

/**
 * Runs an action on the TLS Client Management server with an accessing fabric.
 *
 * @param {(tls: MatterbridgeTlsClientManagementServer) => T} action - The action to run.
 * @param {FabricIndex | null} [fabric] - The accessing fabric, FABRIC_1 by default, null for none.
 * @returns {Promise<Awaited<T>>} The result of the action.
 */
async function withClient<T>(action: (tls: MatterbridgeTlsClientManagementServer) => T, fabric: FabricIndex | null = FABRIC_1): Promise<Awaited<T>> {
  return await withBehavior(MatterbridgeTlsClientManagementServer, action, fabric);
}

/** A TLS endpoint as a plain object. */
type TlsEndpoint = { [K in keyof TlsClientManagement.TlsEndpoint]: TlsClientManagement.TlsEndpoint[K] };

/**
 * Returns a plain copy of the ProvisionedEndpoints attribute, so the assertions do not keep references to the
 * matter.js managed state (the diff of a failed assertion would read them after the state changed).
 *
 * @returns {TlsEndpoint[]} The provisioned TLS endpoints.
 */
function provisionedEndpoints(): TlsEndpoint[] {
  return server.stateOf(MatterbridgeTlsClientManagementServer).provisionedEndpoints.map((endpoint) => ({
    endpointId: endpoint.endpointId,
    hostname: endpoint.hostname,
    port: endpoint.port,
    caid: endpoint.caid,
    ccdid: endpoint.ccdid,
    referenceCount: endpoint.referenceCount,
    fabricIndex: endpoint.fabricIndex,
  }));
}

/**
 * Builds a ProvisionEndpoint request.
 *
 * @param {Partial<TlsClientManagement.ProvisionEndpointRequest>} request - The fields that differ from the defaults.
 * @returns {TlsClientManagement.ProvisionEndpointRequest} The request.
 */
function provisionRequest(request: Partial<TlsClientManagement.ProvisionEndpointRequest>): TlsClientManagement.ProvisionEndpointRequest {
  return { hostname: HOSTNAME, port: 443, caid: 0, ccdid: null, endpointId: null, ...request };
}

describe('MatterbridgeTlsClientManagementServer', () => {
  /** The CAID and CCDID of each fabric. */
  const certificates = { caid: [0, 0], ccdid: [0, 0] };

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node acting as the Root Node
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();

    // Time Synchronization of the Root Node of a Camera
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
      timeZoneDatabase: TimeSynchronization.TimeZoneDatabase.None,
      timeZoneListMaxSize: 2,
      dstOffsetListMaxSize: 2,
    });
    server.behaviors.require(MatterbridgeTlsCertificateManagementServer, {
      maxRootCertificates: 5,
      provisionedRootCertificates: [],
      maxClientCertificates: 5,
      provisionedClientCertificates: [],
    });
    server.behaviors.require(MatterbridgeTlsClientManagementServer, { maxProvisioned: 5, provisionedEndpoints: [] });
    await server.act(async (agent) => {
      await agent.load(MatterbridgeTimeSynchronizationServer);
      await agent.load(MatterbridgeTlsCertificateManagementServer);
      await agent.load(MatterbridgeTlsClientManagementServer);
    });

    // A root certificate and a client certificate on each fabric
    for (const [index, fabric] of [FABRIC_1, FABRIC_2].entries()) {
      certificates.caid[index] = (
        await withBehavior(MatterbridgeTlsCertificateManagementServer, (tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }), fabric)
      ).caid;
      certificates.ccdid[index] = (await withBehavior(MatterbridgeTlsCertificateManagementServer, (tls) => tls.clientCsr({ nonce: randomBytes(32), ccdid: null }), fabric)).ccdid;
    }
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
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

  it('should persist the TLS endpoint ID allocator without exposing it as an attribute', () => {
    const supervisor = (MatterbridgeTlsClientManagementServer as unknown as { supervisor: { persistentKeys(): Set<string>; attributeKeys(): Set<string> } }).supervisor;
    expect(supervisor.persistentKeys().has('nextEndpointId')).toBe(true);
    expect(supervisor.persistentKeys().has('provisionedEndpoints')).toBe(true);
    expect(supervisor.attributeKeys().has('nextEndpointId')).toBe(false);
  });

  it('should fail every command with UnsupportedAccess when there is no accessing fabric', async () => {
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({})), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    await expect(withClient((tls) => tls.findEndpoint({ endpointId: 0 }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    await expect(withClient((tls) => tls.removeEndpoint({ endpointId: 0 }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
  });

  it('should fail ProvisionEndpoint with InvalidTime before time synchronization', async () => {
    // Stop the host clock refresh and clear the UTC time, as before the first time synchronization
    await server.act((agent) => {
      agent.get(MatterbridgeTimeSynchronizationServer).internal.clockTimer?.stop();
    });
    await server.setStateOf(MatterbridgeTimeSynchronizationServer, { utcTime: null, granularity: TimeSynchronization.Granularity.NoTimeGranularity });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[0] })))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: TlsClientManagement.StatusCode.InvalidTime,
    });
    // Matter 1.6.1 § 14.4.6.1: ProvisionRootCertificate fails with InvalidInState before time synchronization
    await expect(
      withBehavior(MatterbridgeTlsCertificateManagementServer, (tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }), FABRIC_1),
    ).rejects.toMatchObject({ code: Status.InvalidInState });
    await server.setStateOf(MatterbridgeTimeSynchronizationServer, { utcTime: BigInt(Date.now()) * 1000n, granularity: TimeSynchronization.Granularity.MillisecondsGranularity });
  });

  it('should provision, update, find and remove a TLS endpoint (TC-TLSCLIENT-3.1, 3.10, 3.20)', async () => {
    const [caid] = certificates.caid;
    const [ccdid] = certificates.ccdid;
    expect(await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, ccdid })))).toEqual({ endpointId: 0 });
    const endpoint = { endpointId: 0, hostname: HOSTNAME, port: 443, caid, ccdid, referenceCount: 0, fabricIndex: FABRIC_1 };
    expect(provisionedEndpoints()).toEqual([endpoint]);
    expect(await withClient((tls) => tls.findEndpoint({ endpointId: 0 }))).toEqual({ endpoint });

    // Update the port and drop the client certificate: the EndpointID and the ReferenceCount are kept
    expect(await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, port: 8443, endpointId: 0 })))).toEqual({ endpointId: 0 });
    expect(await withClient((tls) => tls.findEndpoint({ endpointId: 0 }))).toEqual({ endpoint: { ...endpoint, port: 8443, ccdid: null } });

    // FindEndpoint
    await expect(withClient((tls) => tls.findEndpoint({ endpointId: 1 }))).rejects.toMatchObject({ code: Status.NotFound });
    await expect(withClient((tls) => tls.findEndpoint({ endpointId: 0 }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    await expect(withClient((tls) => tls.findEndpoint({ endpointId: MAX_TLS_ENDPOINT_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });

    // RemoveEndpoint
    await expect(withClient((tls) => tls.removeEndpoint({ endpointId: MAX_TLS_ENDPOINT_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });
    await expect(withClient((tls) => tls.removeEndpoint({ endpointId: 0 }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    await withClient((tls) => tls.removeEndpoint({ endpointId: 0 }));
    await expect(withClient((tls) => tls.removeEndpoint({ endpointId: 0 }))).rejects.toMatchObject({ code: Status.NotFound });
    expect(provisionedEndpoints()).toEqual([]);
  });

  it('should limit the TLS endpoints of a fabric to MaxProvisioned (TC-TLSCLIENT-3.2)', async () => {
    const endpointIds: number[] = [];
    for (let port = 1; port <= 5; port++) {
      endpointIds.push((await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[0], port })))).endpointId);
    }
    // EndpointIDs are not reused right after a removal: they continue from the last one allocated
    expect(endpointIds).toEqual([1, 2, 3, 4, 5]);
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[0], port: 6 })))).rejects.toMatchObject({ code: Status.ResourceExhausted });
    // Matter 1.6.1 § 14.5.7.1: for a null EndpointID, ResourceExhausted comes before EndpointAlreadyInstalled
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[0], port: 1 })))).rejects.toMatchObject({ code: Status.ResourceExhausted });
    // The limit is per fabric, the EndpointIDs are unique on the node
    expect(await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[1], port: 6 })), FABRIC_2)).toEqual({ endpointId: 6 });
    for (const endpointId of endpointIds) await withClient((tls) => tls.removeEndpoint({ endpointId }));
    await withClient((tls) => tls.removeEndpoint({ endpointId: 6 }), FABRIC_2);
  });

  it('should reject bad ProvisionEndpoint arguments (TC-TLSCLIENT-3.3)', async () => {
    const [caid, otherCaid] = certificates.caid;
    const [ccdid, otherCcdid] = certificates.ccdid;
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, hostname: Buffer.from('a.b') })))).rejects.toMatchObject({ code: Status.ConstraintError });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, hostname: Buffer.alloc(254, 0x61) })))).rejects.toMatchObject({ code: Status.ConstraintError });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, port: 0 })))).rejects.toMatchObject({ code: Status.ConstraintError });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: MAX_TLS_ENDPOINT_ID + 1 })))).rejects.toMatchObject({ code: Status.ConstraintError });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, ccdid: MAX_TLS_ENDPOINT_ID + 1 })))).rejects.toMatchObject({ code: Status.ConstraintError });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, endpointId: MAX_TLS_ENDPOINT_ID + 1 })))).rejects.toMatchObject({
      code: Status.ConstraintError,
    });

    // The certificates of another fabric are not found
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: otherCaid })))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: TlsClientManagement.StatusCode.RootCertificateNotFound,
    });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, ccdid: otherCcdid })))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: TlsClientManagement.StatusCode.ClientCertificateNotFound,
    });

    // The same Hostname and Port of another TLS endpoint of the fabric is EndpointAlreadyInstalled
    const { endpointId } = await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, ccdid })));
    const other = await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, port: 8443 })));
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid })))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: TlsClientManagement.StatusCode.EndpointAlreadyInstalled,
    });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, endpointId: other.endpointId })))).rejects.toMatchObject({
      code: Status.Failure,
      clusterCode: TlsClientManagement.StatusCode.EndpointAlreadyInstalled,
    });
    // Another fabric can provision the same Hostname and Port
    const third = await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: otherCaid })), FABRIC_2);

    // Matter 1.6.1 § 14.5.7.1: for a non-null EndpointID, NotFound comes before EndpointAlreadyInstalled
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, endpointId: MAX_TLS_ENDPOINT_ID })))).rejects.toMatchObject({ code: Status.NotFound });

    // Updating an unknown EndpointID, or the EndpointID of another fabric, is NotFound
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid, port: 9443, endpointId: MAX_TLS_ENDPOINT_ID })))).rejects.toMatchObject({
      code: Status.NotFound,
    });
    await expect(withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: otherCaid, port: 9443, endpointId })), FABRIC_2)).rejects.toMatchObject({
      code: Status.NotFound,
    });

    await withClient((tls) => tls.removeEndpoint({ endpointId }));
    await withClient((tls) => tls.removeEndpoint({ endpointId: other.endpointId }));
    await withClient((tls) => tls.removeEndpoint({ endpointId: third.endpointId }), FABRIC_2);
  });

  it('should not remove a TLS endpoint in use', async () => {
    // A TLS endpoint of another fabric, left unchanged by the update below
    await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[1] })), FABRIC_2);
    const { endpointId } = await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[0] })));
    // A cluster using the TLS endpoint increments its ReferenceCount
    const endpoints = provisionedEndpoints();
    await server.setStateOf(MatterbridgeTlsClientManagementServer, { provisionedEndpoints: endpoints.map((endpoint) => ({ ...endpoint, referenceCount: 1 })) });
    await expect(withClient((tls) => tls.removeEndpoint({ endpointId }))).rejects.toMatchObject({ code: Status.InvalidInState });

    // An update keeps the ReferenceCount
    await withClient((tls) => tls.provisionEndpoint(provisionRequest({ caid: certificates.caid[0], port: 8443, endpointId })));
    expect((await withClient((tls) => tls.findEndpoint({ endpointId }))).endpoint.referenceCount).toBe(1);
    expect(provisionedEndpoints().map((endpoint) => [endpoint.fabricIndex, endpoint.port])).toEqual([
      [FABRIC_2, 443],
      [FABRIC_1, 8443],
    ]);

    await server.setStateOf(MatterbridgeTlsClientManagementServer, { provisionedEndpoints: [] });
  });
});
