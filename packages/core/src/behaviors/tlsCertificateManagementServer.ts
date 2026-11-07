/**
 * @file packages/core/src/behaviors/tlsCertificateManagementServer.ts
 * @description This file contains the MatterbridgeTlsCertificateManagementServer class, a TLS Certificate Management cluster server.
 * @author Luca Liguori
 * @created 2026-10-21
 * @version 2.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, X509Certificate } from 'node:crypto';

import { Bytes, Time } from '@matter/general';
import { AttributeModel, FieldElement } from '@matter/main/model';
import { Node } from '@matter/node';
import { OperationalCredentialsServer } from '@matter/node/behaviors/operational-credentials';
import { TimeSynchronizationServer } from '@matter/node/behaviors/time-synchronization';
import { TlsCertificateManagementServer } from '@matter/node/behaviors/tls-certificate-management';
import { TlsClientManagementServer } from '@matter/node/behaviors/tls-client-management';
import { FabricManager, Val } from '@matter/protocol';
import type { OperationalCredentials } from '@matter/types/clusters/operational-credentials';
import { TlsCertificateManagement } from '@matter/types/clusters/tls-certificate-management';
import { StatusResponseError } from '@matter/types/common';
import { FabricIndex } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

/** Largest TLSCAID and TLSCCDID value (Matter 1.6.1 TLS Certificate Management data types). */
export const MAX_TLS_CERTIFICATE_ID = 65534;

/** Largest DER encoded certificate accepted, in octets. */
export const MAX_CERTIFICATE_BYTES = 3000;

/** Largest certificate fingerprint accepted by LookupRootCertificate and LookupClientCertificate, in octets. */
export const MAX_FINGERPRINT_BYTES = 64;

/** Length of the ClientCSR Nonce, in octets. */
export const CLIENT_CSR_NONCE_BYTES = 32;

/** Largest number of intermediate certificates of a client certificate. */
export const MAX_INTERMEDIATE_CERTIFICATES = 10;

/** DER encoded OID 2.5.4.3 (id-at-commonName). */
const OID_COMMON_NAME = Buffer.from([0x06, 0x03, 0x55, 0x04, 0x03]);

/** DER encoded OID 1.2.840.10045.4.3.2 (ecdsa-with-SHA256). */
const OID_ECDSA_WITH_SHA256 = Buffer.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]);

/** Common name of the subject of the client CSRs. */
const CSR_COMMON_NAME = 'Matterbridge TLS Client';

/** Module logger for the TLS Certificate Management server. */
const log = new AnsiLogger({ logName: 'TlsCertificates', logLevel: LogLevel.INFO, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });

/**
 * Encodes a DER element: the tag, the definite length and the content.
 *
 * @param {number} tag - The DER tag octet.
 * @param {Buffer} content - The content octets.
 * @returns {Buffer} The DER element.
 */
function der(tag: number, content: Buffer): Buffer {
  const { length } = content;
  if (length < 0x80) return Buffer.concat([Buffer.from([tag, length]), content]);
  // Long form: 0x80 plus the number of length octets, then the length big endian (at most 2 octets here, as content is < 64 KiB).
  const lengthBytes: number[] = [];
  for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / 256)) lengthBytes.unshift(remaining % 256);
  return Buffer.concat([Buffer.from([tag, 0x80 + lengthBytes.length, ...lengthBytes]), content]);
}

/**
 * Creates a PKCS #10 (RFC 2986) DER encoded certificate signing request for a P-256 key pair, signed with
 * ecdsa-with-SHA256 by the private key of the pair.
 *
 * @param {Uint8Array} privateKey - The PKCS #8 DER encoded P-256 private key.
 * @returns {Buffer} The DER encoded CSR.
 */
export function createClientCsr(privateKey: Uint8Array): Buffer {
  const key = createPrivateKey({ key: Buffer.from(privateKey), format: 'der', type: 'pkcs8' });
  const publicKeyInfo = createPublicKey(key).export({ type: 'spki', format: 'der' });
  const subject = der(0x30, der(0x31, der(0x30, Buffer.concat([OID_COMMON_NAME, der(0x0c, Buffer.from(CSR_COMMON_NAME, 'utf8'))]))));
  // CertificationRequestInfo: version 0, subject, subjectPKInfo and an empty [0] attributes set.
  const requestInfo = der(0x30, Buffer.concat([der(0x02, Buffer.from([0x00])), subject, publicKeyInfo, Buffer.from([0xa0, 0x00])]));
  const signature = sign('sha256', requestInfo, key);
  return der(0x30, Buffer.concat([requestInfo, der(0x30, OID_ECDSA_WITH_SHA256), der(0x03, Buffer.concat([Buffer.from([0x00]), signature]))]));
}

/**
 * Signs a ClientCSR Nonce with ECDSA over SHA-256, returning the raw r || s signature (64 octets for P-256).
 *
 * @param {Uint8Array} privateKey - The PKCS #8 DER encoded P-256 private key.
 * @param {Uint8Array} nonce - The nonce to sign.
 * @returns {Buffer} The raw ECDSA signature.
 */
export function signClientCsrNonce(privateKey: Uint8Array, nonce: Uint8Array): Buffer {
  const key = createPrivateKey({ key: Buffer.from(privateKey), format: 'der', type: 'pkcs8' });
  return sign('sha256', nonce, { key, dsaEncoding: 'ieee-p1363' });
}

/**
 * Returns the public key of a P-256 private key as an uncompressed point (0x04 || X || Y, 65 octets), the format of
 * the Matter operational public keys.
 *
 * @param {Uint8Array} privateKey - The PKCS #8 DER encoded P-256 private key.
 * @returns {Buffer} The uncompressed public key point.
 */
export function publicKeyPoint(privateKey: Uint8Array): Buffer {
  const spki = createPublicKey(createPrivateKey({ key: Buffer.from(privateKey), format: 'der', type: 'pkcs8' })).export({ type: 'spki', format: 'der' });
  // The P-256 SubjectPublicKeyInfo ends with the 65 octets of the uncompressed point.
  return spki.subarray(spki.length - 65);
}

/**
 * Returns the SHA-256 fingerprint of a DER encoded certificate.
 *
 * @param {Uint8Array} certificate - The DER encoded certificate.
 * @returns {Buffer} The 32 octets fingerprint.
 */
export function certificateFingerprint(certificate: Uint8Array): Buffer {
  return createHash('sha256').update(certificate).digest();
}

/**
 * Parses a DER encoded X.509 certificate and checks that it is valid at the current time.
 *
 * @param {Uint8Array} certificate - The certificate octets.
 * @returns {X509Certificate | undefined} The parsed certificate, undefined if it is not a strict DER encoding of an
 * X.509 certificate or it is not valid at the current time.
 */
export function parseValidCertificate(certificate: Uint8Array): X509Certificate | undefined {
  let x509: X509Certificate;
  try {
    x509 = new X509Certificate(Buffer.from(certificate));
  } catch {
    return undefined;
  }
  // X509Certificate also accepts PEM: the certificate octets must be the DER encoding itself.
  if (!x509.raw.equals(Buffer.from(certificate))) return undefined;
  const now = Time.nowMs;
  if (now < Date.parse(x509.validFrom) || now > Date.parse(x509.validTo)) return undefined;
  return x509;
}

/**
 * Allocates a new ID, unique on the node across all fabrics. IDs are allocated incrementally from `next`, wrapping
 * after {@link MAX_TLS_CERTIFICATE_ID}, so a removed ID is not immediately reused. Used for the TLSCAID, the TLSCCDID
 * and the TLSEndpointID.
 *
 * @param {Set<number>} used - The IDs in use.
 * @param {number} next - The next ID to try.
 * @returns {number} The allocated ID.
 * @throws {StatusResponseError} ResourceExhausted if all the IDs are in use. The per fabric limits (at most 254 per
 * fabric) and the number of fabrics make it unreachable from the commands, but the allocator does not rely on it.
 */
export function allocateId(used: Set<number>, next: number): number {
  for (let i = 0; i <= MAX_TLS_CERTIFICATE_ID; i++) {
    const id = (next + i) % (MAX_TLS_CERTIFICATE_ID + 1);
    if (!used.has(id)) return id;
  }
  throw new StatusResponseError('No ID available', Status.ResourceExhausted);
}

/** The TLS Certificate Management cluster schema of matter.js. */
const { schema } = TlsCertificateManagement;

/**
 * The cluster schema with:
 * - The persistent certificate store, kept in nonvolatile fields of the behavior state that are not cluster
 *   attributes: the private keys never appear in the attributes (see the class remarks).
 * - No constraint on the length of ProvisionedRootCertificates and ProvisionedClientCertificates: MaxRootCertificates
 *   and MaxClientCertificates limit the certificates of each fabric (the fabric filtered view a controller reads),
 *   while matter.js would check the list of all the fabrics. The server enforces the limits per fabric.
 */
const TlsCertificateManagementSchema = schema.extend(
  undefined,
  schema.require(AttributeModel, 'provisionedRootCertificates').extend({ constraint: 'none' }),
  schema.require(AttributeModel, 'provisionedClientCertificates').extend({ constraint: 'none' }),
  FieldElement(
    { name: 'RootCertificateStore', type: 'list', quality: 'N' },
    FieldElement(
      { name: 'entry', type: 'struct' },
      FieldElement({ name: 'Caid', id: 0, type: 'uint16' }),
      FieldElement({ name: 'Fabric', id: 1, type: 'uint8' }),
      FieldElement({ name: 'Certificate', id: 2, type: 'octstr' }),
    ),
  ),
  FieldElement(
    { name: 'ClientCertificateStore', type: 'list', quality: 'N' },
    FieldElement(
      { name: 'entry', type: 'struct' },
      FieldElement({ name: 'Ccdid', id: 0, type: 'uint16' }),
      FieldElement({ name: 'Fabric', id: 1, type: 'uint8' }),
      FieldElement({ name: 'ClientCertificate', id: 2, type: 'octstr', quality: 'X' }),
      FieldElement({ name: 'IntermediateCertificates', id: 3, type: 'list' }, FieldElement({ name: 'entry', type: 'octstr' })),
      FieldElement({ name: 'PrivateKey', id: 4, type: 'octstr' }),
    ),
  ),
  FieldElement({ name: 'NextCaid', type: 'uint16', quality: 'N' }),
  FieldElement({ name: 'NextCcdid', type: 'uint16', quality: 'N' }),
);

/** matter.js base of {@link MatterbridgeTlsCertificateManagementServer}, with the persistent certificate store. */
const MatterbridgeTlsCertificateManagementServerBase = TlsCertificateManagementServer.for(TlsCertificateManagement, TlsCertificateManagementSchema);

/**
 * WARNING: this server MUST be added only to the Root Node (endpoint 0) of the server node, never to a
 * MatterbridgeEndpoint. The TLS Certificate Management cluster has Node scope and is a Root Node singleton (Matter 1.6.1
 * Root Node device type, condition requirements of Camera, Intercom, Audio Doorbell and related device types).
 * As a consequence:
 * - there is NO plugin command handler: its commands have no entry in `CommandHandlers`, are never forwarded with
 *   `executeHandler()` and cannot be handled with `addCommandHandler()`;
 * - there is NO command observable: its commands are never emitted with `emitCommand()` and cannot be observed
 *   with `subscribeCommand()`;
 * - `this.endpoint` is NOT a MatterbridgeEndpoint: there is no `MatterbridgeServer` state (`device.log`,
 *   `device.commandHandler`), so the server logs with its own module logger.
 *
 * TLS Certificate Management cluster server (0x0801, revision 1) for the Root Node of a Camera (`TLSCertificatesCond`).
 *
 * The node stores, per fabric, up to MaxRootCertificates TLS root certificates and up to MaxClientCertificates TLS
 * client certificates. A client certificate is created by ClientCSR: the node generates a P-256 key pair, returns a
 * PKCS #10 CSR and a signature of the nonce, and keeps the private key; ProvisionClientCertificate then installs the
 * certificate issued for that key. CAIDs and CCDIDs are unique on the node across fabrics. The certificate
 * fingerprint is the SHA-256 of its DER encoding. Certificates are accepted only if they are a DER encoded X.509
 * certificate valid at the current time.
 *
 * Behavior follows the Matter 1.6.1 data model (data_model/1.6.1/clusters/TLSCertificateManagement.xml), the CHIP
 * v1.6.1.0 reference server and the TC-TLSCERT-2.x certification tests.
 *
 * @remarks
 * Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: the ProvisionedRootCertificates and ProvisionedClientCertificates attributes
 * include the certificate payloads when read over a Large Message capable transport (TCP) and omit them otherwise. The
 * stored attributes carry the payloads, and the {@link MatterbridgeTlsCertificateManagementServer.State} provides a
 * context-aware view (`Val.properties`) that removes them for a remote read over a non Large Message capable
 * transport, so a list entry never exceeds one MRP message. The private keys never appear in the attributes.
 */
export class MatterbridgeTlsCertificateManagementServer extends MatterbridgeTlsCertificateManagementServerBase {
  declare state: MatterbridgeTlsCertificateManagementServer.State;

  override initialize(): void {
    // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
    this.#updateAttributes();
    // The OperationalCredentials cluster is on the Root Node: Node.forEndpoint() finds it traversing the owners of this endpoint.
    // Offline: the reaction runs in its own transaction, not in the OperationalCredentials one that changed the fabrics.
    const node = Node.forEndpoint(this.endpoint);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(node.eventsOf(OperationalCredentialsServer).fabrics$Changed, this.#handleFabricsChanged, { offline: true, lock: true });
  }

  /**
   * Handles the ProvisionRootCertificate command: provisions a new root certificate (null CAID) or replaces the
   * certificate of an existing CAID of the accessing fabric.
   *
   * @param {TlsCertificateManagement.ProvisionRootCertificateRequest} request - The command request.
   * @returns {TlsCertificateManagement.ProvisionRootCertificateResponse} The CAID of the provisioned certificate.
   * @throws {StatusResponseError} In the order of Matter 1.6.1 § 14.4.6.1: ConstraintError if the certificate exceeds
   * 3000 octets or the CAID is out of range, InvalidInState if the node has no UTC time to validate the certificate,
   * DynamicConstraintError if the certificate is not a valid DER encoded X.509 certificate, AlreadyExists if the
   * certificate is already provisioned on the fabric, NotFound if the CAID does not exist on the fabric,
   * ResourceExhausted if the fabric has MaxRootCertificates certificates.
   */
  override provisionRootCertificate(request: TlsCertificateManagement.ProvisionRootCertificateRequest): TlsCertificateManagement.ProvisionRootCertificateResponse {
    const certificate = Bytes.of(request.certificate);
    const { caid } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.6.1: The Certificate field has a maximum length of 3000 octets (CONSTRAINT_ERROR).
    if (certificate.byteLength > MAX_CERTIFICATE_BYTES) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: certificate of ${certificate.byteLength} octets exceeds ${MAX_CERTIFICATE_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.1 § 14.4.4.1: A TLSCAID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (caid !== null && caid > MAX_TLS_CERTIFICATE_ID) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: the CAID ${caid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.1 § 14.4.6.1: Fail with INVALID_IN_STATE if the UTCTime attribute of the Time Synchronization cluster is null.
    if (this.endpoint.behaviors.has(TimeSynchronizationServer) && this.endpoint.stateOf(TimeSynchronizationServer).utcTime === null) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: time synchronization has not yet occurred (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.1 § 14.4.6.1: Fail with DYNAMIC_CONSTRAINT_ERROR if the Certificate is not a valid TLS certificate.
    if (parseValidCertificate(certificate) === undefined) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: not a valid DER encoded X.509 certificate (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }
    const store = this.state.rootCertificateStore;
    const fingerprint = certificateFingerprint(certificate);
    // Matter 1.6.1 § 14.4.6.1: Fail with ALREADY_EXISTS if a certificate with the same fingerprint is provisioned on the accessing fabric.
    if (store.some((entry) => entry.fabric === fabric && certificateFingerprint(entry.certificate).equals(fingerprint))) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: certificate already provisioned (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.AlreadyExists,
      );
    }
    if (caid !== null) {
      // Matter 1.6.1 § 14.4.6.1: For a non-null CAID, fail with NOT_FOUND if the CAID does not exist on the accessing fabric.
      if (!store.some((entry) => entry.fabric === fabric && entry.caid === caid)) {
        throw new StatusResponseError(
          `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: the CAID ${caid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.NotFound,
        );
      }
      // Matter 1.6.1 § 14.4.6.1: For a non-null CAID, update the certificate of the existing entry.
      this.state.rootCertificateStore = store.map((entry) => (entry.fabric === fabric && entry.caid === caid ? { caid, fabric, certificate } : entry));
      // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
      this.#updateAttributes();
      log.info(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: root certificate CAID ${caid} updated on fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { caid };
    }
    // Matter 1.6.1 § 14.4.6.1: For a null CAID, fail with RESOURCE_EXHAUSTED if the accessing fabric already has MaxRootCertificates root certificates.
    if (store.filter((entry) => entry.fabric === fabric).length >= this.state.maxRootCertificates) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: fabric ${fabric} already has ${this.state.maxRootCertificates} root certificates (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ResourceExhausted,
      );
    }
    // Matter 1.6.1 § 14.4.6.1: For a null CAID, generate a new TLSCAID.
    const id = allocateId(new Set(store.map((entry) => entry.caid)), this.state.nextCaid);
    // Matter 1.6.1 § 14.4.4.1: A new TLSCAID SHOULD increase by 1 with each allocation and wrap past 65534 to 0.
    this.state.nextCaid = (id + 1) % (MAX_TLS_CERTIFICATE_ID + 1);
    // Matter 1.6.1 § 14.4.6.1: Add the new root certificate with the generated TLSCAID, associated with the accessing fabric.
    this.state.rootCertificateStore = [...store, { caid: id, fabric, certificate }];
    // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
    this.#updateAttributes();
    log.info(
      `MatterbridgeTlsCertificateManagementServer.provisionRootCertificate: root certificate CAID ${id} provisioned on fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    return { caid: id };
  }

  /**
   * Handles the FindRootCertificate command: returns the root certificate of a CAID, or all the root certificates of
   * the accessing fabric for a null CAID.
   *
   * @param {TlsCertificateManagement.FindRootCertificateRequest} request - The command request.
   * @returns {TlsCertificateManagement.FindRootCertificateResponse} The certificate details.
   * @throws {StatusResponseError} ConstraintError if the CAID is out of range, NotFound if no certificate matches.
   */
  override findRootCertificate(request: TlsCertificateManagement.FindRootCertificateRequest): TlsCertificateManagement.FindRootCertificateResponse {
    const { caid } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.4.1: A TLSCAID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (caid !== null && caid > MAX_TLS_CERTIFICATE_ID)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.findRootCertificate: the CAID ${caid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    const certificateDetails = this.state.rootCertificateStore
      .filter((entry) => entry.fabric === fabric && (caid === null || entry.caid === caid))
      .map((entry) => ({ caid: entry.caid, certificate: entry.certificate, fabricIndex: FabricIndex(fabric) }));
    // Matter 1.6.1 § 14.4.6.3: Fail with NOT_FOUND if no root certificate of the accessing fabric matches the CAID, or none exists for a null CAID.
    if (certificateDetails.length === 0)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.findRootCertificate: the CAID ${caid ?? 'null'} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    return { certificateDetails };
  }

  /**
   * Handles the LookupRootCertificate command: returns the CAID of the root certificate with a fingerprint.
   *
   * @param {TlsCertificateManagement.LookupRootCertificateRequest} request - The command request.
   * @returns {TlsCertificateManagement.LookupRootCertificateResponse} The CAID of the certificate.
   * @throws {StatusResponseError} ConstraintError if the fingerprint exceeds 64 octets, NotFound if no certificate matches.
   */
  override lookupRootCertificate(request: TlsCertificateManagement.LookupRootCertificateRequest): TlsCertificateManagement.LookupRootCertificateResponse {
    const fingerprint = Buffer.from(Bytes.of(request.fingerprint));
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.6.5: The Fingerprint field has a maximum length of 64 octets (CONSTRAINT_ERROR).
    if (fingerprint.byteLength > MAX_FINGERPRINT_BYTES) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.lookupRootCertificate: fingerprint of ${fingerprint.byteLength} octets exceeds ${MAX_FINGERPRINT_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const found = this.state.rootCertificateStore.find((entry) => entry.fabric === fabric && certificateFingerprint(entry.certificate).equals(fingerprint));
    // Matter 1.6.1 § 14.4.6.5: Fail with NOT_FOUND if no root certificate of the accessing fabric has the fingerprint.
    if (found === undefined)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.lookupRootCertificate: fingerprint not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    return { caid: found.caid };
  }

  /**
   * Handles the RemoveRootCertificate command.
   *
   * @param {TlsCertificateManagement.RemoveRootCertificateRequest} request - The command request.
   * @throws {StatusResponseError} ConstraintError if the CAID is out of range, NotFound if the CAID does not exist on
   * the fabric, InvalidInState if a TLS endpoint of the fabric uses the certificate.
   */
  override removeRootCertificate(request: TlsCertificateManagement.RemoveRootCertificateRequest): void {
    const { caid } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.4.1: A TLSCAID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (caid > MAX_TLS_CERTIFICATE_ID)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.removeRootCertificate: the CAID ${caid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    const store = this.state.rootCertificateStore;
    const remaining = store.filter((entry) => !(entry.fabric === fabric && entry.caid === caid));
    // Matter 1.6.1 § 14.4.6.7: Fail with NOT_FOUND if the CAID does not exist on the accessing fabric.
    if (remaining.length === store.length)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.removeRootCertificate: the CAID ${caid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    // Matter 1.6.1 § 14.4.6.7: Then fail with INVALID_IN_STATE if a TLS endpoint of the TLS Client Management cluster uses the CAID.
    if (this.#tlsEndpoints(fabric).some((endpoint) => endpoint.caid === caid)) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.removeRootCertificate: the CAID ${caid} is used by a TLS endpoint (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.1 § 14.4.6.7: Remove the entry of the CAID from ProvisionedRootCertificates.
    this.state.rootCertificateStore = remaining;
    // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
    this.#updateAttributes();
    log.info(
      `MatterbridgeTlsCertificateManagementServer.removeRootCertificate: root certificate CAID ${caid} removed from fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles the ClientCSR command: generates a P-256 key pair for a new client certificate (null CCDID), or reuses
   * the key pair of an existing CCDID of the accessing fabric for a certificate rotation, and returns the CSR and the
   * signature of the nonce.
   *
   * @param {TlsCertificateManagement.ClientCsrRequest} request - The command request.
   * @returns {TlsCertificateManagement.ClientCsrResponse} The CCDID, the DER encoded PKCS #10 CSR and the nonce signature.
   * @throws {StatusResponseError} ConstraintError if the nonce is not 32 octets or the CCDID is out of range,
   * ResourceExhausted if the fabric has MaxClientCertificates certificates, DynamicConstraintError if the new key pair
   * collides with another TLS key pair or an operational key pair, NotFound if the CCDID does not exist on the fabric.
   */
  override clientCsr(request: TlsCertificateManagement.ClientCsrRequest): TlsCertificateManagement.ClientCsrResponse {
    const nonce = Bytes.of(request.nonce);
    const { ccdid } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.6.8: The Nonce field is 32 octets (CONSTRAINT_ERROR).
    if (nonce.byteLength !== CLIENT_CSR_NONCE_BYTES) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.clientCsr: nonce of ${nonce.byteLength} octets is not ${CLIENT_CSR_NONCE_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const store = this.state.clientCertificateStore;
    let id: number;
    let privateKey: Uint8Array;
    if (ccdid === null) {
      // Matter 1.6.1 § 14.4.6.8: For a null CCDID, fail with RESOURCE_EXHAUSTED if the accessing fabric already has MaxClientCertificates client certificates.
      if (store.filter((entry) => entry.fabric === fabric).length >= this.state.maxClientCertificates) {
        throw new StatusResponseError(
          `MatterbridgeTlsCertificateManagementServer.clientCsr: fabric ${fabric} already has ${this.state.maxClientCertificates} client certificates (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.ResourceExhausted,
        );
      }
      // Matter 1.6.1 § 14.4.6.8: For a null CCDID, generate a new key pair.
      privateKey = this.generateClientKey();
      const point = publicKeyPoint(privateKey);
      const tlsKeys = store.map((entry) => publicKeyPoint(entry.privateKey));
      const operationalKeys = [...this.env.get(FabricManager)].map((operationalFabric) => Bytes.of(operationalFabric.publicKey));
      // Matter 1.6.1 § 14.4.6.8: If a key collision is detected against any other TLS key pair or Operational credential key pair, discard the new key pair and fail with DYNAMIC_CONSTRAINT_ERROR.
      if ([...tlsKeys, ...operationalKeys].some((key) => Bytes.areEqual(key, point))) {
        throw new StatusResponseError(
          `MatterbridgeTlsCertificateManagementServer.clientCsr: the new key pair collides with an existing key pair (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.DynamicConstraintError,
        );
      }
      // Matter 1.6.1 § 14.4.6.8: Generate a new TLSCCDID.
      id = allocateId(new Set(store.map((entry) => entry.ccdid)), this.state.nextCcdid);
      // Matter 1.6.1 § 14.4.4.2: A new TLSCCDID SHOULD increase by 1 with each allocation and wrap past 65534 to 0.
      this.state.nextCcdid = (id + 1) % (MAX_TLS_CERTIFICATE_ID + 1);
      // Matter 1.6.1 § 14.4.6.8: Add the new client certificate details with null ClientCertificate and empty IntermediateCertificates, associated with the accessing fabric.
      this.state.clientCertificateStore = [...store, { ccdid: id, fabric, clientCertificate: null, intermediateCertificates: [], privateKey }];
      // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
      this.#updateAttributes();
      log.info(
        `MatterbridgeTlsCertificateManagementServer.clientCsr: client certificate CCDID ${id} created on fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    } else {
      // Matter 1.6.1 § 14.4.4.2: A TLSCCDID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
      if (ccdid > MAX_TLS_CERTIFICATE_ID)
        throw new StatusResponseError(
          `MatterbridgeTlsCertificateManagementServer.clientCsr: the CCDID ${ccdid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.ConstraintError,
        );
      const existing = store.find((entry) => entry.fabric === fabric && entry.ccdid === ccdid);
      // Matter 1.6.1 § 14.4.6.8: For a non-null CCDID, fail with NOT_FOUND if the CCDID does not exist on the accessing fabric.
      if (existing === undefined)
        throw new StatusResponseError(
          `MatterbridgeTlsCertificateManagementServer.clientCsr: the CCDID ${ccdid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.NotFound,
        );
      id = ccdid;
      privateKey = existing.privateKey;
      log.info(
        `MatterbridgeTlsCertificateManagementServer.clientCsr: client certificate CCDID ${id} CSR generated for rotation on fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    return { ccdid: id, csr: createClientCsr(privateKey), nonceSignature: signClientCsrNonce(privateKey, nonce) };
  }

  /**
   * Generates the P-256 key pair of a new client certificate (Crypto_GenerateKeypair).
   *
   * @returns {Uint8Array} The PKCS #8 DER encoded private key.
   */
  generateClientKey(): Uint8Array {
    return generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'der' });
  }

  /**
   * Handles the ProvisionClientCertificate command: installs the client certificate issued for the key pair of a
   * CCDID of the accessing fabric, with its intermediate certificates.
   *
   * @param {TlsCertificateManagement.ProvisionClientCertificateRequest} request - The command request.
   * @throws {StatusResponseError} In the order of Matter 1.6.1 § 14.4.6.10: ConstraintError if the CCDID is out of
   * range, a certificate exceeds 3000 octets or there are more than 10 intermediate certificates, AlreadyExists if the
   * client certificate is already provisioned on the fabric, NotFound if the CCDID does not exist on the fabric,
   * DynamicConstraintError if a certificate is not a valid DER encoded X.509 certificate or the client certificate is
   * not issued for the key pair of the CCDID.
   */
  override provisionClientCertificate(request: TlsCertificateManagement.ProvisionClientCertificateRequest): void {
    const { ccdid } = request;
    const clientCertificate = Bytes.of(request.clientCertificate);
    const intermediateCertificates = request.intermediateCertificates.map((certificate) => Bytes.of(certificate));
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.4.2: A TLSCCDID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (ccdid > MAX_TLS_CERTIFICATE_ID) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: the CCDID ${ccdid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.1 § 14.4.6.10: The ClientCertificate field has a maximum length of 3000 octets (CONSTRAINT_ERROR).
    if (clientCertificate.byteLength > MAX_CERTIFICATE_BYTES) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: certificate of ${clientCertificate.byteLength} octets exceeds ${MAX_CERTIFICATE_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.1 § 14.4.6.10: The IntermediateCertificates field has at most 10 entries (CONSTRAINT_ERROR).
    if (intermediateCertificates.length > MAX_INTERMEDIATE_CERTIFICATES) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: ${intermediateCertificates.length} intermediate certificates exceed ${MAX_INTERMEDIATE_CERTIFICATES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const bigIntermediate = intermediateCertificates.find((intermediate) => intermediate.byteLength > MAX_CERTIFICATE_BYTES);
    // Matter 1.6.1 § 14.4.6.10: Each intermediate certificate has a maximum length of 3000 octets (CONSTRAINT_ERROR).
    if (bigIntermediate !== undefined) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: intermediate certificate of ${bigIntermediate.byteLength} octets exceeds ${MAX_CERTIFICATE_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const store = this.state.clientCertificateStore;
    const fingerprint = certificateFingerprint(clientCertificate);
    // Matter 1.6.1 § 14.4.6.10: Fail with ALREADY_EXISTS if a client certificate with the same fingerprint is provisioned on the accessing fabric.
    if (store.some((entry) => entry.fabric === fabric && entry.clientCertificate !== null && certificateFingerprint(entry.clientCertificate).equals(fingerprint))) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: certificate already provisioned (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.AlreadyExists,
      );
    }
    const existing = store.find((entry) => entry.fabric === fabric && entry.ccdid === ccdid);
    // Matter 1.6.1 § 14.4.6.10: Fail with NOT_FOUND if the CCDID does not exist on the accessing fabric.
    if (existing === undefined) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: the CCDID ${ccdid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    const x509 = parseValidCertificate(clientCertificate);
    // Matter 1.6.1 § 14.4.6.10: Fail with DYNAMIC_CONSTRAINT_ERROR if the ClientCertificate is not a valid TLS certificate.
    if (x509 === undefined) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: not a valid DER encoded X.509 certificate (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }
    // Matter 1.6.1 § 14.4.6.10: Fail with DYNAMIC_CONSTRAINT_ERROR if an intermediate certificate is not a valid TLS certificate.
    if (intermediateCertificates.some((intermediate) => parseValidCertificate(intermediate) === undefined)) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: intermediate certificate not a valid DER encoded X.509 certificate (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }
    const keyPublicKey = createPublicKey(createPrivateKey({ key: Buffer.from(existing.privateKey), format: 'der', type: 'pkcs8' })).export({ type: 'spki', format: 'der' });
    // Matter 1.6.1 § 14.4.6.10: Fail with DYNAMIC_CONSTRAINT_ERROR if the public key of the ClientCertificate does not correspond to the private key of the CCDID.
    if (!x509.publicKey.export({ type: 'spki', format: 'der' }).equals(keyPublicKey)) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: certificate not issued for the key pair of CCDID ${ccdid} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }
    // Matter 1.6.1 § 14.4.6.10: Update the ClientCertificate and IntermediateCertificates of the entry of the CCDID.
    this.state.clientCertificateStore = store.map((entry) =>
      entry.fabric === fabric && entry.ccdid === ccdid ? { ccdid, fabric, clientCertificate, intermediateCertificates, privateKey: existing.privateKey } : entry,
    );
    // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
    this.#updateAttributes();
    log.info(
      `MatterbridgeTlsCertificateManagementServer.provisionClientCertificate: client certificate CCDID ${ccdid} provisioned on fabric ${fabric} with ${intermediateCertificates.length} intermediate certificates (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles the FindClientCertificate command: returns the client certificate details of a CCDID, or of all the
   * client certificates of the accessing fabric for a null CCDID.
   *
   * @param {TlsCertificateManagement.FindClientCertificateRequest} request - The command request.
   * @returns {TlsCertificateManagement.FindClientCertificateResponse} The certificate details.
   * @throws {StatusResponseError} ConstraintError if the CCDID is out of range, NotFound if no certificate matches.
   */
  override findClientCertificate(request: TlsCertificateManagement.FindClientCertificateRequest): TlsCertificateManagement.FindClientCertificateResponse {
    const { ccdid } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.4.2: A TLSCCDID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (ccdid !== null && ccdid > MAX_TLS_CERTIFICATE_ID)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.findClientCertificate: the CCDID ${ccdid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    const certificateDetails = this.state.clientCertificateStore
      .filter((entry) => entry.fabric === fabric && (ccdid === null || entry.ccdid === ccdid))
      .map((entry) => ({
        ccdid: entry.ccdid,
        clientCertificate: entry.clientCertificate,
        intermediateCertificates: entry.intermediateCertificates,
        fabricIndex: FabricIndex(fabric),
      }));
    // Matter 1.6.1 § 14.4.6.11: Fail with NOT_FOUND if no client certificate of the accessing fabric matches the CCDID, or none exists for a null CCDID.
    if (certificateDetails.length === 0)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.findClientCertificate: the CCDID ${ccdid ?? 'null'} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    return { certificateDetails };
  }

  /**
   * Handles the LookupClientCertificate command: returns the CCDID of the client certificate with a fingerprint.
   *
   * @param {TlsCertificateManagement.LookupClientCertificateRequest} request - The command request.
   * @returns {TlsCertificateManagement.LookupClientCertificateResponse} The CCDID of the certificate.
   * @throws {StatusResponseError} ConstraintError if the fingerprint exceeds 64 octets, NotFound if no certificate matches.
   */
  override lookupClientCertificate(request: TlsCertificateManagement.LookupClientCertificateRequest): TlsCertificateManagement.LookupClientCertificateResponse {
    const fingerprint = Buffer.from(Bytes.of(request.fingerprint));
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.6.13: The Fingerprint field has a maximum length of 64 octets (CONSTRAINT_ERROR).
    if (fingerprint.byteLength > MAX_FINGERPRINT_BYTES) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.lookupClientCertificate: fingerprint of ${fingerprint.byteLength} octets exceeds ${MAX_FINGERPRINT_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const found = this.state.clientCertificateStore.find(
      (entry) => entry.fabric === fabric && entry.clientCertificate !== null && certificateFingerprint(entry.clientCertificate).equals(fingerprint),
    );
    // Matter 1.6.1 § 14.4.6.13: Fail with NOT_FOUND if no client certificate of the accessing fabric has the fingerprint.
    if (found === undefined)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.lookupClientCertificate: fingerprint not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    return { ccdid: found.ccdid };
  }

  /**
   * Handles the RemoveClientCertificate command: removes the client certificate and the key pair of a CCDID.
   *
   * @param {TlsCertificateManagement.RemoveClientCertificateRequest} request - The command request.
   * @throws {StatusResponseError} ConstraintError if the CCDID is out of range, NotFound if the CCDID does not exist on
   * the fabric, InvalidInState if a TLS endpoint of the fabric uses the certificate.
   */
  override removeClientCertificate(request: TlsCertificateManagement.RemoveClientCertificateRequest): void {
    const { ccdid } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.4.4.2: A TLSCCDID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (ccdid > MAX_TLS_CERTIFICATE_ID)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.removeClientCertificate: the CCDID ${ccdid} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    const store = this.state.clientCertificateStore;
    const remaining = store.filter((entry) => !(entry.fabric === fabric && entry.ccdid === ccdid));
    // Matter 1.6.1 § 14.4.6.15: Fail with NOT_FOUND if the CCDID does not exist on the accessing fabric.
    if (remaining.length === store.length)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.removeClientCertificate: the CCDID ${ccdid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    // Matter 1.6.1 § 14.4.6.15: Then fail with INVALID_IN_STATE if a TLS endpoint of the TLS Client Management cluster uses the CCDID.
    if (this.#tlsEndpoints(fabric).some((endpoint) => endpoint.ccdid === ccdid)) {
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer.removeClientCertificate: the CCDID ${ccdid} is used by a TLS endpoint (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.1 § 14.4.6.15: Remove all the stored information of the CCDID, including its key pair.
    this.state.clientCertificateStore = remaining;
    // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
    this.#updateAttributes();
    log.info(
      `MatterbridgeTlsCertificateManagementServer.removeClientCertificate: client certificate CCDID ${ccdid} removed from fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Returns the accessing fabric of the command. All the commands of the cluster are fabric scoped, and matter.js
   * rejects them with UnsupportedAccess when there is no accessing fabric.
   *
   * @returns {number} The accessing fabric index.
   * @throws {StatusResponseError} UnsupportedAccess if the command has no accessing fabric (undefined or NO_FABRIC).
   */
  #accessingFabric(): number {
    const fabric = this.context.fabric;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    if (fabric === undefined || fabric === FabricIndex.NO_FABRIC)
      throw new StatusResponseError(
        `MatterbridgeTlsCertificateManagementServer: an accessing fabric is required (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.UnsupportedAccess,
      );
    return fabric;
  }

  /**
   * Returns the TLS endpoints of a fabric provisioned by the TLS Client Management cluster of this endpoint, if present.
   *
   * @param {number} fabric - The fabric index.
   * @returns {TlsClientManagementServer['state']['provisionedEndpoints']} The TLS endpoints of the fabric.
   */
  #tlsEndpoints(fabric: number): TlsClientManagementServer['state']['provisionedEndpoints'] {
    if (!this.endpoint.behaviors.has(TlsClientManagementServer)) return [];
    return this.endpoint.stateOf(TlsClientManagementServer).provisionedEndpoints.filter((endpoint) => endpoint.fabricIndex === fabric);
  }

  /**
   * Updates the ProvisionedRootCertificates and ProvisionedClientCertificates attributes from the certificate store,
   * with the certificate payloads but never the private keys (see the class remarks).
   */
  #updateAttributes(): void {
    // Matter 1.6.1 § 14.4.5.2: ProvisionedRootCertificates lists all the provisioned TLSCertStruct installed on the node.
    this.state.provisionedRootCertificates = this.state.rootCertificateStore.map((entry) => ({
      caid: entry.caid,
      certificate: entry.certificate,
      fabricIndex: FabricIndex(entry.fabric),
    }));
    // Matter 1.6.1 § 14.4.5.4: ProvisionedClientCertificates lists all the provisioned TLSCCDID installed on the node, never their key pairs.
    this.state.provisionedClientCertificates = this.state.clientCertificateStore.map((entry) => ({
      ccdid: entry.ccdid,
      clientCertificate: entry.clientCertificate,
      intermediateCertificates: entry.intermediateCertificates,
      fabricIndex: FabricIndex(entry.fabric),
    }));
  }

  /**
   * Removes the certificates and the key pairs of the removed fabrics.
   *
   * @param {readonly OperationalCredentials.FabricDescriptor[]} fabrics - The fabrics of the node after the change.
   */
  #handleFabricsChanged(fabrics: readonly OperationalCredentials.FabricDescriptor[]): void {
    const fabricIndexes = new Set<number>(fabrics.map((fabric) => fabric.fabricIndex));
    const rootCertificateStore = this.state.rootCertificateStore.filter((entry) => fabricIndexes.has(entry.fabric));
    const clientCertificateStore = this.state.clientCertificateStore.filter((entry) => fabricIndexes.has(entry.fabric));
    if (rootCertificateStore.length === this.state.rootCertificateStore.length && clientCertificateStore.length === this.state.clientCertificateStore.length) return;
    // Matter 1.6.1 § 11.18.6.12: Removing a fabric deletes all its fabric-scoped data, including its root certificates.
    this.state.rootCertificateStore = rootCertificateStore;
    // Matter 1.6.1 § 11.18.6.12: Removing a fabric deletes all its fabric-scoped data, including its client certificates and key pairs.
    this.state.clientCertificateStore = clientCertificateStore;
    // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: ProvisionedRootCertificates and ProvisionedClientCertificates list the provisioned certificates of each fabric.
    this.#updateAttributes();
    log.info(
      `MatterbridgeTlsCertificateManagementServer: a fabric was removed, the certificates of the removed fabrics were deleted (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }
}

/**
 * matter.js's own Behavior subclasses declare State this way; it is how the framework resolves `this.state`'s type.
 */
// oxlint-disable-next-line typescript-eslint/no-namespace
export namespace MatterbridgeTlsCertificateManagementServer {
  /** A root certificate of the persistent certificate store. */
  export interface RootCertificateEntry {
    /** The certificate authority ID, unique on the node. */
    caid: number;
    /** The fabric index of the fabric owning the certificate. */
    fabric: number;
    /** The DER encoded certificate. */
    certificate: Uint8Array;
  }

  /** A client certificate of the persistent certificate store. */
  export interface ClientCertificateEntry {
    /** The client certificate details ID, unique on the node. */
    ccdid: number;
    /** The fabric index of the fabric owning the certificate. */
    fabric: number;
    /** The DER encoded client certificate, null until ProvisionClientCertificate. */
    clientCertificate: Uint8Array | null;
    /** The DER encoded intermediate certificates. */
    intermediateCertificates: Uint8Array[];
    /** The PKCS #8 DER encoded P-256 private key of the client certificate. */
    privateKey: Uint8Array;
  }

  /**
   * State of {@link MatterbridgeTlsCertificateManagementServer}: the cluster attributes and the nonvolatile certificate store.
   */
  export class State extends MatterbridgeTlsCertificateManagementServerBase.State {
    /** The provisioned root certificates of all fabrics. */
    rootCertificateStore: RootCertificateEntry[] = [];
    /** The client certificates of all fabrics, with their private keys. */
    clientCertificateStore: ClientCertificateEntry[] = [];
    /** The next CAID to allocate. */
    nextCaid = 0;
    /** The next CCDID to allocate. */
    nextCcdid = 0;

    /**
     * Serves ProvisionedRootCertificates and ProvisionedClientCertificates without the certificate payloads to a
     * remote read over a transport that is not Large Message capable (see the class remarks). Local actors and reads
     * over a Large Message capable transport get the stored attributes.
     *
     * @param {unknown} _owner - The owner of the root reference of the managed value.
     * @param {{ subject?: unknown; largeMessage?: boolean }} session - The session reading the attributes.
     * @returns {Partial<State>} The context-aware attribute values.
     */
    [Val.properties](_owner: unknown, session: { subject?: unknown; largeMessage?: boolean }): Partial<State> {
      // Matter 1.6.1 § 14.4.5.2 and § 14.4.5.4: Local actors and reads over a Large Message capable transport get the full attributes.
      if (session.subject === undefined || session.largeMessage === true) return {};
      // oxlint-disable-next-line typescript/no-this-alias -- the getters read the raw state this provider belongs to
      const state = this;
      return {
        // Matter 1.6.1 § 14.4.4.3 and § 14.4.5.2: Over a non Large Message capable transport the Certificate field SHALL NOT be included.
        get provisionedRootCertificates() {
          return state.provisionedRootCertificates.map(({ certificate: _certificate, ...entry }) => entry);
        },
        // Matter 1.6.1 § 14.4.4.5 and § 14.4.5.4: Over a non Large Message capable transport a non-null ClientCertificate and
        // non-empty IntermediateCertificates SHALL NOT be included.
        get provisionedClientCertificates() {
          return state.provisionedClientCertificates.map(({ clientCertificate, intermediateCertificates, ...entry }) => ({
            ...entry,
            ...(clientCertificate === null ? { clientCertificate } : {}),
            ...(intermediateCertificates?.length === 0 ? { intermediateCertificates } : {}),
          }));
        },
      };
    }
  }
  /* v8 ignore next -- compiler-generated fallback (`Foo || (Foo = {})`) for namespace/class declaration merging;
   * the class is always already defined by the time this runs, so the assignment branch is structurally unreachable. */
}
