/**
 * This file contains the class MatterbridgeComposed.
 *
 * @file matterbridgeComposed.ts
 * @author Luca Liguori
 * @date 2024-02-27
 * @version 1.0.0
 *
 * Copyright 2024 Luca Liguori.
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

// Just a test if it is possible to aggregate devices without an aggregator
// DONT USE THIS

import { CommissioningServer, CommissioningServerOptions } from '@project-chip/matter-node.js';
import { Device } from '@project-chip/matter-node.js/device';

export class MatterbridgeComposed extends CommissioningServer {
  /**
   * Create a new Aggregator instance and optionally directly add devices to it. If this is used the devices must
   * already have the BridgedDeviceBasicInformationCluster added!
   * @param devices Array of devices to add
   * @param options Optional Endpoint options
   */
  constructor(devices: Device[], options: CommissioningServerOptions) {
    /*
    // Aggregator is a Composed device with an DeviceTypes.AGGREGATOR device type
    const deviceType = DeviceTypeDefinition({
      name: 'MA-composed',
      code: 0x0015,
      deviceClass: DeviceClasses.Composed,
      revision: 1,
    });
    */
    super(options);
    devices.forEach((device) => this.addRootDevice(device));
  }

  /**
   * Add a sub-device to the composed device.
   * @param device Device instance to add
   */
  addRootDevice(device: Device) {
    this.getRootEndpoint().addChildEndpoint(device);
  }
}
