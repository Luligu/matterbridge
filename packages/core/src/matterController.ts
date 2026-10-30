/**
 * @file packages/core/src/matterController.ts
 * @description Starts the Matterbridge controller and handles controller commands.
 * @author Luca Liguori
 * @created 2023-12-29
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2023, 2024, 2025, 2026 Luca Liguori.
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

// WARNING: Not released yet and excluded from Vitest coverage

import path from 'node:path';

import { type Environment, Logger, UINT16_MAX, UINT32_MAX } from '@matter/general';
import { type CommissioningDiscovery, ControllerBehavior, NetworkClient, ServerNode } from '@matter/node';
import { BasicInformationClient } from '@matter/node/behaviors/basic-information';
import { Read, Subscribe } from '@matter/protocol';
import { VendorId } from '@matter/types/datatype';
import { ManualPairingCodeCodec } from '@matter/types/schema';
import { MATTER_STORAGE_DIR } from '@matterbridge/types';
import { getIntParameter, getParameter, hasParameter } from '@matterbridge/utils/cli';
import { createDirectory } from '@matterbridge/utils/create-dir';
import { getErrorMessage } from '@matterbridge/utils/error';
import { isValidInteger, isValidString, parseVersionString } from '@matterbridge/utils/validate';
import { debugStringify } from 'node-ansi-logger';

import type { Matterbridge } from './matterbridge.js';

/**
 * Starts the controller and runs the requested controller command.
 *
 * @param {Matterbridge} matterbridge Matterbridge instance owning the controller.
 * @param {Environment} environment Matter environment used by the controller.
 * @returns {Promise<void>} Resolves when startup or the command completes.
 * @throws {Error} If the storage service has not been initialized.
 */
export async function startController(matterbridge: Matterbridge, environment: Environment): Promise<void> {
  if (!matterbridge.matterStorageService) {
    throw new Error('No storage service initialized');
  }
  await createDirectory(
    path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_DIR, 'MatterbridgeController'),
    `Matter node storage directory for MatterbridgeController`,
    matterbridge.log,
  );
  matterbridge.controllerStorageManager = await matterbridge.matterStorageService.open('MatterbridgeController');
  matterbridge.log.info('Matter node storage manager "MatterbridgeController" created');

  if (hasParameter('reset')) {
    const driver = matterbridge.controllerStorageManager.driver;
    // The file driver requires a named context; clearAll([]) does not clear its root.
    for (const context of await driver.contexts([])) {
      await driver.clearAll([context]);
    }
    for (const key of await driver.keys([])) {
      await driver.delete([], key);
    }
    matterbridge.log.notice('MatterbridgeController storage reset; remote device fabrics are unchanged');
    return;
  }

  matterbridge.log.info('Creating context controllerContext...');
  matterbridge.controllerContext = matterbridge.controllerStorageManager.createContext('controllerContext');
  if (!matterbridge.controllerContext) {
    matterbridge.log.error('No storage context controllerContext initialized');
    return;
  }

  const { randomBytes } = await import('node:crypto');

  const storeId = 'MatterbridgeController';
  const random = randomBytes(8).toString('hex');
  await matterbridge.controllerContext.set('storeId', storeId);
  await matterbridge.controllerContext.set('vendorId', matterbridge.controllerVendorId);
  await matterbridge.controllerContext.set('vendorName', matterbridge.controllerVendorName.slice(0, 32));
  await matterbridge.controllerContext.set('productId', matterbridge.controllerProductId);
  await matterbridge.controllerContext.set('productName', matterbridge.controllerProductName.slice(0, 32));
  await matterbridge.controllerContext.set('productLabel', matterbridge.controllerProductName.replace(matterbridge.controllerVendorName, '').trim().slice(0, 32));
  await matterbridge.controllerContext.set('nodeLabel', storeId.slice(0, 32));
  await matterbridge.controllerContext.set('serialNumber', await matterbridge.controllerContext.get('serialNumber', 'SN' + random));
  await matterbridge.controllerContext.set('uniqueId', await matterbridge.controllerContext.get('uniqueId', 'UI' + random));
  await matterbridge.controllerContext.set(
    'softwareVersion',
    isValidInteger(parseVersionString(matterbridge.matterbridgeVersion), 0, UINT32_MAX) ? parseVersionString(matterbridge.matterbridgeVersion) : 1,
  );
  await matterbridge.controllerContext.set('softwareVersionString', isValidString(matterbridge.matterbridgeVersion, 5, 64) ? matterbridge.matterbridgeVersion : '1.0.0');
  await matterbridge.controllerContext.set(
    'hardwareVersion',
    isValidInteger(parseVersionString(matterbridge.systemInformation.osRelease), 0, UINT16_MAX) ? parseVersionString(matterbridge.systemInformation.osRelease) : 1,
  );
  await matterbridge.controllerContext.set(
    'hardwareVersionString',
    isValidString(matterbridge.systemInformation.osRelease, 5, 64) ? matterbridge.systemInformation.osRelease : '1.0.0',
  );

  matterbridge.log.info('Creating matter commissioning controller...');
  matterbridge.controllerNode = await ServerNode.create(ServerNode.RootEndpointWithoutGroupcast.with(ControllerBehavior), {
    commissioning: { enabled: false },
    controller: { adminFabricLabel: matterbridge.controllerProductName.slice(0, 32) },
    subscriptions: { persistenceEnabled: false },
    id: storeId,

    environment: environment,

    network: {
      autoStartCommissionedPeers: false,
      listeningAddressIpv4: matterbridge.ipv4Address,
      listeningAddressIpv6: matterbridge.ipv6Address,
      port: getIntParameter('port'),
    },

    // Provide defaults for the BasicInformation cluster on the Root endpoint
    basicInformation: {
      nodeLabel: await matterbridge.controllerContext.get<string>('nodeLabel'),

      vendorId: VendorId(await matterbridge.controllerContext.get<number>('vendorId')),
      vendorName: await matterbridge.controllerContext.get<string>('vendorName'),

      productId: await matterbridge.controllerContext.get<number>('productId'),
      productName: await matterbridge.controllerContext.get<string>('productName'),
      productLabel: await matterbridge.controllerContext.get<string>('productLabel'),

      serialNumber: await matterbridge.controllerContext.get<string>('serialNumber'),
      uniqueId: await matterbridge.controllerContext.get<string>('uniqueId'),

      softwareVersion: await matterbridge.controllerContext.get<number>('softwareVersion'),
      softwareVersionString: await matterbridge.controllerContext.get<string>('softwareVersionString'),
      hardwareVersion: await matterbridge.controllerContext.get<number>('hardwareVersion'),
      hardwareVersionString: await matterbridge.controllerContext.get<string>('hardwareVersionString'),

      reachable: true,
    },
  });

  await matterbridge.controllerNode.start();

  matterbridge.log.info(`Loaded matter commissioning controller with ${matterbridge.controllerNode.peers.size} peer nodes.`);
  const requestedNodeId = getIntParameter('node');
  const nodeLabel = requestedNodeId === undefined ? undefined : `Node ${requestedNodeId}`;
  const peerId = requestedNodeId === undefined ? undefined : `peer${requestedNodeId}`;

  if (hasParameter('pair')) {
    // passcode (setupPin) 20242025 longDiscriminator 3840
    // const shortDiscriminator = (discriminator >> 8) & 0x0f;
    let options: CommissioningDiscovery.Options;
    if (hasParameter('pairingcode')) {
      const pairingCode = getParameter('pairingcode');
      if (!pairingCode) {
        matterbridge.log.error('Missing parameter --pairingcode');
        return;
      }
      matterbridge.log.info(`Pairing device ${nodeLabel} with pairingcode: ${pairingCode}`);
      const pairingData = ManualPairingCodeCodec.decode(pairingCode);
      matterbridge.log.info(`- passcode: ${pairingData.passcode}`);
      matterbridge.log.info(`- shortDiscriminator: ${pairingData.shortDiscriminator ?? 'n/a (should never be n/a, short discriminator is encoded in the manual pairing code)'} `);
      matterbridge.log.info(`- longDiscriminator: ${pairingData.discriminator ?? 'n/a (manual pairing code encodes short discriminator only)'}`);
      matterbridge.log.info(`- vendorId: ${pairingData.vendorId ?? 'n/a'}`);
      matterbridge.log.info(`- productId: ${pairingData.productId ?? 'n/a'}`);
      options = {
        id: peerId,
        pairingCode,
        ...(pairingData.shortDiscriminator === undefined ? {} : { shortDiscriminator: pairingData.shortDiscriminator }),
        ...(pairingData.vendorId === undefined ? {} : { vendorId: pairingData.vendorId }),
        ...(pairingData.productId === undefined ? {} : { productId: pairingData.productId }),
      };
    } else {
      const discriminator = getIntParameter('discriminator');
      const passcode = getIntParameter('passcode') ?? 0;
      matterbridge.log.info(`Pairing device ${nodeLabel} with discriminator: ${discriminator}, passcode: ${passcode}`);
      options = { id: peerId, discriminator, passcode };
    }
    matterbridge.log.notice(`Commissioning node ${nodeLabel} with options: ${debugStringify(options)}`);
    try {
      const commissionedNode = await matterbridge.controllerNode.peers.commission(options);
      matterbridge.log.notice(`Commissioning successfully done for node ${commissionedNode.id}`);
    } catch (error) {
      matterbridge.log.error(`Commissioning failed for node ${nodeLabel}: ${getErrorMessage(error)}`);
    }
  } else if (hasParameter('discover')) {
    matterbridge.log.info('Discovering commissionable devices...');
    const discovery = matterbridge.controllerNode.peers.discover();
    discovery.catch((error: unknown) => matterbridge.log.error(`Discovery failed: ${getErrorMessage(error)}`));
    discovery.discovered.on((node) => {
      matterbridge.log.info(`Discovered commissionable device: ${node.id}`);
    });
  } else if (hasParameter('peers')) {
    const peers = matterbridge.controllerNode.peers;
    matterbridge.log.info(`Matter commissioning controller known nodes: ${peers.size}, paired nodes: ${peers.commissioned.length}`);
    for (const peer of peers) {
      const match = /^peer(\d+)$/.exec(peer.id);
      const status = peer.lifecycle.isCommissioned ? 'commissioned' : 'discovered';
      matterbridge.log.info(`- ${match ? `Node ${match[1]}` : peer.id} (${status})`);
    }
  } else if (hasParameter('unpair')) {
    const requestedNodeId = getIntParameter('node');
    if (requestedNodeId === undefined) {
      matterbridge.log.error('Missing parameter --node for --unpair');
      return;
    }
    const nodeLabel = `Node ${requestedNodeId}`;
    const peerId = `peer${requestedNodeId}`;
    matterbridge.log.info(`Matter commissioning controller decommissioning node: ${nodeLabel}`);
    const peers = matterbridge.controllerNode.peers;
    for (const peer of peers) {
      if (peer.id === peerId) {
        await (peer.stateOf(NetworkClient).isDisabled ? peer.enable() : peer.start());
        await peer.decommission();
        matterbridge.log.info(`Matter commissioning controller decommissioned node: ${nodeLabel}`);
        return;
      }
    }
    matterbridge.log.warn(`Matter commissioning controller node not found: ${nodeLabel}`);
  } else if (hasParameter('unpairall')) {
    matterbridge.log.info('Matter commissioning controller decommissioning all nodes...');
    const nodeIds = [...matterbridge.controllerNode.peers.commissioned];
    for (const nodeId of nodeIds) {
      matterbridge.log.info('Matter commissioning controller decommissioning node:', nodeId.id);
      await (nodeId.stateOf(NetworkClient).isDisabled ? nodeId.enable() : nodeId.start());
      await nodeId.decommission();
    }
    matterbridge.log.info('Matter commissioning controller decommissioned all nodes');
  } else {
    matterbridge.log.info('Starting matter commissioning controller...');
    matterbridge.log.info(`Matter commissioning controller started with ${matterbridge.controllerNode.peers.commissioned.length} paired nodes`);

    const tracerSubscriptions = new Map<string, Promise<{ close(): unknown }>>();

    // Automatic peer startup is disabled to preserve --node selection.
    // Starting a peer triggers discovery + session establishment when the device is reachable.
    const peersToStart = [];
    if (peerId) {
      const peer = matterbridge.controllerNode.peers.get(peerId);
      if (peer) {
        peersToStart.push(peer);
      } else {
        matterbridge.log.warn(`Matter commissioning controller peer not found: ${nodeLabel}`);
      }
    } else {
      for (const peer of matterbridge.controllerNode.peers.commissioned) {
        peersToStart.push(peer);
      }
    }

    for (const peer of peersToStart) {
      const match = /^peer(\d+)$/.exec(peer.id);
      const startedLabel = match ? `Node ${match[1]}` : peer.id;

      peer.lifecycle.online.on(() => {
        matterbridge.log.notice(`Matter commissioning controller peer ${startedLabel} is online`);
        if (peer.stateOf(NetworkClient).autoSubscribe) {
          matterbridge.log.info(`Matter commissioning controller autoSubscribe is enabled for peer ${startedLabel}`);
        } else {
          matterbridge.log.info(`Matter commissioning controller setting autoSubscribe for peer ${startedLabel}`);
          peer.setStateOf(NetworkClient, { autoSubscribe: true }).catch((error: unknown) => {
            matterbridge.log.error(`Failed to set autoSubscribe for peer ${startedLabel}: ${getErrorMessage(error)}`);
          });
        }

        // Uses a subscription with an updated callback that yields ReadResult reports on every update.
        if (hasParameter('trace-peer') && !tracerSubscriptions.has(peer.id)) {
          matterbridge.log.info(`Matter commissioning controller enabling trace-peer for ${startedLabel}`);

          const subscribe = Subscribe({
            fabricFilter: true,
            keepSubscriptions: true,
            attributes: [{}],
            events: [{ isUrgent: true }],
          });

          const subscriptionPromise = peer.interaction.subscribe({
            ...subscribe,
            updated: async (update) => {
              for await (const chunk of update) {
                for await (const report of chunk) {
                  if (report.kind === 'attr-value') {
                    matterbridge.log.info(
                      `Peer ${startedLabel} attr ${report.path.endpointId}/${report.path.clusterId}/${report.path.attributeId} v${report.version}: ${debugStringify(report.value ?? { none: true })}`,
                    );
                  } else if (report.kind === 'event-value') {
                    matterbridge.log.info(
                      `Peer ${startedLabel} event ${report.path.endpointId}/${report.path.clusterId}/${report.path.eventId} #${report.number}: ${debugStringify(report.value ?? { none: true })}`,
                    );
                  } else if (report.kind === 'attr-status') {
                    matterbridge.log.warn(
                      `Peer ${startedLabel} attr-status ${report.path.endpointId}/${report.path.clusterId}/${report.path.attributeId}: ${String(report.status)}`,
                    );
                  } else if (report.kind === 'event-status') {
                    matterbridge.log.warn(`Peer ${startedLabel} event-status ${report.path.endpointId}/${report.path.clusterId}/${report.path.eventId}: ${String(report.status)}`);
                  }
                }
              }
            },
            closed: () => {
              matterbridge.log.warn(`Matter commissioning controller trace-peer subscription closed for ${startedLabel}`);
              tracerSubscriptions.delete(peer.id);
            },
          });

          tracerSubscriptions.set(peer.id, subscriptionPromise);
          subscriptionPromise.catch((error: unknown) => {
            tracerSubscriptions.delete(peer.id);
            matterbridge.log.error(`Matter commissioning controller trace-peer subscription failed for ${startedLabel}: ${getErrorMessage(error)}`);
          });
        }

        if (hasParameter('dump-peer')) {
          void (async (): Promise<void> => {
            try {
              // Populate local cache for cluster client behaviors (includes BasicInformation on endpoint 0).
              for await (const chunk of peer.interaction.read(Read({ fabricFilter: true, attributes: [{}] }))) {
                for await (const _report of chunk) {
                  // Consuming each report updates the local state cache.
                }
              }

              // Logger.get(`PeerNode: ${startedLabel}`).info(peer);

              const basicInfo = peer.stateOf(BasicInformationClient);
              Logger.get(`BasicInformation: ${startedLabel}`).info(basicInfo);
            } catch (error) {
              matterbridge.log.error(`Matter commissioning controller dump-peer failed for ${startedLabel}: ${getErrorMessage(error)}`);
            }
          })();
        }
      });

      peer.lifecycle.offline.on(() => {
        matterbridge.log.warn(`Matter commissioning controller peer ${startedLabel} is offline`);
      });

      peer.eventsOf(NetworkClient).autoSubscribe$Changed.on((value, oldValue) => {
        matterbridge.log.info(
          `Matter commissioning controller peer ${startedLabel} autoSubscribe changed from ${oldValue ? 'active' : 'inactive'} to ${value ? 'active' : 'inactive'}`,
        );
      });

      peer.eventsOf(NetworkClient).defaultSubscription$Changed.on((value, oldValue) => {
        matterbridge.log.info(
          `Matter commissioning controller peer ${startedLabel} defaultSubscription changed from ${oldValue ? 'active' : 'inactive'} to ${value ? 'active' : 'inactive'}`,
        );
      });

      peer.eventsOf(NetworkClient).subscriptionStatusChanged.on((isActive) => {
        matterbridge.log.info(`Matter commissioning controller peer ${startedLabel} subscription is ${isActive ? 'active' : 'inactive'}`);
      });

      peer.eventsOf(NetworkClient).subscriptionAlive.on(() => {
        matterbridge.log.info(`Matter commissioning controller peer ${startedLabel} subscription alive event received`);
      });

      // Fire-and-forget: a peer may be offline; don't block controller startup.
      matterbridge.log.notice(`Starting matter commissioning controller peer ${startedLabel}...`);
      (peer.stateOf(NetworkClient).isDisabled ? peer.enable() : peer.start())
        .then(() => {
          matterbridge.log.notice(`Matter commissioning controller peer ${startedLabel} started successfully`);
          return;
        })
        .catch((error: unknown) => {
          matterbridge.log.error(`Matter commissioning controller failed to start peer ${startedLabel}: ${getErrorMessage(error)}`);
        });
    }
  }
}
