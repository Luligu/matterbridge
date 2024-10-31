/**
 * This file contains the class MatterbridgeController.
 *
 * @file matterbridge.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.2.0
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
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
 * limitations under the License. *
 */

/*
import { MatterbridgeDevice, SerializedMatterbridgeDevice } from './matterbridgeDevice.js';

import { NodeStorageManager, NodeStorage } from 'node-persist-manager';
import { AnsiLogger, BRIGHT, RESET, TimestampFormat, UNDERLINE, UNDERLINEOFF, YELLOW, db, debugStringify, stringify, er, nf, rs, wr } from 'node-ansi-logger';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import express from 'express';
import os from 'os';
import path from 'path';

import { CommissioningController, CommissioningServer, MatterServer } from '@project-chip/matter-node.js';
import { BasicInformationCluster, BridgedDeviceBasicInformationCluster, ClusterServer } from '@project-chip/matter-node.js/cluster';
import { DeviceTypeId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Aggregator, Device, DeviceTypes } from '@project-chip/matter-node.js/device';
import { Format, Level, Logger } from '@project-chip/matter-node.js/log';
import { QrCodeSchema } from '@project-chip/matter-node.js/schema';
import { StorageBackendDisk, StorageBackendJsonFile, StorageContext, StorageManager } from '@project-chip/matter-node.js/storage';
import { requireMinNodeVersion, getParameter, getIntParameter, hasParameter } from '@project-chip/matter-node.js/util';
import { CryptoNode } from '@project-chip/matter-node.js/crypto';
import { logEndpoint } from '@project-chip/matter-node.js/device';
import { Matterbridge } from './matterbridge.js';
*/
export function startController() {
  /*
   npm run  matter-controller -- --log-level=debug --storage-clear --pairingcode=05410803219
   -- undefined-0-53 id: 0 name: channel: 25
-- undefined-0-53 id: 1 name: routingRole: 5
-- undefined-0-53 id: 2 name: networkName: MyHome32
-- undefined-0-53 id: 3 name: panId: 32477
-- undefined-0-53 id: 4 name: extendedPanId: 8704323698196694754
-- undefined-0-53 id: 5 name: meshLocalPrefix: "40fd78cbf849390000"
*/
  // const log: AnsiLogger;
  /*
  async startController() {
    this.log.info('Creating mattercontrollerContext: mattercontrollerContext');
    mattercontrollerContext = storageManager.createContext('mattercontrollerContext');

    await createMatterServer(storageManager);

    this.log.info('Creating matter commissioning controller');
    commissioningController = new CommissioningController({
      autoConnect: false,
    });
    await matterServer.addCommissioningController(commissioningController);

    this.log.info('Starting matter server');
    await matterServer.start();
    this.log.info('Started matter server');

    AllClustersMap[EveHistoryCluster.id] = EveHistoryCluster;
    this.log.info('Added custom cluster:', getClusterNameById(EveHistoryCluster.id));

    if (hasParameter('ble')) {
      //
    }

    if (hasParameter('pairingcode')) {
      const pairingCode = getParameter('pairingcode');
      const ip = mattercontrollerContext.has('ip') ? mattercontrollerContext.get<string>('ip') : undefined;
      const port = mattercontrollerContext.has('port') ? mattercontrollerContext.get<number>('port') : undefined;

      let longDiscriminator, setupPin, shortDiscriminator;
      if (pairingCode !== undefined) {
        const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
        shortDiscriminator = pairingCodeCodec.shortDiscriminator;
        longDiscriminator = undefined;
        setupPin = pairingCodeCodec.passcode;
        logger.debug(`Data extracted from pairing code: ${Logger.toJSON(pairingCodeCodec)}`);
      } else {
        longDiscriminator = mattercontrollerContext.get('longDiscriminator', 3840);
        if (longDiscriminator > 4095) throw new Error('Discriminator value must be less than 4096');
        setupPin = mattercontrollerContext.get('pin', 20202021);
      }
      if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
        throw new Error('Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with -passcode');
      }

      const commissioningOptions: CommissioningOptions = {
        regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
        regulatoryCountryCode: 'XX',
      };
      const options = {
        commissioning: commissioningOptions,
        discovery: {
          knownAddress: ip !== undefined && port !== undefined ? { ip, port, type: 'udp' } : undefined,
          identifierData: longDiscriminator !== undefined ? { longDiscriminator } : shortDiscriminator !== undefined ? { shortDiscriminator } : {},
        },
        passcode: setupPin,
      } as NodeCommissioningOptions;
      this.log.info(`Commissioning ... ${JSON.stringify(options)}`);
      const nodeId = await commissioningController.commissionNode(options);
      mattercontrollerContext.set('nodeId', nodeId.nodeId);
      this.log.info(`Commissioning successfully done with nodeId: ${nodeId.nodeId}`);
      console.log('ActiveSessionInformation:', commissioningController.getActiveSessionInformation());
    } // (hasParameter('pairingcode'))

    if (hasParameter('discover')) {
      Logger.defaultLogLevel = Level.DEBUG;
      const discover = await commissioningController.discoverCommissionableDevices({});
      console.log(discover);
      Logger.defaultLogLevel = Level.INFO;
    }

    this.log.info(`Commissioning controller is already commisioned: ${commissioningController.isCommissioned()}`);
    const nodes = commissioningController.getCommissionedNodes();
    nodes.forEach(async (nodeId) => {
      this.log.warn(`Connecting to commissioned node: ${nodeId}`);
      const node = await commissioningController.connectNode(nodeId, {
        attributeChangedCallback: (peerNodeId, { path: { nodeId, clusterId, endpointId, attributeName }, value }) =>
          console.log(`\x1b[37;44mattributeChangedCallback ${peerNodeId}: Attribute ${nodeId}/${endpointId}/${clusterId}/${attributeName} changed to ${Logger.toJSON(value)}\x1b[40;0m`),
        eventTriggeredCallback: (peerNodeId, { path: { nodeId, clusterId, endpointId, eventName }, events }) =>
          console.log(`\x1b[37;44meventTriggeredCallback ${peerNodeId}: Event ${nodeId}/${endpointId}/${clusterId}/${eventName} triggered with ${Logger.toJSON(events)}\x1b[40;0m`),
        stateInformationCallback: (peerNodeId, info) => {
          switch (info) {
            case NodeStateInformation.Connected:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} connected\x1b[40;0m`);
              break;
            case NodeStateInformation.Disconnected:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} disconnected\x1b[40;0m`);
              break;
            case NodeStateInformation.Reconnecting:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} reconnecting\x1b[40;0m`);
              break;
            case NodeStateInformation.WaitingForDeviceDiscovery:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} waiting for device discovery\x1b[40;0m`);
              break;
            case NodeStateInformation.StructureChanged:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} structure changed\x1b[40;0m`);
              break;
            case NodeStateInformation.Decommissioned:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} decommissioned\x1b[40;0m`);
              break;
            default:
              console.log(`\x1b[37;44mstateInformationCallback ${peerNodeId}: Node ${nodeId} NodeStateInformation.${info}\x1b[40;0m`);
              break;
          }
        },
      });

      const info = node.getRootClusterClient(BasicInformationCluster);
      let name = '';
      if (info !== undefined) {
        this.log.info(`Node ${nodeId} VendorName ${await info.getVendorNameAttribute()}`); // This call is executed remotely
        this.log.info(`Node ${nodeId} ProductName ${(name = await info.getProductNameAttribute())}`); // This call is executed remotely
        this.log.info(`Node ${nodeId} NodeLabel ${await info.getNodeLabelAttribute()}`); // This call is executed remotely
        this.log.info(`Node ${nodeId} ProductLabel ${await info.getProductLabelAttribute()}`); // This call is executed remotely
        this.log.info(`Node ${nodeId} SerialNumber ${await info.getSerialNumberAttribute()}`); // This call is executed remotely
        this.log.info(`Node ${nodeId} UniqueId ${await info.getUniqueIdAttribute()}`); // This call is executed remotely
      } else {
        this.log.error('No BasicInformation Cluster found. This should never happen!');
      }

      this.log.warn(`Logging commissioned node: ${nodeId} name: ${name}`);
      //node.logStructure();

      const mattercontrollerNodeContext = storageManager.createContext(name);
      const interactionClient = await node.getInteractionClient();

      // Log BasicInformationCluster
      const attributesInfoCluster = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: BasicInformationCluster.id }],
      });
      attributesInfoCluster.forEach((attribute) => {
        this.log.info(
          `${name}:BasicInformationCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      // Log PowerSourceConfigurationCluster
      const attributesPowerConfigCluster = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: PowerSourceConfigurationCluster.id }],
      });
      attributesPowerConfigCluster.forEach((attribute) => {
        this.log.info(
          `${name}:PowerSourceConfigurationCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      // Log PowerSourceCluster
      const attributesPowerCluster = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: PowerSourceCluster.id }],
      });
      attributesPowerCluster.forEach((attribute) => {
        this.log.info(
          `${name}:PowerSourceCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      // Log ThreadNetworkDiagnostics
      const attributesThreadCluster = await interactionClient.getMultipleAttributes({
        attributes: [{ clusterId: ThreadNetworkDiagnosticsCluster.id }],
      });
      attributesThreadCluster.forEach((attribute) => {
        this.log.info(
          `${name}:ThreadNetworkDiagnosticsCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
        );
      });

      const devices = node.getDevices();
      devices.forEach(async (device) => {
        this.log.info(`Device id: ${device.id} name: ${device.name}`);
        //logEndpoint(device);

        const eveHistory = device.getClusterClient(EveHistoryCluster);
        if (eveHistory !== undefined) {
          this.log.info(`EveHistory found on id: ${device.id} name: ${device.name}`);

          // Log EveHistoryCluster
          const attributesEveHistoryCluster = await interactionClient.getMultipleAttributes({
            attributes: [{ clusterId: EveHistoryCluster.id }],
          });
          attributesEveHistoryCluster.forEach((attribute) => {
            this.log.info(
              `${name}:EveHistoryCluster ${attribute.path.nodeId}-${attribute.path.endpointId}-${attribute.path.clusterId} id: ${attribute.path.attributeId} name: ${attribute.path.attributeName}: ${typeof attribute.value === 'object' ? stringify(attribute.value) : attribute.value}`,
            );
          });

          const history = new MatterHistory(this.log, name, { fileName: name + '_history.json' });
          let logMessage = '';

          // Get and decode HistoryStatus
          const historyStatus: Uint8Array = await eveHistory.getHistoryStatusAttribute();
          this.log.info((logMessage = history.decodeHistoryStatus(Buffer.from(historyStatus))));
          fs.appendFileSync(name + '.log', logMessage + '\n');

          // Set HistorySetTime
          const bufferSetTime = history.encodeHistorySetTime();
          this.log.info((logMessage = history.decodeHistorySetTime(bufferSetTime)));
          fs.appendFileSync(name + '.log', logMessage + '\n');
          await eveHistory.setHistorySetTimeAttribute(bufferSetTime);

          // Set HistoryRequest
          const entryNumber = mattercontrollerNodeContext.get('nextEntry', history.getFirstEntry());
          const bufferRequest = history.encodeHistoryRequest(history.clamp(entryNumber, history.getFirstEntry(), history.getLastEntry()));
          this.log.info((logMessage = history.decodeHistoryRequest(bufferRequest)));
          fs.appendFileSync(name + '.log', logMessage + '\n');
          await eveHistory.setHistoryRequestAttribute(bufferRequest);

          // Get HistoryEntries
          let historyEntries: Uint8Array = await eveHistory.getHistoryEntriesAttribute();
          let bufferHistoryEntries = Buffer.from(historyEntries);
          //console.log(history.historyEntriesToString(bufferHistoryEntries));
          while (bufferHistoryEntries.length > 0) {
            for (let i = 0; i < bufferHistoryEntries.length; ) {
              const bufferHistoryEntry = Buffer.copyBytesFrom(bufferHistoryEntries, i, bufferHistoryEntries.readUInt8(i));
              i += bufferHistoryEntries.readUInt8(i);
              history.decodeHistoryEntry(bufferHistoryEntry);
              this.log.info((logMessage = history.historyEntryToString(bufferHistoryEntry)));
              fs.appendFileSync(name + '.log', logMessage + '\n');
              mattercontrollerNodeContext.set('nextEntry', bufferHistoryEntry.readUInt32LE(1) + 1);
            }
            historyEntries = await eveHistory.getHistoryEntriesAttribute();
            bufferHistoryEntries = Buffer.from(historyEntries);
            //console.log(history.historyEntriesToString(bufferHistoryEntries));
          }
          history.writeHistoryFile();
          //history.logHistory(true);

          eveHistory
            .subscribeHistoryStatusAttribute(
              (value: Uint8Array) => {
                this.log.warn('Received EveHistoryStatus:', value.toHex());
              },
              0,
              30,
            )
            .then(() => {
              this.log.warn('Subscription successful to EveHistoryStatus.');
            })
            .catch((error) => {
              this.log.error('Error during subscription to EveHistoryStatus:', error);
            });

          eveHistory
            .subscribeHistoryEntriesAttribute(
              (value: Uint8Array) => {
                this.log.warn('Received EveHistoryEntries:', value.toHex());
              },
              0,
              30,
            )
            .then(() => {
              this.log.warn('Subscription successful to EveHistoryEntries.');
            })
            .catch((error) => {
              this.log.error('Error during subscription to EveHistoryEntries:', error);
            });

          setInterval(async () => {
            try {
              const attributesEveCluster = await interactionClient.getMultipleAttributes({
                attributes: [{ clusterId: EveHistoryCluster.id }],
              });
              this.log.info('\x1b[97;45mEve device: ' + name + '\x1b[40;0m');

              attributesEveCluster.forEach((attribute) => {
                if (attribute.path.attributeId === EveHistoryCluster.attributes.ConfigDataGet.id) {
                  const data = Buffer.from(attribute.value);
                  logMessage = `ConfigDataGet(${data.length}): [${data.toHex()}]`;
                  this.log.info(logMessage);
                  this.log.info('*' + history.decodeConfigData(data));
                  fs.appendFileSync(name + '.config.log', logMessage + '\n');
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.HistoryStatus.id) {
                  logMessage = history.decodeHistoryStatus(Buffer.from(attribute.value));
                  this.log.info(logMessage);
                  fs.appendFileSync(name + '.log', logMessage + '\n');
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.HistoryEntries.id) {
                  const bufferHistoryEntries = Buffer.from(attribute.value);
                  for (let i = 0; i < bufferHistoryEntries.length; ) {
                    const bufferHistoryEntry = Buffer.copyBytesFrom(bufferHistoryEntries, i, bufferHistoryEntries.readUInt8(i));
                    i += bufferHistoryEntries.readUInt8(i);
                    history.decodeHistoryEntry(bufferHistoryEntry);
                    this.log.info((logMessage = history.historyEntryToString(bufferHistoryEntry)));
                    fs.appendFileSync(name + '.log', logMessage + '\n');
                  }
                  history.writeHistoryFile();
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.TimesOpened.id) {
                  this.log.info(`TimesOpened: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.LastEvent.id) {
                  this.log.info(`LastEvent: ${attribute.value}=${history.secsToDateString(attribute.value + history.getInitialTime() - history.getTimeOffset())}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.ResetTotal.id) {
                  this.log.info(`ResetTotal: ${attribute.value}=${history.secsToDateStringSinceEveEpoch(attribute.value)}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.Voltage.id) {
                  this.log.info(`Voltage: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.Current.id) {
                  this.log.info(`Current: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.Consumption.id) {
                  this.log.info(`Consumption: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.TotalConsumption.id) {
                  this.log.info(`TotalConsumption: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.ChildLock.id) {
                  this.log.info(`ChildLock: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.MotionSensitivity.id) {
                  this.log.info(`MotionSensitivity: ${attribute.value}`);
                } else if (attribute.path.attributeId === EveHistoryCluster.attributes.RLoc.id) {
                  this.log.info((logMessage = `RLoc: 0x${attribute.value.toString(16)}`));
                } else {
                  if (attribute.path.attributeId >= 0x130a0000) {
                    this.log.info(`Unknown attribute ${attribute.path.attributeName} type: ${typeof attribute.value} value: [${attribute.value.toString(16)}]${attribute.value}`);
                  }
                }
              });
            } catch (error) {
              console.error(error);
            }
          }, 30000);
        } else {
          this.log.info(`EveHistory not found on ${device.id} name: ${device.name}`);
        }
      }); // devices.forEach(async device => {
    }); // nodes.forEach(async nodeId => {

    if (hasParameter('unpairall')) {
      nodes.forEach(async (nodeId) => {
        await commissioningController.removeNode(nodeId);
      });
      process.exit(0);
    }
  }
  */
}
