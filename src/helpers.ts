/**
 * This file contains the helpers functions of Matterbridge.
 *
 * @file helpers.ts
 * @author Luca Liguori
 * @date 2025-05-12
 * @version 1.0.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// @matter module
import { OnOff } from '@matter/main/clusters/on-off';
import { Endpoint } from '@matter/node';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { OnOffBaseServer } from '@matter/node/behaviors/on-off';
import { OnOffPlugInUnitDevice } from '@matter/node/devices/on-off-plug-in-unit';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';

import { hasParameter } from './utils/commandLine.js';
import { Matterbridge } from './matterbridge.js';
import { MountedOnOffControlDevice } from '@matter/node/devices/mounted-on-off-control';
import { OnOffLightDevice } from '@matter/node/devices/on-off-light';
import { OnOffLightSwitchDevice } from '@matter/node/devices/on-off-light-switch';

/**
 * Adds a virtual device to the provided endpoint, sets up an event listener for device state changes,
 * and ensures the device is initialized in the off state.
 *
 * @param {Endpoint<AggregatorEndpoint>} aggregatorEndpoint - The aggragator endpoint to which the virtual device will be added.
 * @param {string} name - The name of the virtual device. Spaces in the name are removed to form the device ID.
 * @param {'light' | 'outlet' | 'switch' | 'mounted_switch'} type - The type of the virtual device. Can be 'light', 'outlet', 'switch', or 'mounted_switch'.
 * @param {() => Promise<void>} callback - A callback function that gets executed when the device's on/off state changes to true.
 * @returns {Promise<Endpoint>} A promise that resolves with the created virtual device.
 * @remark The virtual device is created as an instance of `Endpoint` with the `OnOffPlugInUnitDevice` device type.
 * The onOff state always reverts to false when the device is turned on.
 */
export async function addVirtualDevice(aggregatorEndpoint: Endpoint<AggregatorEndpoint>, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>): Promise<Endpoint> {
  // Create a new virtual device by instantiating `Endpoint` with device information.
  // The device ID is created by replacing all spaces in the name with an empty string.
  // The node label of the bridged device basic information is set to the given name.
  let deviceType;
  switch (type) {
    case 'light':
      deviceType = OnOffLightDevice.with(BridgedDeviceBasicInformationServer);
      break;
    case 'outlet':
      deviceType = OnOffPlugInUnitDevice.with(BridgedDeviceBasicInformationServer);
      break;
    case 'switch':
      deviceType = OnOffLightSwitchDevice.with(BridgedDeviceBasicInformationServer, OnOffBaseServer);
      break;
    case 'mounted_switch':
      deviceType = MountedOnOffControlDevice.with(BridgedDeviceBasicInformationServer);
      break;
  }
  const device = new Endpoint(deviceType, {
    id: name.replaceAll(' ', '') + ':' + type,
    bridgedDeviceBasicInformation: { nodeLabel: name.slice(0, 32) },
    onOff: { onOff: false, startUpOnOff: OnOff.StartUpOnOff.Off },
  });

  // Set up an event listener for when the `onOff` state changes.
  device.events.onOff.onOff$Changed.on((value) => {
    // If the `onOff` state becomes true, turn off the virtual device and execute the callback.
    if (value) {
      callback();
      process.nextTick(async () => {
        try {
          await device.setStateOf(OnOffBaseServer, { onOff: false });
        } catch (_error) {
          // Not necessary to handle the error
        }
      });
    }
  });

  // Add the created device to the given endpoint.
  await aggregatorEndpoint.add(device);

  // Initially set the state of the virtual device's `OnOffBaseServer` to false (off).
  await device.setStateOf(OnOffBaseServer, { onOff: false });

  return device;
}

/**
 * Creates and add the virtual devices to the aggregator.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance.
 * @param {Endpoint<AggregatorEndpoint>} aggregatorEndpoint - The aggregator node to add the virtual devices to.
 * @returns {Promise<void>} A promise that resolves when the virtual devices are added.
 */
export async function addVirtualDevices(matterbridge: Matterbridge, aggregatorEndpoint: Endpoint<AggregatorEndpoint>): Promise<void> {
  if (matterbridge.matterbridgeInformation.virtualMode !== 'disabled' && matterbridge.bridgeMode === 'bridge' && aggregatorEndpoint) {
    matterbridge.log.notice(`Creating virtual devices for Matterbridge server node...`);
    await addVirtualDevice(aggregatorEndpoint, 'Restart Matterbridge', matterbridge.matterbridgeInformation.virtualMode, async () => {
      if (matterbridge.restartMode === '') await matterbridge.restartProcess();
      else await matterbridge.shutdownProcess();
    });
    await addVirtualDevice(aggregatorEndpoint, 'Update Matterbridge', matterbridge.matterbridgeInformation.virtualMode, async () => {
      if (hasParameter('shelly')) {
        const { getShelly } = await import('./shelly.js');
        getShelly('/api/updates/sys/perform', 10 * 1000)
          .then(() => {
            matterbridge.log.notice('Shelly system updated successfully');
          })
          .catch((error) => {
            matterbridge.log.error(`Error updating shelly system: ${error}`);
          });
        getShelly('/api/updates/main/perform', 10 * 1000)
          .then(() => {
            matterbridge.log.notice('Shelly software updated successfully');
          })
          .catch((error) => {
            matterbridge.log.error(`Error updating shelly software: ${error}`);
          });
      } else {
        await matterbridge.updateProcess();
      }
    });
    if (hasParameter('shelly')) {
      await addVirtualDevice(aggregatorEndpoint, 'Reboot Matterbridge', matterbridge.matterbridgeInformation.virtualMode, async () => {
        const { postShelly } = await import('./shelly.js');
        postShelly('/api/system/reboot', {}, 60 * 1000)
          .then(() => {
            matterbridge.log.notice('Rebooting shelly board...');
          })
          .catch((error) => {
            matterbridge.log.error(`Error rebooting shelly board: ${error}`);
          });
      });
    }
  }
}
