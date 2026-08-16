/**
 * @file packages/core/src/chipTest.ts
 * @description This file contains the CHIP test helpers of Matterbridge.
 * @author Luca Liguori
 * @created 2026-08-16
 * @version 1.0.0
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

/* v8 ignore start - No test cause is just a way to easily add new devices for testing purposes without using plugins */
/* oxlint-disable typescript/no-non-null-assertion */

import { spawnSync } from 'node:child_process';
import { closeSync, constants, existsSync, openSync, readSync, unlinkSync } from 'node:fs';

import type { Endpoint } from '@matter/node';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import type { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { EndpointNumber } from '@matter/types/datatype';

import { cliEmitter } from './cliEmitter.js';
import type { Matterbridge } from './matterbridge.js';
import { getSupportedDeviceType } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

type ChipTestAppPipeCommand = {
  Name?: string;
  EndpointId?: number;
  NewState?: boolean;
  SensorFault?: number;
};

const chipTestAppPipePath = '/tmp/matterbridge-chip-test-app-pipe';
let closeChipTestAppPipe: (() => void) | undefined;

export async function createChipTestDevices(matterbridge: Matterbridge, aggregatorEndpoint: Endpoint<AggregatorEndpoint>): Promise<void> {
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

export function createChipTestAppPipe(matterbridge: Matterbridge, aggregatorEndpoint: Endpoint<AggregatorEndpoint>): void {
  closeChipTestAppPipe?.();

  try {
    if (existsSync(chipTestAppPipePath)) unlinkSync(chipTestAppPipePath);
    const mkfifo = spawnSync('mkfifo', [chipTestAppPipePath], { encoding: 'utf8' });
    if (mkfifo.status !== 0) {
      matterbridge.log.error(`Failed to create CHIP test app pipe ${chipTestAppPipePath}: ${mkfifo.stderr.trim()}`);
      return;
    }
  } catch (error) {
    matterbridge.log.error(`Failed to create CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  matterbridge.log.notice(`CHIP test app pipe listening on ${chipTestAppPipePath}`);
  let buffer = '';
  let commandQueue = Promise.resolve<null>(null);
  let isClosing = false;
  let pipeFd: number | undefined;
  let shutdownListener: (() => void) | undefined;

  const closePipe = (): void => {
    isClosing = true;
    if (shutdownListener) {
      cliEmitter.off('shutdown', shutdownListener);
      shutdownListener = undefined;
    }
    if (pipeFd !== undefined) {
      try {
        closeSync(pipeFd);
      } catch (error) {
        matterbridge.log.debug(`Failed to close CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      pipeFd = undefined;
    }
    try {
      if (existsSync(chipTestAppPipePath)) unlinkSync(chipTestAppPipePath);
    } catch (error) {
      matterbridge.log.debug(`Failed to remove CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    closeChipTestAppPipe = undefined;
  };

  const enqueueCommand = (line: string): void => {
    const commandLine = line.trim();
    if (!commandLine) return;
    commandQueue = commandQueue
      .then(async (): Promise<null> => {
        const command: unknown = JSON.parse(commandLine);
        if (!isChipTestAppPipeCommand(command)) {
          matterbridge.log.warn(`Ignoring invalid CHIP test app pipe command: ${commandLine}`);
          return null;
        }
        await handleChipTestAppPipeCommand(matterbridge, aggregatorEndpoint, command);
        return null;
      })
      .catch((error: unknown): null => {
        matterbridge.log.error(`Failed to handle CHIP test app pipe command ${commandLine}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
  };

  const handleChunk = (chunk: string): void => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      enqueueCommand(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  };

  try {
    // oxlint-disable-next-line no-bitwise
    pipeFd = openSync(chipTestAppPipePath, constants.O_RDWR | constants.O_NONBLOCK);
  } catch (error) {
    matterbridge.log.error(`Failed to open CHIP test app pipe ${chipTestAppPipePath}: ${error instanceof Error ? error.message : String(error)}`);
    closePipe();
    return;
  }

  const readBuffer = Buffer.alloc(4096);
  const pollInterval = setInterval(() => {
    if (isClosing || pipeFd === undefined) return;
    try {
      let bytesRead = readSync(pipeFd, readBuffer, 0, readBuffer.length, null);
      while (bytesRead > 0) {
        handleChunk(readBuffer.toString('utf8', 0, bytesRead));
        bytesRead = readSync(pipeFd, readBuffer, 0, readBuffer.length, null);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && ['EAGAIN', 'EWOULDBLOCK'].includes(String(error.code))) return;
      matterbridge.log.error(`CHIP test app pipe ${chipTestAppPipePath} read error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 50);
  pollInterval.unref();

  const closePipeWithInterval = (): void => {
    clearInterval(pollInterval);
    closePipe();
  };
  closeChipTestAppPipe = closePipeWithInterval;
  shutdownListener = closePipeWithInterval;
  cliEmitter.once('shutdown', shutdownListener);
}

async function handleChipTestAppPipeCommand(matterbridge: Matterbridge, aggregatorEndpoint: Endpoint<AggregatorEndpoint>, command: ChipTestAppPipeCommand): Promise<void> {
  const endpointId = command.EndpointId ?? (command.Name === 'SimulateConfigurationVersionChange' ? 701 : undefined);
  if (endpointId === undefined) {
    matterbridge.log.warn(`Ignoring CHIP test app pipe command without EndpointId: ${JSON.stringify(command)}`);
    return;
  }
  const endpoint = getChipTestEndpoint(aggregatorEndpoint, endpointId);
  if (!endpoint) {
    matterbridge.log.warn(`Ignoring CHIP test app pipe command for unknown endpoint ${endpointId}: ${JSON.stringify(command)}`);
    return;
  }

  switch (command.Name) {
    case 'SetBooleanState':
      await endpoint.setStateOf(endpoint.behaviors.supported.booleanState, { stateValue: Boolean(command.NewState) });
      matterbridge.log.info(`CHIP test app pipe set BooleanState.StateValue to ${Boolean(command.NewState)} on endpoint ${endpointId}`);
      return;
    case 'SetBooleanStateSensorFault':
      await endpoint.setStateOf(endpoint.behaviors.supported.booleanStateConfiguration, { sensorFault: { generalFault: Boolean(command.SensorFault) } });
      matterbridge.log.info(`CHIP test app pipe set BooleanStateConfiguration.SensorFault to ${command.SensorFault ?? 0} on endpoint ${endpointId}`);
      return;
    case 'SimulateConfigurationVersionChange':
      endpoint.configurationVersion = (endpoint.stateOf(BridgedDeviceBasicInformationServer).configurationVersion ?? 1) + 1;
      await endpoint.setStateOf(BridgedDeviceBasicInformationServer, { configurationVersion: endpoint.configurationVersion });
      matterbridge.log.info(`CHIP test app pipe set BridgedDeviceBasicInformation.ConfigurationVersion to ${endpoint.configurationVersion} on endpoint ${endpointId}`);
      return;
    default:
      matterbridge.log.warn(`Ignoring unsupported CHIP test app pipe command: ${JSON.stringify(command)}`);
  }
}

function getChipTestEndpoint(aggregatorEndpoint: Endpoint<AggregatorEndpoint>, endpointId: number): MatterbridgeEndpoint | undefined {
  const endpoints = [aggregatorEndpoint as Endpoint, ...aggregatorEndpoint.parts];
  for (const endpoint of endpoints) {
    if (Number(endpoint.number) === endpointId && endpoint instanceof MatterbridgeEndpoint) return endpoint;
    for (const childEndpoint of endpoint.parts) {
      if (Number(childEndpoint.number) === endpointId && childEndpoint instanceof MatterbridgeEndpoint) return childEndpoint;
    }
  }
  return undefined;
}

function isChipTestAppPipeCommand(value: unknown): value is ChipTestAppPipeCommand {
  return (
    typeof value === 'object' &&
    value !== null &&
    (!('Name' in value) || typeof value.Name === 'string') &&
    (!('EndpointId' in value) || typeof value.EndpointId === 'number') &&
    (!('NewState' in value) || typeof value.NewState === 'boolean') &&
    (!('SensorFault' in value) || typeof value.SensorFault === 'number')
  );
}
// v8 ignore end
