/**
 * @file packages/core/src/helpers.ts
 * @description This file contains the helpers functions of Matterbridge.
 * @author Luca Liguori
 * @created 2025-05-12
 * @version 1.0.0
 * @license Apache-2.0
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
 * limitations under the License.
 */

// @matter module
import { Endpoint } from '@matter/node';
import { BindingServer } from '@matter/node/behaviors/binding';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { OnOffBaseServer, OnOffServer } from '@matter/node/behaviors/on-off';
import { MountedOnOffControlDevice } from '@matter/node/devices/mounted-on-off-control';
import { OnOffLightDevice } from '@matter/node/devices/on-off-light';
import { OnOffLightSwitchDevice } from '@matter/node/devices/on-off-light-switch';
import { OnOffPlugInUnitDevice } from '@matter/node/devices/on-off-plug-in-unit';
import type { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { EndpointNumber, VendorId } from '@matter/types/datatype';
import { logModuleLoaded } from '@matterbridge/utils/loader';

// matterbridge
import type { Matterbridge } from './matterbridge.js';
import { getSupportedDeviceType } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

logModuleLoaded('MatterbridgeHelpers');

/**
 * Adds a virtual device to the provided endpoint, sets up an event listener for device state changes,
 * and ensures the device is initialized in the off state.
 *
 * @param {Endpoint<AggregatorEndpoint>} aggregatorEndpoint - The aggragator endpoint to which the virtual device will be added.
 * @param {string} name - The name of the virtual device. Spaces in the name are removed to form the device ID.
 * @param {'light' | 'outlet' | 'switch' | 'mounted_switch'} type - The type of the virtual device. Can be 'light', 'outlet', 'switch', or 'mounted_switch'.
 * @param {() => Promise<void>} callback - A callback function that gets executed when the device's on/off state changes to true.
 * @returns {Promise<Endpoint>} A promise that resolves with the created virtual device.
 * @remarks The virtual device is created as an instance of `Endpoint` with the `OnOffPlugInUnitDevice` device type.
 * The onOff state always reverts to false when the device is turned on.
 */
export async function addVirtualDevice(
  aggregatorEndpoint: Endpoint<AggregatorEndpoint>,
  name: string,
  type: 'light' | 'outlet' | 'switch' | 'mounted_switch',
  callback: () => Promise<void>,
): Promise<Endpoint> {
  // Create a new virtual device by instantiating `Endpoint` with device information.
  // The device ID is created by replacing all spaces in the name with an empty string.
  // The node label of the bridged device basic information is set to the given name.
  let deviceType;
  // oxlint-disable-next-line default-case
  switch (type) {
    case 'light':
      deviceType = OnOffLightDevice.with(BridgedDeviceBasicInformationServer);
      break;
    case 'outlet':
      deviceType = OnOffPlugInUnitDevice.with(BridgedDeviceBasicInformationServer);
      break;
    case 'switch':
      // OnOff server cluster is extraneous for this device type but needed for Apple Home to show a switch.
      deviceType = OnOffLightSwitchDevice.with(BridgedDeviceBasicInformationServer, OnOffServer.with(), BindingServer);
      break;
    case 'mounted_switch':
      deviceType = MountedOnOffControlDevice.with(BridgedDeviceBasicInformationServer);
      break;
  }
  const device = new Endpoint(deviceType, {
    id: name.replaceAll(' ', '') + ':' + type,
    bridgedDeviceBasicInformation: {
      vendorId: VendorId(0xfff1),
      vendorName: 'Matterbridge',
      productName: 'Matterbridge Virtual Device',
      nodeLabel: name.slice(0, 32),
      softwareVersion: 20000,
      softwareVersionString: '2.0.0',
    },
    onOff: { onOff: false },
  });

  // Set up an event listener for when the `onOff` state changes.
  device.events.onOff.onOff$Changed.on((value) => {
    // If the `onOff` state becomes true, turn off the virtual device and execute the callback.
    if (value) {
      void callback().catch(
        /* v8 ignore next */ () => {
          // Noop
        },
      );
      void device.setStateOf(OnOffServer, { onOff: false }).catch(
        /* v8 ignore next */ () => {
          // Noop
        },
      );
    }
  });

  // Add the created device to the given endpoint.
  await aggregatorEndpoint.add(device);
  await device.construction.ready;

  // Add the OnOffPlugInUnit to MountedOnOffControlDevice (Matter 1.4.2 specs added this (new case of superset) for legacy controllers to recognize the mounted switch).
  if (type === 'mounted_switch') {
    await device.act(async (agent) => {
      const descriptor = await agent.load(DescriptorServer);
      descriptor.addDeviceTypes('OnOffPlugInUnit');
    });
  }

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
  await createChipTestDevices(matterbridge, aggregatorEndpoint);
  if (!process.env.MATTERBRIDGE_CHIP_TEST && matterbridge.virtualMode !== 'disabled' && matterbridge.bridgeMode === 'bridge' && aggregatorEndpoint) {
    matterbridge.log.notice(`Creating virtual devices for Matterbridge server node...`);
    await addVirtualDevice(aggregatorEndpoint, 'Restart Matterbridge', matterbridge.virtualMode, async () => {
      if (matterbridge.restartMode === 'none') await matterbridge.restartProcess();
      else await matterbridge.shutdownProcess();
    });
    await addVirtualDevice(aggregatorEndpoint, 'Update Matterbridge', matterbridge.virtualMode, async () => {
      await matterbridge.updateProcess();
    });
  }
}

// v8 ignore start - No test cause is just a way to easily add new devices for testing purposes without using plugins
// Run with: MATTERBRIDGE_CHIP_TEST=1 MATTERBRIDGE_RUN_CHIP_TEST=1 matterbridge
async function createChipTestDevices(matterbridge: Matterbridge, aggregatorEndpoint: Endpoint<AggregatorEndpoint>): Promise<void> {
  if (!process.env.MATTERBRIDGE_CHIP_TEST || !process.env.MATTERBRIDGE_RUN_CHIP_TEST || matterbridge.bridgeMode !== 'bridge' || !aggregatorEndpoint) return;
  let ep: MatterbridgeEndpoint | undefined;
  matterbridge.plugins.set({
    name: 'matterbridge-chip',
    path: '',
    type: 'DynamicPlatform',
    version: '1.0.0',
    description: 'Chip test plugin',
    author: 'Matterbridge',
    enabled: false,
    private: false,
    registeredDevices: 0,
  });

  const registerDevice = async (device: MatterbridgeEndpoint, deviceName: string, serialNumber: string): Promise<void> => {
    device.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber);
    device.addRequiredClusters();
    device.plugin = 'matterbridge-chip';
    await matterbridge.addBridgedEndpoint('matterbridge-chip', device);
  };

  // oxlint-disable typescript/no-non-null-assertion
  const bridgedNode = getSupportedDeviceType('BridgedNode')!;
  const powerSource = getSupportedDeviceType('PowerSource')!;

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ContactSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_01) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultBooleanStateClusterServer();
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Contact Sensor', 'SENSOR-07-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('LightSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_02) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Light Sensor', 'SENSOR-07-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OccupancySensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_03) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Occupancy Sensor', 'SENSOR-07-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('TemperatureSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_04) });
  ep.createDefaultPowerSourceReplaceableBatteryClusterServer();
  await registerDevice(ep, 'Temperature Sensor', 'SENSOR-07-04');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('PressureSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_05) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Pressure Sensor', 'SENSOR-07-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('FlowSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_06) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Flow Sensor', 'SENSOR-07-06');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('HumiditySensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_07) });
  ep.createDefaultPowerSourceRechargeableBatteryClusterServer();
  await registerDevice(ep, 'Humidity Sensor', 'SENSOR-07-07');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OnOffSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_08) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'On/Off Sensor', 'SENSOR-07-08');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { number: EndpointNumber(7_09) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Smoke/CO Alarm', 'SENSOR-07-09');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('AirQualitySensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_10) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Air Quality Sensor', 'SENSOR-07-10');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WaterFreezeDetector')!, bridgedNode, powerSource], { number: EndpointNumber(7_11) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultBooleanStateClusterServer(false);
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Water Freeze Detector', 'SENSOR-07-11');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WaterLeakDetector')!, bridgedNode, powerSource], { number: EndpointNumber(7_12) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultBooleanStateClusterServer(false);
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Water Leak Detector', 'SENSOR-07-12');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('RainSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_13) });
  ep.createDefaultPowerSourceRechargeableBatteryClusterServer();
  ep.createDefaultBooleanStateClusterServer(false);
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Rain Sensor', 'SENSOR-07-13');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SoilSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_14) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Soil Sensor', 'SENSOR-07-14');
}
// v8 ignore end
