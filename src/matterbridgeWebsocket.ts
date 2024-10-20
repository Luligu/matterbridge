/**
 * This file contains the function matterbridgeMessageHandler.
 *
 * @file matterbridgeWebsocket.ts
 * @author Luca Liguori
 * @date 2024-10-16
 * @version 1.0.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

import WebSocket from 'ws';
import { Matterbridge } from './matterbridge.js';
import { debugStringify } from 'node-ansi-logger';
import { isValidNumber, isValidObject, isValidString } from './utils/utils.js';
import { Logger } from '@project-chip/matter-node.js/log';
import { EndpointNumber } from '@project-chip/matter-node.js/datatype';
import { BasicInformationCluster, BridgedDeviceBasicInformationCluster } from '@project-chip/matter-node.js/cluster';

export async function wsMessageHandler(this: Matterbridge, client: WebSocket, message: WebSocket.RawData): Promise<void> {
  let data: { id: number; dst: string; src: string; method: string; params: Record<string, string | number | boolean> };
  try {
    data = JSON.parse(message.toString());
    if (!isValidNumber(data.id) || !isValidString(data.dst) || !isValidString(data.src) || !isValidString(data.method) || !isValidObject(data.params) || data.dst !== 'Matterbridge') {
      this.log.error(`Invalid message from websocket client ${client.url}: ${debugStringify(data)}`);
      client.send(JSON.stringify({ id: data.id, src: 'Matterbridge', error: 'Invalid message' }));
      return;
    }
    if (data.method === '/api/settings') {
      this.matterbridgeInformation.bridgeMode = this.bridgeMode;
      this.matterbridgeInformation.restartMode = this.restartMode;
      this.matterbridgeInformation.loggerLevel = this.log.logLevel;
      this.matterbridgeInformation.matterLoggerLevel = Logger.defaultLogLevel;
      this.matterbridgeInformation.mattermdnsinterface = (await this.nodeContext?.get<string>('mattermdnsinterface', '')) || '';
      this.matterbridgeInformation.matteripv4address = (await this.nodeContext?.get<string>('matteripv4address', '')) || '';
      this.matterbridgeInformation.matteripv6address = (await this.nodeContext?.get<string>('matteripv6address', '')) || '';
      this.matterbridgeInformation.matterbridgePaired = this.matterbridgePaired;
      this.matterbridgeInformation.matterbridgeConnected = this.matterbridgeConnected;
      this.matterbridgeInformation.matterbridgeQrPairingCode = this.matterbridgeQrPairingCode;
      this.matterbridgeInformation.matterbridgeManualPairingCode = this.matterbridgeManualPairingCode;
      this.matterbridgeInformation.matterbridgeFabricInformations = this.matterbridgeFabricInformations;
      this.matterbridgeInformation.matterbridgeSessionInformations = Array.from(this.matterbridgeSessionInformations.values());
      this.matterbridgeInformation.profile = this.profile;
      const response = { systemInformation: this.systemInformation, matterbridgeInformation: this.matterbridgeInformation };
      client.send(JSON.stringify({ id: data.id, src: 'Matterbridge', response }));
      return;
    } else if (data.method === '/api/devices') {
      const data: { pluginName: string; type: string; endpoint: EndpointNumber | undefined; name: string; serial: string; uniqueId: string; cluster: string }[] = [];
      this.devices.forEach(async (device) => {
        let name = device.getClusterServer(BasicInformationCluster)?.attributes.nodeLabel?.getLocal();
        if (!name) name = device.getClusterServer(BridgedDeviceBasicInformationCluster)?.attributes.nodeLabel?.getLocal() ?? 'Unknown';
        let serial = device.getClusterServer(BasicInformationCluster)?.attributes.serialNumber?.getLocal();
        if (!serial) serial = device.getClusterServer(BridgedDeviceBasicInformationCluster)?.attributes.serialNumber?.getLocal() ?? 'Unknown';
        let uniqueId = device.getClusterServer(BasicInformationCluster)?.attributes.uniqueId?.getLocal();
        if (!uniqueId) uniqueId = device.getClusterServer(BridgedDeviceBasicInformationCluster)?.attributes.uniqueId?.getLocal() ?? 'Unknown';
        const cluster = this.getClusterTextFromDevice(device);
        data.push({
          pluginName: device.plugin ?? 'Unknown',
          type: device.name + ' (0x' + device.deviceType.toString(16).padStart(4, '0') + ')',
          endpoint: device.number,
          name,
          serial,
          uniqueId,
          cluster: cluster,
        });
      });
    }
  } catch (error) {
    this.log.error(`Error parsing message from websocket client:`, error instanceof Error ? error.message : error);
    return;
  }
  this.log.debug(`Received message from websocket client ${client.url}: ${debugStringify(data)}`);
}
