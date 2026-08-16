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

/**
 * CHIP TestEventTrigger notes.
 *
 * The Matter command is GeneralDiagnostics.TestEventTrigger on endpoint 0. The command carries only:
 * - EnableKey: a 16-byte key accepted by the DUT.
 * - EventTrigger: a test-defined integer.
 *
 * The command does not carry an endpoint, cluster, attribute, or target value. Each CHIP test defines the
 * meaning of its EventTrigger values in the test source/YAML, so each supported trigger must be mapped
 * explicitly here. Keep these handlers gated to MATTERBRIDGE_CHIP_TEST through Matterbridge.createServerNode().
 *
 * To add a new trigger-backed CHIP test:
 * 1. Read the CHIP test source and copy its exact EventTrigger constants.
 * 2. Check the key the test really sends. Python tests often use 000102...0f. YAML tests may define their
 *    own default key in the YAML config, such as SmokeCOAlarm's 001122...eeff key, so do not add a
 *    chipTests.json --hex-arg unless the YAML default is wrong for that specific test. Add only the required
 *    CHIP-test key to isChipTestEnableKey().
 * 3. Add a small handler in handleChipTestEventTrigger() that updates the target endpoint with setCluster()
 *    or setAttribute(), then emits any event the test reads with triggerEvent().
 * 4. Keep unsupported EventTrigger values delegated to GeneralDiagnosticsServer so they return InvalidCommand.
 * 5. If a failed/interrupted run can persist dirty state, add a resetClusterGlobs entry and set resetBefore
 *    on that chipTests.json entry.
 */

/**
 * CHIP app-pipe notes.
 *
 * The app-pipe is a separate test backchannel from TestEventTrigger. Some Python CHIP tests call
 * write_to_app_pipe()/--app-pipe and write one JSON command per line into a named pipe. The command payload
 * can include fields such as Name, EndpointId, NewState, Occupancy, SensorFault, or SoilMoistureValue.
 *
 * Matterbridge creates /tmp/matterbridge-chip-test-app-pipe only when MATTERBRIDGE_CHIP_TEST is set, and
 * createChipTestAppPipe() is called from the CHIP-test bootstrap. The pipe is Linux-only test glue; do not
 * use it for production behavior and do not make normal runtime shutdown depend on it.
 *
 * To add a new app-pipe-backed CHIP test:
 * 1. Read the CHIP Python test and copy the exact JSON command name and fields passed to write_to_app_pipe().
 * 2. Extend ChipTestAppPipeCommand only with the fields that test actually writes.
 * 3. Add one small case in handleChipTestAppPipeCommand(), resolving the endpoint with getChipTestEndpoint().
 * 4. Update state through Matterbridge helpers such as setCluster() or setAttribute() where possible.
 * 5. Keep invalid or unknown commands logged and ignored so one malformed line cannot break the pipe loop.
 */

/**
 * CHIP container sync notes.
 *
 * After changing local TypeScript, frontend, or PICS files, rebuild locally and copy the built artifacts
 * into the running chip-test container before rerunning CHIP tests. Copy directory contents with `/.` so
 * docker replaces the target contents instead of nesting another `dist` or `build` folder.
 *
 * Usual sync commands:
 * - docker cp dist/. chip-test:/root/matterbridge/dist/
 * - docker cp packages/core/dist/. chip-test:/root/matterbridge/packages/core/dist/
 * - docker cp packages/types/dist/. chip-test:/root/matterbridge/packages/types/dist/
 * - docker cp apps/frontend/build/. chip-test:/root/matterbridge/apps/frontend/build/
 * - docker cp docker/chip-test/*.pics chip-test:/root/
 *
 * Restart the existing container without recreating it after copying runtime code:
 * - docker restart chip-test
 *
 * Then run focused CHIP checks through the repository script, for example:
 * - node scripts/run-matterbridge-chip-tests.mjs --test "SmokeCOAlarm"
 */

import { spawnSync } from 'node:child_process';
import { closeSync, constants, existsSync, openSync, readSync, unlinkSync } from 'node:fs';

import { BasicInformationServer } from '@matter/node/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { GeneralDiagnosticsServer } from '@matter/node/behaviors/general-diagnostics';
import { Status, StatusResponseError } from '@matter/types';
import type { GeneralDiagnostics } from '@matter/types/clusters/general-diagnostics';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { EndpointNumber } from '@matter/types/datatype';

import { MatterbridgeOccupancySensingServer } from './behaviors/occupancySensingServer.js';
import { cliEmitter } from './cliEmitter.js';
import type { Matterbridge } from './matterbridge.js';
import { getSupportedDeviceType } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

type ChipTestAppPipeCommand = {
  Name?: string;
  EndpointId?: number;
  NewState?: boolean;
  Occupancy?: number;
  SensorFault?: number;
  SoilMoistureValue?: number;
};

const chipTestAppPipePath = '/tmp/matterbridge-chip-test-app-pipe';
const chipTestValidEventTrigger = 0xfffffffffff10000n;
const smokeCoAlarmWarningSmokeAlarmTrigger = 0x005c000000000090n;
const smokeCoAlarmCriticalSmokeAlarmTrigger = 0x005c00000000009cn;
const smokeCoAlarmSmokeAlarmClearTrigger = 0x005c0000000000a0n;
const smokeCoAlarmWarningCoAlarmTrigger = 0xffffffff00000091n;
const smokeCoAlarmCriticalCoAlarmTrigger = 0xffffffff0000009dn;
const smokeCoAlarmCoAlarmClearTrigger = 0xffffffff000000a1n;
const smokeCoAlarmYamlWarningCoAlarmTrigger = 0x005c000000000091n;
const smokeCoAlarmYamlCriticalCoAlarmTrigger = 0x005c00000000009dn;
const smokeCoAlarmYamlCoAlarmClearTrigger = 0x005c0000000000a1n;
const smokeCoAlarmWarningBatteryAlertTrigger = 0xffffffff00000095n;
const smokeCoAlarmCriticalBatteryAlertTrigger = 0xffffffff0000009en;
const smokeCoAlarmBatteryAlertClearTrigger = 0xffffffff000000a5n;
const smokeCoAlarmYamlWarningBatteryAlertTrigger = 0x005c000000000095n;
const smokeCoAlarmYamlBatteryAlertClearTrigger = 0x005c0000000000a5n;
const smokeCoAlarmHardwareFaultAlertTrigger = 0xffffffff00000093n;
const smokeCoAlarmHardwareFaultAlertClearTrigger = 0xffffffff000000a3n;
const smokeCoAlarmEndOfServiceAlertTrigger = 0xffffffff0000009an;
const smokeCoAlarmEndOfServiceAlertClearTrigger = 0xffffffff000000aan;
const smokeCoAlarmDeviceMutedTrigger = 0x005c00000000009bn;
const smokeCoAlarmDeviceMutedClearTrigger = 0x005c0000000000abn;

export const chipTestEnableKey = Uint8Array.from({ length: 16 }, (_, index) => index);
const smokeCoAlarmChipTestEnableKey = Uint8Array.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
let chipTestMatterbridge: Matterbridge | undefined;
let closeChipTestAppPipe: (() => void) | undefined;

export class MatterbridgeGeneralDiagnosticsServer extends GeneralDiagnosticsServer {
  override initialize(): void {
    this.state.testEventTriggersEnabled = true;
    this.state.deviceTestEnableKey = chipTestEnableKey;
    super.initialize();
  }

  override async testEventTrigger({ eventTrigger, enableKey }: GeneralDiagnostics.TestEventTriggerRequest): Promise<void> {
    const keyData = Uint8Array.from(enableKey);
    if (keyData.every((byte) => byte === 0)) {
      throw new StatusResponseError('Invalid test enable key, all zeros', Status.ConstraintError);
    }
    if (!isChipTestEnableKey(keyData)) {
      throw new StatusResponseError('Invalid test enable key', Status.ConstraintError);
    }
    if (BigInt(eventTrigger) === chipTestValidEventTrigger) return;
    if (await handleChipTestEventTrigger(BigInt(eventTrigger))) return;
    super.triggerTestEvent(eventTrigger);
  }
}

function isChipTestEnableKey(keyData: Uint8Array): boolean {
  return equalsBytes(keyData, chipTestEnableKey) || equalsBytes(keyData, smokeCoAlarmChipTestEnableKey);
}

function equalsBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index]);
}

export async function createChipTestDevices(matterbridge: Matterbridge): Promise<void> {
  if (!process.env.MATTERBRIDGE_CHIP_TEST || !process.env.MATTERBRIDGE_RUN_CHIP_TEST || matterbridge.bridgeMode !== 'bridge' || !matterbridge.aggregatorNode) return;
  chipTestMatterbridge = matterbridge;
  const serverNode = matterbridge.serverNode;
  const aggregator = matterbridge.aggregatorNode;
  if (!serverNode || !aggregator) {
    matterbridge.log.error('CHIP test devices can only be created when the server node and aggregator node are available');
    return;
  }
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

  // Chapter 2 - Utility Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { number: EndpointNumber(2_06) });
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createDefaultElectricalEnergyMeasurementClusterServer(100_000_000, 10_000_000);
  await registerDevice(ep, 'Electrical Sensor', 'UTILITY-02-06');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { number: EndpointNumber(2_06_1) });
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createImportedElectricalEnergyMeasurementClusterServer(200_000_000);
  await registerDevice(ep, 'Electrical Sensor Imported', 'UTILITY-02-06-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { number: EndpointNumber(2_06_2) });
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createExportedElectricalEnergyMeasurementClusterServer(50_000_000);
  await registerDevice(ep, 'Electrical Sensor Exported', 'UTILITY-02-06-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DeviceEnergyManagement')!, bridgedNode, powerSource], { number: EndpointNumber(2_07) });
  ep.createDefaultDeviceEnergyManagementClusterServer();
  ep.createDefaultDeviceEnergyManagementModeClusterServer();
  await registerDevice(ep, 'Device Energy Management', 'UTILITY-02-07');

  // Chapter 7 - Sensor Devices

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ContactSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_01) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultBooleanStateClusterServer();
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Contact Sensor', 'SENSOR-07-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('LightSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_02) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultIlluminanceMeasurementClusterServer(1000, 1, 65534);
  await registerDevice(ep, 'Light Sensor', 'SENSOR-07-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OccupancySensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_03) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Occupancy Sensor', 'SENSOR-07-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('TemperatureSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_04) });
  ep.createDefaultPowerSourceReplaceableBatteryClusterServer();
  ep.createDefaultTemperatureMeasurementClusterServer(2000, -27315, 32767);
  await registerDevice(ep, 'Temperature Sensor', 'SENSOR-07-04');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('PressureSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_05) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultPressureMeasurementClusterServer(1013, 0, 2000);
  await registerDevice(ep, 'Pressure Sensor', 'SENSOR-07-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('FlowSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_06) });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createDefaultFlowMeasurementClusterServer(100, 0, 1000);
  await registerDevice(ep, 'Flow Sensor', 'SENSOR-07-06');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('HumiditySensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_07) });
  ep.createDefaultPowerSourceRechargeableBatteryClusterServer();
  ep.createDefaultRelativeHumidityMeasurementClusterServer(5000, 0, 10000);
  await registerDevice(ep, 'Humidity Sensor', 'SENSOR-07-07');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OnOffSensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_08) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'On/Off Sensor', 'SENSOR-07-08');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { number: EndpointNumber(7_09) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Smoke/CO Alarm', 'SENSOR-07-09');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { number: EndpointNumber(7_09_1) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createSmokeOnlySmokeCOAlarmClusterServer();
  await registerDevice(ep, 'Smoke Alarm', 'SENSOR-07-09-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { number: EndpointNumber(7_09_2) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createCoOnlySmokeCOAlarmClusterServer();
  await registerDevice(ep, 'CO Alarm', 'SENSOR-07-09-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('AirQualitySensor')!, bridgedNode, powerSource], { number: EndpointNumber(7_10) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultTvocMeasurementClusterServer(50, undefined, undefined, undefined, 0, 1000);
  ep.addOptionalClusterServers();
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

export function createChipTestAppPipe(matterbridge: Matterbridge): void {
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
        await handleChipTestAppPipeCommand(matterbridge, command);
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

async function handleChipTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (
    eventTrigger !== smokeCoAlarmWarningSmokeAlarmTrigger &&
    eventTrigger !== smokeCoAlarmCriticalSmokeAlarmTrigger &&
    eventTrigger !== smokeCoAlarmSmokeAlarmClearTrigger &&
    eventTrigger !== smokeCoAlarmWarningCoAlarmTrigger &&
    eventTrigger !== smokeCoAlarmCriticalCoAlarmTrigger &&
    eventTrigger !== smokeCoAlarmCoAlarmClearTrigger &&
    eventTrigger !== smokeCoAlarmYamlWarningCoAlarmTrigger &&
    eventTrigger !== smokeCoAlarmYamlCriticalCoAlarmTrigger &&
    eventTrigger !== smokeCoAlarmYamlCoAlarmClearTrigger &&
    eventTrigger !== smokeCoAlarmWarningBatteryAlertTrigger &&
    eventTrigger !== smokeCoAlarmCriticalBatteryAlertTrigger &&
    eventTrigger !== smokeCoAlarmBatteryAlertClearTrigger &&
    eventTrigger !== smokeCoAlarmYamlWarningBatteryAlertTrigger &&
    eventTrigger !== smokeCoAlarmYamlBatteryAlertClearTrigger &&
    eventTrigger !== smokeCoAlarmHardwareFaultAlertTrigger &&
    eventTrigger !== smokeCoAlarmHardwareFaultAlertClearTrigger &&
    eventTrigger !== smokeCoAlarmEndOfServiceAlertTrigger &&
    eventTrigger !== smokeCoAlarmEndOfServiceAlertClearTrigger &&
    eventTrigger !== smokeCoAlarmDeviceMutedTrigger &&
    eventTrigger !== smokeCoAlarmDeviceMutedClearTrigger
  ) {
    return false;
  }
  return await handleSmokeCoAlarmTestEventTrigger(eventTrigger);
}

async function handleSmokeCoAlarmTestEventTrigger(eventTrigger: bigint): Promise<boolean> {
  if (!chipTestMatterbridge) return false;
  const endpoint = getChipTestEndpoint(chipTestMatterbridge, 709);
  if (!endpoint) return false;

  switch (eventTrigger) {
    case smokeCoAlarmWarningSmokeAlarmTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        smokeState: SmokeCoAlarm.AlarmState.Warning,
        expressedState: SmokeCoAlarm.ExpressedState.SmokeAlarm,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'smokeAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Warning }, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmCriticalSmokeAlarmTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        smokeState: SmokeCoAlarm.AlarmState.Critical,
        expressedState: SmokeCoAlarm.ExpressedState.SmokeAlarm,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'smokeAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Critical }, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmSmokeAlarmClearTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        smokeState: SmokeCoAlarm.AlarmState.Normal,
        expressedState: getSmokeCoAlarmExpressedState(endpoint, { smokeState: SmokeCoAlarm.AlarmState.Normal }),
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmWarningCoAlarmTrigger:
    case smokeCoAlarmYamlWarningCoAlarmTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        coState: SmokeCoAlarm.AlarmState.Warning,
        expressedState: SmokeCoAlarm.ExpressedState.CoAlarm,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'coAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Warning }, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmCriticalCoAlarmTrigger:
    case smokeCoAlarmYamlCriticalCoAlarmTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        coState: SmokeCoAlarm.AlarmState.Critical,
        expressedState: SmokeCoAlarm.ExpressedState.CoAlarm,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'coAlarm', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Critical }, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmCoAlarmClearTrigger:
    case smokeCoAlarmYamlCoAlarmClearTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        coState: SmokeCoAlarm.AlarmState.Normal,
        expressedState: getSmokeCoAlarmExpressedState(endpoint, { coState: SmokeCoAlarm.AlarmState.Normal }),
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmWarningBatteryAlertTrigger:
    case smokeCoAlarmYamlWarningBatteryAlertTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        batteryAlert: SmokeCoAlarm.AlarmState.Warning,
        expressedState: getSmokeCoAlarmExpressedState(endpoint, { batteryAlert: SmokeCoAlarm.AlarmState.Warning }),
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'lowBattery', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Warning }, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmCriticalBatteryAlertTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        batteryAlert: SmokeCoAlarm.AlarmState.Critical,
        expressedState: getSmokeCoAlarmExpressedState(endpoint, { batteryAlert: SmokeCoAlarm.AlarmState.Critical }),
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'lowBattery', { alarmSeverityLevel: SmokeCoAlarm.AlarmState.Critical }, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmBatteryAlertClearTrigger:
    case smokeCoAlarmYamlBatteryAlertClearTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        batteryAlert: SmokeCoAlarm.AlarmState.Normal,
        expressedState: getSmokeCoAlarmExpressedState(endpoint, { batteryAlert: SmokeCoAlarm.AlarmState.Normal }),
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmHardwareFaultAlertTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        hardwareFaultAlert: true,
        expressedState: SmokeCoAlarm.ExpressedState.HardwareFault,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'hardwareFault', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmHardwareFaultAlertClearTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        hardwareFaultAlert: false,
        expressedState: SmokeCoAlarm.ExpressedState.Normal,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmEndOfServiceAlertTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        endOfServiceAlert: SmokeCoAlarm.EndOfService.Expired,
        expressedState: SmokeCoAlarm.ExpressedState.EndOfService,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'endOfService', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmEndOfServiceAlertClearTrigger:
      await endpoint.setCluster(SmokeCoAlarm, {
        endOfServiceAlert: SmokeCoAlarm.EndOfService.Normal,
        expressedState: SmokeCoAlarm.ExpressedState.Normal,
      }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'allClear', undefined, chipTestMatterbridge.log);
      return true;
    case smokeCoAlarmDeviceMutedTrigger:
      if (
        endpoint.getAttribute(SmokeCoAlarm.id, 'smokeState') === SmokeCoAlarm.AlarmState.Warning ||
        endpoint.getAttribute(SmokeCoAlarm.id, 'coState') === SmokeCoAlarm.AlarmState.Warning
      ) {
        await endpoint.setCluster(SmokeCoAlarm, { deviceMuted: SmokeCoAlarm.MuteState.Muted }, chipTestMatterbridge.log);
        await endpoint.triggerEvent(SmokeCoAlarm, 'alarmMuted', undefined, chipTestMatterbridge.log);
      }
      return true;
    case smokeCoAlarmDeviceMutedClearTrigger:
      await endpoint.setCluster(SmokeCoAlarm, { deviceMuted: SmokeCoAlarm.MuteState.NotMuted }, chipTestMatterbridge.log);
      await endpoint.triggerEvent(SmokeCoAlarm, 'muteEnded', undefined, chipTestMatterbridge.log);
      return true;
    default:
      return false;
  }
}

function getSmokeCoAlarmExpressedState(
  endpoint: MatterbridgeEndpoint,
  state: { smokeState?: SmokeCoAlarm.AlarmState; coState?: SmokeCoAlarm.AlarmState; batteryAlert?: SmokeCoAlarm.AlarmState } = {},
): SmokeCoAlarm.ExpressedState {
  const smokeState = state.smokeState ?? endpoint.getAttribute(SmokeCoAlarm.id, 'smokeState');
  const coState = state.coState ?? endpoint.getAttribute(SmokeCoAlarm.id, 'coState');
  const batteryAlert = state.batteryAlert ?? endpoint.getAttribute(SmokeCoAlarm.id, 'batteryAlert');

  if (smokeState !== SmokeCoAlarm.AlarmState.Normal) return SmokeCoAlarm.ExpressedState.SmokeAlarm;
  if (batteryAlert !== SmokeCoAlarm.AlarmState.Normal) return SmokeCoAlarm.ExpressedState.BatteryAlert;
  if (coState !== SmokeCoAlarm.AlarmState.Normal) return SmokeCoAlarm.ExpressedState.CoAlarm;
  return SmokeCoAlarm.ExpressedState.Normal;
}

async function handleChipTestAppPipeCommand(matterbridge: Matterbridge, command: ChipTestAppPipeCommand): Promise<void> {
  const endpointId =
    command.Name === 'SetOccupancy' && command.EndpointId === 1 ? 703 : (command.EndpointId ?? (command.Name === 'SimulateConfigurationVersionChange' ? 701 : undefined));
  if (endpointId === undefined) {
    matterbridge.log.warn(`Ignoring CHIP test app pipe command without EndpointId: ${JSON.stringify(command)}`);
    return;
  }
  const endpoint = getChipTestEndpoint(matterbridge, endpointId);
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
      if (matterbridge.serverNode) {
        const configurationVersion = (matterbridge.serverNode.stateOf(BasicInformationServer).configurationVersion ?? 1) + 1;
        await matterbridge.serverNode.setStateOf(BasicInformationServer, { configurationVersion });
        matterbridge.log.info(`CHIP test app pipe set BasicInformation.ConfigurationVersion to ${configurationVersion} on endpoint 0`);
      }
      endpoint.configurationVersion = (endpoint.stateOf(BridgedDeviceBasicInformationServer).configurationVersion ?? 1) + 1;
      await endpoint.setStateOf(BridgedDeviceBasicInformationServer, { configurationVersion: endpoint.configurationVersion });
      matterbridge.log.info(`CHIP test app pipe set BridgedDeviceBasicInformation.ConfigurationVersion to ${endpoint.configurationVersion} on endpoint ${endpointId}`);
      return;
    case 'SetOccupancy':
      await endpoint.setStateOf(MatterbridgeOccupancySensingServer, { occupancy: { occupied: Boolean(command.Occupancy) } });
      matterbridge.log.info(`CHIP test app pipe set OccupancySensing.Occupancy to ${command.Occupancy ?? 0} on endpoint ${endpointId}`);
      return;
    case 'SetSimulatedSoilMoisture':
      await endpoint.setStateOf(endpoint.behaviors.supported.soilMeasurement, { soilMoistureMeasuredValue: command.SoilMoistureValue ?? null });
      matterbridge.log.info(`CHIP test app pipe set SoilMeasurement.SoilMoistureMeasuredValue to ${command.SoilMoistureValue ?? null} on endpoint ${endpointId}`);
      return;
    default:
      matterbridge.log.warn(`Ignoring unsupported CHIP test app pipe command: ${JSON.stringify(command)}`);
  }
}

function getChipTestEndpoint(matterbridge: Matterbridge, endpointId: number): MatterbridgeEndpoint | undefined {
  const aggregatorEndpoint = matterbridge.aggregatorNode;
  if (!aggregatorEndpoint) return undefined;
  const endpoints = [aggregatorEndpoint, ...aggregatorEndpoint.parts];
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
    (!('Occupancy' in value) || typeof value.Occupancy === 'number') &&
    (!('SensorFault' in value) || typeof value.SensorFault === 'number') &&
    (!('SoilMoistureValue' in value) || typeof value.SoilMoistureValue === 'number')
  );
}
// v8 ignore end
