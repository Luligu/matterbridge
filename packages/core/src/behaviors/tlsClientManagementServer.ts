/**
 * @file packages/core/src/behaviors/tlsClientManagementServer.ts
 * @description This file contains the MatterbridgeTlsClientManagementServer class, a TLS Client Management cluster server.
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

import { Bytes } from '@matter/general';
import { FieldElement } from '@matter/main/model';
import { TimeSynchronizationServer } from '@matter/node/behaviors/time-synchronization';
import { TlsCertificateManagementServer } from '@matter/node/behaviors/tls-certificate-management';
import { TlsClientManagementServer } from '@matter/node/behaviors/tls-client-management';
import { TlsClientManagement } from '@matter/types/clusters/tls-client-management';
import { StatusResponseError } from '@matter/types/common';
import { FabricIndex } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

import { allocateId } from './tlsCertificateManagementServer.js';

/** Largest TLSEndpointID, TLSCAID and TLSCCDID value. */
export const MAX_TLS_ENDPOINT_ID = 65534;

/** Shortest Hostname accepted, in octets: a single character, a dot and a two letters TLD (e.g. "a.bc"). */
export const MIN_HOSTNAME_BYTES = 4;

/** Longest Hostname accepted, in octets. */
export const MAX_HOSTNAME_BYTES = 253;

/** Module logger for the TLS Client Management server. */
const log = new AnsiLogger({ logName: 'TlsClient', logLevel: LogLevel.INFO, logNameColor: MAGENTA, logTimestampFormat: TimestampFormat.TIME_MILLIS });

/** Nonvolatile allocator of the TLS endpoint IDs, kept in a field of the behavior state that is not a cluster attribute. */
const TlsClientManagementSchema = TlsClientManagement.schema.extend(undefined, FieldElement({ name: 'NextEndpointId', type: 'uint16', quality: 'N' }));

/** matter.js base of {@link MatterbridgeTlsClientManagementServer}, with the persistent TLS endpoint ID allocator. */
const MatterbridgeTlsClientManagementServerBase = TlsClientManagementServer.for(TlsClientManagement, TlsClientManagementSchema);

/**
 * Checks whether two octet strings are equal.
 *
 * @param {Bytes} a - The first octet string.
 * @param {Bytes} b - The second octet string.
 * @returns {boolean} True if the octet strings are equal.
 */
function bytesEqual(a: Bytes, b: Bytes): boolean {
  return Buffer.from(Bytes.of(a)).equals(Buffer.from(Bytes.of(b)));
}

/**
 * WARNING: this server MUST be added only to the Root Node (endpoint 0) of the server node, never to a
 * MatterbridgeEndpoint. The TLS Client Management cluster has Node scope and is a Root Node singleton (Matter 1.6.1
 * Root Node device type, condition requirements of Camera, Intercom, Audio Doorbell and related device types).
 * As a consequence:
 * - there is NO plugin command handler: its commands have no entry in `CommandHandlers`, are never forwarded with
 *   `executeHandler()` and cannot be handled with `addCommandHandler()`;
 * - there is NO command observable: its commands are never emitted with `emitCommand()` and cannot be observed
 *   with `subscribeCommand()`;
 * - `this.endpoint` is NOT a MatterbridgeEndpoint: there is no `MatterbridgeServer` state (`device.log`,
 *   `device.commandHandler`), so the server logs with its own module logger.
 *
 * TLS Client Management cluster server (0x0802, revision 1) for the Root Node of a Camera (`TLSClientCond`).
 *
 * The node stores, per fabric, up to MaxProvisioned TLS endpoints: a Hostname / Port pair with the root certificate
 * (CAID) that authenticates the server and the optional client certificate (CCDID) of the node, both provisioned
 * with the TLS Certificate Management cluster, which SHALL be present on the same endpoint. TLS endpoint IDs are unique on the node across
 * fabrics. The ReferenceCount of an endpoint counts the clusters using it: no cluster of this plugin uses TLS
 * endpoints, so it stays 0. matter.js removes the TLS endpoints of a fabric when the fabric is removed.
 *
 * Behavior follows the Matter 1.6.1 data model (data_model/1.6.1/clusters/TLSClientManagement.xml), the CHIP
 * v1.6.1.0 reference server and the TC-TLSCLIENT-x.x certification tests.
 */
export class MatterbridgeTlsClientManagementServer extends MatterbridgeTlsClientManagementServerBase {
  declare state: MatterbridgeTlsClientManagementServer.State;

  /**
   * Handles the ProvisionEndpoint command: provisions a new TLS endpoint (null EndpointID) or updates an existing TLS
   * endpoint of the accessing fabric.
   *
   * @param {TlsClientManagement.ProvisionEndpointRequest} request - The command request.
   * @returns {TlsClientManagement.ProvisionEndpointResponse} The EndpointID of the provisioned TLS endpoint.
   * @throws {StatusResponseError} ConstraintError if the Hostname is not 4 to 253 octets, the Port is 0 or an ID is
   * out of range, InvalidTime if the node has no UTC time to validate the certificates, RootCertificateNotFound or
   * ClientCertificateNotFound if the CAID or the CCDID does not exist on the fabric, then for a null EndpointID
   * ResourceExhausted if the fabric has MaxProvisioned TLS endpoints, for a non-null EndpointID NotFound if it does not
   * exist on the fabric, and EndpointAlreadyInstalled if another TLS endpoint of the fabric has the same Hostname and
   * Port (the order of Matter 1.6.1 § 14.5.7.1).
   */
  override provisionEndpoint(request: TlsClientManagement.ProvisionEndpointRequest): TlsClientManagement.ProvisionEndpointResponse {
    const hostname = Bytes.of(request.hostname);
    const { port, caid, ccdid, endpointId } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.5.7.1: The Hostname field is 4 to 253 octets (CONSTRAINT_ERROR).
    if (hostname.byteLength < MIN_HOSTNAME_BYTES || hostname.byteLength > MAX_HOSTNAME_BYTES) {
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: hostname of ${hostname.byteLength} octets is not ${MIN_HOSTNAME_BYTES} to ${MAX_HOSTNAME_BYTES} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.1 § 14.5.7.1: The Port field is 1 to 65535 (CONSTRAINT_ERROR).
    if (port < 1)
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: the port 0 is not valid (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    // Matter 1.6.1 § 14.4.4.1, § 14.4.4.2 and § 14.5.4.1: A TLSCAID, a TLSCCDID and a TLSEndpointID have valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (caid > MAX_TLS_ENDPOINT_ID || (ccdid !== null && ccdid > MAX_TLS_ENDPOINT_ID) || (endpointId !== null && endpointId > MAX_TLS_ENDPOINT_ID)) {
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: the CAID, CCDID or EndpointID is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.1 § 14.5.7.1: Fail with InvalidTime if the UTCTime attribute of the Time Synchronization cluster is null.
    if (this.endpoint.behaviors.has(TimeSynchronizationServer) && this.endpoint.stateOf(TimeSynchronizationServer).utcTime === null) {
      throw new TlsClientManagement.InvalidTimeError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: time synchronization has not yet occurred (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    const certificates = this.endpoint.stateOf(TlsCertificateManagementServer);
    // Matter 1.6.1 § 14.5.7.1: Fail with RootCertificateNotFound if the CAID does not exist on the accessing fabric.
    if (!certificates.provisionedRootCertificates.some((entry) => entry.fabricIndex === fabric && entry.caid === caid)) {
      throw new TlsClientManagement.RootCertificateNotFoundError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: the CAID ${caid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    // Matter 1.6.1 § 14.5.7.1: Fail with ClientCertificateNotFound if a non-null CCDID does not exist on the accessing fabric.
    if (ccdid !== null && !certificates.provisionedClientCertificates.some((entry) => entry.fabricIndex === fabric && entry.ccdid === ccdid)) {
      throw new TlsClientManagement.ClientCertificateNotFoundError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: the CCDID ${ccdid} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    const endpoints = this.state.provisionedEndpoints;
    const fabricEndpoints = endpoints.filter((endpoint) => endpoint.fabricIndex === fabric);
    const duplicate = fabricEndpoints.some((endpoint) => endpoint.port === port && bytesEqual(endpoint.hostname, hostname) && endpoint.endpointId !== endpointId);
    if (endpointId === null) {
      // Matter 1.6.1 § 14.5.7.1 and § 14.5.6.1: For a null EndpointID, fail with RESOURCE_EXHAUSTED if MaxProvisioned (a per fabric maximum) TLS endpoints are provisioned on the accessing fabric.
      if (fabricEndpoints.length >= this.state.maxProvisioned) {
        throw new StatusResponseError(
          `MatterbridgeTlsClientManagementServer.provisionEndpoint: fabric ${fabric} already has ${this.state.maxProvisioned} endpoints (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.ResourceExhausted,
        );
      }
      // Matter 1.6.1 § 14.5.7.1: For a null EndpointID, fail with EndpointAlreadyInstalled if another TLS endpoint of the accessing fabric has the same Hostname and Port.
      if (duplicate) {
        throw new TlsClientManagement.EndpointAlreadyInstalledError(
          `MatterbridgeTlsClientManagementServer.provisionEndpoint: an endpoint with the same hostname and port is already installed (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        );
      }
      // Matter 1.6.1 § 14.5.7.1: For a null EndpointID, generate a new TLSEndpointID.
      const id = allocateId(new Set(endpoints.map((endpoint) => endpoint.endpointId)), this.state.nextEndpointId);
      // Matter 1.6.1 § 14.5.4.1: A new TLSEndpointID SHOULD increase by 1 with each allocation and wrap past 65534 to 0.
      this.state.nextEndpointId = (id + 1) % (MAX_TLS_ENDPOINT_ID + 1);
      // Matter 1.6.1 § 14.5.7.1: Add the new TLS endpoint with a ReferenceCount of 0, associated with the accessing fabric.
      this.state.provisionedEndpoints = [...endpoints, { endpointId: id, hostname, port, caid, ccdid, referenceCount: 0, fabricIndex: FabricIndex(fabric) }];
      log.info(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: the TLS endpoint ${id} provisioned on fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { endpointId: id };
    }
    const existing = fabricEndpoints.find((endpoint) => endpoint.endpointId === endpointId);
    // Matter 1.6.1 § 14.5.7.1: For a non-null EndpointID, fail with NOT_FOUND if the EndpointID does not exist on the accessing fabric.
    if (existing === undefined)
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: the EndpointID ${endpointId} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    // Matter 1.6.1 § 14.5.7.1: For a non-null EndpointID, fail with EndpointAlreadyInstalled if another TLS endpoint of the accessing fabric has the same Hostname and Port.
    if (duplicate) {
      throw new TlsClientManagement.EndpointAlreadyInstalledError(
        `MatterbridgeTlsClientManagementServer.provisionEndpoint: an endpoint with the same hostname and port is already installed (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    // The ReferenceCount is kept: the clusters using the TLS endpoint still use it after the update.
    const { referenceCount } = existing;
    // Matter 1.6.1 § 14.5.7.1: Update the fields of the matching TLS endpoint with the values of the command.
    this.state.provisionedEndpoints = endpoints.map((endpoint) =>
      endpoint.fabricIndex === fabric && endpoint.endpointId === endpointId
        ? { endpointId, hostname, port, caid, ccdid, referenceCount, fabricIndex: FabricIndex(fabric) }
        : endpoint,
    );
    log.info(
      `MatterbridgeTlsClientManagementServer.provisionEndpoint: the TLS endpoint ${endpointId} updated on fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    return { endpointId };
  }

  /**
   * Handles the FindEndpoint command: returns the TLS endpoint of an EndpointID of the accessing fabric.
   *
   * @param {TlsClientManagement.FindEndpointRequest} request - The command request.
   * @returns {TlsClientManagement.FindEndpointResponse} The TLS endpoint.
   * @throws {StatusResponseError} ConstraintError if the EndpointID is out of range, NotFound if it does not exist on the fabric.
   */
  override findEndpoint(request: TlsClientManagement.FindEndpointRequest): TlsClientManagement.FindEndpointResponse {
    const { endpointId } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.5.4.1: A TLSEndpointID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (endpointId > MAX_TLS_ENDPOINT_ID)
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.findEndpoint: the EndpointID ${endpointId} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    const endpoint = this.state.provisionedEndpoints.find((entry) => entry.fabricIndex === fabric && entry.endpointId === endpointId);
    // Matter 1.6.1 § 14.5.7.3: Fail with NOT_FOUND if the EndpointID does not exist on the accessing fabric.
    if (endpoint === undefined)
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.findEndpoint: the EndpointID ${endpointId} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    return { endpoint };
  }

  /**
   * Handles the RemoveEndpoint command: removes a TLS endpoint of the accessing fabric.
   *
   * @param {TlsClientManagement.RemoveEndpointRequest} request - The command request.
   * @throws {StatusResponseError} ConstraintError if the EndpointID is out of range, NotFound if it does not exist on
   * the fabric, InvalidInState if its ReferenceCount is not 0.
   */
  override removeEndpoint(request: TlsClientManagement.RemoveEndpointRequest): void {
    const { endpointId } = request;
    // Matter 1.6.1 § 8.8.2.3: A fabric-scoped command without an accessing fabric is rejected with UNSUPPORTED_ACCESS.
    const fabric = this.#accessingFabric();
    // Matter 1.6.1 § 14.5.4.1: A TLSEndpointID has valid values from 0 to 65534 (CONSTRAINT_ERROR).
    if (endpointId > MAX_TLS_ENDPOINT_ID)
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.removeEndpoint: the EndpointID ${endpointId} is out of range (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    const endpoints = this.state.provisionedEndpoints;
    const endpoint = endpoints.find((entry) => entry.fabricIndex === fabric && entry.endpointId === endpointId);
    // Matter 1.6.1 § 14.5.7.5: Fail with NOT_FOUND if the EndpointID does not exist on the accessing fabric.
    if (endpoint === undefined)
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.removeEndpoint: the EndpointID ${endpointId} was not found (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    // Matter 1.6.1 § 14.5.7.5: Fail with INVALID_IN_STATE if the ReferenceCount of the TLS endpoint is greater than 0.
    if (endpoint.referenceCount > 0) {
      throw new StatusResponseError(
        `MatterbridgeTlsClientManagementServer.removeEndpoint: the EndpointID ${endpointId} is in use by ${endpoint.referenceCount} clusters (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.1 § 14.5.7.5: Remove the TLS endpoint from ProvisionedEndpoints.
    this.state.provisionedEndpoints = endpoints.filter((entry) => !(entry.fabricIndex === fabric && entry.endpointId === endpointId));
    log.info(
      `MatterbridgeTlsClientManagementServer.removeEndpoint: the TLS endpoint ${endpointId} removed from fabric ${fabric} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
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
        `MatterbridgeTlsClientManagementServer: an accessing fabric is required (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.UnsupportedAccess,
      );
    return fabric;
  }
}

/**
 * matter.js's own Behavior subclasses declare State this way; it is how the framework resolves `this.state`'s type.
 */
// oxlint-disable-next-line typescript-eslint/no-namespace
export namespace MatterbridgeTlsClientManagementServer {
  /**
   * State of {@link MatterbridgeTlsClientManagementServer}: the cluster attributes and the nonvolatile TLS endpoint ID allocator.
   */
  export class State extends MatterbridgeTlsClientManagementServerBase.State {
    /** The next TLS endpoint ID to allocate. */
    nextEndpointId = 0;
  }
  /* v8 ignore next -- compiler-generated fallback (`Foo || (Foo = {})`) for namespace/class declaration merging;
   * the class is always already defined by the time this runs, so the assignment branch is structurally unreachable. */
}
