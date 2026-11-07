/**
 * @file packages/core/buntest/behaviors/tlsCertificateManagementServer.test.ts
 * @description This file contains the bun tests for the MatterbridgeTlsCertificateManagementServer class.
 * @author Luca Liguori
 */

const NAME = 'TlsCertificateManagementServer';
const MATTER_PORT = 8037;

import { afterEach, beforeAll, describe, expect, test, vi } from 'bun:test';
import { generateKeyPairSync, randomBytes } from 'node:crypto';

import { OperationalCredentialsServer } from '@matter/node/behaviors/operational-credentials';
import { FabricManager, Val } from '@matter/protocol';
import { StatusResponseError } from '@matter/types/common';
import { FabricIndex } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { server } from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import {
  allocateId,
  certificateFingerprint,
  createClientCsr,
  MAX_TLS_CERTIFICATE_ID,
  MatterbridgeTlsCertificateManagementServer,
  parseValidCertificate,
  publicKeyPoint,
} from '../../src/behaviors/tlsCertificateManagementServer.js';
import { MatterbridgeTlsClientManagementServer } from '../../src/behaviors/tlsClientManagementServer.js';
import { useServerNode } from '../bunUtils.js';
import { createCertificate, DAY_MS, decodeCsr, der, ECDSA_WITH_SHA256, verifyNonceSignature } from './tlsTestUtils.js';

await setupTest(NAME);

/** The accessing fabric of the first controller. */
const FABRIC_1 = FabricIndex(1);

/** The accessing fabric of the second controller. */
const FABRIC_2 = FabricIndex(2);

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
    const behavior = agent.get(type as unknown as typeof MatterbridgeTlsCertificateManagementServer) as unknown as B;
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
 * Runs an action on the TLS Certificate Management server with an accessing fabric.
 *
 * @param {(tls: MatterbridgeTlsCertificateManagementServer) => T} action - The action to run.
 * @param {FabricIndex | null} [fabric] - The accessing fabric, FABRIC_1 by default, null for none.
 * @returns {Promise<Awaited<T>>} The result of the action.
 */
async function withCertificates<T>(action: (tls: MatterbridgeTlsCertificateManagementServer) => T, fabric: FabricIndex | null = FABRIC_1): Promise<Awaited<T>> {
  return await withBehavior(MatterbridgeTlsCertificateManagementServer, action, fabric);
}

/**
 * Emits a change of the OperationalCredentials fabrics, as on a fabric removal, and waits for the TLS Certificate
 * Management server reaction, which runs in its own transaction.
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
 * Returns a plain copy of the TLS Certificate Management server state, so the assertions do not keep references to the
 * matter.js managed state (the diff of a failed assertion would read them after the state changed).
 *
 * @returns {{ provisionedRootCertificates: object[]; provisionedClientCertificates: object[]; rootCertificateStore: object[]; clientCertificateStore: object[] }} The state lists.
 */
function certificateState(): {
  provisionedRootCertificates: { caid: number; fabricIndex: FabricIndex }[];
  provisionedClientCertificates: { ccdid: number; fabricIndex: FabricIndex }[];
  rootCertificateStore: { caid: number; fabric: number }[];
  clientCertificateStore: { ccdid: number; fabric: number }[];
} {
  const state = server.stateOf(MatterbridgeTlsCertificateManagementServer);
  return {
    provisionedRootCertificates: state.provisionedRootCertificates.map(({ caid, fabricIndex }) => ({ caid, fabricIndex })),
    provisionedClientCertificates: state.provisionedClientCertificates.map(({ ccdid, fabricIndex }) => ({ ccdid, fabricIndex })),
    rootCertificateStore: state.rootCertificateStore.map(({ caid, fabric }) => ({ caid, fabric })),
    clientCertificateStore: state.clientCertificateStore.map(({ ccdid, fabric }) => ({ ccdid, fabric })),
  };
}

/**
 * Generates a random ClientCSR nonce.
 *
 * @returns {Buffer} 32 random octets.
 */
function nonce(): Buffer {
  return randomBytes(32);
}

describe('TLS Certificate Management helpers', () => {
  test('should return the public key of a P-256 private key as an uncompressed point', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const point = publicKeyPoint(privateKey.export({ type: 'pkcs8', format: 'der' }));
    const { x, y } = privateKey.export({ format: 'jwk' });
    expect(point.equals(Buffer.concat([Buffer.from([0x04]), Buffer.from(x ?? '', 'base64url'), Buffer.from(y ?? '', 'base64url')]))).toBe(true);
  });

  test('should parse a valid DER encoded certificate', () => {
    const certificate = createCertificate();
    expect(parseValidCertificate(certificate)?.raw.equals(certificate)).toBe(true);
  });

  test('should reject a certificate that is not a DER encoding', () => {
    expect(parseValidCertificate(Buffer.from('not a certificate'))).toBeUndefined();
    const pem = `-----BEGIN CERTIFICATE-----\n${createCertificate().toString('base64')}\n-----END CERTIFICATE-----\n`;
    expect(parseValidCertificate(Buffer.from(pem, 'ascii'))).toBeUndefined();
  });

  test('should reject a certificate that is not valid at the current time', () => {
    expect(parseValidCertificate(createCertificate({ notBefore: Date.now() - 2 * DAY_MS, notAfter: Date.now() - DAY_MS }))).toBeUndefined();
    expect(parseValidCertificate(createCertificate({ notBefore: Date.now() + DAY_MS, notAfter: Date.now() + 2 * DAY_MS }))).toBeUndefined();
  });

  test('should compute the SHA-256 fingerprint of a certificate', () => {
    expect(certificateFingerprint(Buffer.from('abc')).toString('hex')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('should create a PKCS #10 CSR signed with ecdsa-with-SHA256', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const csr = decodeCsr(createClientCsr(privateKey.export({ type: 'pkcs8', format: 'der' })));
    expect(csr.signatureAlgorithm.equals(ECDSA_WITH_SHA256)).toBe(true);
    expect(csr.signatureValid).toBe(true);
    expect(csr.publicKey.export({ type: 'spki', format: 'der' }).equals(publicKey.export({ type: 'spki', format: 'der' }))).toBe(true);
  });

  test('should allocate IDs incrementally, wrapping and skipping the IDs in use', () => {
    expect(allocateId(new Set(), 0)).toBe(0);
    expect(allocateId(new Set([3, 4]), 3)).toBe(5);
    expect(allocateId(new Set([MAX_TLS_CERTIFICATE_ID]), MAX_TLS_CERTIFICATE_ID)).toBe(0);
    const all = new Set(Array.from({ length: MAX_TLS_CERTIFICATE_ID + 1 }, (_, id) => id));
    expect(() => allocateId(all, 0)).toThrow(StatusResponseError);
  });

  test('should encode DER lengths in the long form', () => {
    expect(der(0x04, Buffer.alloc(300)).subarray(0, 4)).toEqual(Buffer.from([0x04, 0x82, 0x01, 0x2c]));
  });
});

describe('MatterbridgeTlsCertificateManagementServer', () => {
  useServerNode(MATTER_PORT);

  beforeAll(async () => {
    // The TLS Client Management server is added later, to test the TLS Certificate Management server without it first
    server.behaviors.require(MatterbridgeTlsCertificateManagementServer, {
      maxRootCertificates: 5,
      provisionedRootCertificates: [],
      maxClientCertificates: 2,
      provisionedClientCertificates: [],
    });
    await server.act(async (agent) => {
      await agent.load(MatterbridgeTlsCertificateManagementServer);
    });
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  test('should persist the certificate store without exposing it as attributes', () => {
    const supervisor = (MatterbridgeTlsCertificateManagementServer as unknown as { supervisor: { persistentKeys(): Set<string>; attributeKeys(): Set<string> } }).supervisor;
    const persistent = supervisor.persistentKeys();
    for (const key of ['rootCertificateStore', 'clientCertificateStore', 'nextCaid', 'nextCcdid', 'provisionedRootCertificates', 'provisionedClientCertificates']) {
      expect(persistent.has(key)).toBe(true);
    }
    const attributes = supervisor.attributeKeys();
    expect(attributes.has('rootCertificateStore')).toBe(false);
    expect(attributes.has('clientCertificateStore')).toBe(false);
    const state = certificateState();
    expect(state.provisionedRootCertificates).toEqual([]);
    expect(state.provisionedClientCertificates).toEqual([]);
  });

  test('should fail every command with UnsupportedAccess when there is no accessing fabric', async () => {
    const certificate = createCertificate();
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate, caid: null }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    expect(withCertificates((tls) => tls.findRootCertificate({ caid: null }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    expect(withCertificates((tls) => tls.lookupRootCertificate({ fingerprint: certificateFingerprint(certificate) }), null)).rejects.toMatchObject({
      code: Status.UnsupportedAccess,
    });
    expect(withCertificates((tls) => tls.removeRootCertificate({ caid: 0 }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    expect(withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    expect(withCertificates((tls) => tls.provisionClientCertificate({ ccdid: 0, clientCertificate: certificate, intermediateCertificates: [] }), null)).rejects.toMatchObject({
      code: Status.UnsupportedAccess,
    });
    expect(withCertificates((tls) => tls.findClientCertificate({ ccdid: null }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
    expect(withCertificates((tls) => tls.lookupClientCertificate({ fingerprint: certificateFingerprint(certificate) }), null)).rejects.toMatchObject({
      code: Status.UnsupportedAccess,
    });
    expect(withCertificates((tls) => tls.removeClientCertificate({ ccdid: 0 }), null)).rejects.toMatchObject({ code: Status.UnsupportedAccess });
  });

  test('should provision, update and find root certificates per fabric (TC-TLSCERT-2.2)', async () => {
    const rootCertificate = [createCertificate(), createCertificate(), createCertificate()];

    // A new root certificate gets the first CAID, listed in the attribute with its fabric
    expect(await withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate[0], caid: null }))).toEqual({ caid: 0 });
    expect(certificateState().provisionedRootCertificates).toEqual([{ caid: 0, fabricIndex: FABRIC_1 }]);

    // The same certificate again is AlreadyExists
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate[0], caid: null }))).rejects.toMatchObject({ code: Status.AlreadyExists });

    // FindRootCertificate returns the certificate payload
    expect(await withCertificates((tls) => tls.findRootCertificate({ caid: null }))).toEqual({
      certificateDetails: [{ caid: 0, certificate: rootCertificate[0], fabricIndex: FABRIC_1 }],
    });

    // Replace the certificate of CAID 0
    expect(await withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate[1], caid: 0 }))).toEqual({ caid: 0 });
    expect(await withCertificates((tls) => tls.findRootCertificate({ caid: 0 }))).toEqual({
      certificateDetails: [{ caid: 0, certificate: rootCertificate[1], fabricIndex: FABRIC_1 }],
    });

    // The second fabric sees nothing and cannot update the CAID of the first fabric
    expect(withCertificates((tls) => tls.findRootCertificate({ caid: null }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate[2], caid: 0 }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });

    // The second fabric gets a CAID unique on the node
    expect(await withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate[2], caid: null }), FABRIC_2)).toEqual({ caid: 1 });
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate[2], caid: 1 }), FABRIC_2)).rejects.toMatchObject({
      code: Status.AlreadyExists,
    });
    expect(certificateState().provisionedRootCertificates).toEqual([
      { caid: 0, fabricIndex: FABRIC_1 },
      { caid: 1, fabricIndex: FABRIC_2 },
    ]);
    expect(await withCertificates((tls) => tls.findRootCertificate({ caid: null }), FABRIC_2)).toEqual({
      certificateDetails: [{ caid: 1, certificate: rootCertificate[2], fabricIndex: FABRIC_2 }],
    });

    // Updating the certificate of a fabric leaves the certificates of the other fabrics unchanged
    const rotated = createCertificate();
    expect(await withCertificates((tls) => tls.provisionRootCertificate({ certificate: rotated, caid: 1 }), FABRIC_2)).toEqual({ caid: 1 });
    expect(await withCertificates((tls) => tls.findRootCertificate({ caid: null }), FABRIC_2)).toEqual({
      certificateDetails: [{ caid: 1, certificate: rotated, fabricIndex: FABRIC_2 }],
    });
    expect(await withCertificates((tls) => tls.findRootCertificate({ caid: null }))).toEqual({
      certificateDetails: [{ caid: 0, certificate: rootCertificate[1], fabricIndex: FABRIC_1 }],
    });

    // Clean up
    await withCertificates((tls) => tls.removeRootCertificate({ caid: 0 }));
    await withCertificates((tls) => tls.removeRootCertificate({ caid: 1 }), FABRIC_2);
    expect(certificateState().provisionedRootCertificates).toEqual([]);
  });

  test('should limit the root certificates of a fabric to MaxRootCertificates (TC-TLSCERT-2.3)', async () => {
    const caids: number[] = [];
    for (let i = 0; i < 5; i++) {
      caids.push((await withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }))).caid);
    }
    // CAIDs are not reused right after a removal: they continue from the last one allocated
    expect(caids).toEqual([2, 3, 4, 5, 6]);
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }))).rejects.toMatchObject({
      code: Status.ResourceExhausted,
    });
    // Matter 1.6.1 § 14.4.6.1: an invalid certificate is DynamicConstraintError before the MaxRootCertificates check
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: randomBytes(100), caid: null }))).rejects.toMatchObject({
      code: Status.DynamicConstraintError,
    });
    // The limit is per fabric
    expect(await withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }), FABRIC_2)).toEqual({ caid: 7 });
    expect((await withCertificates((tls) => tls.findRootCertificate({ caid: null }))).certificateDetails).toHaveLength(5);
    for (const caid of caids) await withCertificates((tls) => tls.removeRootCertificate({ caid }));
    await withCertificates((tls) => tls.removeRootCertificate({ caid: 7 }), FABRIC_2);
  });

  test('should reject bad ProvisionRootCertificate arguments (TC-TLSCERT-2.4)', async () => {
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate({ padding: 3000 }), caid: null }))).rejects.toMatchObject({
      code: Status.ConstraintError,
    });
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: randomBytes(100), caid: null }))).rejects.toMatchObject({
      code: Status.DynamicConstraintError,
    });
    expect(
      withCertificates((tls) =>
        tls.provisionRootCertificate({ certificate: createCertificate({ notBefore: Date.now() - 2 * DAY_MS, notAfter: Date.now() - DAY_MS }), caid: null }),
      ),
    ).rejects.toMatchObject({ code: Status.DynamicConstraintError });
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: 10 }))).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({
      code: Status.ConstraintError,
    });
    // Matter 1.6.1 § 14.4.6.1: the constraints come first, then an invalid certificate is DynamicConstraintError before the CAID lookup
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: randomBytes(100), caid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({
      code: Status.ConstraintError,
    });
    expect(withCertificates((tls) => tls.provisionRootCertificate({ certificate: randomBytes(100), caid: 10 }))).rejects.toMatchObject({
      code: Status.DynamicConstraintError,
    });
    expect(certificateState().provisionedRootCertificates).toEqual([]);
  });

  test('should find, look up and remove root certificates (TC-TLSCERT-2.5, 2.6, 2.7)', async () => {
    const certificate = createCertificate();
    const { caid } = await withCertificates((tls) => tls.provisionRootCertificate({ certificate, caid: null }));

    // FindRootCertificate
    expect(withCertificates((tls) => tls.findRootCertificate({ caid: caid + 1 }))).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.findRootCertificate({ caid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(withCertificates((tls) => tls.findRootCertificate({ caid }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });

    // LookupRootCertificate
    expect(await withCertificates((tls) => tls.lookupRootCertificate({ fingerprint: certificateFingerprint(certificate) }))).toEqual({ caid });
    expect(withCertificates((tls) => tls.lookupRootCertificate({ fingerprint: certificateFingerprint(certificate) }), FABRIC_2)).rejects.toMatchObject({
      code: Status.NotFound,
    });
    expect(withCertificates((tls) => tls.lookupRootCertificate({ fingerprint: new Uint8Array(0) }))).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.lookupRootCertificate({ fingerprint: Buffer.concat([certificateFingerprint(certificate), randomBytes(33)]) }))).rejects.toMatchObject({
      code: Status.ConstraintError,
    });

    // RemoveRootCertificate: without the TLS Client Management cluster no TLS endpoint can use the certificate
    expect(withCertificates((tls) => tls.removeRootCertificate({ caid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(withCertificates((tls) => tls.removeRootCertificate({ caid }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    await withCertificates((tls) => tls.removeRootCertificate({ caid }));
    expect(withCertificates((tls) => tls.removeRootCertificate({ caid }))).rejects.toMatchObject({ code: Status.NotFound });
  });

  test('should generate client CSRs and limit them to MaxClientCertificates (TC-TLSCERT-2.8)', async () => {
    expect(withCertificates((tls) => tls.clientCsr({ nonce: randomBytes(33), ccdid: null }))).rejects.toMatchObject({ code: Status.ConstraintError });

    const myNonce = [nonce(), nonce(), nonce()];
    const response = await withCertificates((tls) => tls.clientCsr({ nonce: myNonce[0], ccdid: null }));
    expect(response.ccdid).toBe(0);
    const csr = decodeCsr(response.csr);
    expect(csr.signatureAlgorithm.equals(ECDSA_WITH_SHA256)).toBe(true);
    expect(csr.signatureValid).toBe(true);
    expect(csr.publicKey.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
    expect(response.nonceSignature).toHaveLength(64);
    expect(verifyNonceSignature(csr.publicKey, myNonce[0], response.nonceSignature)).toBe(true);

    // The pending client certificate is in the attribute, the details have a null certificate
    expect(certificateState().provisionedClientCertificates).toEqual([{ ccdid: 0, fabricIndex: FABRIC_1 }]);
    expect(await withCertificates((tls) => tls.findClientCertificate({ ccdid: 0 }))).toEqual({
      certificateDetails: [{ ccdid: 0, clientCertificate: null, intermediateCertificates: [], fabricIndex: FABRIC_1 }],
    });

    // MaxClientCertificates is 2 per fabric
    expect((await withCertificates((tls) => tls.clientCsr({ nonce: myNonce[1], ccdid: null }))).ccdid).toBe(1);
    expect(withCertificates((tls) => tls.clientCsr({ nonce: myNonce[2], ccdid: null }))).rejects.toMatchObject({ code: Status.ResourceExhausted });
    expect((await withCertificates((tls) => tls.clientCsr({ nonce: myNonce[2], ccdid: null }), FABRIC_2)).ccdid).toBe(2);

    // A CSR for an existing CCDID reuses its key pair, for the certificate rotation
    const rotation = await withCertificates((tls) => tls.clientCsr({ nonce: myNonce[2], ccdid: 0 }));
    expect(rotation.ccdid).toBe(0);
    expect(
      decodeCsr(rotation.csr)
        .publicKey.export({ type: 'spki', format: 'der' })
        .equals(csr.publicKey.export({ type: 'spki', format: 'der' })),
    ).toBe(true);
    expect(verifyNonceSignature(csr.publicKey, myNonce[2], rotation.nonceSignature)).toBe(true);
    expect(withCertificates((tls) => tls.clientCsr({ nonce: myNonce[2], ccdid: 0 }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.clientCsr({ nonce: myNonce[2], ccdid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });

    // Clean up
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid: 0 }));
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid: 1 }));
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid: 2 }), FABRIC_2);
    expect(certificateState().clientCertificateStore).toEqual([]);
  });

  test('should reject a ClientCSR key pair colliding with another TLS key pair with DYNAMIC_CONSTRAINT_ERROR', async () => {
    const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'der' });
    const generateClientKey = vi.spyOn(MatterbridgeTlsCertificateManagementServer.prototype, 'generateClientKey').mockReturnValue(key);
    try {
      const { ccdid } = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));
      const nextCcdid = server.stateOf(MatterbridgeTlsCertificateManagementServer).nextCcdid;
      // The same key pair again, on any fabric, is discarded with no other side effects
      expect(await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null })).catch((error: unknown) => error)).toMatchObject({
        code: Status.DynamicConstraintError,
      });
      expect(await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }), FABRIC_2).catch((error: unknown) => error)).toMatchObject({
        code: Status.DynamicConstraintError,
      });
      expect(certificateState().clientCertificateStore).toEqual([{ ccdid, fabric: FABRIC_1 }]);
      expect(server.stateOf(MatterbridgeTlsCertificateManagementServer).nextCcdid).toBe(nextCcdid);
      await withCertificates((tls) => tls.removeClientCertificate({ ccdid }));
    } finally {
      generateClientKey.mockRestore();
    }
    expect(certificateState().clientCertificateStore).toEqual([]);
  });

  test('should reject a ClientCSR key pair colliding with an operational key pair with DYNAMIC_CONSTRAINT_ERROR', async () => {
    const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'der' });
    const generateClientKey = vi.spyOn(MatterbridgeTlsCertificateManagementServer.prototype, 'generateClientKey').mockReturnValue(key);
    // A fabric whose operational public key is the public key of the new key pair
    const fabrics = vi.spyOn(FabricManager.prototype, Symbol.iterator).mockImplementation(() => [{ publicKey: publicKeyPoint(key) }][Symbol.iterator]() as never);
    try {
      expect(await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null })).catch((error: unknown) => error)).toMatchObject({
        code: Status.DynamicConstraintError,
      });
    } finally {
      fabrics.mockRestore();
      generateClientKey.mockRestore();
    }
    expect(certificateState().clientCertificateStore).toEqual([]);
  });

  test('should provision, find, look up and remove client certificates (TC-TLSCERT-2.9, 2.11, 2.12, 2.13)', async () => {
    const { ccdid, csr } = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));
    const { publicKey } = decodeCsr(csr);
    // A pending client certificate of another fabric, left unchanged by the provisioning
    const other = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }), FABRIC_2);
    const intermediateKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    const intermediate = createCertificate({ signerKey: intermediateKey });
    const clientCertificate = createCertificate({ signerKey: intermediateKey, publicKey });

    // A pending client certificate is not found by fingerprint
    expect(withCertificates((tls) => tls.lookupClientCertificate({ fingerprint: certificateFingerprint(clientCertificate) }))).rejects.toMatchObject({
      code: Status.NotFound,
    });

    await withCertificates((tls) => tls.provisionClientCertificate({ ccdid, clientCertificate, intermediateCertificates: [intermediate] }));
    expect(certificateState().provisionedClientCertificates).toEqual([
      { ccdid, fabricIndex: FABRIC_1 },
      { ccdid: other.ccdid, fabricIndex: FABRIC_2 },
    ]);
    expect(await withCertificates((tls) => tls.findClientCertificate({ ccdid: null }))).toEqual({
      certificateDetails: [{ ccdid, clientCertificate, intermediateCertificates: [intermediate], fabricIndex: FABRIC_1 }],
    });

    // The same certificate again is AlreadyExists
    expect(withCertificates((tls) => tls.provisionClientCertificate({ ccdid, clientCertificate, intermediateCertificates: [] }))).rejects.toMatchObject({
      code: Status.AlreadyExists,
    });

    // FindClientCertificate
    expect(withCertificates((tls) => tls.findClientCertificate({ ccdid: ccdid + 1 }))).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.findClientCertificate({ ccdid }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    expect(await withCertificates((tls) => tls.findClientCertificate({ ccdid: null }), FABRIC_2)).toEqual({
      certificateDetails: [{ ccdid: other.ccdid, clientCertificate: null, intermediateCertificates: [], fabricIndex: FABRIC_2 }],
    });
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid: other.ccdid }), FABRIC_2);
    expect(withCertificates((tls) => tls.findClientCertificate({ ccdid: null }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    expect(withCertificates((tls) => tls.findClientCertificate({ ccdid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });

    // LookupClientCertificate
    expect(await withCertificates((tls) => tls.lookupClientCertificate({ fingerprint: certificateFingerprint(clientCertificate) }))).toEqual({ ccdid });
    expect(withCertificates((tls) => tls.lookupClientCertificate({ fingerprint: certificateFingerprint(clientCertificate) }), FABRIC_2)).rejects.toMatchObject({
      code: Status.NotFound,
    });
    expect(withCertificates((tls) => tls.lookupClientCertificate({ fingerprint: randomBytes(65) }))).rejects.toMatchObject({ code: Status.ConstraintError });

    // RemoveClientCertificate removes the certificate and its key pair
    expect(withCertificates((tls) => tls.removeClientCertificate({ ccdid: MAX_TLS_CERTIFICATE_ID + 1 }))).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(withCertificates((tls) => tls.removeClientCertificate({ ccdid }), FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid }));
    expect(withCertificates((tls) => tls.removeClientCertificate({ ccdid }))).rejects.toMatchObject({ code: Status.NotFound });
    expect(certificateState().clientCertificateStore).toEqual([]);
  });

  test('should include the certificate payloads in the attributes only over a Large Message capable transport (TC-TLSCERT-2.2, 2.8, 2.9)', async () => {
    const rootCertificate = createCertificate();
    const { caid } = await withCertificates((tls) => tls.provisionRootCertificate({ certificate: rootCertificate, caid: null }));
    const { ccdid, csr } = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));
    const intermediateKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    const intermediate = createCertificate({ signerKey: intermediateKey });
    const clientCertificate = createCertificate({ signerKey: intermediateKey, publicKey: decodeCsr(csr).publicKey });
    await withCertificates((tls) => tls.provisionClientCertificate({ ccdid, clientCertificate, intermediateCertificates: [intermediate] }));
    // A pending client certificate: null ClientCertificate and empty IntermediateCertificates
    const pending = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));

    // The stored attributes carry the payloads, never the private keys
    const state = server.stateOf(MatterbridgeTlsCertificateManagementServer);
    const rootAttribute = [{ caid, certificate: rootCertificate, fabricIndex: FABRIC_1 }];
    const clientAttribute = [
      { ccdid, clientCertificate, intermediateCertificates: [intermediate], fabricIndex: FABRIC_1 },
      { ccdid: pending.ccdid, clientCertificate: null, intermediateCertificates: [], fabricIndex: FABRIC_1 },
    ];
    expect(state.provisionedRootCertificates.map((entry) => ({ ...entry }))).toEqual(rootAttribute);
    expect(state.provisionedClientCertificates.map((entry) => ({ ...entry, intermediateCertificates: [...(entry.intermediateCertificates ?? [])] }))).toEqual(clientAttribute);

    const raw = Object.assign(new MatterbridgeTlsCertificateManagementServer.State(), {
      provisionedRootCertificates: rootAttribute,
      provisionedClientCertificates: clientAttribute,
    });
    // A local actor and a remote read over a Large Message capable transport get the stored attributes
    expect(raw[Val.properties](undefined, {})).toEqual({});
    expect(raw[Val.properties](undefined, { subject: 1, largeMessage: true })).toEqual({});
    // A remote read over MRP gets the attributes without the certificate payloads, keeping a null ClientCertificate and empty IntermediateCertificates
    const mrp = raw[Val.properties](undefined, { subject: 1, largeMessage: false });
    expect(mrp.provisionedRootCertificates).toEqual([{ caid, fabricIndex: FABRIC_1 }]);
    expect(mrp.provisionedClientCertificates).toEqual([
      { ccdid, fabricIndex: FABRIC_1 },
      { ccdid: pending.ccdid, clientCertificate: null, intermediateCertificates: [], fabricIndex: FABRIC_1 },
    ]);

    // Clean up
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid }));
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid: pending.ccdid }));
    await withCertificates((tls) => tls.removeRootCertificate({ caid }));
    expect(certificateState().provisionedRootCertificates).toEqual([]);
    expect(certificateState().provisionedClientCertificates).toEqual([]);
  });

  test('should reject bad ProvisionClientCertificate arguments (TC-TLSCERT-2.10)', async () => {
    const { ccdid, csr } = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));
    const { publicKey } = decodeCsr(csr);
    const signerKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    const clientCertificate = createCertificate({ signerKey, publicKey });
    const bigCertificate = createCertificate({ signerKey, publicKey, padding: 3000 });
    const badCertificate = randomBytes(100);

    const provision = async (request: { ccdid?: number; clientCertificate?: Uint8Array; intermediateCertificates?: Uint8Array[] }, fabric = FABRIC_1): Promise<void> => {
      await withCertificates((tls) => tls.provisionClientCertificate({ ccdid, clientCertificate, intermediateCertificates: [], ...request }), fabric);
    };
    expect(provision({ ccdid: MAX_TLS_CERTIFICATE_ID + 1 })).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(provision({ clientCertificate: bigCertificate })).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(provision({ intermediateCertificates: [bigCertificate] })).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(provision({ intermediateCertificates: Array.from({ length: 11 }, () => createCertificate()) })).rejects.toMatchObject({ code: Status.ConstraintError });
    expect(provision({ clientCertificate: badCertificate })).rejects.toMatchObject({ code: Status.DynamicConstraintError });
    expect(provision({ clientCertificate: createCertificate() })).rejects.toMatchObject({ code: Status.DynamicConstraintError });
    expect(provision({ intermediateCertificates: [badCertificate] })).rejects.toMatchObject({ code: Status.DynamicConstraintError });
    expect(provision({ ccdid: ccdid + 1 })).rejects.toMatchObject({ code: Status.NotFound });
    expect(provision({}, FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    // Matter 1.6.1 § 14.4.6.10: an unknown CCDID is NotFound before the certificate validity checks
    expect(provision({ ccdid: ccdid + 1, clientCertificate: badCertificate })).rejects.toMatchObject({ code: Status.NotFound });
    expect(provision({ clientCertificate: createCertificate() }, FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });
    expect(provision({ intermediateCertificates: [badCertificate] }, FABRIC_2)).rejects.toMatchObject({ code: Status.NotFound });

    // Up to 10 intermediate certificates are accepted
    const intermediates = Array.from({ length: 10 }, () => createCertificate());
    await provision({ intermediateCertificates: intermediates });
    expect((await withCertificates((tls) => tls.findClientCertificate({ ccdid }))).certificateDetails[0].intermediateCertificates).toEqual(intermediates);
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid }));
  });

  test('should not remove certificates used by a TLS endpoint (TC-TLSCERT-2.7, 2.13)', async () => {
    // Add the TLS Client Management server: the certificates used by its TLS endpoints cannot be removed
    server.behaviors.require(MatterbridgeTlsClientManagementServer, { maxProvisioned: 5, provisionedEndpoints: [] });
    await server.act(async (agent) => {
      await agent.load(MatterbridgeTlsClientManagementServer);
    });

    const { caid } = await withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }));
    const { ccdid } = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));
    const { endpointId } = await withBehavior(
      MatterbridgeTlsClientManagementServer,
      (tls) => tls.provisionEndpoint({ hostname: Buffer.from('camera.example.com'), port: 443, caid, ccdid, endpointId: null }),
      FABRIC_1,
    );

    expect(withCertificates((tls) => tls.removeRootCertificate({ caid }))).rejects.toMatchObject({ code: Status.InvalidInState });
    expect(withCertificates((tls) => tls.removeClientCertificate({ ccdid }))).rejects.toMatchObject({ code: Status.InvalidInState });

    // Once the TLS endpoint is removed the certificates can be removed
    await withBehavior(MatterbridgeTlsClientManagementServer, (tls) => tls.removeEndpoint({ endpointId }), FABRIC_1);
    await withCertificates((tls) => tls.removeRootCertificate({ caid }));
    await withCertificates((tls) => tls.removeClientCertificate({ ccdid }));
  });

  test('should delete the certificates of a removed fabric', async () => {
    await withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }));
    await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }));
    const root2 = await withCertificates((tls) => tls.provisionRootCertificate({ certificate: createCertificate(), caid: null }), FABRIC_2);
    const client2 = await withCertificates((tls) => tls.clientCsr({ nonce: nonce(), ccdid: null }), FABRIC_2);

    // Removing fabric 1 keeps the certificates of fabric 2
    await emitFabrics([FABRIC_2]);
    const state = certificateState();
    expect(state.provisionedRootCertificates).toEqual([{ caid: root2.caid, fabricIndex: FABRIC_2 }]);
    expect(state.provisionedClientCertificates).toEqual([{ ccdid: client2.ccdid, fabricIndex: FABRIC_2 }]);
    expect(state.rootCertificateStore.map((entry) => entry.fabric)).toEqual([2]);
    expect(state.clientCertificateStore.map((entry) => entry.fabric)).toEqual([2]);

    // A change that removes no fabric with certificates changes nothing
    await emitFabrics([FABRIC_1, FABRIC_2]);
    expect(certificateState().rootCertificateStore).toHaveLength(1);

    await emitFabrics([]);
    expect(certificateState().provisionedRootCertificates).toEqual([]);
    expect(certificateState().provisionedClientCertificates).toEqual([]);
  });
});
